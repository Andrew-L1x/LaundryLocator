/**
 * Simple Small Batch Import Script
 * 
 * A lightweight script to import a very small batch of laundromat records
 * without exceeding Replit's memory constraints.
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// Configuration - very small batch size to avoid memory issues
const BATCH_SIZE = 10;
const SOURCE_FILE = './data/import_ready_laundromats.json';
const PROGRESS_FILE = './data/import-progress.json';

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
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
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

/**
 * Load progress from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  
  return {
    position: 0,
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    lastUpdate: new Date().toISOString()
  };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Process one small batch of records
 */
async function processSmallBatch(data, progress) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    const startPos = progress.position;
    const endPos = Math.min(startPos + BATCH_SIZE, data.length);
    const batch = data.slice(startPos, endPos);
    
    console.log(`Processing records ${startPos} to ${endPos-1} (${batch.length} records)`);
    
    let batchStats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: 0
    };
    
    // Process each record
    for (const record of batch) {
      try {
        batchStats.processed++;
        
        // Get state information
        const stateAbbr = record.state.toUpperCase();
        const stateName = stateMap[stateAbbr] || record.state;
        const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
        
        // Insert or update state
        const stateResult = await client.query(
          `INSERT INTO states (name, abbr, slug, laundry_count) 
           VALUES ($1, $2, $3, 1)
           ON CONFLICT (slug) 
           DO UPDATE SET laundry_count = states.laundry_count + 1
           RETURNING id`,
          [stateName, stateAbbr, stateSlug]
        );
        const stateId = stateResult.rows[0].id;
        
        // Process city
        const cityName = record.city;
        const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;
        
        // Insert or update city
        await client.query(
          `INSERT INTO cities (name, state, slug, laundry_count, state_id) 
           VALUES ($1, $2, $3, 1, $4)
           ON CONFLICT (slug) 
           DO UPDATE SET laundry_count = cities.laundry_count + 1`,
          [cityName, stateAbbr, citySlug, stateId]
        );
        
        // Handle services and amenities
        const services = typeof record.services === 'string' 
          ? record.services 
          : JSON.stringify(record.services || ['Self-service laundry']);
          
        const amenities = typeof record.amenities === 'string'
          ? record.amenities
          : JSON.stringify(record.amenities || ['Vending machines']);
          
        // Insert the laundromat
        const result = await client.query(`
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website, 
            latitude, longitude, rating, review_count, hours, 
            services, amenities, listing_type, is_featured,
            is_verified, image_url, description, created_at
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
                  $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `, [
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
          record.rating || '4.0',
          record.reviewCount || 0,
          record.hours || '{"Monday":"7:00 AM - 10:00 PM","Tuesday":"7:00 AM - 10:00 PM","Wednesday":"7:00 AM - 10:00 PM","Thursday":"7:00 AM - 10:00 PM","Friday":"7:00 AM - 10:00 PM","Saturday":"7:00 AM - 10:00 PM","Sunday":"7:00 AM - 10:00 PM"}',
          services,
          amenities,
          'standard',
          false, // No featured laundromats per user request
          false,
          record.imageUrl || null,
          record.description || `${record.name} is a laundromat located in ${record.city}, ${record.state}.`,
          new Date()
        ]);
        
        if (result.rowCount > 0) {
          batchStats.imported++;
        } else {
          batchStats.skipped++;
        }
      } catch (error) {
        console.error(`Error importing record:`, error);
        batchStats.errors++;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Update progress
    progress.position = endPos;
    progress.imported += batchStats.imported;
    progress.skipped += batchStats.skipped;
    progress.errors += batchStats.errors;
    
    console.log(`Batch results: processed ${batchStats.processed}, imported ${batchStats.imported}, skipped ${batchStats.skipped}, errors ${batchStats.errors}`);
    console.log(`Overall progress: ${progress.position}/${progress.total} (${Math.round((progress.position/progress.total)*100)}%)`);
    
    return true;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Batch processing error:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Load the data
    console.log('Reading data file...');
    const rawData = fs.readFileSync(SOURCE_FILE, 'utf8');
    const data = JSON.parse(rawData);
    
    // Load progress
    const progress = loadProgress();
    progress.total = data.length;
    
    console.log(`Total records: ${progress.total}, current position: ${progress.position}`);
    
    // Process one small batch
    const success = await processSmallBatch(data, progress);
    
    // Save progress
    saveProgress(progress);
    
    // Success message
    if (success) {
      if (progress.position < progress.total) {
        console.log(`Completed batch successfully. Run script again to continue from position ${progress.position}`);
      } else {
        console.log('All records have been processed!');
      }
    } else {
      console.log('Import encountered an error. Fix the issue and try again.');
    }
  } catch (error) {
    console.error('Import process error:', error);
  } finally {
    await pool.end();
  }
}

console.log('=== Starting Simple Small Batch Import ===');
main()
  .then(() => {
    console.log('=== Import Task Completed ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('=== Import Failed ===', error);
    process.exit(1);
  });