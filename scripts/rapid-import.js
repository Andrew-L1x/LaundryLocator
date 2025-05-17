/**
 * Rapid Laundromat Import Script
 * 
 * This script imports a large number of laundromats efficiently by:
 * 1. Preparing all database queries in advance
 * 2. Using batch insertion
 * 3. Minimizing transaction overhead
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

// Configure database connection with increased pool size for parallel operations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20 // Increase connection pool size
});

// Configuration
const IMPORT_SIZE = 2000; // Import first 2,000 records
const BATCH_SIZE = 100; // Insert 100 records per batch
const PREMIUM_RATE = 0.15; // 15% of listings are premium
const FEATURED_RATE = 0.05; // 5% of listings are featured
const VERIFIED_RATE = 0.30; // 30% of listings are verified

// State abbreviation to full name mapping
const stateNameMap = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
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
 * Generate a slug for a laundromat
 */
function generateSlug(text, uniqueId) {
  if (!text) {
    return `laundromat-${uniqueId}`;
  }
  
  let slug = text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${slug}-${uniqueId}`;
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(name, city, state) {
  const cityState = city && state ? 
    `- ${city}, ${state}` : '';
  
  return `${name || 'Laundromat'} ${cityState} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(name, city, state) {
  const cityState = city && state ? 
    `in ${city}, ${state}` : '';
  
  return `${name || 'This laundromat'} is a laundromat ${cityState} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(name, city, state) {
  const tags = [
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me"
  ];
  
  if (city) tags.push(`laundromat in ${city}`);
  if (state) tags.push(`laundromat in ${state}`);
  if (city && state) tags.push(`laundromat in ${city}, ${state}`);
  
  return tags;
}

/**
 * Prepare all states in the database first
 */
async function prepareStates(client, allRecords) {
  console.log("Preparing states...");
  
  // Extract all unique states
  const states = new Set();
  for (const record of allRecords) {
    const stateAbbr = record.state;
    if (stateAbbr) {
      states.add(stateAbbr);
    }
  }
  
  // Insert all states in one batch
  for (const stateAbbr of states) {
    const stateName = getStateNameFromAbbr(stateAbbr);
    const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Try to insert the state, but ignore if it already exists
    try {
      await client.query(`
        INSERT INTO states (name, abbr, slug, laundry_count)
        VALUES ($1, $2, $3, 0)
      `, [stateName, stateAbbr.toUpperCase(), stateSlug]);
    } catch (error) {
      // Ignore if state already exists (unique constraint violation)
      if (error.code !== '23505') {
        console.error(`Error inserting state ${stateName}:`, error.message);
      }
    }
  }
  
  // Get all states with their IDs
  const stateResult = await client.query('SELECT id, name FROM states');
  
  // Create a map of state name to ID
  const stateMap = {};
  for (const row of stateResult.rows) {
    stateMap[row.name] = row.id;
  }
  
  console.log(`Prepared ${stateResult.rowCount} states`);
  return stateMap;
}

/**
 * Prepare cities in the database
 */
async function prepareCities(client, allRecords, stateMap) {
  console.log("Preparing cities...");
  
  // Extract all unique city+state combinations
  const cityStates = new Set();
  for (const record of allRecords) {
    const city = record.city;
    const stateAbbr = record.state;
    if (city && stateAbbr) {
      const stateName = getStateNameFromAbbr(stateAbbr);
      cityStates.add(`${city}|${stateName}`);
    }
  }
  
  // Insert cities individually to avoid ON CONFLICT issues
  let insertedCount = 0;
  
  for (const cityState of cityStates) {
    const [city, state] = cityState.split('|');
    const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000);
    
    // Try to insert the city
    try {
      await client.query(`
        INSERT INTO cities (name, state, slug, laundry_count)
        VALUES ($1, $2, $3, 0)
      `, [city, state, citySlug]);
      
      insertedCount++;
      
      // Log progress periodically
      if (insertedCount % 50 === 0) {
        console.log(`Inserted ${insertedCount} cities...`);
      }
    } catch (error) {
      // Ignore if city already exists (unique constraint violation)
      if (error.code !== '23505') {
        console.error(`Error inserting city ${city}, ${state}:`, error.message);
      }
    }
  }
  
  // Get all cities with their IDs
  const cityResult = await client.query('SELECT id, name, state FROM cities');
  
  // Create a map of city+state to ID
  const cityMap = {};
  for (const row of cityResult.rows) {
    cityMap[`${row.name}|${row.state}`] = row.id;
  }
  
  console.log(`Prepared ${cityResult.rowCount} cities in ${batchCount} batches`);
  return cityMap;
}

/**
 * Import laundromats in optimized batches
 */
async function importLaundromats(client, allRecords, stateMap, cityMap) {
  console.log(`Starting batch import of up to ${IMPORT_SIZE} laundromats...`);
  
  // Only process the requested number of records
  const recordsToProcess = allRecords.slice(0, IMPORT_SIZE);
  const totalBatches = Math.ceil(recordsToProcess.length / BATCH_SIZE);
  
  // Import in batches
  let totalImported = 0;
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, recordsToProcess.length);
    const batchRecords = recordsToProcess.slice(start, end);
    
    console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1} to ${end} of ${recordsToProcess.length})...`);
    
    const laundryQueries = [];
    const laundryParams = [];
    let paramCount = 1;
    const stateCountUpdates = {};
    const cityCountUpdates = {};
    
    // Prepare all insertions for this batch
    for (const record of batchRecords) {
      // Get basic data with defaults
      const name = record.name || `Laundromat ${Math.floor(Math.random() * 100000)}`;
      const address = record.address || '123 Main St';
      const city = record.city || 'Unknown City';
      const stateAbbr = record.state || 'TX';
      const stateName = getStateNameFromAbbr(stateAbbr);
      const zip = record.zip || '00000';
      
      // Generate a unique slug using record index for uniqueness
      const uniqueId = Math.floor(Math.random() * 1000000);
      const slug = generateSlug(`${name}-${city}-${stateName}`, uniqueId);
      
      // Generate SEO fields
      const seoTitle = generateSeoTitle(name, city, stateName);
      const seoDescription = generateSeoDescription(name, city, stateName);
      const seoTags = JSON.stringify(generateSeoTags(name, city, stateName));
      
      // Generate premium features
      const isPremium = Math.random() < PREMIUM_RATE;
      const isFeatured = Math.random() < FEATURED_RATE;
      const isVerified = Math.random() < VERIFIED_RATE;
      const premiumScore = Math.floor(Math.random() * 40) + 60; // Score between 60-100
      
      // Add to queries
      laundryQueries.push(`(
        $${paramCount}, $${paramCount+1}, $${paramCount+2}, $${paramCount+3}, $${paramCount+4}, 
        $${paramCount+5}, $${paramCount+6}, $${paramCount+7}, $${paramCount+8}, $${paramCount+9}, 
        $${paramCount+10}, $${paramCount+11}, $${paramCount+12}, $${paramCount+13}, $${paramCount+14}, 
        $${paramCount+15}, $${paramCount+16}, $${paramCount+17}, $${paramCount+18}, $${paramCount+19}, 
        $${paramCount+20}, $${paramCount+21}, $${paramCount+22}
      )`);
      
      laundryParams.push(
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
        isFeatured,
        isPremium,
        isVerified,
        `${name} is a laundromat located in ${city}, ${stateName}.`,
        new Date(),
        seoTitle,
        seoDescription,
        seoTags,
        premiumScore
      );
      
      paramCount += 23;
      
      // Track state and city counts for later updates
      if (stateName) {
        stateCountUpdates[stateName] = (stateCountUpdates[stateName] || 0) + 1;
      }
      
      const cityKey = `${city}|${stateName}`;
      if (cityKey) {
        cityCountUpdates[cityKey] = (cityCountUpdates[cityKey] || 0) + 1;
      }
    }
    
    // Insert the laundromats
    try {
      await client.query('BEGIN');
      
      // Insert all laundromats in this batch
      if (laundryQueries.length > 0) {
        const result = await client.query(`
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website,
            latitude, longitude, rating, review_count, hours, services,
            is_featured, is_premium, is_verified, description, created_at,
            seo_title, seo_description, seo_tags, premium_score
          )
          VALUES ${laundryQueries.join(', ')}
          ON CONFLICT (slug) DO NOTHING
        `, laundryParams);
        
        console.log(`Imported ${result.rowCount} laundromats in batch ${batchIndex + 1}`);
        totalImported += result.rowCount;
      }
      
      // Update state counts
      for (const [stateName, count] of Object.entries(stateCountUpdates)) {
        if (stateMap[stateName]) {
          await client.query(
            'UPDATE states SET laundry_count = laundry_count + $1 WHERE id = $2',
            [count, stateMap[stateName]]
          );
        }
      }
      
      // Update city counts
      for (const [cityKey, count] of Object.entries(cityCountUpdates)) {
        if (cityMap[cityKey]) {
          await client.query(
            'UPDATE cities SET laundry_count = laundry_count + $1 WHERE id = $2',
            [count, cityMap[cityKey]]
          );
        }
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error in batch ${batchIndex + 1}:`, error);
    }
  }
  
  return totalImported;
}

/**
 * Run the entire import process
 */
async function runImport() {
  console.log(`Starting rapid laundromat import of up to ${IMPORT_SIZE} records...`);
  
  const client = await pool.connect();
  
  try {
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
    
    console.log(`Found ${allData.length} total records in Excel file`);
    
    // Begin transaction for the entire process
    await client.query('BEGIN');
    
    // Prepare all states
    const stateMap = await prepareStates(client, allData);
    
    // Prepare all cities
    const cityMap = await prepareCities(client, allData, stateMap);
    
    // Import laundromats
    const totalImported = await importLaundromats(client, allData, stateMap, cityMap);
    
    // Commit everything
    await client.query('COMMIT');
    
    console.log(`\nImport completed successfully!`);
    console.log(`Imported ${totalImported} laundromats`);
    
    // Show stats
    const statsQuery = await client.query('SELECT COUNT(*) FROM laundromats');
    console.log(`Total laundromats in database: ${statsQuery.rows[0].count}`);
    
    const stateQuery = await client.query('SELECT COUNT(*) FROM states');
    console.log(`Total states in database: ${stateQuery.rows[0].count}`);
    
    const cityQuery = await client.query('SELECT COUNT(*) FROM cities');
    console.log(`Total cities in database: ${cityQuery.rows[0].count}`);
    
    // Show state breakdown
    const stateBreakdown = await client.query('SELECT name, laundry_count FROM states ORDER BY laundry_count DESC LIMIT 10');
    console.log('\nTop 10 states by laundromat count:');
    for (const row of stateBreakdown.rows) {
      console.log(`${row.name}: ${row.laundry_count}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during import:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the rapid import
console.time('Import Duration');
runImport()
  .then(() => {
    console.timeEnd('Import Duration');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });