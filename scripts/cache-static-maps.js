/**
 * Static Maps Caching Script
 * 
 * This script pre-generates and stores static map images for all laundromats,
 * eliminating the need for repeated Google Static Maps API calls.
 * 
 * Benefits:
 * - Near 100% reduction in Google Static Maps API costs
 * - Faster page load times once maps are cached
 * - Consistent map display even during API disruptions
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
const MAPS_CACHE_DIR = path.join(__dirname, '..', 'client', 'public', 'maps', 'static');
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 1000; // 1 second delay between batches
const DELAY_BETWEEN_REQUESTS_MS = 200; // 200ms delay between individual requests
const MAX_CONCURRENCY = 5; // Maximum number of concurrent requests
const LOG_FILE = path.join(__dirname, '..', 'static-maps-cache.log');
const PROGRESS_FILE = path.join(__dirname, '..', 'static-maps-progress.json');

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
  if (!fs.existsSync(MAPS_CACHE_DIR)) {
    fs.mkdirSync(MAPS_CACHE_DIR, { recursive: true });
    log(`Created cache directory: ${MAPS_CACHE_DIR}`);
  }
}

// Format coordinates for file path (replace dots with underscores)
function formatCoordinateForPath(coord) {
  return String(coord).replace(/\./g, '_');
}

// Generate cache file path
function getCacheFilePath(lat, lng, zoom, width, height) {
  const filename = `map_${formatCoordinateForPath(lat)}_${formatCoordinateForPath(lng)}_${zoom}_${width}x${height}.jpg`;
  return path.join(MAPS_CACHE_DIR, filename);
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

// Generate and save static map for a laundromat
async function downloadStaticMap(laundromat, width = 600, height = 300, zoom = 14) {
  const { id, name, latitude, longitude } = laundromat;
  
  if (!latitude || !longitude) {
    log(`Skipping laundromat ${id}: Missing coordinates`);
    return { success: false, skipped: true };
  }
  
  const cachePath = getCacheFilePath(latitude, longitude, zoom, width, height);
  
  // Check if cache already exists
  if (fs.existsSync(cachePath)) {
    log(`Skipping laundromat ${id} (${name}): Cache already exists`);
    return { success: true, skipped: true };
  }
  
  // Construct Google Static Maps API URL
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${width}x${height}&scale=2&markers=color:red|${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  
  try {
    const response = await axios({
      method: 'GET',
      url: mapUrl,
      responseType: 'arraybuffer',
      timeout: 10000, // 10 seconds timeout
    });
    
    // Save image to cache
    fs.writeFileSync(cachePath, response.data);
    log(`✓ Cached static map for laundromat ${id} (${name})`);
    return { success: true };
  } catch (error) {
    log(`✗ Error caching static map for laundromat ${id} (${name}): ${error.message}`);
    return { success: false };
  }
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
    
    let successCount = 0;
    let errorCount = 0;
    let lastProcessedId = lastId;
    
    for (const batch of batches) {
      // Process each batch in parallel with limited concurrency
      const promises = batch.map(laundromat => downloadStaticMap(laundromat));
      const results = await Promise.all(promises);
      
      // Calculate statistics
      for (let i = 0; i < results.length; i++) {
        if (results[i].success) {
          successCount++;
        } else if (!results[i].skipped) {
          errorCount++;
        }
        lastProcessedId = Math.max(lastProcessedId, batch[i].id);
      }
      
      // Add small delay between chunks
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

// Main function
async function main() {
  log('Starting static maps caching process');
  ensureCacheDirectoryExists();
  
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
      progress.successCount += result.successCount;
      progress.errorCount += result.errorCount;
      
      // Save progress
      saveProgress(progress);
      
      // Calculate and show progress percentage
      const totalMaps = await getTotalCount();
      const percent = ((progress.lastProcessedId / totalMaps) * 100).toFixed(2);
      log(`Progress: ${progress.lastProcessedId}/${totalMaps} (${percent}%)`);
      log(`Success: ${progress.successCount}, Errors: ${progress.errorCount}`);
      
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
  log('Static maps caching process complete!');
  log(`Total processed: ${progress.totalProcessed}`);
  log(`Successfully cached: ${progress.successCount}`);
  log(`Errors: ${progress.errorCount}`);
  log(`Total runtime: ${hours}h ${minutes}m ${seconds}s`);
  log('===============================================');
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

// Run the script
main().catch(error => {
  log(`Unhandled error: ${error.message}`);
  process.exit(1);
}).finally(() => {
  // Close the database pool
  pool.end();
});