/**
 * Continuous Address Fix Script
 * 
 * This script repeatedly runs the quick-address-fix.js script 
 * to gradually update placeholder addresses with real ones.
 */

import { spawn } from 'child_process';
import fs from 'fs';

// Configuration
const PAUSE_BETWEEN_BATCHES = 30000; // 30 seconds pause between batches
const MAX_RUN_TIME = 60000; // 60 seconds max run time per batch
const LOG_FILE = 'address-fix.log';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a single address fix batch
 */
async function runAddressFix() {
  console.log('Starting address fix batch...');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/quick-address-fix.js'], {
      stdio: 'inherit',
      timeout: MAX_RUN_TIME
    });
    
    const timer = setTimeout(() => {
      console.log('Address fix taking too long, killing process...');
      child.kill();
      resolve({ success: false, error: 'Timeout' });
    }, MAX_RUN_TIME);
    
    child.on('error', (error) => {
      clearTimeout(timer);
      console.error(`Address fix error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
    
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        console.log('Address fix batch completed successfully');
        resolve({ success: true });
      } else {
        console.log(`Address fix batch exited with code ${code}`);
        resolve({ success: false, code });
      }
    });
  });
}

/**
 * Log operation
 */
function logOperation(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(message);
}

/**
 * Check remaining placeholder addresses
 */
async function checkRemainingPlaceholders() {
  return new Promise((resolve, reject) => {
    const query = "SELECT COUNT(*) FROM laundromats WHERE address LIKE '%123 Main St%' OR address LIKE '%123 Main Street%' OR address LIKE '%1234 Main St%' OR address LIKE '%123 Oak St%' OR address LIKE '%123 Elm St%';";
    const cmd = `psql ${process.env.DATABASE_URL} -t -c "${query}"`;
    
    const child = spawn('bash', ['-c', cmd]);
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('error', (error) => {
      console.error(`Error checking placeholders: ${error.message}`);
      resolve(0);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        // Parse the count from output
        const count = parseInt(output.trim(), 10);
        resolve(count || 0);
      } else {
        console.log(`Check placeholders exited with code ${code}`);
        resolve(0);
      }
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('=== Starting Continuous Address Fix Process ===');
  
  let consecutiveErrors = 0;
  let batchCount = 0;
  
  // Create log file if it doesn't exist
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
  }
  
  // Write PID to file so we can check if process is running
  fs.writeFileSync('address-fix.pid', process.pid.toString());
  
  // Main loop
  while (true) {
    // Check if there are still placeholder addresses to fix
    const remainingPlaceholders = await checkRemainingPlaceholders();
    
    logOperation(`Batch #${batchCount + 1} - Remaining placeholder addresses: ${remainingPlaceholders}`);
    
    if (remainingPlaceholders <= 0) {
      logOperation('No more placeholder addresses to fix!');
      break;
    }
    
    // Run address fix batch
    const result = await runAddressFix();
    batchCount++;
    
    if (result.success) {
      logOperation(`Successfully completed batch #${batchCount}`);
      consecutiveErrors = 0;
    } else {
      logOperation(`Batch #${batchCount} failed: ${result.error || 'Unknown error'}`);
      consecutiveErrors++;
      
      if (consecutiveErrors >= 3) {
        logOperation('Too many consecutive errors, pausing for 2 minutes...');
        await sleep(120000);
        consecutiveErrors = 0;
      }
    }
    
    // Pause between batches
    logOperation(`Pausing for ${PAUSE_BETWEEN_BATCHES/1000} seconds before next batch...`);
    await sleep(PAUSE_BETWEEN_BATCHES);
  }
  
  logOperation('=== Address Fix Process Completed ===');
}

// Start the process
main().catch(error => {
  console.error('Continuous address fix failed:', error);
});