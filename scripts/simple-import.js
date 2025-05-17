/**
 * Simple Import Script
 * 
 * This script imports laundromats directly from the Excel file
 * with minimal complexity to quickly populate our database.
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

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  if (!abbr) return 'Unknown State';
  if (abbr.length > 2) return abbr; // Already a full name
  return stateNameMap[abbr.toUpperCase()] || abbr;
}

/**
 * Simple slug generator
 */
function generateSlug(text) {
  if (!text) return `laundromat-${Math.floor(Math.random() * 1000000)}`;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
 * Make sure a state exists in the database
 */
async function ensureStateExists(client, stateAbbr) {
  const stateName = getStateNameFromAbbr(stateAbbr);
  const stateSlug = generateSlug(stateName);
  
  // Check if state exists
  const stateResult = await client.query(
    'SELECT id FROM states WHERE name = $1',
    [stateName]
  );
  
  if (stateResult.rows.length > 0) {
    return stateResult.rows[0].id;
  }
  
  // Create state if it doesn't exist
  const newState = await client.query(
    'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
    [stateName, stateAbbr.toUpperCase(), stateSlug, 0]
  );
  
  return newState.rows[0].id;
}

/**
 * Make sure a city exists in the database
 */
async function ensureCityExists(client, cityName, stateName) {
  const citySlug = generateSlug(cityName);
  
  // Check if city exists
  const cityResult = await client.query(
    'SELECT id FROM cities WHERE name = $1 AND state = $2',
    [cityName, stateName]
  );
  
  if (cityResult.rows.length > 0) {
    return cityResult.rows[0].id;
  }
  
  // Create city if it doesn't exist
  const newCity = await client.query(
    'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
    [cityName, stateName, citySlug, 0]
  );
  
  return newCity.rows[0].id;
}

/**
 * Import a single laundromat record
 */
async function importLaundromat(client, record) {
  try {
    // Fill in missing values with defaults
    const name = record.name || `Laundromat in ${record.city || 'Unknown Location'}`;
    const address = record.address || '123 Main St';
    const city = record.city || 'Unknown City';
    const stateAbbr = record.state || 'TX';
    const stateName = getStateNameFromAbbr(stateAbbr);
    const zip = record.zip || '00000';
    
    // Generate slug
    const slug = generateSlug(`${name}-${city}-${stateName}`);
    
    // Generate SEO fields
    const seoTitle = generateSeoTitle({ name, city, state: stateName });
    const seoDescription = generateSeoDescription({ name, city, state: stateName });
    const seoTags = generateSeoTags({ name, city, state: stateName });
    
    // Check if this laundromat already exists
    const existingResult = await client.query(
      'SELECT id FROM laundromats WHERE name = $1 AND address = $2 AND city = $3 AND state = $4',
      [name, address, city, stateName]
    );
    
    if (existingResult.rows.length > 0) {
      console.log(`Skipping duplicate: ${name} in ${city}, ${stateName}`);
      return false;
    }
    
    // Get/create state
    const stateId = await ensureStateExists(client, stateAbbr);
    
    // Get/create city
    const cityId = await ensureCityExists(client, city, stateName);
    
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
    
    console.log(`Imported: ${name} (${city}, ${stateName})`);
    return true;
  } catch (error) {
    console.error(`Error importing laundromat ${record.name}:`, error.message);
    return false;
  }
}

/**
 * Import laundromats from each state
 */
async function importLaundromats() {
  const client = await pool.connect();
  
  try {
    console.log('Starting laundromat import...');
    
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
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${data.length} total records`);
    
    // Group data by state
    const stateMap = new Map();
    data.forEach(record => {
      if (!record.state) return;
      
      if (!stateMap.has(record.state)) {
        stateMap.set(record.state, []);
      }
      
      stateMap.get(record.state).push(record);
    });
    
    console.log(`Found data for ${stateMap.size} states`);
    
    // Set batch size per state
    const batchSize = 5; // Small batch size to avoid timeouts
    
    // Start transaction
    await client.query('BEGIN');
    
    // Import 5 laundromats from each state
    let totalImported = 0;
    let totalSkipped = 0;
    
    for (const [stateAbbr, records] of stateMap.entries()) {
      const stateName = getStateNameFromAbbr(stateAbbr);
      console.log(`\nProcessing ${stateName} (${records.length} records)...`);
      
      // Select a random sample of records
      const stateSample = records
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(batchSize, records.length));
      
      console.log(`Selected ${stateSample.length} samples from ${stateName}`);
      
      let stateSuccessCount = 0;
      for (const record of stateSample) {
        const success = await importLaundromat(client, record);
        if (success) {
          stateSuccessCount++;
          totalImported++;
        } else {
          totalSkipped++;
        }
      }
      
      console.log(`Successfully imported ${stateSuccessCount} laundromats for ${stateName}`);
      
      // Commit after each state to ensure data is saved even if script times out
      await client.query('COMMIT');
      await client.query('BEGIN');
    }
    
    // Final commit
    await client.query('COMMIT');
    
    console.log(`
    Import completed:
    - States: ${stateMap.size}
    - Imported: ${totalImported}
    - Skipped: ${totalSkipped}
    - Total processed: ${totalImported + totalSkipped}
    `);
    
  } catch (error) {
    console.error('Error during import:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.log('Starting simple laundromat import...');
importLaundromats().catch(console.error);