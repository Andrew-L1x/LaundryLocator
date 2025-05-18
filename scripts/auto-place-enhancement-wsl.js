/**
 * Automated Google Places Enhancement for WSL Environment
 * 
 * This script runs the batch-place-enhancement.js script continuously with
 * proper pauses between batches to respect API rate limits.
 * 
 * Run with: node scripts/auto-place-enhancement-wsl.js
 * 
 * It saves progress to a file so it can be stopped and resumed at any time.
 * Press Ctrl+C to gracefully stop the script.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const PROGRESS_FILE = 'place-enhancement-progress.json';
const BATCH_SIZE = 5; // Process 5 laundromats per batch
const PAUSE_BETWEEN_BATCHES = 60000; // 60 seconds between batches
const LOG_FILE = 'batch-place-enhancement.log';

// Process status tracking
let isRunning = true;
let currentProcess = null;

// Set up log function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Append to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\\n');
}

// Load saved progress
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  // Default progress
  return {
    processed: 0,
    totalProcessed: 0,
    lastProcessed: null,
    startTime: new Date().toISOString(),
  };
}

// Save progress to file
function saveProgress(progress) {
  try {
    progress.lastUpdated = new Date().toISOString();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    log(`Error saving progress: ${error.message}`);
  }
}

// Run batch-place-enhancement.js with appropriate parameters
function runBatchProcess(progress) {
  return new Promise((resolve, reject) => {
    log(`Starting batch process at position ${progress.processed}`);
    
    const args = [
      'scripts/batch-place-enhancement.js',
      '--start', progress.processed,
      '--limit', BATCH_SIZE
    ];
    
    currentProcess = spawn('node', args, { stdio: ['inherit', 'pipe', 'pipe'] });
    
    // Collect stdout
    let output = '';
    currentProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    
    // Collect stderr
    currentProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      console.error(chunk);
    });
    
    // Handle process completion
    currentProcess.on('close', (code) => {
      if (code === 0) {
        // Try to extract the number of laundromats processed
        const processedMatch = output.match(/Processed (\d+) laundromats/);
        const processed = processedMatch ? parseInt(processedMatch[1]) : BATCH_SIZE;
        
        // Update progress
        progress.processed += processed;
        progress.totalProcessed += processed;
        
        log(`Batch completed successfully. Processed ${processed} laundromats. Total: ${progress.totalProcessed}`);
        saveProgress(progress);
        resolve(progress);
      } else {
        log(`Batch process exited with code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

// Calculate and log estimated time remaining
function logEstimatedTimeRemaining(progress, totalLaundromats) {
  if (!progress.startTime || progress.totalProcessed === 0) return;
  
  const startTime = new Date(progress.startTime).getTime();
  const currentTime = new Date().getTime();
  const elapsedTimeMs = currentTime - startTime;
  const elapsedTimeHours = elapsedTimeMs / (1000 * 60 * 60);
  
  const processRate = progress.totalProcessed / elapsedTimeHours; // laundromats per hour
  const remaining = totalLaundromats - progress.processed;
  const estimatedHoursRemaining = remaining / processRate;
  
  const days = Math.floor(estimatedHoursRemaining / 24);
  const hours = Math.floor(estimatedHoursRemaining % 24);
  const minutes = Math.floor((estimatedHoursRemaining * 60) % 60);
  
  log(`Progress: ${progress.processed}/${totalLaundromats} (${((progress.processed/totalLaundromats)*100).toFixed(2)}%)`);
  log(`Processing rate: ${processRate.toFixed(2)} laundromats per hour`);
  log(`Estimated time remaining: ${days} days, ${hours} hours, ${minutes} minutes`);
}

// Main function to continuously run the batch process
async function main() {
  let progress = loadProgress();
  progress.startTime = progress.startTime || new Date().toISOString();
  
  // Get total number of laundromats from database
  let totalLaundromats = 30000; // Default estimate - will be updated when first batch runs
  
  log('Starting automated Google Places Enhancement process');
  log(`Current progress: ${progress.processed} laundromats processed so far`);
  
  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    log('Received SIGINT. Gracefully stopping...');
    isRunning = false;
    
    if (currentProcess) {
      currentProcess.kill();
    }
    
    log('Process stopped. Current progress has been saved.');
    log(`Total processed: ${progress.totalProcessed} laundromats`);
    process.exit(0);
  });
  
  // Main process loop
  while (isRunning) {
    try {
      // Run one batch
      await runBatchProcess(progress);
      
      // Log progress and estimated time
      logEstimatedTimeRemaining(progress, totalLaundromats);
      
      // Pause between batches to avoid overwhelming the API
      log(`Pausing for ${PAUSE_BETWEEN_BATCHES/1000} seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_BATCHES));
      
    } catch (error) {
      log(`Error during batch process: ${error.message}`);
      log('Waiting 5 minutes before retry...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
  }
}

// Start the process
main().catch(error => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});