/**
 * Background Laundromat Import Service
 * 
 * This script runs as a background service to continuously import
 * laundromat data in small batches with automatic pauses and retry logic.
 * 
 * Usage:
 * - Run with: node scripts/background-import.js
 * - Press Ctrl+C to stop gracefully
 */

import { Pool } from 'pg';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import format from 'pg-format';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

dotenv.config();

// Configuration
const BATCH_SIZE = 200; // Process 200 records at a time
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';
const PROGRESS_FILE = '/home/runner/workspace/import-progress.json';
const LOG_FILE = '/home/runner/workspace/import-log.json';
const PID_FILE = '/home/runner/workspace/import-service.pid';
const PAUSE_BETWEEN_BATCHES = 1000; // 1 second pause between batches

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Global state
let isRunning = true;
let currentProgress = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function updateStatus(status) {
  process.stdout.write(`\r${status}`.padEnd(100));
}

/**
 * Get current laundromat count from the database
 */
async function getCurrentCount() {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM laundromats');
    return parseInt(countResult.rows[0].count);
  } catch (error) {
    log(`Error getting current count: ${error.message}`);
    return 0;
  }
}

/**
 * Load or initialize progress tracking file
 */
async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Initial progress state
    const initialState = {
      totalImported: 0,
      lastBatchSize: 0,
      lastRunTime: 0,
      currentState: null,
      currentOffset: 0,
      completedStates: [],
      remainingStates: Object.keys(STATE_MAPPING),
      batchesRun: 0,
      totalRunTime: 0,
      startTime: Date.now(),
      recordsPerMinute: 0,
      errors: [],
      lastUpdate: new Date().toISOString()
    };
    
    await saveProgress(initialState);
    return initialState;
  }
}

/**
 * Save progress to file
 */
async function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
  
  // Also create a backup
  await fs.writeFile(
    '/home/runner/workspace/import-progress-backup.json', 
    JSON.stringify(progress, null, 2), 
    'utf8'
  );
  
  // Update global state
  currentProgress = progress;
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

// Get full state name from abbreviation
function getStateNameFromAbbr(abbr) {
  return STATE_MAPPING[abbr] || abbr;
}

// Generate a slug from name, city, and state
function generateSlug(name, city, state) {
  // Create a base slug from name, city, and state
  const baseSlug = `${name || 'laundromat'} ${city || 'city'} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-');        // Replace spaces with hyphens
  
  // Add a random string to ensure uniqueness
  const randomStr = uuidv4().substring(0, 6);
  return `${baseSlug}-${randomStr}`;
}

// Generate SEO tags for a laundromat
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

// Generate SEO description
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
 * Run a single import batch
 */
async function runImportBatch() {
  if (!currentProgress) {
    currentProgress = await loadProgress();
  }
  
  try {
    const startTime = Date.now();
    
    // Get current count for reporting
    const startingCount = await getCurrentCount();
    
    // Load all data from Excel file
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allData = xlsx.utils.sheet_to_json(sheet);
    
    // Determine which state to process
    let currentState = currentProgress.currentState;
    let currentOffset = currentProgress.currentOffset;
    
    if (!currentState || currentProgress.remainingStates.length === 0) {
      // Select a new state if we don't have one or we've completed all states
      if (currentProgress.remainingStates.length === 0) {
        log('All states have been processed.');
        return {
          status: 'completed',
          totalImported: currentProgress.totalImported
        };
      }
      
      currentState = currentProgress.remainingStates[0];
      currentOffset = 0;
      log(`Selected new state: ${currentState}`);
    }
    
    // Process batch
    log(`Processing ${currentState} (${getStateNameFromAbbr(currentState)}) at offset ${currentOffset}`);
    
    // Find all records for this state
    const stateRecords = allData.filter(record => 
      record.state && record.state.trim().toUpperCase() === currentState
    );
    
    if (stateRecords.length === 0) {
      log(`No records found for ${currentState}, skipping...`);
      
      // Mark state as completed
      currentProgress.completedStates.push(currentState);
      currentProgress.remainingStates = currentProgress.remainingStates.filter(s => s !== currentState);
      currentProgress.currentState = null;
      currentProgress.currentOffset = 0;
      
      await saveProgress(currentProgress);
      
      return { 
        status: 'skipped',
        state: currentState
      };
    }
    
    // Get current batch
    const batchRecords = stateRecords.slice(currentOffset, currentOffset + BATCH_SIZE);
    
    if (batchRecords.length === 0) {
      log(`No more records for ${currentState} at offset ${currentOffset}, state completed`);
      
      // Mark state as completed
      currentProgress.completedStates.push(currentState);
      currentProgress.remainingStates = currentProgress.remainingStates.filter(s => s !== currentState);
      currentProgress.currentState = null;
      currentProgress.currentOffset = 0;
      
      await saveProgress(currentProgress);
      
      return { 
        status: 'completed_state',
        state: currentState,
        totalStateRecords: stateRecords.length
      };
    }
    
    // Process the batch
    const client = await pool.connect();
    let insertedCount = 0;
    
    try {
      // Ensure state exists in states table
      await client.query('BEGIN');
      const stateName = getStateNameFromAbbr(currentState);
      const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
      
      // Check if the state already exists
      const stateCheck = await client.query(
        'SELECT id FROM states WHERE abbr = $1 OR name = $2',
        [currentState, stateName]
      );
      
      // Insert state if it doesn't exist
      if (stateCheck.rows.length === 0) {
        await client.query(
          'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3)',
          [stateName, stateSlug, currentState]
        );
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
      
      // Skip if no valid records
      if (validRecords.length === 0) {
        await client.query('COMMIT');
        
        // Move to next batch
        currentProgress.currentOffset = currentOffset + BATCH_SIZE;
        await saveProgress(currentProgress);
        
        return { 
          status: 'no_valid_records',
          state: currentState,
          offset: currentOffset
        };
      }
      
      // Process using pg-format for safe SQL
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
      insertedCount = result.rowCount;
      
      // Update state laundry_count
      await client.query(
        'UPDATE states SET laundry_count = (SELECT COUNT(*) FROM laundromats WHERE state = $1) WHERE name = $1 OR abbr = $2',
        [stateName, currentState]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      log(`Error in batch: ${error.message}`);
      
      // Record the error
      currentProgress.errors.push({
        timestamp: new Date().toISOString(),
        state: currentState,
        offset: currentOffset,
        message: error.message
      });
      
      await saveProgress(currentProgress);
      
      return {
        status: 'error',
        message: error.message
      };
    } finally {
      client.release();
    }
    
    // Update progress
    const runTime = (Date.now() - startTime) / 1000;
    currentProgress.lastBatchSize = insertedCount;
    currentProgress.totalImported += insertedCount;
    currentProgress.lastRunTime = runTime;
    currentProgress.totalRunTime += runTime;
    currentProgress.batchesRun += 1;
    currentProgress.currentState = currentState;
    
    // Calculate insertion rate
    if (insertedCount > 0 && runTime > 0) {
      const currentRate = insertedCount / (runTime / 60);
      // Weighted average to smooth fluctuations
      if (currentProgress.recordsPerMinute === 0) {
        currentProgress.recordsPerMinute = currentRate;
      } else {
        currentProgress.recordsPerMinute = 0.7 * currentProgress.recordsPerMinute + 0.3 * currentRate;
      }
    }
    
    // Move to next batch
    if (currentOffset + BATCH_SIZE >= stateRecords.length) {
      // State completed
      currentProgress.completedStates.push(currentState);
      currentProgress.remainingStates = currentProgress.remainingStates.filter(s => s !== currentState);
      currentProgress.currentState = null;
      currentProgress.currentOffset = 0;
      log(`Completed state: ${currentState}`);
    } else {
      // Move to next batch
      currentProgress.currentOffset = currentOffset + BATCH_SIZE;
    }
    
    await saveProgress(currentProgress);
    
    // Calculate estimated time remaining
    let estimatedRemaining = 'unknown';
    if (currentProgress.recordsPerMinute > 0) {
      const totalRecords = 27188; // Total from the file
      const remaining = totalRecords - (startingCount + insertedCount);
      const minutesRemaining = remaining / currentProgress.recordsPerMinute;
      const hoursRemaining = (minutesRemaining / 60).toFixed(1);
      estimatedRemaining = `${hoursRemaining} hours`;
    }
    
    // Log batch summary
    const finalCount = await getCurrentCount();
    const summaryData = {
      state: currentState,
      offset: currentOffset,
      batchSize: BATCH_SIZE,
      validRecords: validRecords.length,
      inserted: insertedCount,
      duration: runTime.toFixed(2),
      rate: Math.round(insertedCount / (runTime / 60)),
      overallRate: Math.round(currentProgress.recordsPerMinute),
      remaining: estimatedRemaining,
      totalCount: finalCount
    };
    
    await logOperation({
      action: 'batch_complete',
      ...summaryData
    });
    
    return {
      status: 'success',
      ...summaryData
    };
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    
    // Record the error
    if (currentProgress) {
      currentProgress.errors.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack
      });
      
      await saveProgress(currentProgress);
    }
    
    await logOperation({
      action: 'fatal_error',
      message: error.message,
      stack: error.stack
    });
    
    return {
      status: 'fatal_error',
      message: error.message
    };
  }
}

/**
 * Check if we should stop the import process
 */
function shouldStop() {
  return !isRunning;
}

/**
 * Main background import loop
 */
async function startBackgroundImport() {
  // Write PID file for management
  await fs.writeFile(PID_FILE, process.pid.toString(), 'utf8');
  
  log('Background import service started');
  currentProgress = await loadProgress();
  
  // Print initial status
  const currentCount = await getCurrentCount();
  log(`
===== Import Service Started =====
PID: ${process.pid}
Current laundromat count: ${currentCount}
Completed states: ${currentProgress.completedStates.join(', ')}
Remaining states: ${currentProgress.remainingStates.length} states
Total imported so far: ${currentProgress.totalImported} records
================================
  `);
  
  // Setup clean shutdown
  process.on('SIGINT', async () => {
    log('Received SIGINT, stopping gracefully...');
    isRunning = false;
  });
  
  process.on('SIGTERM', async () => {
    log('Received SIGTERM, stopping gracefully...');
    isRunning = false;
  });
  
  // Main import loop
  let lastBatchTime = Date.now();
  let consecutiveErrors = 0;
  
  while (!shouldStop()) {
    try {
      // Run a batch
      const result = await runImportBatch();
      
      // Reset error counter on success
      if (result.status !== 'error' && result.status !== 'fatal_error') {
        consecutiveErrors = 0;
      } else {
        consecutiveErrors++;
      }
      
      // Completed all imports
      if (result.status === 'completed') {
        log('All laundromat data has been imported!');
        break;
      }
      
      // Check for too many consecutive errors
      if (consecutiveErrors >= 5) {
        log('Too many consecutive errors, pausing for 30 seconds...');
        await sleep(30000); // 30 second pause
        consecutiveErrors = 0;
      }
      
      // Update status display
      const currentCount = await getCurrentCount();
      const totalStates = Object.keys(STATE_MAPPING).length;
      const completedStates = currentProgress.completedStates.length;
      const progress = Math.round((currentCount / 27188) * 100);
      const stateProgress = Math.round((completedStates / totalStates) * 100);
      
      updateStatus(`Imported ${currentCount}/27188 (${progress}%) | States: ${completedStates}/${totalStates} (${stateProgress}%) | Rate: ${Math.round(currentProgress.recordsPerMinute)}/min`);
      
      // Pause between batches
      await sleep(PAUSE_BETWEEN_BATCHES);
      
      // Every 5 minutes, give a full status report
      if (Date.now() - lastBatchTime > 5 * 60 * 1000) {
        log(`
===== Import Progress Update =====
Current count: ${currentCount} of 27188 (${progress}%)
Completed states: ${currentProgress.completedStates.length} of ${totalStates} (${stateProgress}%)
Current state: ${currentProgress.currentState || 'None'}
Import rate: ${Math.round(currentProgress.recordsPerMinute)}/minute
Total run time: ${Math.round(currentProgress.totalRunTime / 60)} minutes
================================
        `);
        lastBatchTime = Date.now();
      }
    } catch (error) {
      log(`Unexpected error in main loop: ${error.message}`);
      consecutiveErrors++;
      
      // Pause after error
      await sleep(5000);
    }
  }
  
  // Cleanup on exit
  await logOperation({
    action: 'service_stopped',
    totalImported: currentProgress.totalImported,
    message: 'Import service stopped gracefully'
  });
  
  log('Background import service stopped');
  
  try {
    await fs.unlink(PID_FILE);
  } catch (error) {
    // Ignore error
  }
  
  await pool.end();
}

// Start the import process
startBackgroundImport().catch(error => {
  console.error(`Fatal error in background service: ${error.stack}`);
  process.exit(1);
});