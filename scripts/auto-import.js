/**
 * Automated Import Process
 * 
 * This script runs continuous imports with proper pauses between batches
 * to automatically process all 27,188 laundromat records.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

// Configuration settings
const BATCH_SIZE = 5; // Records per batch
const PAUSE_SECONDS = 15; // Seconds between batches
const LOG_FILE = 'auto-import-log.txt';
const MAX_ERRORS = 3; // Max consecutive errors before stopping

// Global counters
let batchesCompleted = 0;
let recordsImported = 0;
let consecutiveErrors = 0;
let isRunning = true;
let startTime = Date.now();

// Simple logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
  } catch (error) {
    console.error(`Error writing to log: ${error.message}`);
  }
}

// Helper function for pausing
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get the current count of laundromats
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

// Run a single import batch
async function runImportBatch() {
  try {
    log('Starting import batch...');
    const { stdout, stderr } = await execPromise('node scripts/optimized-import.js');
    
    if (stderr && stderr.length > 0) {
      log(`Import stderr: ${stderr}`);
    }
    
    // Extract results from output
    const recordsInsertedMatch = stdout.match(/Records inserted: (\d+)/);
    const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
    
    const finalCountMatch = stdout.match(/Final count: (\d+)/);
    const finalCount = finalCountMatch ? parseInt(finalCountMatch[1]) : 0;
    
    log(`Batch completed successfully. Inserted: ${recordsInserted}, Total count: ${finalCount}`);
    
    recordsImported += recordsInserted;
    consecutiveErrors = 0; // Reset error count on success
    
    return { success: true, recordsInserted, finalCount };
  } catch (error) {
    consecutiveErrors++;
    log(`Error running import batch (${consecutiveErrors}/${MAX_ERRORS}): ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main import loop
async function startAutomatedImport() {
  log('Starting automated import process...');
  
  // Get starting count
  const startingCount = await getCurrentCount();
  log(`Starting laundromat count: ${startingCount}`);
  
  // Main loop
  while (isRunning) {
    // Check if we should stop due to errors
    if (consecutiveErrors >= MAX_ERRORS) {
      log(`Too many consecutive errors (${consecutiveErrors}). Stopping import process.`);
      break;
    }
    
    // Run an import batch
    batchesCompleted++;
    const result = await runImportBatch();
    
    // Log progress
    const currentCount = await getCurrentCount();
    const addedSoFar = currentCount - startingCount;
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
    
    log(`
      Progress update:
      Batches completed: ${batchesCompleted}
      Records imported: ${recordsImported}
      Added so far: ${addedSoFar}
      Current count: ${currentCount}
      Time elapsed: ${elapsedMinutes} minutes
      Import rate: ${(addedSoFar / elapsedMinutes).toFixed(2)} records/minute
    `);
    
    // Pause between batches
    log(`Pausing for ${PAUSE_SECONDS} seconds before next batch...`);
    await sleep(PAUSE_SECONDS * 1000);
  }
  
  // Final report
  const finalCount = await getCurrentCount();
  const totalElapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  
  log(`
    Automated import completed.
    Starting count: ${startingCount}
    Final count: ${finalCount}
    Total added: ${finalCount - startingCount}
    Batches completed: ${batchesCompleted}
    Time elapsed: ${totalElapsedMinutes} minutes
    Average import rate: ${((finalCount - startingCount) / totalElapsedMinutes).toFixed(2)} records/minute
  `);
}

// Start the import process
startAutomatedImport().catch(error => {
  log(`Fatal error in automated import: ${error.stack}`);
});

// Log startup
log('Automated import process started');