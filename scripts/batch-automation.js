/**
 * Batch Automation Script for Laundromat Data Import
 * 
 * This script automates running the optimized import script multiple times
 * with a pause between each run to avoid timeouts.
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const PAUSE_SECONDS = 15; // Pause between import runs
const MAX_RUNS = 50; // Number of import runs to perform
const STATUS_FILE = 'import-progress-backup.json';

// Helper function for pausing
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current laundromat count from the database
 */
async function getCurrentCount() {
  try {
    const output = execSync('psql -c "SELECT COUNT(*) FROM laundromats" -t').toString();
    return parseInt(output.trim());
  } catch (error) {
    console.error(`Error getting current count: ${error.message}`);
    return 0;
  }
}

/**
 * Run import script once
 */
async function runImport() {
  try {
    console.log('Starting import batch...');
    const startTime = Date.now();
    
    // Run the import script
    const output = execSync('node scripts/optimized-import.js').toString();
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(output);
    
    // Extract results from output
    const recordsInsertedMatch = output.match(/Records inserted: (\d+)/);
    const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
    
    const finalCountMatch = output.match(/Final count: (\d+)/);
    const finalCount = finalCountMatch ? parseInt(finalCountMatch[1]) : 0;
    
    console.log(`Batch completed successfully. Inserted: ${recordsInserted}, Total count: ${finalCount}, Duration: ${duration}s`);
    
    return { success: true, recordsInserted, finalCount, duration, output };
  } catch (error) {
    console.error(`Import error: ${error.message}`);
    return { success: false, error: error.message };
  }
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
 * Main function
 */
async function main() {
  console.log('=== Starting batch automation for laundromat import ===');
  
  // Get starting count
  const startingCount = await getCurrentCount();
  console.log(`Starting count: ${startingCount} laundromats`);
  
  // Initialize or load progress
  let progress = {
    runs: 0,
    totalRecords: 0,
    startCount: startingCount,
    startTime: Date.now()
  };
  
  if (fs.existsSync(STATUS_FILE)) {
    try {
      const savedProgress = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      progress = { ...savedProgress, currentTime: Date.now() };
      console.log(`Resuming from previous progress: Run ${progress.runs}, ${progress.totalRecords} records imported`);
    } catch (error) {
      console.error(`Error loading progress: ${error.message}`);
    }
  }
  
  // Main loop
  for (let i = 0; i < MAX_RUNS; i++) {
    progress.runs++;
    console.log(`\n=== Run ${progress.runs} of ${MAX_RUNS} ===`);
    
    // Get completed states
    const completedStates = getCompletedStates();
    console.log(`Completed states: ${completedStates.join(', ')}`);
    
    // Run the import
    const result = await runImport();
    
    if (result.success) {
      progress.totalRecords += result.recordsInserted;
      
      // Update progress file
      progress.lastRun = new Date().toISOString();
      progress.currentCount = await getCurrentCount();
      progress.addedSoFar = progress.currentCount - progress.startCount;
      progress.elapsedMinutes = Math.floor((Date.now() - progress.startTime) / 60000);
      progress.completedStates = completedStates;
      
      fs.writeFileSync(STATUS_FILE, JSON.stringify(progress, null, 2));
      
      // Calculate stats
      const recordsPerMinute = progress.elapsedMinutes > 0 
        ? (progress.addedSoFar / progress.elapsedMinutes).toFixed(2) 
        : 'calculating...';
      
      console.log(`
Progress update:
- Runs completed: ${progress.runs}/${MAX_RUNS}
- Records imported this run: ${result.recordsInserted}
- Total records imported: ${progress.totalRecords}
- Current count: ${progress.currentCount}
- Added so far: ${progress.addedSoFar}
- Time elapsed: ${progress.elapsedMinutes} minutes
- Import rate: ${recordsPerMinute} records/minute
      `);
      
      if (i < MAX_RUNS - 1) {
        console.log(`Pausing for ${PAUSE_SECONDS} seconds before next batch...`);
        await sleep(PAUSE_SECONDS * 1000);
      }
    } else {
      console.error(`Run ${progress.runs} failed: ${result.error}`);
      console.log('Taking a longer break before trying again...');
      await sleep(30000); // 30 second break after error
    }
  }
  
  // Final report
  const finalCount = await getCurrentCount();
  const totalAdded = finalCount - startingCount;
  const totalMinutes = Math.floor((Date.now() - progress.startTime) / 60000);
  const overallRate = totalMinutes > 0 ? (totalAdded / totalMinutes).toFixed(2) : 'N/A';
  
  console.log(`
=== Batch Automation Complete ===
- Starting count: ${startingCount}
- Final count: ${finalCount}
- Total added: ${totalAdded}
- Runs completed: ${progress.runs}
- Time elapsed: ${totalMinutes} minutes
- Overall import rate: ${overallRate} records/minute
  `);
}

// Run the main function
main().catch(error => {
  console.error(`Fatal error in batch automation: ${error.stack}`);
});