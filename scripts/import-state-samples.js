/**
 * State Sample Import Script
 * 
 * This script imports a representative sample of laundromats from each state
 * to provide comprehensive nationwide coverage quickly.
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

// Configure how many laundromats to import per state
const LAUNDROMATS_PER_STATE = 50;

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  if (!abbr) return 'Unknown State';
  if (abbr.length > 2) return abbr; // Already a full name
  return stateNameMap[abbr.toUpperCase()] || abbr;
}

/**
 * Generate a slug for a laundromat
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
    `- ${record.city}, ${record.state}` : '';
  
  return `${record.name} ${cityState} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  const cityState = record.city && record.state ? 
    `in ${record.city}, ${record.state}` : '';
  
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
  if (record.state) tags.push(`laundromat in ${record.state}`);
  if (record.city && record.state) tags.push(`laundromat in ${record.city}, ${record.state}`);
  
  return tags;
}

/**
 * Make sure a state exists in the database
 */
async function ensureStateExists(client, stateAbbr, stateCache = {}) {
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
async function ensureCityExists(client, cityName, stateName, cityCache = {}) {
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
 * Import a single laundromat
 */
async function importLaundromat(client, record, stateCache, cityCache) {
  try {
    // Fill in missing values with defaults
    const name = record.name || `Laundromat ${Math.floor(Math.random() * 10000)}`;
    const address = record.address || '123 Main St';
    const city = record.city || 'Unknown City';
    const stateAbbr = record.state || 'TX';
    const stateName = getStateNameFromAbbr(stateAbbr);
    const zip = record.zip || '00000';
    
    // Skip if this laundromat already exists
    const exists = await laundryExists(client, name, address, city, stateName);
    if (exists) {
      console.log(`Skipping existing: ${name} (${city}, ${stateName})`);
      return false;
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
    
    // Calculate premium features
    const isPremium = Math.random() < 0.15; // 15% of listings are premium
    const isFeatured = Math.random() < 0.05; // 5% of listings are featured
    const isVerified = Math.random() < 0.3; // 30% of listings are verified
    const premiumScore = Math.floor(Math.random() * 40) + 60; // Score between 60-100
    
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
      isFeatured, // is_featured
      isPremium, // is_premium
      isVerified, // is_verified
      `${name} is a laundromat located in ${city}, ${stateName}.`,
      new Date(),
      seoTitle,
      seoDescription,
      JSON.stringify(seoTags),
      premiumScore // premium_score
    ]);
    
    // Update counts
    await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
    await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
    
    console.log(`Imported: ${name} (${city}, ${stateName})`);
    return true;
  } catch (error) {
    console.error(`Error importing laundromat:`, error.message);
    return false;
  }
}

/**
 * Import laundromats from each state
 */
async function importStateSamples() {
  const client = await pool.connect();
  
  try {
    console.log('Starting state-by-state laundromat import...');
    
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
    
    // Group records by state
    const stateData = {};
    for (const record of allData) {
      const stateAbbr = record.state || 'unknown';
      if (!stateData[stateAbbr]) {
        stateData[stateAbbr] = [];
      }
      stateData[stateAbbr].push(record);
    }
    
    console.log(`Found data for ${Object.keys(stateData).length} states`);
    
    // Process each state
    const stateCache = {};
    const cityCache = {};
    let totalImported = 0;
    
    for (const stateAbbr in stateData) {
      const records = stateData[stateAbbr];
      const stateName = getStateNameFromAbbr(stateAbbr);
      
      console.log(`\nProcessing ${stateName} (${records.length} records)...`);
      
      // Sample records from this state
      const sampleCount = Math.min(LAUNDROMATS_PER_STATE, records.length);
      const samples = [];
      
      // If we have more records than needed, randomly select them
      if (records.length > sampleCount) {
        // Get a random sample of records
        const shuffled = [...records].sort(() => 0.5 - Math.random());
        samples.push(...shuffled.slice(0, sampleCount));
      } else {
        // Use all records if we don't have enough
        samples.push(...records);
      }
      
      console.log(`Selected ${samples.length} samples from ${stateName}`);
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        let stateImported = 0;
        
        // Import each sample
        for (const record of samples) {
          const success = await importLaundromat(client, record, stateCache, cityCache);
          if (success) {
            stateImported++;
          }
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        totalImported += stateImported;
        console.log(`Successfully imported ${stateImported} laundromats for ${stateName}`);
      } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error(`Error processing ${stateName}:`, error);
      }
    }
    
    console.log(`\nImport completed! Imported ${totalImported} laundromats across all states.`);
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importStateSamples().catch(console.error);