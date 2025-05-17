/**
 * Micro-Batch Import Script
 * 
 * This script imports a small batch of laundromat records (25) at a time
 * to avoid timeouts and ensure progress in database population.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

// Current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Configuration
const BATCH_SIZE = 25;
const SOURCE_FILE = path.join(cwd, 'data/import_ready_laundromats.json');
const PROGRESS_FILE = path.join(cwd, 'data/import-progress.json');

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// State abbreviation to full name mapping
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
 * Load progress from file or create initial progress
 */
async function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress file:', error);
  }
  
  // Default progress object
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
async function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

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
    
    // Upsert the state
    const upsertStateResult = await client.query(
      `INSERT INTO states (name, abbr, slug, laundry_count) 
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (slug) 
       DO UPDATE SET laundry_count = states.laundry_count + 1
       RETURNING id`,
      [stateName, stateAbbr, stateSlug]
    );
    const stateId = upsertStateResult.rows[0].id;
    
    // Process city
    const cityName = record.city;
    const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;
    
    // Upsert the city
    await client.query(
      `INSERT INTO cities (name, state, slug, laundry_count, state_id) 
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (slug) 
       DO UPDATE SET laundry_count = cities.laundry_count + 1`,
      [cityName, stateAbbr, citySlug, stateId]
    );
    
    return true;
  } catch (error) {
    console.error('Error processing location data:', error);
    return false;
  }
}

/**
 * Import a small batch of records
 */
async function importMicroBatch(allData, progress) {
  // Calculate batch end position
  const start = progress.position;
  const end = Math.min(start + BATCH_SIZE, allData.length);
  const batch = allData.slice(start, end);
  
  if (batch.length === 0) {
    console.log('No more records to process.');
    return false;
  }
  
  console.log(`Processing batch from position ${start} to ${end-1} (${batch.length} records)...`);
  
  // Connect to database
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    let batchStats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: 0
    };
    
    // Process each record in batch
    for (const record of batch) {
      try {
        batchStats.processed++;
        
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
        
        // Prepare SEO fields
        const seoTitle = record.seoTitle || `${record.name} - Laundromat in ${record.city}, ${record.state}`;
        
        // Handle services for description
        let serviceList = ['Self-service laundry'];
        try {
          if (typeof services === 'string') {
            const parsedServices = JSON.parse(services);
            if (Array.isArray(parsedServices) && parsedServices.length > 0) {
              serviceList = parsedServices;
            }
          }
        } catch (e) {
          console.log('Error parsing services:', e);
        }
        
        const seoDescription = record.seoDescription || 
          `Visit ${record.name} in ${record.city}, ${record.state}. Offering ${serviceList.join(', ')}. Open 7 days a week for all your laundry needs.`;
        
        // Create SEO tags as proper JSON
        const defaultTags = [
          "laundromat", "laundry service", `laundromat in ${record.city}`, 
          `laundry in ${record.state}`, "coin laundry", "self-service laundry"
        ];
        
        let seoTags;
        if (record.seoTags) {
          try {
            // If it's already JSON, keep it
            if (typeof record.seoTags === 'string') {
              JSON.parse(record.seoTags); // Just to validate
              seoTags = record.seoTags;
            } else if (Array.isArray(record.seoTags)) {
              seoTags = JSON.stringify(record.seoTags);
            } else {
              seoTags = JSON.stringify(defaultTags);
            }
          } catch (e) {
            seoTags = JSON.stringify(defaultTags);
          }
        } else {
          seoTags = JSON.stringify(defaultTags);
        }
        
        // Insert the laundromat
        const insertQuery = `
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website, 
            latitude, longitude, rating, review_count, hours, 
            services, amenities, machine_count, listing_type, is_featured,
            is_verified, image_url, description, created_at, 
            seo_title, seo_description, seo_tags, premium_score
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
                  $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `;
        
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
          record.rating || 4.0,
          record.reviewCount || 0,
          record.hours || '{"Monday":"7:00 AM - 10:00 PM","Tuesday":"7:00 AM - 10:00 PM","Wednesday":"7:00 AM - 10:00 PM","Thursday":"7:00 AM - 10:00 PM","Friday":"7:00 AM - 10:00 PM","Saturday":"7:00 AM - 10:00 PM","Sunday":"7:00 AM - 10:00 PM"}',
          services,
          amenities,
          machineCount,
          record.listingType || 'basic',
          record.isFeatured || false,
          record.isVerified || record.verified || false,
          record.imageUrl || null,
          record.description || `${record.name} is a laundromat located in ${record.city}, ${record.state}.`,
          new Date(),
          seoTitle,
          seoDescription,
          seoTags,
          record.premiumScore || 50
        ]);
        
        if (result.rowCount > 0) {
          batchStats.imported++;
          
          // Process cities and states
          await processLocationData(client, record);
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
    progress.position = end;
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
    // Release the client
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Read the source data
    console.log(`Reading data from: ${SOURCE_FILE}`);
    const data = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    
    if (!Array.isArray(data)) {
      throw new Error('Source data must be an array');
    }
    
    // Load or initialize progress
    const progress = await loadProgress();
    
    // Make sure essential properties exist
    if (progress.position === undefined) {
      progress.position = 0;
    }
    
    // Set total count if not already set
    if (!progress.total) {
      progress.total = data.length;
    }
    
    console.log(`Starting import from position ${progress.position} of ${progress.total} total records`);
    
    // Process one batch
    const success = await importMicroBatch(data, progress);
    
    // Save the current progress
    await saveProgress(progress);
    
    if (success) {
      if (progress.position < progress.total) {
        console.log(`Run this script again to continue from position ${progress.position}`);
      } else {
        console.log('All records have been processed!');
      }
    } else {
      console.log('Import encountered an error. Fix the issue and try again.');
    }
    
    // Close database connection
    await pool.end();
    
  } catch (error) {
    console.error('Error in import process:', error);
    await pool.end();
    process.exit(1);
  }
}

// Start the import process
console.log('=== Starting Micro-Batch Import ===');
main()
  .then(() => {
    console.log('=== Micro-Batch Import Completed ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('=== Micro-Batch Import Failed ===', error);
    process.exit(1);
  });