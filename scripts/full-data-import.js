/**
 * Full Data Import Script
 * 
 * This script imports ALL laundromat records from the Excel file
 * with optimized batch processing and resume capabilities.
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set batch size for processing
const BATCH_SIZE = 100; // Process 100 records at a time

// State abbreviation to full name mapping
const stateNameMap = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  if (!abbr) return 'Unknown State';
  if (abbr.length > 2) return abbr; // Already a full name
  return stateNameMap[abbr.toUpperCase()] || abbr;
}

/**
 * Simple slug generator with uniqueness
 */
function generateSlug(text, suffix = '') {
  if (!text) {
    const randomId = Math.floor(Math.random() * 1000000);
    return `laundromat-${randomId}`;
  }
  
  let slug = text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (suffix) {
    slug += `-${suffix}`;
  }
  
  return slug;
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  const cityState = record.city && record.state ? 
    `- ${record.city}, ${getStateNameFromAbbr(record.state)}` : '';
  
  return `${record.name} ${cityState} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  const cityState = record.city && record.state ? 
    `in ${record.city}, ${getStateNameFromAbbr(record.state)}` : '';
  
  return `${record.name} is a laundromat ${cityState} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me"
  ];
  
  if (record.city) tags.push(`laundromat in ${record.city}`);
  if (record.state) tags.push(`laundromat in ${getStateNameFromAbbr(record.state)}`);
  if (record.city && record.state) tags.push(`laundromat in ${record.city}, ${getStateNameFromAbbr(record.state)}`);
  
  return tags;
}

/**
 * Load progress from file if it exists
 */
function loadProgress() {
  const progressFilePath = path.join(process.cwd(), 'data', 'import-progress.json');
  
  if (fs.existsSync(progressFilePath)) {
    try {
      const progress = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
      return progress;
    } catch (e) {
      console.error('Error reading progress file:', e);
    }
  }
  
  return {
    nextIndex: 0,
    totalImported: 0,
    totalSkipped: 0,
    stateCache: {},
    cityCache: {},
    startTime: new Date().toISOString()
  };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  const progressFilePath = path.join(process.cwd(), 'data', 'import-progress.json');
  
  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Add last update timestamp
    progress.lastUpdate = new Date().toISOString();
    
    // Calculate ETA if possible
    if (progress.totalRecords && progress.nextIndex > 0 && progress.startTime) {
      const startTime = new Date(progress.startTime);
      const currentTime = new Date();
      const elapsedMs = currentTime - startTime;
      const msPerRecord = elapsedMs / progress.nextIndex;
      const remainingRecords = progress.totalRecords - progress.nextIndex;
      const remainingMs = remainingRecords * msPerRecord;
      
      // Format nicely
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      
      progress.eta = `${remainingHours}h ${remainingMinutes}m`;
      progress.percentComplete = Math.round((progress.nextIndex / progress.totalRecords) * 100);
    }
    
    fs.writeFileSync(progressFilePath, JSON.stringify(progress, null, 2));
  } catch (e) {
    console.error('Error saving progress:', e);
  }
}

/**
 * Make sure a state exists in the database
 */
async function ensureStateExists(client, stateAbbr, stateCache) {
  // Check cache first
  if (stateCache[stateAbbr]) {
    return stateCache[stateAbbr];
  }
  
  const stateName = getStateNameFromAbbr(stateAbbr);
  const stateSlug = generateSlug(stateName);
  
  // Check if state exists
  const stateResult = await client.query(
    'SELECT id FROM states WHERE name = $1',
    [stateName]
  );
  
  if (stateResult.rows.length > 0) {
    // Store in cache
    stateCache[stateAbbr] = stateResult.rows[0].id;
    return stateResult.rows[0].id;
  }
  
  // Create state if it doesn't exist
  const newState = await client.query(
    'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
    [stateName, stateAbbr.toUpperCase(), stateSlug, 0]
  );
  
  // Store in cache
  stateCache[stateAbbr] = newState.rows[0].id;
  return newState.rows[0].id;
}

/**
 * Make sure a city exists in the database
 */
async function ensureCityExists(client, cityName, stateName, cityCache) {
  const cacheKey = `${cityName}|${stateName}`;
  
  // Check cache first
  if (cityCache[cacheKey]) {
    return cityCache[cacheKey];
  }
  
  const citySlug = generateSlug(cityName);
  
  // Check if city exists
  try {
    const cityResult = await client.query(
      'SELECT id FROM cities WHERE name = $1 AND state = $2',
      [cityName, stateName]
    );
    
    if (cityResult.rows.length > 0) {
      // Store in cache
      cityCache[cacheKey] = cityResult.rows[0].id;
      return cityResult.rows[0].id;
    }
    
    // Create city if it doesn't exist
    try {
      const newCity = await client.query(
        'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
        [cityName, stateName, citySlug, 0]
      );
      
      // Store in cache
      cityCache[cacheKey] = newCity.rows[0].id;
      return newCity.rows[0].id;
    } catch (error) {
      // If there's a duplicate slug, add a suffix and try again
      if (error.code === '23505' && error.constraint === 'cities_slug_unique') {
        const randomSuffix = Math.floor(Math.random() * 10000);
        const newSlug = `${citySlug}-${randomSuffix}`;
        
        const newCity = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
          [cityName, stateName, newSlug, 0]
        );
        
        // Store in cache
        cityCache[cacheKey] = newCity.rows[0].id;
        return newCity.rows[0].id;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`Error ensuring city exists (${cityName}, ${stateName}):`, error);
    throw error;
  }
}

/**
 * Check if laundromat already exists
 */
