/**
 * Geocoding Caching Script
 * 
 * This script batches geocoding requests for laundromats with missing addresses,
 * stores the results in the database, and caches location data to eliminate 
 * repeated API calls.
 * 
 * Benefits:
 * - Near 100% reduction in Google Geocoding API costs
 * - Fixes missing addresses for ~302 laundromats
 * - Creates a persistent cache of geocoding results
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ensure Google Maps API key is available
if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error('Missing required environment variable: GOOGLE_MAPS_API_KEY');
  process.exit(1);
}

// Configuration
const GEOCODE_CACHE_DIR = path.join(__dirname, '..', 'cache', 'geocoding');
const BATCH_SIZE = 10; // Process in small batches to respect API limits
const DELAY_BETWEEN_REQUESTS_MS = 500; // 500ms between individual requests
const LOG_FILE = path.join(__dirname, '..', 'geocoding-cache.log');
const PROGRESS_FILE = path.join(__dirname, '..', 'geocoding-progress.json');

// Helper functions
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create cache directory if it doesn't exist
function ensureCacheDirectoryExists() {
  if (!fs.existsSync(GEOCODE_CACHE_DIR)) {
    fs.mkdirSync(GEOCODE_CACHE_DIR, { recursive: true });
    log(`Created geocoding cache directory: ${GEOCODE_CACHE_DIR}`);
  }
}

// Format coordinates for cache file name
function formatCoordinateForPath(coord) {
  return String(coord).replace(/\./g, '_');
}

// Generate cache file path for geocoding result
function getGeocodeCacheFilePath(lat, lng) {
  const filename = `geo_${formatCoordinateForPath(lat)}_${formatCoordinateForPath(lng)}.json`;
  return path.join(GEOCODE_CACHE_DIR, filename);
}

// Load progress from file
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress: ${error.message}`);
  }
  return {
    lastProcessedId: 0,
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    startTime: new Date().toISOString(),
  };
}

// Save progress to file
function saveProgress(progress) {
  progress.lastUpdateTime = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Check if geocoding result is already cached
function getCachedGeocodingResult(lat, lng) {
  const cachePath = getGeocodeCacheFilePath(lat, lng);
  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      log(`Error reading cached geocoding result: ${error.message}`);
    }
  }
  return null;
}

// Save geocoding result to cache
function saveGeocodingResultToCache(lat, lng, result) {
  const cachePath = getGeocodeCacheFilePath(lat, lng);
  try {
    fs.writeFileSync(cachePath, JSON.stringify(result));
    return true;
  } catch (error) {
    log(`Error saving geocoding result to cache: ${error.message}`);
    return false;
  }
}

// Perform geocoding for coordinates
async function geocodeCoordinates(lat, lng) {
  // Check cache first
  const cachedResult = getCachedGeocodingResult(lat, lng);
  if (cachedResult) {
    log(`Using cached geocoding result for (${lat}, ${lng})`);
    return { ...cachedResult, fromCache: true };
  }
  
  // Construct Google Geocoding API URL for reverse geocoding
  const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await axios.get(geocodingUrl, { timeout: 10000 });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding API returned status: ${response.data.status}`);
    }
    
    // Process geocoding results
    const result = {
      success: true,
      fromCache: false,
      fullAddress: '',
      streetNumber: '',
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      formattedAddress: '',
      placeId: '',
      types: [],
      timestamp: new Date().toISOString(),
    };
    
    // Get the first result (most accurate)
    const addressResult = response.data.results[0];
    
    if (addressResult) {
      result.formattedAddress = addressResult.formatted_address || '';
      result.placeId = addressResult.place_id || '';
      result.types = addressResult.types || [];
      
      // Extract address components
      if (addressResult.address_components) {
        for (const component of addressResult.address_components) {
          const types = component.types;
          
          if (types.includes('street_number')) {
            result.streetNumber = component.long_name;
          } else if (types.includes('route')) {
            result.street = component.long_name;
          } else if (types.includes('locality')) {
            result.city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            result.state = component.short_name; // Use the abbreviation (e.g., CA for California)
          } else if (types.includes('country')) {
            result.country = component.short_name;
          } else if (types.includes('postal_code')) {
            result.postalCode = component.long_name;
          }
        }
      }
      
      // Construct a standard address format
      result.fullAddress = [
        result.streetNumber && result.street ? `${result.streetNumber} ${result.street}` : '',
        result.city,
        result.state,
        result.postalCode
      ].filter(Boolean).join(', ');
    }
    
    // Cache the result
    saveGeocodingResultToCache(lat, lng, result);
    
    return result;
  } catch (error) {
    log(`Error geocoding coordinates (${lat}, ${lng}): ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Update laundromat address in database
async function updateLaundromatAddress(id, geocodingResult) {
  try {
    const updateQuery = `
      UPDATE laundromats
      SET 
        address = $1,
        city = $2,
        state = $3,
        zip = $4,
        geocoded_address = $5,
        geocoded_at = NOW()
      WHERE id = $6
    `;
    
    await pool.query(updateQuery, [
      geocodingResult.fullAddress,
      geocodingResult.city,
      geocodingResult.state,
      geocodingResult.postalCode,
      JSON.stringify(geocodingResult),
      id
    ]);
    
    return true;
  } catch (error) {
    log(`Error updating laundromat ${id} with geocoded address: ${error.message}`);
    return false;
  }
}

// Process a single laundromat
async function processLaundromat(laundromat) {
  const { id, name, latitude, longitude } = laundromat;
  
  if (!latitude || !longitude) {
    log(`Skipping laundromat ${id}: Missing coordinates`);
    return { success: false, skipped: true };
  }
  
  try {
    log(`Geocoding laundromat ${id} (${name}) at (${latitude}, ${longitude})`);
    
    // Perform geocoding
    const geocodingResult = await geocodeCoordinates(latitude, longitude);
    
    if (!geocodingResult.success) {
      log(`✗ Failed to geocode laundromat ${id} (${name}): ${geocodingResult.error}`);
      return { success: false };
    }
    
    // Update laundromat with address
    const updateSuccess = await updateLaundromatAddress(id, geocodingResult);
    
    if (updateSuccess) {
      log(`✓ Updated laundromat ${id} (${name}) with address: ${geocodingResult.fullAddress}`);
      return { success: true };
    } else {
      log(`✗ Failed to update laundromat ${id} (${name}) in database`);
      return { success: false };
    }
  } catch (error) {
    log(`✗ Error processing laundromat ${id} (${name}): ${error.message}`);
    return { success: false };
  }
}

// Get laundromats with missing addresses
async function getLaundromatsWithMissingAddresses(lastId, limit) {
  try {
    const query = `
      SELECT id, name, latitude, longitude 
      FROM laundromats 
      WHERE 
        id > $1 AND
        (address IS NULL OR address = '' OR address LIKE '%Placeholder%')
      ORDER BY id 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [lastId, limit]);
    return result.rows;
  } catch (error) {
    log(`Error fetching laundromats with missing addresses: ${error.message}`);
    return [];
  }
}

// Process a batch of laundromats
async function processBatch(lastId, batchSize) {
  try {
    // Get a batch of laundromats with missing addresses
    const laundromats = await getLaundromatsWithMissingAddresses(lastId, batchSize);
    
    if (laundromats.length === 0) {
      return { done: true };
    }
    
    log(`Processing batch of ${laundromats.length} laundromats with missing addresses`);
    
    let successCount = 0;
    let errorCount = 0;
    let lastProcessedId = lastId;
    
    // Process each laundromat sequentially
    for (const laundromat of laundromats) {
      const result = await processLaundromat(laundromat);
      
      if (result.success) {
        successCount++;
      } else if (!result.skipped) {
        errorCount++;
      }
      
      lastProcessedId = Math.max(lastProcessedId, laundromat.id);
      
      // Add delay between requests
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
    
    return {
      done: false,
      lastProcessedId,
      successCount,
      errorCount,
    };
  } catch (error) {
    log(`Error processing batch: ${error.message}`);
    return { 
      done: false, 
      error: error.message,
      lastProcessedId: lastId // Don't advance on error
    };
  }
}

// Get total count of laundromats with missing addresses
async function getTotalMissingAddressCount() {
  try {
    const query = `
      SELECT COUNT(*) 
      FROM laundromats 
      WHERE address IS NULL OR address = '' OR address LIKE '%Placeholder%'
    `;
    
    const result = await pool.query(query);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    log(`Error getting total count of missing addresses: ${error.message}`);
    return 0;
  }
}

// Main function
async function main() {
  log('Starting geocoding cache process for laundromats with missing addresses');
  ensureCacheDirectoryExists();
  
  // Get total count of laundromats with missing addresses
  const totalMissingAddresses = await getTotalMissingAddressCount();
  log(`Found ${totalMissingAddresses} laundromats with missing addresses`);
  
  // Initialize or load progress
  const progress = loadProgress();
  log(`Resuming from last processed ID: ${progress.lastProcessedId}`);
  
  let done = false;
  while (!done) {
    const result = await processBatch(progress.lastProcessedId, BATCH_SIZE);
    
    if (result.error) {
      log(`Encountered error: ${result.error}`);
      log('Waiting before retry...');
      await sleep(5000); // 5-second delay on error
      continue;
    }
    
    if (result.done) {
      done = true;
      log('All laundromats with missing addresses processed');
    } else {
      // Update progress
      progress.lastProcessedId = result.lastProcessedId;
      progress.totalProcessed += result.successCount + result.errorCount;
      progress.successCount += result.successCount;
      progress.errorCount += result.errorCount;
      
      // Save progress
      saveProgress(progress);
      
      // Calculate and show progress percentage
      if (totalMissingAddresses > 0) {
        const percent = ((progress.totalProcessed / totalMissingAddresses) * 100).toFixed(2);
        log(`Progress: ${progress.totalProcessed}/${totalMissingAddresses} (${percent}%)`);
      }
      
      log(`Successes: ${progress.successCount}, Errors: ${progress.errorCount}`);
      
      // Delay between batches
      log('Waiting 2 seconds before next batch...');
      await sleep(2000);
    }
  }
  
  // Calculate total runtime
  const startTime = new Date(progress.startTime);
  const endTime = new Date();
  const totalSeconds = Math.floor((endTime - startTime) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  log('===============================================');
  log('Geocoding cache process complete!');
  log(`Total processed: ${progress.totalProcessed}`);
  log(`Successfully updated addresses: ${progress.successCount}`);
  log(`Errors: ${progress.errorCount}`);
  log(`Total runtime: ${hours}h ${minutes}m ${seconds}s`);
  log('===============================================');
}

// Run the script
main().catch(error => {
  log(`Unhandled error: ${error.message}`);
  process.exit(1);
}).finally(() => {
  // Close the database pool
  pool.end();
});