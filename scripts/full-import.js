/**
 * Full Database Import Script
 * 
 * This script imports the entire dataset of laundromats into the database
 * using an optimized approach with error handling and recovery
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
// Batch size for processing
const BATCH_SIZE = 50;
// Progress file to track import status
const PROGRESS_FILE = path.join(cwd, 'data/import_progress.json');

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Statistics for tracking import progress
const stats = {
  total: 0,
  imported: 0,
  skipped: 0,
  errors: 0,
  processed: 0,
  startTime: Date.now(),
  lastProcessed: 0 // Index of the last processed record
};

// Load progress if available
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      stats.total = progress.total || 0;
      stats.imported = progress.imported || 0;
      stats.skipped = progress.skipped || 0;
      stats.errors = progress.errors || 0;
      stats.processed = progress.processed || 0;
      stats.lastProcessed = progress.lastProcessed || 0;
      stats.startTime = progress.startTime || Date.now();
      
      console.log(`Loaded previous progress: processed ${stats.processed}/${stats.total} records`);
      return true;
    }
  } catch (error) {
    console.error('Error loading progress:', error.message);
  }
  return false;
}

// Save progress to file
function saveProgress() {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Error saving progress:', error.message);
  }
}

/**
 * Import a single record with its own transaction
 */
async function importRecord(client, record) {
  try {
    // Start a transaction for this record
    await client.query('BEGIN');
    
    // Prepare the insert query with all necessary fields
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
    
    let success = false;
    
    if (result.rowCount > 0) {
      // Update location counters
      await updateLocationCounter(client, record.state, record.city);
      success = true;
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    return success;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Update location counters
 */
async function updateLocationCounter(client, stateAbbr, cityName) {
  try {
    // Normalize state abbreviation
    if (!stateAbbr) return;
    
    const normalizedStateAbbr = stateAbbr.length === 2 ? stateAbbr.toUpperCase() : stateAbbr;
    
    // Update state count
    try {
      await client.query(
        'UPDATE states SET laundry_count = laundry_count + 1 WHERE abbr = $1 OR name = $1',
        [normalizedStateAbbr]
      );
    } catch (err) {
      // Ignore state update errors to continue processing
      console.warn(`Could not update state count for ${normalizedStateAbbr}`);
    }
    
    // Update city count or insert new city
    if (cityName) {
      const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${normalizedStateAbbr.toLowerCase()}`;
      
      try {
        // Try to update existing city first
        const result = await client.query(
          'UPDATE cities SET laundry_count = laundry_count + 1 WHERE slug = $1 RETURNING id',
          [citySlug]
        );
        
        // If city doesn't exist, create it
        if (result.rowCount === 0) {
          await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 1) ON CONFLICT (slug) DO UPDATE SET laundry_count = cities.laundry_count + 1',
            [cityName, normalizedStateAbbr, citySlug]
          );
        }
      } catch (err) {
        // Ignore city update errors to continue processing
        console.warn(`Could not update city count for ${cityName}, ${normalizedStateAbbr}`);
      }
    }
  } catch (error) {
    console.error('Error updating location counters:', error.message);
  }
}

/**
 * Process a batch of records
 */
async function processBatch(records, batchIndex, totalBatches) {
  console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${records.length} records)...`);
  
  // Connect to the database
  const client = await pool.connect();
  
  try {
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
        
        // Import the record with its own transaction
        const success = await importRecord(client, record);
        
        if (success) {
          batchStats.imported++;
          stats.imported++;
        } else {
          batchStats.skipped++;
          stats.skipped++;
        }
        
        // Update the last processed index
        stats.lastProcessed = stats.lastProcessed + 1;
      } catch (error) {
        console.error(`Error importing record (${record.name}):`, error.message);
        batchStats.errors++;
        stats.errors++;
        
        // Still increment the last processed index to move forward
        stats.lastProcessed = stats.lastProcessed + 1;
      }
      
      // Log progress periodically
      if (stats.processed % 20 === 0) {
        // Save progress to file every 20 records
        saveProgress();
        
        const elapsedSeconds = (Date.now() - stats.startTime) / 1000;
        const recordsPerSecond = (stats.processed / elapsedSeconds).toFixed(2);
        console.log(`Processed ${stats.processed}/${stats.total} records (${recordsPerSecond} records/sec), imported: ${stats.imported}, skipped: ${stats.skipped}, errors: ${stats.errors}`);
      }
    }
    
    console.log(`Batch ${batchIndex + 1} results: processed ${batchStats.processed}, imported ${batchStats.imported}, skipped ${batchStats.skipped}, errors ${batchStats.errors}`);
    
    return batchStats;
  } catch (error) {
    console.error('Batch processing error:', error.message);
    throw error;
  } finally {
    // Release the client
    client.release();
  }
}

/**
 * Ensure states are set up properly
 */
async function setupStates() {
  const client = await pool.connect();
  try {
    console.log('Setting up states...');
    const stateData = [
      { abbr: 'AL', name: 'Alabama' },
      { abbr: 'AK', name: 'Alaska' },
      { abbr: 'AZ', name: 'Arizona' },
      { abbr: 'AR', name: 'Arkansas' },
      { abbr: 'CA', name: 'California' },
      { abbr: 'CO', name: 'Colorado' },
      { abbr: 'CT', name: 'Connecticut' },
      { abbr: 'DE', name: 'Delaware' },
      { abbr: 'FL', name: 'Florida' },
      { abbr: 'GA', name: 'Georgia' },
      { abbr: 'HI', name: 'Hawaii' },
      { abbr: 'ID', name: 'Idaho' },
      { abbr: 'IL', name: 'Illinois' },
      { abbr: 'IN', name: 'Indiana' },
      { abbr: 'IA', name: 'Iowa' },
      { abbr: 'KS', name: 'Kansas' },
      { abbr: 'KY', name: 'Kentucky' },
      { abbr: 'LA', name: 'Louisiana' },
      { abbr: 'ME', name: 'Maine' },
      { abbr: 'MD', name: 'Maryland' },
      { abbr: 'MA', name: 'Massachusetts' },
      { abbr: 'MI', name: 'Michigan' },
      { abbr: 'MN', name: 'Minnesota' },
      { abbr: 'MS', name: 'Mississippi' },
      { abbr: 'MO', name: 'Missouri' },
      { abbr: 'MT', name: 'Montana' },
      { abbr: 'NE', name: 'Nebraska' },
      { abbr: 'NV', name: 'Nevada' },
      { abbr: 'NH', name: 'New Hampshire' },
      { abbr: 'NJ', name: 'New Jersey' },
      { abbr: 'NM', name: 'New Mexico' },
      { abbr: 'NY', name: 'New York' },
      { abbr: 'NC', name: 'North Carolina' },
      { abbr: 'ND', name: 'North Dakota' },
      { abbr: 'OH', name: 'Ohio' },
      { abbr: 'OK', name: 'Oklahoma' },
      { abbr: 'OR', name: 'Oregon' },
      { abbr: 'PA', name: 'Pennsylvania' },
      { abbr: 'RI', name: 'Rhode Island' },
      { abbr: 'SC', name: 'South Carolina' },
      { abbr: 'SD', name: 'South Dakota' },
      { abbr: 'TN', name: 'Tennessee' },
      { abbr: 'TX', name: 'Texas' },
      { abbr: 'UT', name: 'Utah' },
      { abbr: 'VT', name: 'Vermont' },
      { abbr: 'VA', name: 'Virginia' },
      { abbr: 'WA', name: 'Washington' },
      { abbr: 'WV', name: 'West Virginia' },
      { abbr: 'WI', name: 'Wisconsin' },
      { abbr: 'WY', name: 'Wyoming' }
    ];
    
    // First count states
    const stateResult = await client.query('SELECT COUNT(*) FROM states');
    const stateCount = parseInt(stateResult.rows[0].count);
    console.log(`${stateCount} states found in database`);
    
    // Add any missing states
    for (const state of stateData) {
      const slug = state.name.toLowerCase().replace(/\s+/g, '-');
      try {
        await client.query(
          'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING',
          [state.name, state.abbr, slug]
        );
      } catch (err) {
        console.warn(`Error inserting state ${state.name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error setting up states:', err.message);
  } finally {
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
    
    let resuming = loadProgress();
    
    if (!resuming) {
      // Starting fresh
      stats.total = fileData.length;
      stats.startTime = Date.now();
    }
    
    console.log(`Found ${stats.total} total records to import`);
    
    // Set up states first to avoid database errors
    await setupStates();
    
    // Calculate batch parameters
    const totalBatches = Math.ceil(fileData.length / BATCH_SIZE);
    let startBatchIndex = Math.floor(stats.lastProcessed / BATCH_SIZE);
    
    console.log(`Starting from record ${stats.lastProcessed} (batch ${startBatchIndex + 1} of ${totalBatches})`);
    
    // Process batches from where we left off
    for (let batchIndex = startBatchIndex; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, fileData.length);
      
      // If resuming and partially through a batch, adjust the start
      const adjustedStart = batchIndex === startBatchIndex && resuming 
        ? stats.lastProcessed 
        : start;
      
      const batch = fileData.slice(adjustedStart, end);
      
      if (batch.length === 0) continue;
      
      await processBatch(batch, batchIndex, totalBatches);
      
      // Save progress after each batch
      saveProgress();
      
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
    
    // Clean up progress file after successful import
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
    
    // Close the pool
    await pool.end();
    
    return stats;
  } catch (error) {
    console.error('Import error:', error.message);
    
    // Save progress before exiting on error
    saveProgress();
    
    await pool.end();
    throw error;
  }
}

// Start the import
console.log('=== Starting Full Data Import ===');
importData()
  .then(() => {
    console.log('=== Import Process Completed ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('=== Import Process Failed ===', error);
    process.exit(1);
  });