async function laundryExists(client, name, address, city, state) {
  const result = await client.query(
    'SELECT id FROM laundromats WHERE name = $1 AND address = $2 AND city = $3 AND state = $4',
    [name, address, city, state]
  );
  
  return result.rows.length > 0;
}

/**
 * Import a batch of laundromats
 */
async function importBatch(client, records, startIndex, stateCache, cityCache) {
  let imported = 0;
  let skipped = 0;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordIndex = startIndex + i;
    
    try {
      // Fill in missing values with defaults
      const name = record.name || `Laundromat ${recordIndex}`;
      const address = record.address || '123 Main St';
      const city = record.city || 'Unknown City';
      const stateAbbr = record.state || 'TX';
      const stateName = getStateNameFromAbbr(stateAbbr);
      const zip = record.zip || '00000';
      
      // Skip if this laundromat already exists
      const exists = await laundryExists(client, name, address, city, stateName);
      if (exists) {
        console.log(`Skipping existing: ${name} (${city}, ${stateName})`);
        skipped++;
        continue;
      }
      
      // Generate a unique slug
      let slug = generateSlug(`${name}-${city}-${stateName}`);
      
      // Add a random suffix if needed to avoid duplicates
      const slugQuery = await client.query(
        'SELECT COUNT(*) FROM laundromats WHERE slug = $1',
        [slug]
      );
      
      if (parseInt(slugQuery.rows[0].count) > 0) {
        slug = generateSlug(`${name}-${city}-${stateName}`, Math.floor(Math.random() * 10000));
      }
      
      // Generate SEO fields
      const seoTitle = generateSeoTitle({ name, city, state: stateName });
      const seoDescription = generateSeoDescription({ name, city, state: stateName });
      const seoTags = generateSeoTags({ name, city, state: stateName });
      
      // Get/ensure state and city
      const stateId = await ensureStateExists(client, stateAbbr, stateCache);
      const cityId = await ensureCityExists(client, city, stateName, cityCache);
      
      // Insert laundromat
      await client.query(`
        INSERT INTO laundromats (
          name, slug, address, city, state, zip, phone, website,
          latitude, longitude, rating, review_count, hours, services,
          is_featured, is_premium, is_verified, description, created_at,
          seo_title, seo_description, seo_tags, premium_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      `, [
        name,
        slug,
        address,
        city,
        stateName,
        zip,
        record.phone || '',
        record.website || null,
        record.latitude || '0',
        record.longitude || '0',
        record.rating || '0',
        record.review_count || 0,
        record.hours || 'Call for hours',
        JSON.stringify(record.services || []),
        false, // is_featured
        false, // is_premium
        false, // is_verified
        `${name} is a laundromat located in ${city}, ${stateName}.`,
        new Date(),
        seoTitle,
        seoDescription,
        JSON.stringify(seoTags),
        60 // premium_score
      ]);
      
      // Update counts
      await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
      await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
      
      if (recordIndex % 10 === 0) {
        console.log(`Imported ${recordIndex} of ${records.length + startIndex}: ${name} (${city}, ${stateName})`);
      }
      
      imported++;
    } catch (error) {
      console.error(`Error importing #${recordIndex}:`, error.message);
      skipped++;
    }
  }
  
  return { imported, skipped };
}

/**
 * Import all laundromats from the Excel file
 */
async function importData() {
  const client = await pool.connect();
  
  try {
    console.log('Starting full laundromat data import...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.log('Available files:');
      console.log(fs.readdirSync(path.join(process.cwd(), 'attached_assets')));
      throw new Error('Excel file not found');
    }
    
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${allData.length} total records`);
    
    // Load progress
    const progress = loadProgress();
    if (!progress.startTime) {
      progress.startTime = new Date().toISOString();
    }
    progress.totalRecords = allData.length;
    
    if (!progress.stateCache) progress.stateCache = {};
    if (!progress.cityCache) progress.cityCache = {};
    
    // Save initial progress
    saveProgress(progress);
    
    // Start from where we left off
    const startIndex = progress.nextIndex || 0;
    console.log(`Starting from record ${startIndex} of ${allData.length}`);
    
    // Process in batches
    let totalImported = progress.totalImported || 0;
    let totalSkipped = progress.totalSkipped || 0;
    
    // Process all data in batches
    for (let i = startIndex; i < allData.length; i += BATCH_SIZE) {
      const batch = allData.slice(i, Math.min(i + BATCH_SIZE, allData.length));
      
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(allData.length / BATCH_SIZE)}`);
      console.log(`Records ${i + 1} to ${i + batch.length} of ${allData.length}`);
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Import batch
        const { imported, skipped } = await importBatch(client, batch, i, progress.stateCache, progress.cityCache);
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Update progress
        totalImported += imported;
        totalSkipped += skipped;
        progress.nextIndex = i + batch.length;
        progress.totalImported = totalImported;
        progress.totalSkipped = totalSkipped;
        
        // Save progress
        saveProgress(progress);
        
        console.log(`
        Batch completed:
        - Imported: ${imported}
        - Skipped: ${skipped}
        - Total progress: ${progress.nextIndex}/${allData.length} (${Math.round((progress.nextIndex / allData.length) * 100)}%)
        - Estimated time remaining: ${progress.eta || 'calculating...'}
        `);
      } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Error processing batch:', error);
        
        // Save progress anyway so we can resume
        progress.nextIndex = i;
        progress.totalImported = totalImported;
        progress.totalSkipped = totalSkipped;
        saveProgress(progress);
      }
    }
    
    console.log(`
    Import completed:
    - Total records: ${allData.length}
    - Total imported: ${totalImported}
    - Total skipped: ${totalSkipped}
    `);
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.log('Starting full laundromat data import...');
importData().catch(console.error);