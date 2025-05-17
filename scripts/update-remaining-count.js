/**
 * Calculate Remaining Records to Import
 * 
 * This script checks current database count and shows progress
 * information for the import process.
 */

import { Pool } from 'pg';

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Total records to import
const TOTAL_RECORDS = 27187;

async function getImportProgress() {
  const client = await pool.connect();
  
  try {
    // Get current count of laundromats
    const { rows } = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(rows[0].count, 10);
    
    // Calculate progress
    const remainingCount = TOTAL_RECORDS - currentCount;
    const progressPercent = ((currentCount / TOTAL_RECORDS) * 100).toFixed(2);
    
    // Get count of placeholder addresses
    const placeholderQuery = `
      SELECT COUNT(*) FROM laundromats 
      WHERE address LIKE '%123 Main St%' 
      OR address LIKE '%123 Main Street%' 
      OR address LIKE '%1234 Main St%' 
      OR address LIKE '%123 Oak St%' 
      OR address LIKE '%123 Elm St%'
    `;
    
    const placeholderResult = await client.query(placeholderQuery);
    const placeholderCount = parseInt(placeholderResult.rows[0].count, 10);
    
    // Calculate placeholder percentage
    const placeholderPercent = ((placeholderCount / currentCount) * 100).toFixed(2);
    
    // Report progress
    console.log('=== Import Progress Report ===');
    console.log(`Total records to import: ${TOTAL_RECORDS}`);
    console.log(`Current records in database: ${currentCount}`);
    console.log(`Remaining records to import: ${remainingCount}`);
    console.log(`Progress: ${progressPercent}%`);
    console.log('\n=== Address Quality Report ===');
    console.log(`Records with placeholder addresses: ${placeholderCount}`);
    console.log(`Records with real addresses: ${currentCount - placeholderCount}`);
    console.log(`Placeholder percentage: ${placeholderPercent}%`);
    console.log(`Fixed percentage: ${(100 - parseFloat(placeholderPercent)).toFixed(2)}%`);
    
    // Calculate ETA based on 25 records per batch at 2 minutes per batch
    const remainingBatches = Math.ceil(remainingCount / 25);
    const estimatedMinutes = remainingBatches * 2;
    const estimatedHours = Math.floor(estimatedMinutes / 60);
    const remainingMinutes = estimatedMinutes % 60;
    
    console.log('\n=== Estimated Completion ===');
    console.log(`Estimated batches remaining: ${remainingBatches}`);
    if (estimatedHours > 0) {
      console.log(`Estimated time to complete: ${estimatedHours} hours, ${remainingMinutes} minutes`);
    } else {
      console.log(`Estimated time to complete: ${remainingMinutes} minutes`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the report
getImportProgress().catch(console.error);