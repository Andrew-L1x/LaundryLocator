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

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuration
const BATCH_SIZE = 500; // Process 500 records at once
const RECORDS_PER_STATE = 250; // Max records to take from each state 
const TOTAL_RECORDS = 5000; // Target to import

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

// Top states to prioritize
const TOP_STATES = ['TX', 'CA', 'NY', 'FL', 'PA', 'IL', 'OH', 'MI', 'NJ', 'VA'];

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
  return `${name || 'Laundromat'} - ${city}, ${state} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(name, city, state) {
  return `${name || 'This laundromat'} is a laundromat in ${city}, ${state} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
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
    if (record.state) {
      states.add(record.state);
    }
  }
  
  // Create all states first
  const stateMap = {};
  for (const stateAbbr of states) {
    const stateName = getStateNameFromAbbr(stateAbbr);
    
    // Check if state exists
    const stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
    
    if (stateResult.rows.length === 0) {
      // Create state
      const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const abbr = stateAbbr.length <= 2 ? stateAbbr.toUpperCase() : stateAbbr;
      
      const newStateResult = await client.query(
        'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
        [stateName, abbr, stateSlug]
      );
      
      stateMap[stateName] = newStateResult.rows[0].id;
      console.log(`Created state: ${stateName}`);
    } else {
      stateMap[stateName] = stateResult.rows[0].id;
    }
  }
  
  console.log(`Prepared ${Object.keys(stateMap).length} states`);
  return stateMap;
}

/**
 * Prepare cities in the database
 */
async function prepareCities(client, allRecords, stateMap) {
  console.log("Preparing cities...");
  
  // Extract all unique city+state combinations
  const cities = new Set();
  for (const record of allRecords) {
    if (record.city && record.state) {
      const stateName = getStateNameFromAbbr(record.state);
      cities.add(`${record.city}|${stateName}`);
    }
  }
  
  // Create all cities
  const cityMap = {};
  let count = 0;
  
  for (const cityState of cities) {
    const [city, state] = cityState.split('|');
    
    // Check if city exists
    const cityResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, state]);
    
    if (cityResult.rows.length === 0) {
      // Create city
      const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      try {
        const newCityResult = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [city, state, citySlug]
        );
        
        cityMap[cityState] = newCityResult.rows[0].id;
        count++;
        
        if (count % 50 === 0) {
          console.log(`Created ${count} cities so far...`);
        }
      } catch (error) {
        // If duplicate city slug, try with a random suffix
        if (error.code === '23505') {
          const uniqueSlug = `${citySlug}-${Math.floor(Math.random() * 10000)}`;
          
          const retryResult = await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
            [city, state, uniqueSlug]
          );
          
          cityMap[cityState] = retryResult.rows[0].id;
          count++;
        } else {
          console.error(`Error creating city ${city}, ${state}:`, error.message);
        }
      }
    } else {
      cityMap[cityState] = cityResult.rows[0].id;
    }
  }
  
  console.log(`Prepared ${Object.keys(cityMap).length} cities (created ${count} new ones)`);
  return cityMap;
}

/**
 * Import laundromats in optimized batches
 */
async function importLaundromats(client, allRecords, stateMap, cityMap) {
  console.log(`Importing up to ${TOTAL_RECORDS} laundromats...`);
  
  // Prepare all records for insertion
  const preparedRecords = [];
  let processed = 0;
  
  for (const record of allRecords) {
    if (processed >= TOTAL_RECORDS) break;
    
    try {
      // Get city and state info
      const name = record.name || `Laundromat ${processed}`;
      const address = record.address || '123 Main St';
      const city = record.city || 'Unknown City';
      const stateAbbr = record.state || 'TX';
      const stateName = getStateNameFromAbbr(stateAbbr);
      const zip = record.zip || '00000';
      
      // Get city and state IDs
      const cityState = `${city}|${stateName}`;
      const cityId = cityMap[cityState];
      const stateId = stateMap[stateName];
      
      if (!cityId || !stateId) {
        console.log(`Missing city or state ID for ${city}, ${stateName} - skipping`);
        continue;
      }
      
      // Generate a unique slug
      const uniqueId = Math.floor(Math.random() * 10000000);
      const slug = generateSlug(`${name}-${city}-${stateName}`, uniqueId);
      
      // Generate SEO fields
      const seoTitle = generateSeoTitle(name, city, stateName);
      const seoDescription = generateSeoDescription(name, city, stateName);
      const seoTags = JSON.stringify(generateSeoTags(name, city, stateName));
      
      // Generate premium features
      const isPremium = Math.random() < 0.15;
      const isFeatured = Math.random() < 0.05; 
      const isVerified = Math.random() < 0.3;
      const premiumScore = Math.floor(Math.random() * 40) + 60; // Score between 60-100
      
      // Add to batch
      preparedRecords.push({
        name,
        slug,
        address,
        city,
        stateName,
        zip,
        phone: record.phone || '',
        website: record.website || null,
        latitude: record.latitude || '0',
        longitude: record.longitude || '0',
        rating: record.rating || '0',
        reviewCount: record.review_count || 0,
        hours: record.hours || 'Call for hours',
        services: JSON.stringify(record.services || []),
        isFeatured,
        isPremium,
        isVerified,
        description: `${name} is a laundromat located in ${city}, ${stateName}.`,
        createdAt: new Date(),
        seoTitle,
        seoDescription,
        seoTags,
        premiumScore,
        cityId,
        stateId
      });
      
      processed++;
      
      if (processed % 1000 === 0) {
        console.log(`Prepared ${processed} records for insertion...`);
      }
    } catch (error) {
      console.error(`Error preparing record:`, error.message);
    }
  }
  
  console.log(`Prepared ${preparedRecords.length} total records for insertion`);
  
  // Insert in batches
  let imported = 0;
  let skipped = 0;
  const batches = Math.ceil(preparedRecords.length / BATCH_SIZE);
  
  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, preparedRecords.length);
    const batch = preparedRecords.slice(start, end);
    
    console.log(`Processing batch ${i + 1}/${batches} (${batch.length} records)...`);
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Insert records
      for (const record of batch) {
        try {
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
            record.name,
            record.slug,
            record.address,
            record.city,
            record.stateName,
            record.zip,
            record.phone,
            record.website,
            record.latitude,
            record.longitude,
            record.rating,
            record.reviewCount,
            record.hours,
            record.services,
            record.isFeatured,
            record.isPremium,
            record.isVerified,
            record.description,
            record.createdAt,
            record.seoTitle,
            record.seoDescription,
            record.seoTags,
            record.premiumScore
          ]);
          
          // Update counts
          await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [record.cityId]);
          await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [record.stateId]);
          
          imported++;
        } catch (error) {
          console.error(`Error inserting record ${record.name}:`, error.message);
          skipped++;
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log(`Committed batch ${i + 1}/${batches} (${imported} of ${batch.length} successful)`);
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error(`Error in batch ${i + 1}:`, error.message);
      skipped += batch.length;
    }
  }
  
  return { imported, skipped };
}

/**
 * Run the entire import process
 */
async function runImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting rapid laundromat import...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${allData.length} total records in Excel file`);
    
    // Group records by state
    const stateData = {};
    for (const record of allData) {
      const stateAbbr = record.state || 'unknown';
      if (!stateData[stateAbbr]) {
        stateData[stateAbbr] = [];
      }
      stateData[stateAbbr].push(record);
    }
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Select records to import
    const recordsToImport = [];
    
    // First add records from top states
    for (const stateAbbr of TOP_STATES) {
      if (stateData[stateAbbr]) {
        const stateRecords = stateData[stateAbbr];
        console.log(`Found ${stateRecords.length} records for top state ${stateAbbr}`);
        
        // Take a sample from this state
        const stateLimit = Math.min(stateRecords.length, RECORDS_PER_STATE);
        const stateRecordsShuffled = [...stateRecords].sort(() => 0.5 - Math.random());
        recordsToImport.push(...stateRecordsShuffled.slice(0, stateLimit));
      }
    }
    
    // Then add records from other states
    for (const stateAbbr of Object.keys(stateData)) {
      if (!TOP_STATES.includes(stateAbbr)) {
        const stateRecords = stateData[stateAbbr];
        
        // Take a smaller sample from non-top states
        const stateLimit = Math.min(stateRecords.length, Math.floor(RECORDS_PER_STATE / 2));
        const stateRecordsShuffled = [...stateRecords].sort(() => 0.5 - Math.random());
        recordsToImport.push(...stateRecordsShuffled.slice(0, stateLimit));
      }
    }
    
    // Shuffle all selected records for better distribution
    recordsToImport.sort(() => 0.5 - Math.random());
    
    // Limit total number of records
    const recordsToProcess = recordsToImport.slice(0, TOTAL_RECORDS);
    console.log(`Selected ${recordsToProcess.length} records for import`);
    
    // Prepare database
    const stateMap = await prepareStates(client, recordsToProcess);
    const cityMap = await prepareCities(client, recordsToProcess, stateMap);
    
    // Import laundromats
    const { imported, skipped } = await importLaundromats(client, recordsToProcess, stateMap, cityMap);
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`\nImport completed!
    - Starting count: ${currentCount}
    - Records selected: ${recordsToProcess.length}
    - Successfully imported: ${imported}
    - Skipped/failed: ${skipped}
    - Final count: ${finalCount}
    - Total new records: ${finalCount - currentCount}
    `);
    
    // Show state breakdown
    const stateBreakdown = await client.query('SELECT name, laundry_count FROM states ORDER BY laundry_count DESC LIMIT 15');
    console.log('\nTop 15 states by laundromat count:');
    for (const row of stateBreakdown.rows) {
      console.log(`${row.name}: ${row.laundry_count}`);
    }
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.time('Import Duration');
runImport()
  .then(() => {
    console.timeEnd('Import Duration');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });