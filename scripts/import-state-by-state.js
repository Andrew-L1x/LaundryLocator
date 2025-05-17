/**
 * State-by-State Import Script
 * 
 * This script imports a representative sample of laundromats from every state
 * to provide comprehensive coverage of our database.
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
 * Get or create a state
 */
async function getOrCreateState(client, stateName) {
  // Generate slug
  const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Get state abbreviation
  const stateAbbr = Object.keys(stateNameMap).find(abbr => stateNameMap[abbr] === stateName) || '';
  
  // Check if state exists
  const existingState = await client.query(
    'SELECT id FROM states WHERE name = $1',
    [stateName]
  );
  
  if (existingState.rows.length > 0) {
    return existingState.rows[0].id;
  }
  
  // Create new state
  const newState = await client.query(
    'INSERT INTO states (name, slug, abbr, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
    [stateName, stateSlug, stateAbbr, 0]
  );
  
  return newState.rows[0].id;
}

/**
 * Get or create a city
 */
async function getOrCreateCity(client, cityName, stateId, stateName) {
  if (!cityName) return null;
  
  // Generate slug
  const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Check if city exists
  const existingCity = await client.query(
    'SELECT id FROM cities WHERE name = $1 AND state_id = $2',
    [cityName, stateId]
  );
  
  if (existingCity.rows.length > 0) {
    return existingCity.rows[0].id;
  }
  
  // Create new city
  const newCity = await client.query(
    'INSERT INTO cities (name, slug, state_id, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
    [cityName, citySlug, stateId, 0]
  );
  
  return newCity.rows[0].id;
}

/**
 * Import a single laundromat
 */
async function importLaundromat(client, record) {
  try {
    // Ensure required fields have values
    const name = record.name || `Laundromat in ${record.city || record.state}`;
    const address = record.address || '123 Main St';
    const city = record.city || 'Unknown City';
    const state = getStateNameFromAbbr(record.state);
    const zip = record.zip || '00000';
    
    // Get state ID
    const stateId = await getOrCreateState(client, state);
    
    // Get city ID
    const cityId = await getOrCreateCity(client, city, stateId, state);
    
    // Check if laundromat already exists
    const existing = await client.query(
      'SELECT id FROM laundromats WHERE name = $1 AND address = $2 AND city_id = $3',
      [name, address, cityId]
    );
    
    if (existing.rows.length > 0) {
      console.log(`Laundromat already exists: ${name}`);
      return false;
    }
    
    // Generate SEO fields
    const seoTitle = generateSeoTitle(record);
    const seoDescription = generateSeoDescription(record);
    const seoTags = generateSeoTags(record);
    
    // Insert the laundromat
    await client.query(
      `INSERT INTO laundromats (
        name, slug, address, city, state, zip, phone, website,
        latitude, longitude, rating, review_count, hours, services,
        is_featured, is_premium, is_verified, description, created_at,
        city_id, state_id, seo_title, seo_description, seo_tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        name,
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        address,
        city,
        state,
        zip,
        record.phone || '',
        record.website || null,
        record.latitude || '0',
        record.longitude || '0',
        record.rating || '0',
        record.review_count || 0,
        record.hours || 'Call for hours',
        JSON.stringify(record.services || []),
        false,
        false,
        false,
        `${name} is a laundromat located in ${city}, ${state}.`,
        new Date(),
        cityId,
        stateId,
        seoTitle,
        seoDescription,
        JSON.stringify(seoTags)
      ]
    );
    
    // Update counts
    await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
    await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
    
    console.log(`Imported: ${name} (${city}, ${state})`);
    return true;
  } catch (error) {
    console.error(`Error importing laundromat ${record.name}:`, error);
    return false;
  }
}

/**
 * Import representative laundromats from each state
 */
async function importStateByState() {
  const client = await pool.connect();
  
  try {
    console.log('Starting state-by-state import...');
    
    // Read the data
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    // Create workbook
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${data.length} total records`);
    
    // Group by state
    const stateMap = new Map();
    
    for (const record of data) {
      if (!record.state) continue;
      
      const state = record.state;
      if (!stateMap.has(state)) {
        stateMap.set(state, []);
      }
      
      stateMap.get(state).push(record);
    }
    
    console.log(`Found ${stateMap.size} states in the data`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    let totalImported = 0;
    let totalSkipped = 0;
    
    // Import 5 laundromats from each state
    for (const [stateAbbr, records] of stateMap.entries()) {
      const stateName = getStateNameFromAbbr(stateAbbr);
      console.log(`\nProcessing state: ${stateName} (${records.length} laundromats)`);
      
      // Take up to 5 laundromats from this state
      const stateLimit = 5;
      const stateRecords = records
        .sort(() => 0.5 - Math.random()) // Shuffle records
        .slice(0, stateLimit);
      
      console.log(`Selected ${stateRecords.length} records from ${stateName}`);
      
      // Import each laundromat
      let stateImported = 0;
      for (const record of stateRecords) {
        const result = await importLaundromat(client, record);
        if (result) {
          stateImported++;
          totalImported++;
        } else {
          totalSkipped++;
        }
      }
      
      console.log(`Imported ${stateImported} laundromats from ${stateName}`);
    }
    
    // Commit changes
    await client.query('COMMIT');
    
    console.log(`
    Import completed:
    - States processed: ${stateMap.size}
    - Laundromats imported: ${totalImported}
    - Laundromats skipped: ${totalSkipped}
    - Total processed: ${totalImported + totalSkipped}
    `);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during import:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the import
console.log('Starting laundromat import process...');
importStateByState().catch(console.error);