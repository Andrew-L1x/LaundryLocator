/**
 * Static Map Image Optimization and Caching
 * 
 * This script optimizes the use of Google Static Maps API by:
 * 1. Downloading and locally storing static map images once for each location
 * 2. Creating a system to serve these cached images instead of making repeated API calls
 * 3. Adding a refresh mechanism for periodically updating important maps
 * 
 * This significantly reduces API usage since static map images don't change frequently
 * for most locations.
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // For image optimization
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(
    path.join(process.cwd(), 'static-maps-cache.log'),
    `[${timestamp}] ${message}\n`
  );
}

/**
 * Ensure the necessary directories and database tables exist
 */
async function initialize() {
  try {
    // Create directories if they don't exist
    const staticMapsDir = path.join(process.cwd(), 'client', 'public', 'static-maps');
    if (!fs.existsSync(staticMapsDir)) {
      fs.mkdirSync(staticMapsDir, { recursive: true });
      log('Created static maps directory');
    }
    
    // Create database table to track cached maps
    const tableQuery = `
      CREATE TABLE IF NOT EXISTS static_maps_cache (
        id SERIAL PRIMARY KEY,
        location_key TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        api_calls_saved INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS static_maps_location_idx ON static_maps_cache(location_key);
    `;
    
    await pool.query(tableQuery);
    log('Ensured static_maps_cache table exists');
    
    return true;
  } catch (error) {
    log(`Error during initialization: ${error.message}`);
    return false;
  }
}

/**
 * Generate static map image URL
 */
function generateStaticMapUrl(latitude, longitude, zoom = 15, width = 600, height = 300, markers = true) {
  const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
  const location = `${latitude},${longitude}`;
  
  let url = `https://maps.googleapis.com/maps/api/staticmap?center=${location}&zoom=${zoom}&size=${width}x${height}&scale=2&key=${GOOGLE_MAPS_API_KEY}`;
  
  // Add marker if requested
  if (markers) {
    url += `&markers=color:red|${location}`;
  }
  
  return url;
}

/**
 * Check if a static map image is already cached
 */
async function checkCachedMap(locationKey) {
  try {
    const result = await pool.query(
      'SELECT filename, last_updated FROM static_maps_cache WHERE location_key = $1',
      [locationKey]
    );
    
    if (result.rows.length > 0) {
      // Increment API calls saved counter
      await pool.query(
        'UPDATE static_maps_cache SET api_calls_saved = api_calls_saved + 1 WHERE location_key = $1',
        [locationKey]
      );
      
      return {
        cached: true,
        filename: result.rows[0].filename,
        lastUpdated: result.rows[0].last_updated
      };
    }
    
    return { cached: false };
  } catch (error) {
    log(`Error checking cached map: ${error.message}`);
    return { cached: false, error: error.message };
  }
}

/**
 * Download and cache static map image
 */
