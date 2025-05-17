/**
 * Continuous Batch Import Script
 * 
 * This script repeatedly runs the micro-batch import
 * until all records are processed.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const BATCH_SIZE = 25; // Records per batch
const PAUSE_BETWEEN_BATCHES = 10000; // 10 seconds pause between batches
const MAX_IMPORT_TIME = 25000; // 25 seconds max run time per batch
const LOG_FILE = 'import-log.json';
const TOTAL_RECORDS = 27187;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a single batch import
 */
async function runBatchImport() {
  console.log('Starting batch import...');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/micro-batch-import.js'], {
      stdio: 'inherit',
      timeout: MAX_IMPORT_TIME
    });
    
    const timer = setTimeout(() => {
      console.log('Import taking too long, killing process...');
      child.kill();
      resolve({ success: false, error: 'Timeout' });
    }, MAX_IMPORT_TIME);
    
    child.on('error', (error) => {
      clearTimeout(timer);
      console.error(`Import error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        console.log('Batch import completed successfully');
        resolve({ success: true });
      } else {
        console.log(`Batch import exited with code ${code}`);
        resolve({ success: false, code });
      }
    });
  });
}

/**
 * Get current progress
 */
function getProgress() {
  try {
    const progressData = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    return progressData;
  } catch (error) {
    return { position: 0, totalImported: 0, lastRun: null };
  }
}

/**
 * Update progress log
 */
function updateProgress(position, totalImported) {
  const progressData = { 
    position, 
    totalImported,
    lastRun: new Date().toISOString()
  };
  fs.writeFileSync(LOG_FILE, JSON.stringify(progressData, null, 2));
}

/**
 * Main function
 */
async function main() {
  console.log('=== Starting Continuous Batch Import ===');
  
  // Get current progress
  let progressData = getProgress();
  console.log(`Resuming from position ${progressData.position}`);
  
  let consecutiveErrors = 0;
  
  // Main import loop
  while (progressData.position < TOTAL_RECORDS) {
    // Run batch import
    const result = await runBatchImport();
    
    if (result.success) {
      // Update progress based on micro-batch-import.js behavior
      progressData.position += BATCH_SIZE;
      progressData.totalImported += BATCH_SIZE; // Approximate
      consecutiveErrors = 0;
    } else {
      console.log(`Batch import failed: ${result.error || 'Unknown error'}`);
      consecutiveErrors++;
      
      if (consecutiveErrors >= 3) {
        console.log('Too many consecutive errors, pausing for 60 seconds...');
        await sleep(60000);
        consecutiveErrors = 0;
      }
    }
    
    // Update progress file
    updateProgress(progressData.position, progressData.totalImported);
    
    // Calculate progress percentage
    const progressPercent = Math.round((progressData.position / TOTAL_RECORDS) * 100 * 10) / 10;
    console.log(`Progress: ${progressData.position}/${TOTAL_RECORDS} (${progressPercent}%)`);
    
    // Pause between batches
    console.log(`Pausing for ${PAUSE_BETWEEN_BATCHES/1000} seconds before next batch...`);
    await sleep(PAUSE_BETWEEN_BATCHES);
  }
  
  console.log('=== All records processed! ===');
}

// Start the process
main().catch(error => {
  console.error('Continuous import failed:', error);
});