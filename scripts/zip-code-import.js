/**
 * ZIP Code Import Script
 * 
 * This script adds common ZIP codes to our zip_codes table to improve search functionality.
 * It handles the most popular or problematic ZIP codes to ensure better search results.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ZIP code data for key locations
const commonZipCodes = [
  { zip: '35951', city: 'Albertville', state: 'AL', lat: 34.2668, lng: -86.2089 },
  { zip: '30301', city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { zip: '10001', city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { zip: '90001', city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { zip: '60601', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { zip: '75001', city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { zip: '77001', city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { zip: '19101', city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { zip: '85001', city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { zip: '92101', city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
];

// Insert ZIP code data in batches
async function importZipCodes() {
  const client = await pool.connect();
  
  try {
    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS zip_codes (
        id SERIAL PRIMARY KEY,
        zip VARCHAR(10) NOT NULL UNIQUE,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        county VARCHAR(100),
        lat DECIMAL(9,6),
        lng DECIMAL(9,6),
        UNIQUE(zip)
      );
    `);
    
    console.log('Adding common ZIP codes to database...');
    
    // Insert all ZIP codes in one transaction
    await client.query('BEGIN');
    
    for (const zipData of commonZipCodes) {
      await client.query(`
        INSERT INTO zip_codes (zip, city, state, lat, lng)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (zip) DO UPDATE SET
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng
      `, [zipData.zip, zipData.city, zipData.state, zipData.lat, zipData.lng]);
    }
    
    await client.query('COMMIT');
    console.log(`Successfully imported ${commonZipCodes.length} ZIP codes`);
    
    // Create a function to get city/state for a ZIP code
    await client.query(`
      CREATE OR REPLACE FUNCTION get_location_by_zip(zip_code TEXT)
      RETURNS TABLE (
        city TEXT,
        state TEXT,
        lat DECIMAL,
        lng DECIMAL
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          z.city::TEXT, 
          z.state::TEXT, 
          z.lat, 
          z.lng
        FROM zip_codes z
        WHERE z.zip = zip_code;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('Created database function for ZIP code lookups');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing ZIP codes:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the import
importZipCodes()
  .then(() => {
    console.log('ZIP code import complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });