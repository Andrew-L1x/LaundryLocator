/**
 * Tiny Import Script for Laundromat Data
 * 
 * This script imports just 5 records at a time to guarantee completion
 * within the execution time limits.
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

// Target state - focus on just one state per run
const TARGET_STATE = "CO"; // Colorado

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
 * Run the tiny import process
 */
async function runTinyImport() {
  const client = await pool.connect();
  
  try {
    console.log(`Starting tiny laundromat import for ${TARGET_STATE}...`);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Get state name
    const stateName = stateNameMap[TARGET_STATE] || TARGET_STATE;
    
    // Read the offset file to determine where to start
    let offset = 0;
    const offsetFile = `${TARGET_STATE.toLowerCase()}-offset.txt`;
    
    try {
      if (fs.existsSync(offsetFile)) {
        offset = parseInt(fs.readFileSync(offsetFile, 'utf8')) || 0;
      }
    } catch (err) {
      console.log(`No offset file found, starting from 0`);
    }
    
    // Read the Excel file - just the first sheet
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    // Filter records by target state
    const stateRecords = allData.filter(record => record.state === TARGET_STATE);
    console.log(`Found ${stateRecords.length} records for ${stateName}`);
    
    if (stateRecords.length === 0) {
      console.log(`No records found for ${stateName}, please choose another state.`);
      return;
    }
    
    // Get next batch of records (5 max)
    const batchSize = 5;
    const endOffset = Math.min(offset + batchSize, stateRecords.length);
    
    if (offset >= stateRecords.length) {
      console.log(`All records for ${stateName} have been processed. Please choose another state.`);
      return;
    }
    
    const batch = stateRecords.slice(offset, endOffset);
    console.log(`Processing batch of ${batch.length} records (${offset + 1} to ${endOffset} of ${stateRecords.length})`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Process records
    let importedCount = 0;
    let skippedCount = 0;
    
    // Ensure state exists
    let stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
    let stateId;
    
    if (stateResult.rows.length === 0) {
      // Create state
      const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const stateInsertResult = await client.query(
        'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
        [stateName, TARGET_STATE, stateSlug]
      );
      stateId = stateInsertResult.rows[0].id;
      console.log(`Created state: ${stateName}`);
    } else {
      stateId = stateResult.rows[0].id;
    }
    
    // Process each record
    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const recordIndex = offset + i + 1;
      
      try {
        // Get basic info
        const name = record.name || `Laundromat ${recordIndex}`;
        const address = record.address || '123 Main St';
        const city = record.city || 'Unknown City';
        const zip = record.zip || '00000';
        
        // Generate a slug
        const uniqueId = Math.floor(Math.random() * 10000000);
        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uniqueId}`;
        
        // Check if city exists
        let cityResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, stateName]);
        let cityId;
        
        if (cityResult.rows.length === 0) {
          // Create city
          const citySlug = `${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uniqueId}`;
          const cityInsertResult = await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
            [city, stateName, citySlug]
          );
          cityId = cityInsertResult.rows[0].id;
          console.log(`Created city: ${city}, ${stateName}`);
        } else {
          cityId = cityResult.rows[0].id;
        }
        
        // Generate SEO fields
        const seoTitle = `${name} in ${city}, ${stateName} | Laundromat Near Me`;
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
        
        // Calculate premium score
        let premiumScore = 70; // Base score
        if (record.rating) {
          premiumScore += parseFloat(record.rating) * 5;
        }
        if (record.website) {
          premiumScore += 5;
        }
        premiumScore = Math.min(100, Math.round(premiumScore));
        
        // Set premium attributes
        const isPremium = Math.random() < 0.15 || premiumScore >= 75;
        const isFeatured = Math.random() < 0.05 || premiumScore >= 90;
        const isVerified = Math.random() < 0.3 || premiumScore >= 80;
        
        // Insert the laundromat
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
        
        console.log(`Imported ${recordIndex}/${stateRecords.length}: ${name} (${city}, ${stateName})`);
        importedCount++;
        
      } catch (error) {
        console.error(`Error importing record #${recordIndex}:`, error.message);
        skippedCount++;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Update offset file
    fs.writeFileSync(offsetFile, (endOffset).toString());
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`
      Import completed successfully!
      - Starting count: ${currentCount}
      - Imported: ${importedCount}
      - Skipped: ${skippedCount}
      - Final count: ${finalCount}
      - Added: ${finalCount - currentCount} new records
      - Processed ${endOffset} of ${stateRecords.length} records for ${stateName}
    `);
    
    // Check if more records for this state
    if (endOffset < stateRecords.length) {
      console.log(`
        There are ${stateRecords.length - endOffset} more records for ${stateName}.
        Run this script again to continue importing.
      `);
    } else {
      console.log(`
        All ${stateRecords.length} records for ${stateName} have been processed.
        Edit the script to set TARGET_STATE to a different state for more imports.
      `);
    }
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error during import:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.time('Import Duration');
runTinyImport()
  .then(() => {
    console.timeEnd('Import Duration');
    console.log('Tiny import completed.');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });