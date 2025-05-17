/**
 * Quick Batch Import Script
 * 
 * This script imports multiple laundromat records quickly
 * focusing on one state at a time with a larger batch size.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const BATCH_SIZE = 25;
const STATE_TO_PROCESS = "AZ"; // Choose a state to process all at once
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';

// Execute the optimized import script multiple times
async function runBatchImport() {
  console.log(`Starting large batch import for ${STATE_TO_PROCESS}...`);
  
  // Get current laundromat count
  const countOutput = execSync('psql -c "SELECT COUNT(*) FROM laundromats" -t').toString();
  const startingCount = parseInt(countOutput.trim());
  console.log(`Starting laundromat count: ${startingCount}`);
  
  // Set the state offset to 0 to start fresh
  fs.writeFileSync(`${STATE_TO_PROCESS.toLowerCase()}-offset.txt`, "0");
  console.log(`Reset offset for ${STATE_TO_PROCESS} to start fresh`);
  
  // Run imports until we've processed all records for this state
  let completed = false;
  let batchCount = 0;
  let recordsImported = 0;
  
  while (!completed && batchCount < 20) { // Limit to 20 batches as a safety
    batchCount++;
    console.log(`\n=== Running batch ${batchCount} for ${STATE_TO_PROCESS} ===`);
    
    try {
      // Run the optimized import with a specific state focus
      const output = execSync(`FORCE_STATE=${STATE_TO_PROCESS} BATCH_SIZE=${BATCH_SIZE} node scripts/optimized-import.js`).toString();
      console.log(output);
      
      // Check if this state is completed based on the output
      if (output.includes(`Completed import for ${STATE_TO_PROCESS}`)) {
        console.log(`All records for ${STATE_TO_PROCESS} have been imported!`);
        completed = true;
      }
      
      // Extract records inserted count
      const recordsInsertedMatch = output.match(/Records inserted: (\d+)/);
      const recordsInserted = recordsInsertedMatch ? parseInt(recordsInsertedMatch[1]) : 0;
      recordsImported += recordsInserted;
      
      // If we didn't insert any records, we might be done
      if (recordsInserted === 0 && batchCount > 1) {
        console.log(`No new records inserted, ${STATE_TO_PROCESS} might be complete`);
        break;
      }
    } catch (error) {
      console.error(`Error in batch ${batchCount}: ${error.message}`);
      break;
    }
  }
  
  // Get final count
  const finalCountOutput = execSync('psql -c "SELECT COUNT(*) FROM laundromats" -t').toString();
  const finalCount = parseInt(finalCountOutput.trim());
  const recordsAdded = finalCount - startingCount;
  
  console.log(`\n=== Batch Import Summary for ${STATE_TO_PROCESS} ===`);
  console.log(`Starting count: ${startingCount}`);
  console.log(`Final count: ${finalCount}`);
  console.log(`Records added: ${recordsAdded}`);
  console.log(`Batches run: ${batchCount}`);
  
  // Now get some state statistics
  console.log(`\n=== State Statistics ===`);
  try {
    // Get the count for this state
    const stateCountOutput = execSync(`psql -c "SELECT COUNT(*) FROM laundromats WHERE state = '${STATE_TO_PROCESS}'" -t`).toString();
    const stateCount = parseInt(stateCountOutput.trim());
    console.log(`Total ${STATE_TO_PROCESS} laundromats: ${stateCount}`);
    
    // Get the top 3 cities in this state
    const topCitiesOutput = execSync(`psql -c "SELECT city, COUNT(*) as count FROM laundromats WHERE state = '${STATE_TO_PROCESS}' GROUP BY city ORDER BY count DESC LIMIT 3" -t`).toString();
    console.log(`Top cities in ${STATE_TO_PROCESS}:`);
    console.log(topCitiesOutput);
  } catch (error) {
    console.error(`Error getting statistics: ${error.message}`);
  }
  
  console.log('\nQuick batch import completed successfully!');
}

// Run the batch import
runBatchImport().catch(error => {
  console.error(`Fatal error: ${error.stack}`);
});