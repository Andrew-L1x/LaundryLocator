/**
 * Quick Address Fix Script
 * 
 * This script identifies a small batch of laundromat records with placeholder addresses
 * and updates them with real addresses based on their geographic coordinates.
 */

import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configure batch size for processing
const BATCH_SIZE = 15;

// Pattern matching for placeholder addresses
const PLACEHOLDER_PATTERNS = [
  "123 Main St",
  "123 Main Street",
  "1234 Main St", 
  "123 Oak St",
  "123 Elm St"
];

/**
 * Fetch real address from Google Maps API using coordinates
 */
async function getAddressFromCoordinates(latitude, longitude) {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.log('Missing GOOGLE_MAPS_API_KEY environment variable.');
      return null;
    }
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      
      // Extract the formatted address
      const formatted_address = result.formatted_address;
      
      // Extract address components
      let street_number = '';
      let route = '';
      let city = '';
      let state = '';
      let zip = '';
      
      for (const component of result.address_components) {
        if (component.types.includes('street_number')) {
          street_number = component.long_name;
        } else if (component.types.includes('route')) {
          route = component.long_name;
        } else if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.short_name;
        } else if (component.types.includes('postal_code')) {
          zip = component.long_name;
        }
      }
      
      // Construct a proper street address
      const address = street_number && route ? `${street_number} ${route}` : '';
      
      return {
        address,
        city,
        state,
        zip,
        formatted_address
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching address: ${error.message}`);
    return null;
  }
}

/**
 * Fix a batch of placeholder addresses
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
      LIMIT ${BATCH_SIZE}
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
console.log('=== Starting Quick Address Fix ===');
fixPlaceholderAddresses()
  .then(() => {
    console.log('=== Address Fix Process Completed ===');
  })
  .catch(error => {
    console.error('Error:', error);
  });