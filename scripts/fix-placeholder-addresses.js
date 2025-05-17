/**
 * Fix Placeholder Addresses Script
 * 
 * This script identifies laundromats with placeholder addresses (like "123 Main St")
 * and uses their latitude/longitude coordinates to get real addresses via Google Maps API.
 */

import pg from 'pg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create log directory if it doesn't exist
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Configure logging
const LOG_FILE = path.join(LOG_DIR, 'address-fix.log');
const PID_FILE = path.join(process.cwd(), 'address-fix.pid');

// Check if Google Maps API key is available
if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error('Error: GOOGLE_MAPS_API_KEY environment variable is not set.');
  process.exit(1);
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Store PID to allow checking if the script is already running
fs.writeFileSync(PID_FILE, process.pid.toString());

// Log function with timestamps
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

// Clean up on exit
function cleanup() {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
  log('Script terminated');
}

// Set up cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
  log('Received SIGINT - shutting down');
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('Received SIGTERM - shutting down');
  process.exit(0);
});

// Sleep function for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get real address using Google Maps Reverse Geocoding API
 */
async function getRealAddress(latitude, longitude) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      // Get the most detailed result (usually the first one)
      const result = response.data.results[0];
      
      // Extract components
      const streetNumber = result.address_components.find(comp => comp.types.includes('street_number'))?.long_name || '';
      const street = result.address_components.find(comp => comp.types.includes('route'))?.long_name || '';
      const city = result.address_components.find(comp => comp.types.includes('locality'))?.long_name || 
                  result.address_components.find(comp => comp.types.includes('administrative_area_level_3'))?.long_name || '';
      const state = result.address_components.find(comp => comp.types.includes('administrative_area_level_1'))?.short_name || '';
      const zip = result.address_components.find(comp => comp.types.includes('postal_code'))?.long_name || '';
      
      // Get formatted address
      const formattedAddress = result.formatted_address;
      const streetAddress = streetNumber && street ? `${streetNumber} ${street}` : formattedAddress.split(',')[0];
      
      return {
        success: true,
        streetAddress,
        city,
        state,
        zip,
        formattedAddress
      };
    } else {
      log(`Geocoding API error: ${response.data.status} for coordinates ${latitude},${longitude}`);
      return { success: false, error: response.data.status };
    }
  } catch (error) {
    log(`Error getting address from Google Maps: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Update a laundromat with the real address
 */
async function updateLaundromat(id, addressData, client) {
  try {
    const { streetAddress, city, state, zip } = addressData;
    
    // Update the laundromat record
    const query = `
      UPDATE laundromats
      SET address = $1, city = $2, state = $3, zip = $4
      WHERE id = $5
    `;
    
    await client.query(query, [streetAddress, city, state, zip, id]);
    return true;
  } catch (error) {
    log(`Error updating laundromat ${id}: ${error.message}`);
    return false;
  }
}

/**
 * Get laundromats with placeholder addresses
 */
async function getPlaceholderLaundromats(limit = 15) {
  try {
    const query = `
      SELECT id, latitude, longitude
      FROM laundromats
      WHERE (address LIKE '%123 Main%' OR address LIKE '%Placeholder%')
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    log(`Error getting placeholder laundromats: ${error.message}`);
    return [];
  }
}

/**
 * Process a batch of laundromats
 */
async function processBatch(batchSize = 15) {
  log(`Starting to process a batch of ${batchSize} laundromats`);
  
  // Get laundromats with placeholder addresses
  const laundromats = await getPlaceholderLaundromats(batchSize);
  
  if (laundromats.length === 0) {
    log('No placeholder addresses to fix');
    return 0;
  }
  
  log(`Found ${laundromats.length} laundromats with placeholder addresses`);
  
  let successCount = 0;
  let failCount = 0;
  
  // Get a client from the pool for transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Process each laundromat
    for (const laundromat of laundromats) {
      const { id, latitude, longitude } = laundromat;
      
      log(`Processing laundromat ${id} at coordinates ${latitude},${longitude}`);
      
      // Get real address from Google Maps
      const addressData = await getRealAddress(latitude, longitude);
      
      if (addressData.success) {
        log(`Got address for laundromat ${id}: ${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zip}`);
        
        // Update the laundromat
        const updated = await updateLaundromat(id, addressData, client);
        
        if (updated) {
          successCount++;
          log(`Updated laundromat ${id} with new address`);
        } else {
          failCount++;
          log(`Failed to update laundromat ${id}`);
        }
      } else {
        failCount++;
        log(`Failed to get address for laundromat ${id}: ${addressData.error}`);
      }
      
      // Rate limiting - don't overload the Google Maps API
      await sleep(200);
    }
    
    await client.query('COMMIT');
    log(`Batch complete: ${successCount} updated, ${failCount} failed`);
    
    return successCount;
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Error processing batch: ${error.message}`);
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Get current counts
 */
async function getCounts() {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM laundromats');
    const placeholderResult = await pool.query("SELECT COUNT(*) FROM laundromats WHERE address LIKE '%123 Main%' OR address LIKE '%Placeholder%'");
    
    return {
      total: parseInt(totalResult.rows[0].count, 10),
      placeholder: parseInt(placeholderResult.rows[0].count, 10)
    };
  } catch (error) {
    log(`Error getting counts: ${error.message}`);
    return { total: '?', placeholder: '?' };
  }
}

/**
 * Main function
 */
async function main() {
  log('Starting placeholder address fix script');
  
  // Get initial counts
  const initialCounts = await getCounts();
  log(`Initial state: ${initialCounts.placeholder} placeholder addresses out of ${initialCounts.total} total laundromats`);
  
  // Process a batch
  const processedCount = await processBatch(15);
  
  // Get final counts
  const finalCounts = await getCounts();
  log(`Final state: ${finalCounts.placeholder} placeholder addresses remaining out of ${finalCounts.total} total laundromats`);
  log(`Fixed ${processedCount} addresses`);
  
  log('Script completed');
}

// Run the script
main()
  .then(() => {
    setTimeout(() => process.exit(0), 500); // Give time for connections to close
  })
  .catch(error => {
    log(`Unhandled error: ${error.message}`);
    setTimeout(() => process.exit(1), 500);
  });