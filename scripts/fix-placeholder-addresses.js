/**
 * Fix Placeholder Addresses Script
 * 
 * This script identifies laundromat records with placeholder addresses like "123 Main Street"
 * and uses their latitude/longitude coordinates to retrieve accurate addresses via Google Maps Geocoding API.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!GOOGLE_MAPS_API_KEY) {
  console.error('Error: GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Placeholder address patterns to detect
const PLACEHOLDER_PATTERNS = [
  '123 Main Street',
  '123 Main St',
  '123 MAIN STREET',
  'MAIN STREET',
  'Main Street',
  '123 First Street',
  '123 Any Street'
];

/**
 * Fetch accurate address from Google Maps API using coordinates
 */
async function getAddressFromCoordinates(latitude, longitude) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      
      // Extract address components
      const street_number = result.address_components.find(c => c.types.includes('street_number'))?.long_name || '';
      const street = result.address_components.find(c => c.types.includes('route'))?.long_name || '';
      const city = result.address_components.find(c => c.types.includes('locality'))?.long_name || '';
      const state = result.address_components.find(c => c.types.includes('administrative_area_level_1'))?.short_name || '';
      const zip = result.address_components.find(c => c.types.includes('postal_code'))?.long_name || '';
      
      // Construct address
      const address = street_number ? `${street_number} ${street}` : street;
      
      return {
        address,
        city,
        state,
        zip,
        formatted_address: result.formatted_address
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching address from Google Maps: ${error.message}`);
    return null;
  }
}

/**
 * Main function to fix placeholder addresses
 */
async function fixPlaceholderAddresses() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to fix placeholder addresses...');
    
    // Find laundromats with placeholder addresses
    const query = `
      SELECT id, name, address, city, state, zip, latitude, longitude
      FROM laundromats
      WHERE ${PLACEHOLDER_PATTERNS.map(pattern => `address ILIKE '%${pattern}%'`).join(' OR ')}
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT 100
    `;
    
    const { rows } = await client.query(query);
    console.log(`Found ${rows.length} records with placeholder addresses`);
    
    let updatedCount = 0;
    
    // Process each record
    for (const record of rows) {
      console.log(`Processing ${record.name} (ID: ${record.id}) - Current address: ${record.address}`);
      
      // Skip if latitude or longitude is missing
      if (!record.latitude || !record.longitude) {
        console.log(`Skipping record ${record.id} - Missing coordinates`);
        continue;
      }
      
      // Get accurate address
      const addressInfo = await getAddressFromCoordinates(record.latitude, record.longitude);
      
      if (addressInfo && addressInfo.address) {
        console.log(`Found real address: ${addressInfo.formatted_address}`);
        
        // Update database with real address
        await client.query(`
          UPDATE laundromats
          SET 
            address = $1,
            city = CASE WHEN $2 != '' THEN $2 ELSE city END,
            state = CASE WHEN $3 != '' THEN $3 ELSE state END,
            zip = CASE WHEN $4 != '' THEN $4 ELSE zip END
          WHERE id = $5
        `, [
          addressInfo.address, 
          addressInfo.city,
          addressInfo.state,
          addressInfo.zip,
          record.id
        ]);
        
        updatedCount++;
        console.log(`Updated address for ${record.name} (ID: ${record.id})`);
        
        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log(`Could not get address for ${record.name} (ID: ${record.id})`);
      }
    }
    
    console.log(`Successfully updated ${updatedCount} out of ${rows.length} records`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
fixPlaceholderAddresses().catch(console.error);