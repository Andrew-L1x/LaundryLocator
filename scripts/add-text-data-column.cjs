/**
 * Add Text Data Column Script
 * 
 * This script adds the places_text_data JSONB column to the laundromats table
 * to support our API cost-saving strategy.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Add places_text_data column to the laundromats table
 */
async function addTextDataColumn() {
  try {
    // First check if the column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'laundromats' AND column_name = 'places_text_data'
    `;
    
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      log('places_text_data column already exists in laundromats table');
      return true;
    }
    
    // Add the column if it doesn't exist
    const alterQuery = `
      ALTER TABLE laundromats
      ADD COLUMN places_text_data JSONB DEFAULT NULL
    `;
    
    await pool.query(alterQuery);
    log('Successfully added places_text_data column to laundromats table');
    
    return true;
  } catch (error) {
    log(`Error adding text data column: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting database schema update');
    
    // Add the places_text_data column
    const columnAdded = await addTextDataColumn();
    
    if (columnAdded) {
      log('Database schema updated successfully');
    } else {
      log('Failed to update database schema');
    }
  } catch (error) {
    log(`Unhandled error: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();