/**
 * Direct JSON Import Script
 * 
 * This script directly imports the enriched JSON data into the database
 * Uses direct database connection for efficient batch importing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Source file
const SOURCE_FILE = path.join(cwd, 'data/import_ready_laundromats.json');

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// State name mapping
const stateMap = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// Statistics for tracking import progress
const stats = {
  total: 0,
  imported: 0,
  skipped: 0,
  errors: 0,
  processed: 0,
  startTime: Date.now(),
};

/**
 * Process location data (cities and states)
 */
async function processLocationData(client, record) {
  try {
    // Normalize state abbreviation
    let stateAbbr = record.state;
    if (stateAbbr.length === 2) {
      stateAbbr = stateAbbr.toUpperCase();
    }
    
    // Get state name from abbreviation
    const stateName = stateMap[stateAbbr] || stateAbbr;
    const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
    
    // Check if state exists
    const stateResult = await client.query(
      'SELECT id FROM states WHERE abbr = $1',
      [stateAbbr]
    );
    
    let stateId;
    
    if (stateResult.rows.length === 0) {
      // Create state if it doesn't exist
      const newStateResult = await client.query(
        'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 1) RETURNING id',
        [stateName, stateAbbr, stateSlug]
      );
      stateId = newStateResult.rows[0].id;
    } else {
      stateId = stateResult.rows[0].id;
      // Update laundry count
      await client.query(
        'UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1',
        [stateId]
      );
    }
    
    // Process city
    const cityName = record.city;
    const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;
    
    // Check if city exists
    const cityResult = await client.query(
      'SELECT id FROM cities WHERE slug = $1',
      [citySlug]
    );
    
    if (cityResult.rows.length === 0) {
      // Create city if it doesn't exist
      await client.query(
        'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 1)',
        [cityName, stateAbbr, citySlug]
      );
    } else {
      // Update laundry count
      await client.query(
        'UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1',
        [cityResult.rows[0].id]
      );
    }
  } catch (error) {
    console.error('Error processing location data:', error);
  }
}

/**
 * Process a batch of records
 */
async function processBatch(records, batchIndex, batchSize) {
  console.log(`Processing batch ${batchIndex + 1} (${records.length} records)...`);
  
  // Connect to the database
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    let batchStats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: 0
    };
    
    for (const record of records) {
      try {
        batchStats.processed++;
        stats.processed++;
        
        // Prepare the insert query
        const insertQuery = `
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website, 
            latitude, longitude, rating, review_count, hours, 
            services, amenities, machine_count, listing_type, is_featured,
            verified, image_url, description, created_at
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `;
        
        // Convert services to JSON string if needed
        const services = typeof record.services === 'string' 
          ? record.services 
          : JSON.stringify(record.services || ['Self-service laundry']);
        
        // Convert amenities to JSON string if needed
        const amenities = typeof record.amenities === 'string'
          ? record.amenities
          : JSON.stringify(record.amenities || ['Vending machines']);
        
        // Convert machine count to JSON string if needed
        const machineCount = typeof record.machineCount === 'string'
          ? record.machineCount
          : JSON.stringify(record.machineCount || { washers: 15, dryers: 10 });
        
        // Execute the query
        const result = await client.query(insertQuery, [
          record.name,
          record.slug,
          record.address,
          record.city,
          record.state,
          record.zip,
          record.phone,
          record.website,
          record.latitude,
          record.longitude,
          record.rating,
          record.reviewCount || 0,
          record.hours,
          services,
          amenities,
          machineCount,
          record.listingType || 'basic',
          record.isFeatured || false,
          record.verified || true,
          record.imageUrl,
          record.seoDescription || record.description,
          new Date()
        ]);
        
        if (result.rowCount > 0) {
          batchStats.imported++;
          stats.imported++;
          
          // Process cities and states
          await processLocationData(client, record);
        } else {
          batchStats.skipped++;
          stats.skipped++;
        }
      } catch (error) {
        console.error(`Error importing record:`, error);
        batchStats.errors++;
        stats.errors++;
      }
      
      // Log progress every 100 records
      if (stats.processed % 100 === 0) {
        const elapsedSeconds = (Date.now() - stats.startTime) / 1000;
        const recordsPerSecond = (stats.processed / elapsedSeconds).toFixed(2);
        console.log(`Processed ${stats.processed} records (${recordsPerSecond} records/sec), imported: ${stats.imported}, skipped: ${stats.skipped}, errors: ${stats.errors}`);
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`Batch ${batchIndex + 1} results: processed ${batchStats.processed}, imported ${batchStats.imported}, skipped ${batchStats.skipped}, errors ${batchStats.errors}`);
    
    return batchStats;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Batch processing error:', error);
    throw error;
  } finally {
    // Release the client
    client.release();
  }
}

/**
 * Main import function
 */
async function importData() {
  try {
    console.log(`Reading data file: ${SOURCE_FILE}`);
    
    // Read the JSON file
    const fileData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    
    if (!Array.isArray(fileData)) {
      throw new Error('File data must be an array');
    }
    
    stats.total = fileData.length;
    console.log(`Found ${stats.total} records to import`);
    
    // Process in batches
    const batchSize = 100;
    const totalBatches = Math.ceil(fileData.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, fileData.length);
      const batch = fileData.slice(start, end);
      
      await processBatch(batch, batchIndex, batchSize);
      
      // Log overall progress
      const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
      console.log(`Overall progress: ${progress}% (${batchIndex + 1}/${totalBatches} batches)`);
    }
    
    const elapsedTime = (Date.now() - stats.startTime) / 1000;
    console.log(`\nImport completed in ${elapsedTime.toFixed(2)} seconds`);
    console.log(`Total records: ${stats.total}`);
    console.log(`Imported: ${stats.imported}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
    // Close the pool
    await pool.end();
    
    return stats;
  } catch (error) {
    console.error('Import error:', error);
    await pool.end();
    throw error;
  }
}

// Start the import
console.log('=== Starting Direct JSON Import ===');
importData()
  .then(() => {
    console.log('=== Import Process Completed ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('=== Import Process Failed ===', error);
    process.exit(1);
  });