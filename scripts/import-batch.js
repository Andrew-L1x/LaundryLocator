/**
 * Laundromat Batch Import Script
 * 
 * This script runs multiple batches of laundromat imports in a single session
 * to efficiently add more records to the database.
 * 
 * Usage: node scripts/import-batch.js [number_of_batches]
 * Example: node scripts/import-batch.js 10
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Default to 10 batches if not specified
const numBatches = process.argv[2] ? parseInt(process.argv[2]) : 10;
console.log(`Starting import of ${numBatches} batches...`);

// Get current count
let currentCount = 0;
try {
  const countOutput = execSync('psql -c "SELECT COUNT(*) FROM laundromats" -t').toString();
  currentCount = parseInt(countOutput.trim());
  console.log(`Initial laundromat count: ${currentCount}`);
} catch (error) {
  console.error(`Error getting count: ${error.message}`);
}

// Run batches
const startTime = Date.now();
let totalRecordsAdded = 0;

for (let i = 0; i < numBatches; i++) {
  console.log(`\n=== Batch ${i+1} of ${numBatches} ===`);
  const batchStartTime = Date.now();
  
  try {
    // Run import
    const output = execSync('node scripts/optimized-import.js').toString();
    console.log(output);
    
    // Extract results from output
    const recordsInsertedMatch = output.match(/Records inserted: (\d+)/);
    const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
    totalRecordsAdded += recordsInserted;
    
    const finalCountMatch = output.match(/Final count: (\d+)/);
    const finalCount = finalCountMatch ? parseInt(finalCountMatch[1]) : 0;
    
    const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
    console.log(`Batch ${i+1} completed: Added ${recordsInserted} records in ${batchDuration} seconds`);
    
    // Show progress
    const progress = ((i+1) / numBatches * 100).toFixed(1);
    console.log(`Overall progress: ${progress}% (${i+1}/${numBatches})`);
    
    // Get currently completed states
    const stateFiles = fs.readdirSync('.').filter(file => file.endsWith('-offset.txt'));
    const completedStates = stateFiles.map(file => file.split('-')[0].toUpperCase());
    console.log(`States with progress: ${completedStates.join(', ')}`);
    
  } catch (error) {
    console.error(`Error in batch ${i+1}: ${error.message}`);
  }
}

// Final stats
const totalDuration = Math.round((Date.now() - startTime) / 1000);
const durationMinutes = (totalDuration / 60).toFixed(1);

try {
  const finalCountOutput = execSync('psql -c "SELECT COUNT(*) FROM laundromats" -t').toString();
  const finalCount = parseInt(finalCountOutput.trim());
  const actualAdded = finalCount - currentCount;
  
  console.log(`\n=== Import Batch Summary ===`);
  console.log(`Starting count: ${currentCount}`);
  console.log(`Final count: ${finalCount}`);
  console.log(`Total records added: ${actualAdded}`);
  console.log(`Success rate: ${(actualAdded / (numBatches * 5) * 100).toFixed(1)}%`);
  console.log(`Total duration: ${durationMinutes} minutes`);
  console.log(`Import rate: ${(actualAdded / durationMinutes).toFixed(1)} records/minute`);
  
} catch (error) {
  console.error(`Error getting final count: ${error.message}`);
  console.log(`\n=== Import Batch Summary ===`);
  console.log(`Expected records added: ${totalRecordsAdded}`);
  console.log(`Total duration: ${durationMinutes} minutes`);
}

console.log('\nImport batch completed successfully.');