async function cacheStaticMap(latitude, longitude, zoom = 15, width = 600, height = 300) {
  try {
    // Generate a unique key for this map location and settings
    const locationKey = `${latitude}_${longitude}_${zoom}_${width}_${height}`;
    
    // Check if already cached
    const cachedResult = await checkCachedMap(locationKey);
    if (cachedResult.cached) {
      log(`Map already cached: ${cachedResult.filename}`);
      return cachedResult;
    }
    
    // Generate map URL
    const mapUrl = generateStaticMapUrl(latitude, longitude, zoom, width, height);
    
    // Generate filename
    const filename = `map_${locationKey.replace(/\./g, '_')}.png`;
    const outputPath = path.join(process.cwd(), 'client', 'public', 'static-maps', filename);
    
    // Download image
    log(`Downloading static map for location ${latitude},${longitude}`);
    const response = await axios({
      method: 'GET',
      url: mapUrl.replace(process.env.VITE_GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN'),
      responseType: 'arraybuffer'
    });
    
    // Optimize image
    const optimizedImage = await sharp(response.data)
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();
    
    // Save to file
    fs.writeFileSync(outputPath, optimizedImage);
    
    // Record in database
    await pool.query(
      'INSERT INTO static_maps_cache (location_key, filename) VALUES ($1, $2) ON CONFLICT (location_key) DO UPDATE SET filename = $2, last_updated = NOW()',
      [locationKey, filename]
    );
    
    log(`Successfully cached static map: ${filename}`);
    
    return {
      cached: true,
      filename,
      lastUpdated: new Date(),
      justCreated: true
    };
  } catch (error) {
    log(`Error caching static map: ${error.message}`);
    return { cached: false, error: error.message };
  }
}

/**
 * Get static map URL for a laundromat (either cached or generate new)
 */
async function getStaticMapForLaundromat(laundromat) {
  if (!laundromat.latitude || !laundromat.longitude) {
    return null;
  }
  
  const latitude = parseFloat(laundromat.latitude);
  const longitude = parseFloat(laundromat.longitude);
  
  // Check for existing cached map
  const locationKey = `${latitude}_${longitude}_15_600_300`; // Using default zoom and size
  const cachedResult = await checkCachedMap(locationKey);
  
  if (cachedResult.cached) {
    return `/static-maps/${cachedResult.filename}`;
  }
  
  // If not cached and we're running as a background job, cache it
  if (process.env.NODE_ENV !== 'production') {
    await cacheStaticMap(latitude, longitude);
    return `/static-maps/map_${locationKey.replace(/\./g, '_')}.png`;
  }
  
  // If in production and not cached, return the API URL directly
  // This provides a fallback but doesn't save the map
  return generateStaticMapUrl(latitude, longitude);
}

/**
 * Process batch of laundromats to cache their maps
 */
async function processBatch(client, offset = 0, limit = 100) {
  try {
    // Get laundromats
    const query = `
      SELECT id, name, latitude, longitude
      FROM laundromats
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
    `;
    
    const result = await client.query(query, [limit, offset]);
    
    if (result.rows.length === 0) {
      log('No more laundromats to process');
      return 0;
    }
    
    log(`Processing ${result.rows.length} laundromats`);
    
    // Track successful caches
    let successCount = 0;
    
    // Process each laundromat
    for (const laundromat of result.rows) {
      try {
        const cacheResult = await cacheStaticMap(
          parseFloat(laundromat.latitude),
          parseFloat(laundromat.longitude)
        );
        
        if (cacheResult.cached) {
          successCount++;
        }
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        log(`Error processing laundromat ${laundromat.id}: ${error.message}`);
      }
    }
    
    log(`Processed batch: ${successCount}/${result.rows.length} maps cached successfully`);
    return result.rows.length;
  } catch (error) {
    log(`Error processing batch: ${error.message}`);
    return 0;
  }
}

/**
 * Run caching job for all laundromats
 */
async function cacheAllStaticMaps() {
  const client = await pool.connect();
  
  try {
    let offset = 0;
    const batchSize = 100;
    let totalProcessed = 0;
    let continueProcessing = true;
    
    while (continueProcessing) {
      const processed = await processBatch(client, offset, batchSize);
      
      if (processed === 0) {
        continueProcessing = false;
      } else {
        totalProcessed += processed;
        offset += batchSize;
        
        // Log progress
        log(`Progress: processed ${totalProcessed} laundromats so far`);
        
        // Add a pause between batches to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    log(`Completed caching static maps for ${totalProcessed} laundromats`);
  } catch (error) {
    log(`Error in cacheAllStaticMaps: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  try {
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM static_maps_cache');
    const totalCached = parseInt(countResult.rows[0].total);
    
    // Get total API calls saved
    const apiCallsResult = await pool.query('SELECT SUM(api_calls_saved) as total_saved FROM static_maps_cache');
    const totalApiCallsSaved = parseInt(apiCallsResult.rows[0].total_saved || 0);
    
    // Get age statistics
    const ageResult = await pool.query(`
      SELECT 
        COUNT(*) as total_old 
      FROM static_maps_cache 
      WHERE last_updated < NOW() - INTERVAL '90 days'
    `);
    const oldMapsCount = parseInt(ageResult.rows[0].total_old);
    
    // Calculate estimated cost savings (assume $5 per 1000 Static Maps API calls)
    const estimatedSavings = (totalApiCallsSaved / 1000) * 5;
    
    return {
      totalCached,
      totalApiCallsSaved,
      oldMapsCount,
      estimatedSavings: estimatedSavings.toFixed(2)
    };
  } catch (error) {
    log(`Error getting cache stats: ${error.message}`);
    return {
      totalCached: 0,
      totalApiCallsSaved: 0,
      oldMapsCount: 0,
      estimatedSavings: 0
    };
  }
}

// Export functions
module.exports = {
  initialize,
  cacheStaticMap,
  checkCachedMap,
  getStaticMapForLaundromat,
  cacheAllStaticMaps,
  getCacheStats
};

// Direct execution
if (require.main === module) {
  (async () => {
    try {
      // Initialize
      await initialize();
      
      // Parse command-line arguments
      const args = process.argv.slice(2);
      
      if (args.includes('--stats')) {
        // Show cache statistics
        const stats = await getCacheStats();
        
        log('===== Static Maps Cache Statistics =====');
        log(`Total cached maps: ${stats.totalCached}`);
        log(`Total API calls saved: ${stats.totalApiCallsSaved}`);
        log(`Maps older than 90 days: ${stats.oldMapsCount}`);
        log(`Estimated cost savings: $${stats.estimatedSavings}`);
      } else if (args.includes('--cache-all')) {
        // Cache all laundromat maps
        log('Starting batch caching of all static maps...');
        await cacheAllStaticMaps();
      } else {
        // Print usage
        log('Usage:');
        log('  node optimize-static-maps.js --stats      (Show cache statistics)');
        log('  node optimize-static-maps.js --cache-all  (Cache all laundromat maps)');
      }
    } catch (error) {
      log(`Error: ${error.message}`);
    } finally {
      pool.end();
    }
  })();
}