/**
 * Street View Image Caching Script
 * 
 * This script pre-generates and stores Street View images for all laundromats,
 * eliminating the need for repeated Google Street View API calls.
 * 
 * Benefits:
 * - Near 100% reduction in Google Street View API costs
 * - Faster page load times
 * - Fallback to satellite view when Street View is unavailable
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
const STREETVIEW_CACHE_DIR = path.join(__dirname, '..', 'client', 'public', 'maps', 'streetview');
const SATELLITE_CACHE_DIR = path.join(__dirname, '..', 'client', 'public', 'maps', 'satellite');
const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 2000; // 2 second delay between batches
const DELAY_BETWEEN_REQUESTS_MS = 300; // 300ms delay between individual requests
const MAX_CONCURRENCY = 5; // Maximum number of concurrent requests
const LOG_FILE = path.join(__dirname, '..', 'streetview-cache.log');
const PROGRESS_FILE = path.join(__dirname, '..', 'streetview-progress.json');

// Street View image settings
const STREETVIEW_WIDTH = 600;
const STREETVIEW_HEIGHT = 400;
const STREETVIEW_FOV = 80; // Field of view
const STREETVIEW_PITCH = 0; // Angle (0 = straight)
const STREETVIEW_HEADING = 'random'; // Direction, or 'random' to try multiple angles

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

// Create cache directories if they don't exist
function ensureCacheDirectoriesExist() {
  if (!fs.existsSync(STREETVIEW_CACHE_DIR)) {
    fs.mkdirSync(STREETVIEW_CACHE_DIR, { recursive: true });
    log(`Created Street View cache directory: ${STREETVIEW_CACHE_DIR}`);
  }
  
  if (!fs.existsSync(SATELLITE_CACHE_DIR)) {
    fs.mkdirSync(SATELLITE_CACHE_DIR, { recursive: true });
    log(`Created Satellite cache directory: ${SATELLITE_CACHE_DIR}`);
  }
}

// Format coordinates for file path (replace dots with underscores)
function formatCoordinateForPath(coord) {
  return String(coord).replace(/\./g, '_');
}

// Generate cache file path
function getStreetViewCacheFilePath(lat, lng, heading) {
  const headingStr = heading !== undefined ? `_h${heading}` : '';
  const filename = `sv_${formatCoordinateForPath(lat)}_${formatCoordinateForPath(lng)}${headingStr}.jpg`;
  return path.join(STREETVIEW_CACHE_DIR, filename);
}

function getSatelliteCacheFilePath(lat, lng, zoom = 18) {
  const filename = `sat_${formatCoordinateForPath(lat)}_${formatCoordinateForPath(lng)}_${zoom}.jpg`;
  return path.join(SATELLITE_CACHE_DIR, filename);
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
    streetViewSuccess: 0,
    streetViewMissing: 0,
    satelliteSuccess: 0,
    errors: 0,
    startTime: new Date().toISOString(),
  };
}

// Save progress to file
function saveProgress(progress) {
  progress.lastUpdateTime = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Check if Street View is available at specific location
async function checkStreetViewAvailability(lat, lng) {
  try {
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(metadataUrl, { timeout: 5000 });
    return response.data.status === 'OK';
  } catch (error) {
    log(`Error checking Street View availability: ${error.message}`);
    return false;
  }
}

// Find best Street View heading by testing multiple angles
async function findBestStreetViewHeading(lat, lng) {
  // Try several headings to find the best view
  const headings = [0, 90, 180, 270]; // Cardinal directions
  
  for (const heading of headings) {
    try {
      const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&heading=${heading}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const response = await axios.get(metadataUrl, { timeout: 5000 });
      
      if (response.data.status === 'OK') {
        return heading;
      }
      
      // Small delay between heading checks
      await sleep(100);
    } catch (error) {
      // Continue with next heading
    }
  }
  
  return 0; // Default to north if no good heading found
}

// Download Street View image
async function downloadStreetViewImage(lat, lng, heading) {
  const url = `https://maps.googleapis.com/maps/api/streetview?size=${STREETVIEW_WIDTH}x${STREETVIEW_HEIGHT}&location=${lat},${lng}&fov=${STREETVIEW_FOV}&pitch=${STREETVIEW_PITCH}&heading=${heading}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to download Street View image: ${error.message}`);
  }
}

// Download Satellite image
async function downloadSatelliteImage(lat, lng, zoom = 18) {
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${STREETVIEW_WIDTH}x${STREETVIEW_HEIGHT}&maptype=satellite&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to download Satellite image: ${error.message}`);
  }
}

// Process a single laundromat
async function processLaundromat(laundromat) {
  const { id, name, latitude, longitude } = laundromat;
  
  if (!latitude || !longitude) {
    log(`Skipping laundromat ${id}: Missing coordinates`);
    return { 
      streetViewSuccess: false, 
      satelliteSuccess: false, 
      streetViewMissing: false,
      error: false,
      skipped: true 
    };
  }
  
  let result = {
    streetViewSuccess: false,
    satelliteSuccess: false,
    streetViewMissing: false,
    error: false,
    skipped: false
  };
  
  try {
    // Check if Street View is available
    const hasStreetView = await checkStreetViewAvailability(latitude, longitude);
    
    if (hasStreetView) {
      // Get best heading
      let heading = 0;
      
      if (STREETVIEW_HEADING === 'random') {
        heading = await findBestStreetViewHeading(latitude, longitude);
      } else {
        heading = parseInt(STREETVIEW_HEADING);
      }
      
      // Get Street View cache path
      const streetViewCachePath = getStreetViewCacheFilePath(latitude, longitude, heading);
      
      // Check if Street View image is already cached
      if (!fs.existsSync(streetViewCachePath)) {
        // Download and cache Street View image
        const streetViewImage = await downloadStreetViewImage(latitude, longitude, heading);
        fs.writeFileSync(streetViewCachePath, streetViewImage);
        log(`✓ Cached Street View image for ${id} (${name}) with heading ${heading}°`);
        result.streetViewSuccess = true;
      } else {
        log(`Skipping Street View for ${id} (${name}): Already cached`);
        result.streetViewSuccess = true;
      }
    } else {
      log(`× No Street View available for ${id} (${name})`);
      result.streetViewMissing = true;
    }
    
    // Always get satellite view as fallback
    const satelliteCachePath = getSatelliteCacheFilePath(latitude, longitude);
    
    if (!fs.existsSync(satelliteCachePath)) {
      // Download and cache Satellite image
      const satelliteImage = await downloadSatelliteImage(latitude, longitude);
      fs.writeFileSync(satelliteCachePath, satelliteImage);
      log(`✓ Cached Satellite image for ${id} (${name})`);
      result.satelliteSuccess = true;
    } else {
      log(`Skipping Satellite for ${id} (${name}): Already cached`);
      result.satelliteSuccess = true;
    }
  } catch (error) {
    log(`✗ Error processing laundromat ${id} (${name}): ${error.message}`);
    result.error = true;
  }
  
  return result;
}

// Process a batch of laundromats
async function processBatch(lastId, batchSize) {
  try {
    // Get a batch of laundromats
    const result = await pool.query(
      `SELECT id, name, latitude, longitude 
       FROM laundromats 
       WHERE id > $1 
       ORDER BY id 
       LIMIT $2`,
      [lastId, batchSize]
    );
    
    if (result.rows.length === 0) {
      return { done: true };
    }
    
    log(`Processing batch of ${result.rows.length} laundromats (starting from ID ${lastId + 1})`);
    
    // Process laundromats with limited concurrency
    const batches = [];
    for (let i = 0; i < result.rows.length; i += MAX_CONCURRENCY) {
      const chunk = result.rows.slice(i, i + MAX_CONCURRENCY);
      batches.push(chunk);
    }
    
    let streetViewSuccess = 0;
    let streetViewMissing = 0;
    let satelliteSuccess = 0;
    let errors = 0;
    let lastProcessedId = lastId;
    
    for (const batch of batches) {
      // Process each batch in parallel with limited concurrency
      const promises = batch.map(laundromat => processLaundromat(laundromat));
      const results = await Promise.all(promises);
      
      // Calculate statistics
      for (let i = 0; i < results.length; i++) {
        if (results[i].streetViewSuccess) streetViewSuccess++;
        if (results[i].streetViewMissing) streetViewMissing++;
        if (results[i].satelliteSuccess) satelliteSuccess++;
        if (results[i].error) errors++;
        
        lastProcessedId = Math.max(lastProcessedId, batch[i].id);
      }
      
      // Add small delay between chunks
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
    
    return {
      done: false,
      lastProcessedId,
      streetViewSuccess,
      streetViewMissing,
      satelliteSuccess,
      errors,
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

// Get total number of laundromats
async function getTotalCount() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM laundromats');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    log(`Error getting total count: ${error.message}`);
    return 0;
  }
}

// Main function
async function main() {
  log('Starting Street View and Satellite image caching process');
  ensureCacheDirectoriesExist();
  
  // Initialize or load progress
  const progress = loadProgress();
  log(`Resuming from last processed ID: ${progress.lastProcessedId}`);
  
  let done = false;
  while (!done) {
    const result = await processBatch(progress.lastProcessedId, BATCH_SIZE);
    
    if (result.error) {
      log(`Encountered error: ${result.error}`);
      log('Waiting before retry...');
      await sleep(DELAY_BETWEEN_BATCHES_MS * 5); // Longer delay on error
      continue;
    }
    
    if (result.done) {
      done = true;
      log('All laundromats processed');
    } else {
      // Update progress
      progress.lastProcessedId = result.lastProcessedId;
      progress.totalProcessed += BATCH_SIZE;
      progress.streetViewSuccess += result.streetViewSuccess;
      progress.streetViewMissing += result.streetViewMissing;
      progress.satelliteSuccess += result.satelliteSuccess;
      progress.errors += result.errors;
      
      // Save progress
      saveProgress(progress);
      
      // Calculate and show progress percentage
      const totalLaundromats = await getTotalCount();
      const percent = ((progress.lastProcessedId / totalLaundromats) * 100).toFixed(2);
      log(`Progress: ${progress.lastProcessedId}/${totalLaundromats} (${percent}%)`);
      log(`Street View success: ${progress.streetViewSuccess}, missing: ${progress.streetViewMissing}`);
      log(`Satellite success: ${progress.satelliteSuccess}, Errors: ${progress.errors}`);
      
      // Delay between batches to respect API rate limits
      log(`Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
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
  log('Street View and Satellite image caching complete!');
  log(`Total processed: ${progress.totalProcessed}`);
  log(`Street View images cached: ${progress.streetViewSuccess}`);
  log(`Locations without Street View: ${progress.streetViewMissing}`);
  log(`Satellite images cached: ${progress.satelliteSuccess}`);
  log(`Errors: ${progress.errors}`);
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