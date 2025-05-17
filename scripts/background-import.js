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

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { once } from 'events';
import dotenv from 'dotenv';

dotenv.config();
const execPromise = promisify(exec);

// Configuration
const BATCH_SIZE = 5; // Records per batch
const PAUSE_SECONDS = 15; // Seconds between batches
const MAX_CONSECUTIVE_ERRORS = 3;
const LOG_FILE = 'import-log.txt';
const STATUS_FILE = 'import-status.json';
const STOP_FILE = 'stop-import.txt'; // Create this file to gracefully stop the import

// Global state
let isRunning = true;
let consecutiveErrors = 0;
let totalBatchesRun = 0;
let totalRecordsImported = 0;
let startTime = Date.now();

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function updateStatus(status) {
  const currentStatus = {
    ...status,
    lastUpdated: new Date().toISOString(),
    runningTime: `${Math.floor((Date.now() - startTime) / 60000)} minutes`,
    isRunning
  };
  
  fs.writeFileSync(STATUS_FILE, JSON.stringify(currentStatus, null, 2));
}

/**
 * Get current laundromat count from the database
 */
async function getCurrentCount() {
  try {
    const { stdout } = await execPromise(`
      PGPASSWORD=${process.env.PGPASSWORD} psql -h ${process.env.PGHOST} -U ${process.env.PGUSER} -d ${process.env.PGDATABASE} -c "SELECT COUNT(*) FROM laundromats;" -t
    `);
    
    return parseInt(stdout.trim());
  } catch (error) {
    log(`Error getting current count: ${error.message}`);
    return 0;
  }
}

/**
 * Run a single import batch
 */
async function runImportBatch() {
  try {
    log('Starting import batch...');
    const { stdout, stderr } = await execPromise('node scripts/optimized-import.js');
    
    if (stderr) {
      log(`Import stderr: ${stderr}`);
    }
    
    // Extract the results using regex
    const recordsInsertedMatch = stdout.match(/Records inserted: (\d+)/);
    const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
    
    const finalCountMatch = stdout.match(/Final count: (\d+)/);
    const finalCount = finalCountMatch ? parseInt(finalCountMatch[1]) : 0;
    
    log(`Batch completed: ${recordsInserted} records inserted. Total count: ${finalCount}`);
    totalRecordsImported += recordsInserted;
    
    // Reset consecutive errors on success
    consecutiveErrors = 0;
    
    return { success: true, recordsInserted, finalCount };
  } catch (error) {
    consecutiveErrors++;
    log(`Import error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Check if we should stop the import process
 */
function shouldStop() {
  // Check for stop file
  if (fs.existsSync(STOP_FILE)) {
    log('Stop file detected. Gracefully stopping import process.');
    isRunning = false;
    return true;
  }
  
  // Check for too many consecutive errors
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    log(`Too many consecutive errors (${consecutiveErrors}). Stopping import process.`);
    isRunning = false;
    return true;
  }
  
  return false;
}

/**
 * Main background import loop
 */
async function startBackgroundImport() {
  log('Starting background import service...');
  
  // Create empty log file if it doesn't exist
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }
  
  // Remove stop file if it exists
  if (fs.existsSync(STOP_FILE)) {
    fs.unlinkSync(STOP_FILE);
  }
  
  // Initialize status
  const initialCount = await getCurrentCount();
  log(`Initial laundromat count: ${initialCount}`);
  
  updateStatus({
    totalBatchesRun: 0,
    recordsImported: 0,
    currentCount: initialCount,
    consecutiveErrors: 0,
    batchSize: BATCH_SIZE,
    pauseSeconds: PAUSE_SECONDS
  });
  
  // Register process termination handlers
  process.on('SIGINT', async () => {
    log('Received SIGINT. Gracefully stopping import process...');
    isRunning = false;
  });
  
  process.on('SIGTERM', async () => {
    log('Received SIGTERM. Gracefully stopping import process...');
    isRunning = false;
  });
  
  // Main import loop
  while (isRunning) {
    // Check if we should stop
    if (shouldStop()) {
      break;
    }
    
    // Run a batch
    totalBatchesRun++;
    const result = await runImportBatch();
    
    // Update status
    const currentCount = await getCurrentCount();
    updateStatus({
      totalBatchesRun,
      recordsImported: totalRecordsImported,
      currentCount,
      consecutiveErrors,
      lastBatchSuccess: result.success,
      lastBatchRecords: result.recordsInserted || 0,
      batchSize: BATCH_SIZE,
      pauseSeconds: PAUSE_SECONDS,
      startedAt: new Date(startTime).toISOString()
    });
    
    // Pause between batches if still running
    if (isRunning) {
      log(`Pausing for ${PAUSE_SECONDS} seconds before next batch...`);
      await sleep(PAUSE_SECONDS * 1000);
    }
  }
  
  // Final status update
  const finalCount = await getCurrentCount();
  log(`
    Background import service stopped.
    Total batches run: ${totalBatchesRun}
    Total records imported: ${totalRecordsImported}
    Starting count: ${initialCount}
    Final count: ${finalCount}
    Net added: ${finalCount - initialCount}
    Total runtime: ${Math.floor((Date.now() - startTime) / 60000)} minutes
  `);
  
  updateStatus({
    totalBatchesRun,
    recordsImported: totalRecordsImported,
    startingCount: initialCount,
    finalCount,
    netAdded: finalCount - initialCount,
    isRunning: false,
    stoppedAt: new Date().toISOString(),
    totalRuntime: `${Math.floor((Date.now() - startTime) / 60000)} minutes`
  });
}

// Start the background import process
startBackgroundImport().catch(error => {
  log(`Fatal error in background import: ${error.stack}`);
  isRunning = false;
  updateStatus({
    error: error.message,
    isRunning: false,
    crashedAt: new Date().toISOString()
  });
});

// Log startup
log('Background import service launched in detached mode');