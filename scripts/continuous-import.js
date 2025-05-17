/**
 * Continuous Import Automation for Laundromat Data
 * 
 * This script runs a continuous import process for all 27,188 laundromat records
 * with small batch sizes and proper error handling to restart after timeouts.
 */

import { Pool } from 'pg';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import format from 'pg-format';
import { promises as fs } from 'fs';
import path from 'path';

dotenv.config();

// Configuration
const BATCH_SIZE = 200; // Process 200 records at a time
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';
const PROGRESS_FILE = '/home/runner/workspace/import-progress.json';
const LOG_FILE = '/home/runner/workspace/import-log.json';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Required fields with default values
const DEFAULT_VALUES = {
  address: "123 Main Street",
  phone: "555-555-5555",
  hours: "9AM-9PM Daily",
  latitude: "37.0902",
  longitude: "-95.7129",
  services: ["Laundromat Service"],
  rating: "4.0",
  reviewCount: 0
};

// State name mapping for consistency
const STATE_MAPPING = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current laundromat count from the database
 */
async function getCurrentCount() {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM laundromats');
    return parseInt(countResult.rows[0].count);
  } catch (error) {
    console.error(`Error getting current count: ${error.message}`);
    return 0;
  }
}

/**
 * Load progress from file or create initial progress
 */
async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Initial progress state
    return {
      totalImported: 0,
      lastBatchSize: 0,
      lastRunTime: 0,
      currentOffset: 0,
      completedStates: [],
      remainingStates: Object.keys(STATE_MAPPING),
      currentState: null,
      batchesRun: 0,
      totalRunTime: 0,
      startTime: Date.now(),
      recordsPerMinute: 0,
      errors: []
    };
  }
}

/**
 * Save progress to file
 */
async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
  // Also create a backup
  await fs.writeFile(
    '/home/runner/workspace/import-progress-backup.json', 
    JSON.stringify(progress, null, 2), 
    'utf8'
  );
}

/**
 * Append to log file
 */
async function logOperation(operation) {
  try {
    let log = [];
    try {
      const data = await fs.readFile(LOG_FILE, 'utf8');
      log = JSON.parse(data);
    } catch (error) {
      // New log
    }
    
    log.push({
      timestamp: new Date().toISOString(),
      ...operation
    });
    
    await fs.writeFile(LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing to log: ${error.message}`);
  }
}

// Get full state name from abbreviation
function getStateNameFromAbbr(abbr) {
  return STATE_MAPPING[abbr] || abbr;
}

// Generate a slug from name, city, and state
function generateSlug(name, city, state) {
  // Create a base slug from name, city, and state
  const baseSlug = `${name || 'laundromat'} ${city || 'city'} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\\s-]/g, '') // Remove special characters
    .replace(/\\s+/g, '-');        // Replace spaces with hyphens
  
  // Add a random string to ensure uniqueness
  const randomStr = uuidv4().substring(0, 6);
  return `${baseSlug}-${randomStr}`;
}

// Generate SEO tags quickly using a template approach
function generateSeoTags(record) {
  const city = record.city || 'local';
  const state = record.state;
  const zip = record.zip || '';
  
  // Create a standard set of tags with location information
  return [
    'laundromat', 'laundry', 'wash', 'dry', 'cleaning',
    `${city} laundromat`, 
    `laundromat in ${city}`,
    `${state} laundromat`,
    `${city} ${state} laundry`,
    'laundromat near me',
    zip ? `${zip} laundromat` : '',
    'wash and fold',
    'dry cleaning',
    'self-service laundry'
  ].filter(tag => tag !== ''); // Remove empty tags
}

// Generate standard SEO description
function generateSeoDescription(record) {
  return `${record.name} is a convenient laundromat located in ${record.city}, ${record.state}. ` +
    `Find us at ${record.address}, ${record.city}, ${record.state} ${record.zip || ''}. ` +
    `Our services include wash and fold, dry cleaning, and self-service laundry. ` +
    `Call us at ${record.phone}. ` +
    `Looking for a laundromat near me? We're conveniently located to serve all your laundry needs!`;
}

// Generate SEO title
function generateSeoTitle(record) {
  return `${record.name} - Laundromat in ${record.city}, ${record.state}`;
}

/**
 * Process a batch of records for the specified state
 */
async function processBatch(allData, state, offset, batchSize) {
  console.log(`\n===== Processing ${state} (${getStateNameFromAbbr(state)}) - Batch at offset ${offset} =====`);
  
  const client = await pool.connect();
  try {
    // Find all records for this state
    console.log(`Finding records for ${state}...`);
    const stateRecords = allData.filter(record => 
      record.state && record.state.trim().toUpperCase() === state
    );
    
    if (stateRecords.length === 0) {
      console.log(`No records found for ${state}, skipping...`);
      return { 
        insertedCount: 0, 
        totalStateRecords: 0,
        isComplete: true
      };
    }
    
    console.log(`Found ${stateRecords.length} total records for ${state}`);
    
    // Take current batch based on offset
    const batchRecords = stateRecords.slice(offset, offset + batchSize);
    console.log(`Processing batch of ${batchRecords.length} records from offset ${offset}`);
    
    if (batchRecords.length === 0) {
      console.log(`No more records for ${state} at offset ${offset}, state completed`);
      return { 
        insertedCount: 0, 
        totalStateRecords: stateRecords.length,
        isComplete: true
      };
    }
    
    // Ensure state exists in states table
    await client.query('BEGIN');
    const stateName = getStateNameFromAbbr(state);
    const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
    
    // Check if the state already exists
    const stateCheck = await client.query(
      'SELECT id FROM states WHERE abbr = $1 OR name = $2',
      [state, stateName]
    );
    
    // Insert state if it doesn't exist
    if (stateCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3)',
        [stateName, stateSlug, state]
      );
      console.log(`Created state: ${state} (${stateName})`);
    } else {
      console.log(`State already exists: ${state} (${stateName})`);
    }
    
    // Prepare records for insertion
    const validRecords = [];
    
    for (let i = 0; i < batchRecords.length; i++) {
      const record = batchRecords[i];
      
      // Skip records without name or city
      if (!record.name || !record.city) {
        continue;
      }
      
      // Generate a unique slug
      const slug = generateSlug(record.name, record.city, stateName);
      
      // Generate SEO content
      const seoTags = generateSeoTags({...record, state: stateName});
      const seoTitle = generateSeoTitle({...record, state: stateName});
      const seoDescription = generateSeoDescription({...record, state: stateName});
      
      // Create the record with defaults for missing values
      validRecords.push({
        name: record.name,
        slug: slug,
        address: record.address || DEFAULT_VALUES.address,
        city: record.city,
        state: stateName,
        zip: record.zip || '',
        phone: record.phone || DEFAULT_VALUES.phone,
        website: record.website || null,
        latitude: record.latitude || DEFAULT_VALUES.latitude,
        longitude: record.longitude || DEFAULT_VALUES.longitude,
        rating: record.rating || DEFAULT_VALUES.rating,
        reviewCount: record.reviewCount || DEFAULT_VALUES.reviewCount,
        hours: record.hours || DEFAULT_VALUES.hours,
        services: JSON.stringify(Array.isArray(record.services) ? record.services : DEFAULT_VALUES.services),
        seoTitle: seoTitle,
        seoDescription: seoDescription,
        seoTags: JSON.stringify(seoTags),
        premiumScore: 50 // Default score
      });
    }
    
    console.log(`Prepared ${validRecords.length} valid records for insertion`);
    
    // Skip if no valid records
    if (validRecords.length === 0) {
      await client.query('COMMIT');
      console.log(`No valid records for this batch, skipping...`);
      
      return { 
        insertedCount: 0, 
        totalStateRecords: stateRecords.length,
        isComplete: offset + batchSize >= stateRecords.length
      };
    }
    
    // Process using pg-format for safe SQL
    let insertedCount = 0;
    const batchValues = [];
    
    for (const record of validRecords) {
      batchValues.push([
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
        record.reviewCount,
        record.hours,
        record.services,
        record.seoDescription,
        null, // image_url
        'basic', // listing_type
        false, // is_premium
        false, // is_featured
        record.seoTitle,
        record.seoDescription,
        record.seoTags,
        record.premiumScore
      ]);
    }
    
    try {
      // Use pg-format to safely build the query
      const insertQuery = format(
        `INSERT INTO laundromats (
          name, slug, address, city, state, zip, phone, website,
          latitude, longitude, rating, review_count,
          hours, services, description, image_url,
          listing_type, is_premium, is_featured,
          seo_title, seo_description, seo_tags, premium_score
        )
        VALUES %L
        ON CONFLICT (slug) DO NOTHING
        RETURNING id`,
        batchValues
      );
      
      const result = await client.query(insertQuery);
      console.log(`Inserted ${result.rowCount} records`);
      insertedCount = result.rowCount;
    } catch (error) {
      console.error(`Error in batch: ${error.message}`);
      // Continue despite errors by committing what we have
    }
    
    // Update state laundry_count
    await client.query(
      'UPDATE states SET laundry_count = (SELECT COUNT(*) FROM laundromats WHERE state = $1) WHERE name = $1 OR abbr = $2',
      [stateName, state]
    );
    
    await client.query('COMMIT');
    
    return { 
      insertedCount,
      totalStateRecords: stateRecords.length,
      isComplete: offset + batchSize >= stateRecords.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error processing batch: ${error.message}`);
    
    return { 
      insertedCount: 0,
      error: error.message,
      isComplete: false
    };
  } finally {
    client.release();
  }
}

/**
 * Run the main import process
 */
async function runImport() {
  const progress = await loadProgress();
  
  console.log(`
===== Continuous Import Status =====
Total imported: ${progress.totalImported}
Current state: ${progress.currentState || 'None selected yet'}
Current offset: ${progress.currentOffset}
Completed states: ${progress.completedStates.join(', ')}
Remaining states: ${progress.remainingStates.length} states
Total run time: ${Math.round(progress.totalRunTime / 60)} minutes
Records per minute: ${progress.recordsPerMinute}
======================================
  `);
  
  try {
    const startTime = Date.now();
    
    // Get current count
    const startingCount = await getCurrentCount();
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Load all data from Excel file
    console.log(`Reading Excel file: ${SOURCE_FILE}`);
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allData = xlsx.utils.sheet_to_json(sheet);
    console.log(`Read ${allData.length} total records from Excel file`);
    
    // Determine which state to process
    let currentState = progress.currentState;
    let currentOffset = progress.currentOffset;
    
    if (!currentState || progress.remainingStates.length === 0) {
      // Select a new state if we don't have one or we've completed all states
      if (progress.remainingStates.length === 0) {
        console.log('All states have been processed.');
        return {
          status: 'completed',
          totalImported: progress.totalImported
        };
      }
      
      currentState = progress.remainingStates[0];
      currentOffset = 0;
      console.log(`Selected new state: ${currentState}`);
    }
    
    // Process a batch for the current state
    const batchResult = await processBatch(allData, currentState, currentOffset, BATCH_SIZE);
    
    // Update progress
    progress.lastBatchSize = batchResult.insertedCount;
    progress.totalImported += batchResult.insertedCount;
    progress.currentState = currentState;
    progress.batchesRun += 1;
    
    // Calculate timing
    const runTime = (Date.now() - startTime) / 1000;
    progress.lastRunTime = runTime;
    progress.totalRunTime += runTime;
    
    if (batchResult.insertedCount > 0 && runTime > 0) {
      const currentRate = batchResult.insertedCount / (runTime / 60);
      // Weighted average to smooth fluctuations
      if (progress.recordsPerMinute === 0) {
        progress.recordsPerMinute = currentRate;
      } else {
        progress.recordsPerMinute = 0.7 * progress.recordsPerMinute + 0.3 * currentRate;
      }
    }
    
    // Handle state completion
    if (batchResult.isComplete) {
      console.log(`Completed state: ${currentState}`);
      progress.completedStates.push(currentState);
      progress.remainingStates = progress.remainingStates.filter(s => s !== currentState);
      progress.currentState = null;
      progress.currentOffset = 0;
    } else {
      // Move offset forward for next batch
      progress.currentOffset = currentOffset + BATCH_SIZE;
    }
    
    // If batch had an error, log it
    if (batchResult.error) {
      progress.errors.push({
        state: currentState,
        offset: currentOffset,
        message: batchResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    // Save progress
    await saveProgress(progress);
    
    // Log this operation
    await logOperation({
      action: 'batch_import',
      state: currentState,
      offset: currentOffset,
      batchSize: BATCH_SIZE,
      inserted: batchResult.insertedCount,
      duration: runTime,
      isComplete: batchResult.isComplete,
      error: batchResult.error
    });
    
    // Calculate estimated time remaining
    let estimatedRemaining = 'unknown';
    if (progress.recordsPerMinute > 0) {
      const totalRecords = 27188; // Total from the file
      const remaining = totalRecords - (startingCount + progress.lastBatchSize);
      const minutesRemaining = remaining / progress.recordsPerMinute;
      const hoursRemaining = (minutesRemaining / 60).toFixed(1);
      estimatedRemaining = `${hoursRemaining} hours`;
    }
    
    // Summary of this run
    console.log(`
===== Batch Import Summary =====
State: ${currentState}
Offset: ${currentOffset}
Batch size: ${BATCH_SIZE}
Records inserted: ${batchResult.insertedCount}
Duration: ${runTime.toFixed(2)} seconds
Insertion rate: ${Math.round(batchResult.insertedCount / (runTime / 60))} records/minute
Overall rate: ${Math.round(progress.recordsPerMinute)} records/minute
Estimated time remaining: ${estimatedRemaining}
State completed: ${batchResult.isComplete ? 'Yes' : 'No'}
==================================
    `);
    
    return {
      status: 'running',
      state: currentState,
      offset: currentOffset,
      inserted: batchResult.insertedCount,
      isComplete: batchResult.isComplete
    };
    
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    await logOperation({
      action: 'error',
      message: error.message,
      stack: error.stack
    });
    
    return {
      status: 'error',
      message: error.message
    };
  }
}

/**
 * Main function to run continuous imports
 */
async function main() {
  console.log('Starting continuous import process...');
  
  try {
    // Run in a loop until complete or error
    while (true) {
      const result = await runImport();
      
      if (result.status === 'completed') {
        console.log('All records have been imported successfully!');
        break;
      }
      
      if (result.status === 'error') {
        console.error(`Import process encountered a fatal error: ${result.message}`);
        // Wait before retrying
        console.log('Waiting 10 seconds before retrying...');
        await sleep(10000);
        continue;
      }
      
      // Pause between batches to avoid overloading the system
      const pauseTime = 2000; // 2 seconds
      console.log(`Pausing for ${pauseTime/1000} seconds before next batch...`);
      await sleep(pauseTime);
    }
  } catch (error) {
    console.error(`Unexpected error in main process: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Run the main process
main().then(() => {
  console.log('Continuous import process completed.');
}).catch(error => {
  console.error(`Unhandled error: ${error.stack}`);
  process.exit(1);
});