/**
 * Continuous Batch Import Script
 * 
 * This script repeatedly runs the micro-batch import
 * until all records are processed.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Progress file path
const PROGRESS_FILE = path.join(cwd, 'data', 'import-progress.json');
const BATCH_SCRIPT = path.join(__dirname, 'micro-batch-import.js');
const MAX_BATCHES = 20; // Limit the number of batches per run to avoid timeouts

// Add a delay between batches
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a single batch import
 */
async function runBatchImport() {
  return new Promise((resolve, reject) => {
    const batchProcess = spawn('node', [BATCH_SCRIPT], {
      stdio: 'inherit'
    });
    
    batchProcess.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Batch process exited with code ${code}`));
      }
    });
  });
}

/**
 * Get current progress
 */
function getProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading progress file:', error);
  }
  
  return { position: 0, total: 0 };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Starting Continuous Batch Import ===');
  
  let batchCount = 0;
  let isComplete = false;
  
  try {
    while (!isComplete && batchCount < MAX_BATCHES) {
      // Run a single batch
      await runBatchImport();
      batchCount++;
      
      // Check progress
      const progress = getProgress();
      
      // Calculate completion percentage
      const percentComplete = Math.round((progress.position / progress.total) * 100);
      console.log(`Completed ${batchCount} batches (${progress.position}/${progress.total} records, ${percentComplete}%)`);
      
      // Check if we're done
      if (progress.position >= progress.total) {
        isComplete = true;
        console.log('All records have been processed!');
        break;
      }
      
      // Add a small delay between batches
      console.log('Pausing for 2 seconds before next batch...');
      await sleep(2000);
    }
    
    if (!isComplete) {
      console.log(`Reached maximum batch limit (${MAX_BATCHES}). Run this script again to continue.`);
    }
    
  } catch (error) {
    console.error('Error during continuous import:', error);
  }
  
  console.log('=== Continuous Batch Import Completed ===');
}

// Start the process
main().catch(console.error);