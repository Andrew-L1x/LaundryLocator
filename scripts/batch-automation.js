/**
 * Batch Automation Script for Laundromat Data Import
 * 
 * This script automates running the optimized import script multiple times
 * with a pause between each run to avoid timeouts.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

// Configuration
const IMPORT_SCRIPT = 'scripts/optimized-import.js';
const PAUSE_SECONDS = 7; // Slightly longer pause between import runs to ensure less timeouts
const MAX_BATCHES = 7; // Maximum number of batches to run
const PROGRESS_FILE = 'import-progress.json';
const TARGET_COUNT = 350; // Target number of laundromats

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    console.error('Error getting current count:', error.message);
    return 0;
  }
}

/**
 * Run import script once
 */
async function runImport() {
  try {
    console.log('Running import script...');
    const { stdout, stderr } = await execPromise(`node ${IMPORT_SCRIPT}`);
    
    if (stderr) {
      console.error('Import script stderr:', stderr);
    }
    
    console.log(stdout);
    return true;
  } catch (error) {
    console.error('Error running import script:', error.message);
    return false;
  }
}

/**
 * Get completed states
 */
function getCompletedStates() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progressData = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      return Object.keys(progressData).filter(state => progressData[state].completed);
    }
  } catch (error) {
    console.error('Error reading progress file:', error.message);
  }
  
  return [];
}

/**
 * Main function
 */
async function main() {
  console.log('Starting batch automation for laundromat data import...');
  
  const startingCount = await getCurrentCount();
  console.log(`Starting laundromat count: ${startingCount}`);
  
  if (startingCount >= TARGET_COUNT) {
    console.log(`Target count of ${TARGET_COUNT} already reached. Skipping import.`);
    return;
  }
  
  let batchesRun = 0;
  let success = true;
  
  while (batchesRun < MAX_BATCHES && success) {
    // Run the import
    success = await runImport();
    batchesRun++;
    
    // Get updated count
    const currentCount = await getCurrentCount();
    const completedStates = getCompletedStates();
    
    console.log(`
      Batch ${batchesRun}/${MAX_BATCHES} completed.
      Current laundromat count: ${currentCount}
      Added so far: ${currentCount - startingCount}
      Completed states: ${completedStates.length}
      States completed: ${completedStates.join(', ')}
    `);
    
    // Check if target reached
    if (currentCount >= TARGET_COUNT) {
      console.log(`Target count of ${TARGET_COUNT} reached. Stopping import.`);
      break;
    }
    
    // Pause between batches if not the last one
    if (batchesRun < MAX_BATCHES && success) {
      console.log(`Pausing for ${PAUSE_SECONDS} seconds before next batch...`);
      await sleep(PAUSE_SECONDS * 1000);
    }
  }
  
  const finalCount = await getCurrentCount();
  console.log(`
    Batch automation completed.
    Starting count: ${startingCount}
    Final count: ${finalCount}
    Total added: ${finalCount - startingCount}
    Batches run: ${batchesRun}
  `);
}

// Run the main function
main().catch(error => {
  console.error('Error in main function:', error);
});