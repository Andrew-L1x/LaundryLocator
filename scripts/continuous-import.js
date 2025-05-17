/**
 * Continuous Import Automation for Laundromat Data
 * 
 * This script runs a continuous import process for all 27,188 laundromat records
 * with small batch sizes (5 records) and proper error handling to restart after timeouts.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BATCH_SIZE = 5; // Small batch size for reliability
const PAUSE_SECONDS = 15; // Pause between import runs
const LOG_FILE = 'import-log.json';
const MAX_RUNS = 5000; // Safety limit
const STATE_FILE = 'import-progress.json';

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current laundromat count from the database
 */
async function getCurrentCount() {
  return new Promise((resolve, reject) => {
    exec('psql -c "SELECT COUNT(*) FROM laundromats" -t', (error, stdout) => {
      if (error) {
        console.error(`Error getting count: ${error.message}`);
        resolve(0); // Return 0 on error
        return;
      }
      
      const count = parseInt(stdout.trim());
      resolve(count);
    });
  });
}

/**
 * Run import script once
 */
async function runImport() {
  return new Promise((resolve, reject) => {
    console.log('Starting import batch...');
    const startTime = Date.now();
    
    exec('node scripts/optimized-import.js', (error, stdout, stderr) => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (error) {
        console.error(`Import error: ${error.message}`);
        resolve({ success: false, error: error.message, duration });
        return;
      }
      
      if (stderr) {
        console.log(`Import stderr: ${stderr}`);
      }
      
      console.log(`Import stdout: ${stdout}`);
      
      // Extract results from output
      const recordsInsertedMatch = stdout.match(/Records inserted: (\d+)/);
      const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
      
      const finalCountMatch = stdout.match(/Final count: (\d+)/);
      const finalCount = finalCountMatch ? parseInt(finalCountMatch[1]) : 0;
      
      resolve({ 
        success: true, 
        recordsInserted, 
        finalCount,
        duration,
        output: stdout
      });
    });
  });
}

/**
 * Get completed states
 */
function getCompletedStates() {
  try {
    const completedStates = [];
    
    // Check for state-specific completion files
    const stateFiles = fs.readdirSync('.').filter(file => file.endsWith('-offset.txt'));
    
    for (const file of stateFiles) {
      const state = file.split('-')[0].toUpperCase();
      completedStates.push(state);
    }
    
    return completedStates;
  } catch (error) {
    console.error(`Error getting completed states: ${error.message}`);
    return [];
  }
}

/**
 * Extract batch size and records processed from import output
 */
function extractResults(output) {
  const batchSizeMatch = output.match(/Batch size: (\d+)/);
  const batchSize = batchSizeMatch ? parseInt(batchSizeMatch[1]) : 0;
  
  const recordsInsertedMatch = output.match(/Records inserted: (\d+)/);
  const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
  
  return { batchSize, recordsInserted };
}

/**
 * Save progress to a log file
 */
function saveProgressLog(stats) {
  try {
    let log = [];
    if (fs.existsSync(LOG_FILE)) {
      const logContent = fs.readFileSync(LOG_FILE, 'utf8');
      log = JSON.parse(logContent);
    }
    
    log.push({
      ...stats,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  } catch (error) {
    console.error(`Error saving log: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting continuous import automation...');
  
  // Initialize or load state
  let state = { runs: 0, totalRecords: 0, startTime: Date.now() };
  if (fs.existsSync(STATE_FILE)) {
    try {
      const stateContent = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(stateContent);
      console.log(`Resuming from previous state: ${JSON.stringify(state)}`);
    } catch (error) {
      console.error(`Error loading state: ${error.message}`);
    }
  }
  
  // Get starting count
  const startingCount = await getCurrentCount();
  console.log(`Starting laundromat count: ${startingCount}`);
  
  // Main import loop
  let consecutiveErrors = 0;
  while (state.runs < MAX_RUNS) {
    state.runs++;
    
    // Save current state
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    // Get completed states
    const completedStates = getCompletedStates();
    console.log(`Completed states: ${completedStates.join(', ')}`);
    
    // Run import
    console.log(`Running import batch ${state.runs}...`);
    const result = await runImport();
    
    if (result.success) {
      state.totalRecords += result.recordsInserted;
      consecutiveErrors = 0;
      
      // Log success
      console.log(`
        Batch ${state.runs} completed successfully.
        Records inserted: ${result.recordsInserted}
        Total count: ${result.finalCount}
        Duration: ${result.duration} seconds
      `);
      
      // Extract additional metrics
      const { batchSize } = extractResults(result.output);
      
      // Save progress
      saveProgressLog({
        run: state.runs,
        batchSize,
        recordsInserted: result.recordsInserted,
        totalCount: result.finalCount,
        duration: result.duration,
        completedStates
      });
    } else {
      consecutiveErrors++;
      console.error(`
        Batch ${state.runs} failed.
        Error: ${result.error}
        Consecutive errors: ${consecutiveErrors}
      `);
      
      if (consecutiveErrors >= 3) {
        console.error('Too many consecutive errors. Taking a longer break...');
        await sleep(60000); // 1 minute break
        consecutiveErrors = 0;
      }
    }
    
    // Get current count
    const currentCount = await getCurrentCount();
    const addedSoFar = currentCount - startingCount;
    const elapsedMinutes = Math.floor((Date.now() - state.startTime) / 60000);
    const rate = elapsedMinutes > 0 ? (addedSoFar / elapsedMinutes).toFixed(2) : '0.00';
    
    console.log(`
      Progress update:
      Runs completed: ${state.runs}
      Records imported: ${state.totalRecords}
      Current count: ${currentCount}
      Time elapsed: ${elapsedMinutes} minutes
      Import rate: ${rate} records/minute
    `);
    
    // Pause between runs
    console.log(`Pausing for ${PAUSE_SECONDS} seconds before next batch...`);
    await sleep(PAUSE_SECONDS * 1000);
  }
  
  console.log('Import automation completed successfully.');
}

// Run main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
});