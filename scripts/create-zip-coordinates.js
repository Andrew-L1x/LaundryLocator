/**
 * Create ZIP Coordinates Table
 * 
 * This script creates and populates the zip_coordinates table
 * with geographic coordinates for common ZIP codes to enable
 * ZIP code-based search functionality.
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/pg-core';
import dotenv from 'dotenv';

// Configure environment
dotenv.config();

// Create a PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createZipCoordinatesTable() {
  console.log('Creating zip_coordinates table...');
  
  // Initial set of ZIP codes to add
  // Focus on New York City area ZIP codes first since that's where most searches were happening
  const zipCodes = [
    // Ridgewood, Queens, NY (the one that was searched)
    { zip: '11385', city: 'Ridgewood', state: 'NY', latitude: 40.7000, longitude: -73.9000 },
    
    // Other NYC ZIP codes
    { zip: '10001', city: 'New York', state: 'NY', latitude: 40.7503, longitude: -73.9965 },
    { zip: '10002', city: 'New York', state: 'NY', latitude: 40.7180, longitude: -73.9865 },
    { zip: '10003', city: 'New York', state: 'NY', latitude: 40.7320, longitude: -73.9899 },
    { zip: '10011', city: 'New York', state: 'NY', latitude: 40.7399, longitude: -74.0045 },
    { zip: '10012', city: 'New York', state: 'NY', latitude: 40.7267, longitude: -73.9981 },
    { zip: '10013', city: 'New York', state: 'NY', latitude: 40.7210, longitude: -74.0047 },
    { zip: '10014', city: 'New York', state: 'NY', latitude: 40.7337, longitude: -74.0066 },
    { zip: '10016', city: 'New York', state: 'NY', latitude: 40.7478, longitude: -73.9820 },
    { zip: '10017', city: 'New York', state: 'NY', latitude: 40.7520, longitude: -73.9736 },
    { zip: '10018', city: 'New York', state: 'NY', latitude: 40.7551, longitude: -73.9927 },
    { zip: '10019', city: 'New York', state: 'NY', latitude: 40.7653, longitude: -73.9873 },
    { zip: '10021', city: 'New York', state: 'NY', latitude: 40.7691, longitude: -73.9612 },
    { zip: '10022', city: 'New York', state: 'NY', latitude: 40.7589, longitude: -73.9677 },
    { zip: '10023', city: 'New York', state: 'NY', latitude: 40.7785, longitude: -73.9830 },
    { zip: '10024', city: 'New York', state: 'NY', latitude: 40.7921, longitude: -73.9746 },
    { zip: '10025', city: 'New York', state: 'NY', latitude: 40.7998, longitude: -73.9684 },
    { zip: '10028', city: 'New York', state: 'NY', latitude: 40.7766, longitude: -73.9534 },
    { zip: '10036', city: 'New York', state: 'NY', latitude: 40.7599, longitude: -73.9902 },
    
    // Brooklyn
    { zip: '11201', city: 'Brooklyn', state: 'NY', latitude: 40.6944, longitude: -73.9905 },
    { zip: '11203', city: 'Brooklyn', state: 'NY', latitude: 40.6493, longitude: -73.9340 },
    { zip: '11205', city: 'Brooklyn', state: 'NY', latitude: 40.6941, longitude: -73.9657 },
    { zip: '11206', city: 'Brooklyn', state: 'NY', latitude: 40.7022, longitude: -73.9432 },
    { zip: '11207', city: 'Brooklyn', state: 'NY', latitude: 40.6702, longitude: -73.8948 },
    { zip: '11209', city: 'Brooklyn', state: 'NY', latitude: 40.6218, longitude: -74.0300 },
    { zip: '11210', city: 'Brooklyn', state: 'NY', latitude: 40.6314, longitude: -73.9453 },
    { zip: '11211', city: 'Brooklyn', state: 'NY', latitude: 40.7120, longitude: -73.9538 },
    { zip: '11212', city: 'Brooklyn', state: 'NY', latitude: 40.6628, longitude: -73.9133 },
    { zip: '11215', city: 'Brooklyn', state: 'NY', latitude: 40.6682, longitude: -73.9861 },
    { zip: '11216', city: 'Brooklyn', state: 'NY', latitude: 40.6817, longitude: -73.9495 },
    { zip: '11217', city: 'Brooklyn', state: 'NY', latitude: 40.6827, longitude: -73.9786 },
    { zip: '11220', city: 'Brooklyn', state: 'NY', latitude: 40.6413, longitude: -74.0166 },
    { zip: '11221', city: 'Brooklyn', state: 'NY', latitude: 40.6907, longitude: -73.9268 },
    
    // Add some popular areas
    { zip: '90210', city: 'Beverly Hills', state: 'CA', latitude: 34.0901, longitude: -118.4065 },
    { zip: '60611', city: 'Chicago', state: 'IL', latitude: 41.8933, longitude: -87.6211 },
    { zip: '02108', city: 'Boston', state: 'MA', latitude: 42.3588, longitude: -71.0707 },
    { zip: '33139', city: 'Miami Beach', state: 'FL', latitude: 25.7860, longitude: -80.1323 },
    { zip: '77001', city: 'Houston', state: 'TX', latitude: 29.7546, longitude: -95.3773 },
    { zip: '76006', city: 'Arlington', state: 'TX', latitude: 32.7386, longitude: -97.1080 },
    { zip: '80014', city: 'Aurora', state: 'CO', latitude: 39.6478, longitude: -104.7857 },
    { zip: '80203', city: 'Denver', state: 'CO', latitude: 39.7312, longitude: -104.9826 },
    { zip: '80401', city: 'Golden', state: 'CO', latitude: 39.7608, longitude: -105.2092 },
    { zip: '30303', city: 'Atlanta', state: 'GA', latitude: 33.7573, longitude: -84.3876 },
  ];
  
  try {
    // First, check if the table already has records to avoid duplicates
    const existingRecords = await db.select({ count: { count: db.fn.count() } }).from(zipCoordinates);
    
    if (existingRecords[0].count > 0) {
      console.log(`ZIP coordinates table already has ${existingRecords[0].count} records. Skipping import.`);
      return;
    }
    
    // Insert the ZIP code coordinates
    const result = await db.insert(zipCoordinates).values(zipCodes);
    
    console.log(`Successfully added ${zipCodes.length} ZIP code coordinates to the database.`);
  } catch (error) {
    console.error('Error creating or populating ZIP coordinates table:', error);
  }
}

// Run the function
createZipCoordinatesTable()
  .then(() => {
    console.log('Finished setting up ZIP coordinates');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });