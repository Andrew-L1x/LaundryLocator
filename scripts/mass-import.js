/**
 * Mass Laundromat Import Script
 * 
 * This script imports a large number of laundromats efficiently from the Excel file.
 * It focuses on getting hundreds of records from across the country.
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
const LAUNDROMATS_PER_STATE = 50; // Import up to 50 laundromats per state
const IMPORT_TOP_STATES = true; // Import more from the states with most laundromats

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

// Define top states that have more laundromats
const topStates = ['TX', 'CA', 'NY', 'FL', 'PA', 'IL', 'OH', 'MI', 'NJ', 'VA'];

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
 * Prepare states and cities to make import faster
 */
async function prepareStatesAndCities(client, records) {
  console.log("Preparing states and cities for faster import...");
  
  // Extract all unique states
  const states = new Set();
  for (const record of records) {
    if (record.state) {
      states.add(record.state);
    }
  }
  
  // Prepare all states first
  for (const stateAbbr of states) {
    const stateName = getStateNameFromAbbr(stateAbbr);
    
    try {
      // Check if state exists
      const stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
      
      if (stateResult.rows.length === 0) {
        // Create state
        const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await client.query(
          'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0)',
          [stateName, stateAbbr.toUpperCase(), stateSlug]
        );
        console.log(`Created state: ${stateName}`);
      }
    } catch (error) {
      console.error(`Error preparing state ${stateName}:`, error.message);
    }
  }
  
  console.log("States prepared successfully.");
  
  // Now prepare cities (just for key states to save time)
  const preparedCities = new Set();
  let cityCount = 0;
  
  for (const record of records) {
    // Only process cities for records we will import
    if (record.city && record.state) {
      const stateName = getStateNameFromAbbr(record.state);
      const cityKey = `${record.city}|${stateName}`;
      
      // Skip if we already processed this city
      if (preparedCities.has(cityKey)) {
        continue;
      }
      
      // Add to tracking set
      preparedCities.add(cityKey);
      
      try {
        // Check if city exists
        const cityResult = await client.query(
          'SELECT id FROM cities WHERE name = $1 AND state = $2',
          [record.city, stateName]
        );
        
        if (cityResult.rows.length === 0) {
          // Create city with unique slug
          const citySlug = record.city.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
            + '-' + Math.floor(Math.random() * 10000);
          
          await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0)',
            [record.city, stateName, citySlug]
          );
          
          cityCount++;
          
          if (cityCount % 50 === 0) {
            console.log(`Prepared ${cityCount} cities...`);
          }
        }
      } catch (error) {
        // Ignore duplicate key errors
        if (error.code !== '23505') {
          console.error(`Error preparing city ${record.city}, ${stateName}:`, error.message);
        }
      }
    }
  }
  
  console.log(`Cities prepared successfully. Created ${cityCount} new cities.`);
}

/**
 * Import a batch of laundromats efficiently
 */
async function importBatch(client, records) {
  console.log(`Importing batch of ${records.length} laundromats...`);
  
  let imported = 0;
  let skipped = 0;
  
  // Process in smaller chunks to avoid transaction timeouts
  const chunkSize = 50;
  const chunks = Math.ceil(records.length / chunkSize);
  
  for (let c = 0; c < chunks; c++) {
    const start = c * chunkSize;
    const end = Math.min(start + chunkSize, records.length);
    const chunk = records.slice(start, end);
    
    console.log(`Processing chunk ${c + 1}/${chunks} (${start + 1} to ${end} of ${records.length})...`);
    
    try {
      // Start transaction for this chunk
      await client.query('BEGIN');
      
      for (let i = 0; i < chunk.length; i++) {
        const record = chunk[i];
        
        try {
          // Fill in missing values with defaults
          const name = record.name || `Laundromat ${Math.floor(Math.random() * 100000)}`;
          const address = record.address || '123 Main St';
          const city = record.city || 'Unknown City';
          const stateAbbr = record.state || 'TX';
          const stateName = getStateNameFromAbbr(stateAbbr);
          const zip = record.zip || '00000';
          
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
          
          // Get state and city IDs
          let stateIdResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
          if (stateIdResult.rows.length === 0) {
            throw new Error(`State not found: ${stateName}`);
          }
          const stateId = stateIdResult.rows[0].id;
          
          let cityIdResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, stateName]);
          let cityId;
          
          if (cityIdResult.rows.length === 0) {
            // Create city if it doesn't exist
            const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + uniqueId;
            const cityInsertResult = await client.query(
              'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
              [city, stateName, citySlug]
            );
            cityId = cityInsertResult.rows[0].id;
          } else {
            cityId = cityIdResult.rows[0].id;
          }
          
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
            isFeatured,
            isPremium,
            isVerified,
            `${name} is a laundromat located in ${city}, ${stateName}.`,
            new Date(),
            seoTitle,
            seoDescription,
            seoTags,
            premiumScore
          ]);
          
          // Update counts
          await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
          await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
          
          imported++;
          
          // Log progress occasionally
          if (i % 10 === 0) {
            console.log(`Imported ${i}/${chunk.length} in current chunk: ${name} (${city}, ${stateName})`);
          }
        } catch (error) {
          console.error(`Error importing ${record.name || 'laundromat'}:`, error.message);
          skipped++;
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log(`Committed chunk ${c + 1}/${chunks}`);
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error(`Error in chunk ${c + 1}:`, error.message);
      skipped += chunk.length;
    }
  }
  
  return { imported, skipped };
}

/**
 * Run the mass import process
 */
async function runImport() {
  let client;
  
  try {
    console.log('Starting mass laundromat import...');
    client = await pool.connect();
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
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
    
    const stateList = Object.keys(stateData);
    console.log(`Found data for ${stateList.length} states`);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const startingCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Select records to import
    const recordsToImport = [];
    
    // Prioritize import from top states first
    if (IMPORT_TOP_STATES) {
      for (const stateAbbr of topStates) {
        if (stateData[stateAbbr]) {
          const records = stateData[stateAbbr];
          console.log(`Found ${records.length} records for top state ${stateAbbr}`);
          
          // Take more laundromats from top states
          const perState = Math.min(records.length, LAUNDROMATS_PER_STATE * 2);
          
          // Shuffle records for diversity and take a sample
          const shuffled = [...records].sort(() => 0.5 - Math.random());
          const sample = shuffled.slice(0, perState);
          
          recordsToImport.push(...sample);
        }
      }
    }
    
    // Then select from other states to ensure nationwide coverage
    for (const stateAbbr of stateList) {
      // Skip top states which are already handled
      if (IMPORT_TOP_STATES && topStates.includes(stateAbbr)) {
        continue;
      }
      
      const records = stateData[stateAbbr];
      
      // Take sample from each state
      const perState = Math.min(records.length, LAUNDROMATS_PER_STATE);
      
      // Shuffle records for diversity and take a sample
      const shuffled = [...records].sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, perState);
      
      recordsToImport.push(...sample);
    }
    
    console.log(`Selected ${recordsToImport.length} laundromats to import across all states`);
    
    // Prepare states and cities for faster import
    await prepareStatesAndCities(client, recordsToImport);
    
    // Import the selected records
    const { imported, skipped } = await importBatch(client, recordsToImport);
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`\nImport completed! Stats:
    - Starting count: ${startingCount}
    - Records selected for import: ${recordsToImport.length}
    - Successfully imported: ${imported}
    - Skipped: ${skipped}
    - Final count: ${finalCount}
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
    if (client) {
      client.release();
    }
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