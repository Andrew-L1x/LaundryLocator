/**
 * Quick Batch Import Script for Laundromat Data
 * 
 * This script imports laundromats in smaller batches to quickly populate the database.
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

// Configuration - import a smaller batch size for quick results
const BATCH_SIZE = 200;
const STATES_TO_PROCESS = 10; // Process 10 states at a time

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
 * Process a batch of records
 */
async function processBatch(client, records, startIndex) {
  console.log(`Processing batch of ${records.length} records...`);
  
  let success = 0;
  let failed = 0;
  
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
      
      // Generate a unique slug
      const uniqueId = Math.floor(Math.random() * 10000000);
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uniqueId}`;
      
      // Generate SEO fields
      const seoTitle = `${name} - ${city}, ${stateName} | Laundromat Near Me`;
      const seoDescription = `${name} is a laundromat in ${city}, ${stateName} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
      const seoTags = JSON.stringify([
        "laundromat",
        "laundry",
        "coin laundry",
        "laundromat near me",
        `laundromat in ${city}`,
        `laundromat in ${stateName}`,
        `laundromat in ${city}, ${stateName}`
      ]);
      
      // Generate premium features
      const isPremium = Math.random() < 0.15;
      const isFeatured = Math.random() < 0.05; 
      const isVerified = Math.random() < 0.3;
      const premiumScore = Math.floor(Math.random() * 40) + 60; // Score between 60-100
      
      // Skip state ID lookup - create state if needed
      let stateRow;
      const stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
      if (stateResult.rows.length === 0) {
        const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const insertResult = await client.query(
          'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [stateName, stateAbbr.toUpperCase(), stateSlug]
        );
        stateRow = insertResult.rows[0];
      } else {
        stateRow = stateResult.rows[0];
      }
      
      // Skip city ID lookup - create city if needed
      let cityRow;
      const cityResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, stateName]);
      if (cityResult.rows.length === 0) {
        const citySlug = `${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.floor(Math.random() * 10000)}`;
        const insertResult = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [city, stateName, citySlug]
        );
        cityRow = insertResult.rows[0];
      } else {
        cityRow = cityResult.rows[0];
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
      await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityRow.id]);
      await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateRow.id]);
      
      success++;
      
      // Log progress
      if ((i + 1) % 20 === 0 || i === records.length - 1) {
        console.log(`Imported ${i + 1}/${records.length}: ${name} (${city}, ${stateName})`);
      }
    } catch (error) {
      console.error(`Error importing record #${recordIndex}:`, error.message);
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * Run the quick batch import
 */
async function runImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting quick batch laundromat import...');
    
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
    
    const stateList = Object.keys(stateData);
    console.log(`Found data for ${stateList.length} states`);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const startingCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Begin a transaction for the entire process
    await client.query('BEGIN');
    
    // Select states to process in this batch (prioritize states with more data)
    const statesToProcess = stateList
      .map(state => ({ state, count: stateData[state].length }))
      .sort((a, b) => b.count - a.count) // Sort by most laundromats first
      .slice(0, STATES_TO_PROCESS) // Take the top N states
      .map(item => item.state);
    
    console.log(`Selected ${statesToProcess.length} states to process in this batch:`);
    statesToProcess.forEach(state => console.log(` - ${state} (${stateData[state].length} records)`));
    
    // Collect records to import from selected states
    const recordsToImport = [];
    for (const state of statesToProcess) {
      // Take a sample from each state
      const perState = Math.min(stateData[state].length, Math.ceil(BATCH_SIZE / statesToProcess.length));
      
      // Randomly select records
      const shuffled = [...stateData[state]].sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, perState);
      
      recordsToImport.push(...sample);
    }
    
    console.log(`Selected ${recordsToImport.length} records to import from ${statesToProcess.length} states`);
    
    // Process the batch
    const { success, failed } = await processBatch(client, recordsToImport, 0);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`\nBatch import completed!
    - Successfully imported: ${success}
    - Failed: ${failed}
    - Total: ${success + failed}
    `);
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`Total laundromats in database: ${finalCount} (added ${finalCount - startingCount})`);
    
    // Show state breakdown
    const stateBreakdown = await client.query('SELECT name, laundry_count FROM states ORDER BY laundry_count DESC LIMIT 10');
    console.log('\nTop 10 states by laundromat count:');
    for (const row of stateBreakdown.rows) {
      console.log(`${row.name}: ${row.laundry_count}`);
    }
    
  } catch (error) {
    // Rollback the transaction on error
    await client.query('ROLLBACK');
    console.error('Error during batch import:', error);
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