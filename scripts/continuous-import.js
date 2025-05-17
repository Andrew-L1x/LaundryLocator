/**
 * Continuous Import Automation for Laundromat Data
 * 
 * This script runs a continuous import process for all 27,188 laundromat records
 * with small batch sizes (5 records) and proper error handling to restart after timeouts.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

// Configuration
const IMPORT_SCRIPT = 'scripts/optimized-import.js';
const PAUSE_SECONDS = 15; // Even longer pause between import runs for better stability
const MAX_CONSECUTIVE_ERRORS = 3; // Maximum errors before stopping
const PROGRESS_FILE = 'import-progress.json';
const TARGET_TOTAL = 27188; // Total records in dataset
const IMPORT_TIME_LIMIT = 3 * 60 * 60 * 1000; // 3 hours total runtime limit
const PROGRESS_CHECK_INTERVAL = 5; // Save statistics every N batches

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
    console.log('Running import batch...');
    const { stdout, stderr } = await execPromise(`node ${IMPORT_SCRIPT}`);
    
    if (stderr) {
      console.error('Import script stderr:', stderr);
    }
    
    console.log(stdout);
    return { success: true, output: stdout };
  } catch (error) {
    console.error('Error running import script:', error.message);
    return { success: false, error: error.message };
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
 * Extract batch size and records processed from import output
 */
function extractResults(output) {
  try {
    // Extract records inserted from the output
    const insertedMatch = output.match(/Records inserted: (\d+)/);
    const recordsInserted = insertedMatch ? parseInt(insertedMatch[1]) : 0;
    
    // Extract final count from the output
    const countMatch = output.match(/Final count: (\d+)/);
    const finalCount = countMatch ? parseInt(countMatch[1]) : 0;
    
    return { recordsInserted, finalCount };
  } catch (error) {
    console.error('Error extracting results:', error.message);
    return { recordsInserted: 0, finalCount: 0 };
  }
}

/**
 * Save progress to a log file
 */
function saveProgressLog(stats) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...stats
    };
    
    let logs = [];
    if (fs.existsSync('import-log.json')) {
      logs = JSON.parse(fs.readFileSync('import-log.json', 'utf8'));
    }
    
    logs.push(logEntry);
    fs.writeFileSync('import-log.json', JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error saving progress log:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting continuous import automation for laundromat data...');
  console.log(`Target dataset: ${TARGET_TOTAL} records`);
  
  const startingCount = await getCurrentCount();
  console.log(`Starting laundromat count: ${startingCount}`);
  
  const startTime = Date.now();
  let currentCount = startingCount;
  let consecutiveErrors = 0;
  let batchesRun = 0;
  let totalInserted = 0;
  
  // Continue until time limit reached or too many errors
  while (Date.now() - startTime < IMPORT_TIME_LIMIT && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
    const { success, output, error } = await runImport();
    batchesRun++;
    
    if (success) {
      const { recordsInserted, finalCount } = extractResults(output);
      totalInserted += recordsInserted;
      currentCount = finalCount;
      consecutiveErrors = 0; // Reset errors on success
      
      const completedStates = getCompletedStates();
      
      console.log(`
        Batch ${batchesRun} completed successfully.
        Records inserted in this batch: ${recordsInserted}
        Current laundromat count: ${currentCount}
        Added so far: ${currentCount - startingCount}
        Completed states: ${completedStates.length}
        States completed: ${completedStates.join(', ')}
      `);
      
      // Save progress
      saveProgressLog({
        batch: batchesRun,
        recordsInserted,
        currentCount,
        totalInserted,
        completedStates: completedStates.length,
        percentComplete: ((currentCount / TARGET_TOTAL) * 100).toFixed(2) + '%'
      });
      
      // Stop if we've processed all records
      if (currentCount >= TARGET_TOTAL) {
        console.log(`Target count reached! All ${TARGET_TOTAL} records imported.`);
        break;
      }
    } else {
      consecutiveErrors++;
      console.log(`
        Batch ${batchesRun} failed.
        Error: ${error}
        Consecutive errors: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}
      `);
    }
    
    // Pause between batches
    const elapsed = Date.now() - startTime;
    const remaining = IMPORT_TIME_LIMIT - elapsed;
    
    if (remaining <= 0) {
      console.log('Time limit reached, stopping import process.');
      break;
    }
    
    console.log(`Pausing for ${PAUSE_SECONDS} seconds before next batch...`);
    console.log(`Time remaining: ${Math.floor(remaining / 60000)} minutes`);
    await sleep(PAUSE_SECONDS * 1000);
  }
  
  const finalCount = await getCurrentCount();
  const totalTime = (Date.now() - startTime) / 60000; // minutes
  
  console.log(`
    Import automation completed.
    Starting count: ${startingCount}
    Final count: ${finalCount}
    Total records added: ${finalCount - startingCount}
    Batches run: ${batchesRun}
    Time elapsed: ${totalTime.toFixed(2)} minutes
    Import rate: ${((finalCount - startingCount) / totalTime).toFixed(2)} records/minute
    Dataset completion: ${((finalCount / TARGET_TOTAL) * 100).toFixed(2)}%
  `);
}

// Run the main function
main().catch(error => {
  console.error('Error in main function:', error);
});