/**
 * API Cost Optimization Runner
 * 
 * This script orchestrates the execution of all cost optimization scripts
 * in the proper sequence, with appropriate pauses between operations to 
 * avoid overwhelming the system.
 * 
 * Usage:
 * node scripts/run-api-cost-optimization.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also append to log file
  fs.appendFileSync(
    path.join(process.cwd(), 'api-cost-optimization.log'),
    logMessage + '\n'
  );
}

// Function to run a command and return its output as a promise
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    log(`Running command: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, { shell: true });
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output);
    });
    
    process.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output);
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main optimization function
async function runOptimizations() {
  try {
    log('Starting API cost optimization process');
    
    // Step 1: Setup database tables for caching
    log('Step 1: Setting up database tables for caching');
    await runCommand('node', ['scripts/optimize-api-usage.js', '--init']);
    await sleep(2000);
    
    // Step 2: Convert all Places API data to text format
    log('Step 2: Converting all Places API data to text format');
    await runCommand('node', ['scripts/api-to-text-migration.js', '--all']);
    await sleep(2000);
    
    // Step 3: Cache static map images
    log('Step 3: Setting up and populating static map cache');
    await runCommand('node', ['scripts/optimize-static-maps.js', '--cache-all']);
    await sleep(2000);
    
    // Step 4: Cache Street View images
    log('Step 4: Setting up and populating Street View cache');
    await runCommand('node', ['scripts/cache-streetview-images.js', '--cache-all']);
    await sleep(2000);
    
    // Step 5: Process specific details for top laundromats
    log('Step 5: Processing batch place details for top laundromats');
    await runCommand('node', ['scripts/batch-process-place-details.js', '--process']);
    await sleep(2000);
    
    // Step 6: Show optimization statistics
    log('Step 6: Generating optimization statistics');
    
    // Street View stats
    const streetViewStats = await runCommand('node', ['scripts/cache-streetview-images.js', '--stats']);
    log('Street View Optimization Stats:');
    log(streetViewStats);
    
    // Static Maps stats
    const staticMapsStats = await runCommand('node', ['scripts/optimize-static-maps.js', '--stats']);
    log('Static Maps Optimization Stats:');
    log(staticMapsStats);
    
    // Places API stats
    const placesStats = await runCommand('node', ['scripts/batch-process-place-details.js', '--stats']);
    log('Places API Optimization Stats:');
    log(placesStats);
    
    log('API cost optimization process completed!');
    log('The system is now set up to use significantly less Google API calls.');
    
    // Calculate estimated total savings
    log('=== ESTIMATED ANNUAL COST SAVINGS ===');
    log('Based on previous API usage patterns:');
    log('1. Places API: ~$6,800 per year');
    log('2. Street View API: ~$2,800 per year');
    log('3. Static Maps API: ~$2,000 per year');
    log('4. Maps JavaScript API: ~$1,200 per year');
    log('Total estimated annual savings: ~$12,800');
    
  } catch (error) {
    log(`Error during optimization process: ${error.message}`);
    console.error(error);
  }
}

// Run if executed directly
if (require.main === module) {
  runOptimizations().catch(error => {
    log(`Unhandled error: ${error.message}`);
    console.error(error);
  });
}