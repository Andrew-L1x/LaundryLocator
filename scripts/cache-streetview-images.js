/**
 * Street View Image Caching System
 * 
 * This script implements a local static caching system for Google Street View images
 * to dramatically reduce API costs. Instead of making repeated API calls for the same 
 * locations, we store these images locally and serve them directly.
 * 
 * Benefits:
 * - Significantly reduces Street View API costs (typically $7 per 1000 requests)
 * - Improves page load times by serving images locally
 * - Provides a fallback when Street View API limits are reached
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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
    path.join(process.cwd(), 'streetview-cache.log'),
    `[${timestamp}] ${message}\n`
  );
}

/**
 * Ensure the necessary directories and database tables exist
 */
async function initialize() {
  try {
    // Create directories if they don't exist
    const streetViewDir = path.join(process.cwd(), 'client', 'public', 'street-view');
    if (!fs.existsSync(streetViewDir)) {
      fs.mkdirSync(streetViewDir, { recursive: true });
      log('Created street view directory');
    }
    
    // Create database table to track cached images
    const tableQuery = `
      CREATE TABLE IF NOT EXISTS streetview_cache (
        id SERIAL PRIMARY KEY,
        location_key TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        api_calls_saved INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS streetview_location_idx ON streetview_cache(location_key);
    `;
    
    await pool.query(tableQuery);
    log('Ensured streetview_cache table exists');
    
    return true;
  } catch (error) {
    log(`Error during initialization: ${error.message}`);
    return false;
  }
}

/**
 * Generate Street View image URL
 */
function generateStreetViewUrl(latitude, longitude, size = '600x300', heading = 180, pitch = 0) {
  const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
  const location = `${latitude},${longitude}`;
  
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${location}&heading=${heading}&pitch=${pitch}&key=${GOOGLE_MAPS_API_KEY}`;
}

/**
 * Check if a Street View image is already cached
 */
async function checkCachedStreetView(locationKey) {
  try {
    const result = await pool.query(
      'SELECT filename, last_updated FROM streetview_cache WHERE location_key = $1',
      [locationKey]
    );
    
    if (result.rows.length > 0) {
      // Increment API calls saved counter
      await pool.query(
        'UPDATE streetview_cache SET api_calls_saved = api_calls_saved + 1 WHERE location_key = $1',
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
    log(`Error checking cached Street View: ${error.message}`);
    return { cached: false, error: error.message };
  }
}

/**
 * Download and cache Street View image
 */
async function cacheStreetViewImage(latitude, longitude, size = '600x300', heading = 180, pitch = 0) {
  try {
    // Generate a unique key for this location and view settings
    const locationKey = `${latitude}_${longitude}_${heading}_${pitch}`;
    
    // Check if already cached
    const cachedResult = await checkCachedStreetView(locationKey);
    if (cachedResult.cached) {
      log(`Street View already cached: ${cachedResult.filename}`);
      return cachedResult;
    }
    
    // Generate Street View URL
    const streetViewUrl = generateStreetViewUrl(latitude, longitude, size, heading, pitch);
    
    // Generate filename
    const filename = `sv_${locationKey.replace(/\./g, '_')}.jpg`;
    const outputPath = path.join(process.cwd(), 'client', 'public', 'street-view', filename);
    
    // Download image
    log(`Downloading Street View for location ${latitude},${longitude}`);
    const response = await axios({
      method: 'GET',
      url: streetViewUrl.replace(process.env.VITE_GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN'),
      responseType: 'arraybuffer'
    });
    
    // Check if we got a real Street View or just the generic image
    // This can be done by checking the image signature or dimensions
    const imageBuffer = response.data;
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    // Check if this is a "no image available" response (typically has different dimensions)
    // This is implementation-dependent and may need adjusting
    const isGenericImage = metadata.width === 512 && metadata.height === 512;
    
    if (isGenericImage) {
      log(`Warning: Got generic "no image" response for ${latitude},${longitude}`);
      // Don't cache generic images to avoid showing the wrong data
      return { cached: false, error: 'No Street View available for this location' };
    }
    
    // Optimize image
    const optimizedImage = await sharp(imageBuffer)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    
    // Save to file
    fs.writeFileSync(outputPath, optimizedImage);
    
    // Record in database
    await pool.query(
      'INSERT INTO streetview_cache (location_key, filename) VALUES ($1, $2) ON CONFLICT (location_key) DO UPDATE SET filename = $2, last_updated = NOW()',
      [locationKey, filename]
    );
    
    log(`Successfully cached Street View: ${filename}`);
    
    return {
      cached: true,
      filename,
      lastUpdated: new Date(),
      justCreated: true
    };
  } catch (error) {
    log(`Error caching Street View: ${error.message}`);
    return { cached: false, error: error.message };
  }
}

/**
 * Get Street View image URL for a laundromat (either cached or generate new)
 */
async function getStreetViewForLaundromat(laundromat) {
  if (!laundromat.latitude || !laundromat.longitude) {
    return null;
  }
  
  const latitude = parseFloat(laundromat.latitude);
  const longitude = parseFloat(laundromat.longitude);
  
  // For each laundromat, we'll try four different headings (N, E, S, W)
  // to find the best Street View image
  const headings = [0, 90, 180, 270];
  
  for (const heading of headings) {
    const locationKey = `${latitude}_${longitude}_${heading}_0`;
    const cachedResult = await checkCachedStreetView(locationKey);
    
    if (cachedResult.cached) {
      return `/street-view/${cachedResult.filename}`;
    }
    
    // If not in production, try to cache it on the fly
    if (process.env.NODE_ENV !== 'production') {
      try {
        const cacheResult = await cacheStreetViewImage(latitude, longitude, '600x300', heading, 0);
        if (cacheResult.cached) {
          return `/street-view/${cacheResult.filename}`;
        }
      } catch (error) {
        log(`Error caching Street View on the fly: ${error.message}`);
      }
    }
  }
  
  // If in production and not cached, return the API URL directly for the first heading
  // This provides a fallback but doesn't save the image
  return generateStreetViewUrl(latitude, longitude, '600x300', 180, 0);
}

/**
 * Process batch of laundromats to cache their Street View images
 */
async function processBatch(client, offset = 0, limit = 50) {
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
    
    log(`Processing ${result.rows.length} laundromats for Street View caching`);
    
    // Track successful caches
    let successCount = 0;
    
    // Process each laundromat
    for (const laundromat of result.rows) {
      try {
        // We'll only cache one heading (south/180) for batch processing
        // to save on API costs during initial caching
        const cacheResult = await cacheStreetViewImage(
          parseFloat(laundromat.latitude),
          parseFloat(laundromat.longitude),
          '600x300',
          180,
          0
        );
        
        if (cacheResult.cached) {
          successCount++;
        }
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        log(`Error processing laundromat ${laundromat.id} for Street View: ${error.message}`);
      }
    }
    
    log(`Processed batch: ${successCount}/${result.rows.length} Street View images cached successfully`);
    return result.rows.length;
  } catch (error) {
    log(`Error processing batch: ${error.message}`);
    return 0;
  }
}

/**
 * Run caching job for all laundromats
 */
async function cacheAllStreetViews() {
  const client = await pool.connect();
  
  try {
    let offset = 0;
    const batchSize = 50;
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
        log(`Progress: processed ${totalProcessed} laundromats for Street View caching`);
        
        // Add a pause between batches to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    log(`Completed caching Street View images for ${totalProcessed} laundromats`);
  } catch (error) {
    log(`Error in cacheAllStreetViews: ${error.message}`);
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
    const countResult = await pool.query('SELECT COUNT(*) as total FROM streetview_cache');
    const totalCached = parseInt(countResult.rows[0].total);
    
    // Get total API calls saved
    const apiCallsResult = await pool.query('SELECT SUM(api_calls_saved) as total_saved FROM streetview_cache');
    const totalApiCallsSaved = parseInt(apiCallsResult.rows[0].total_saved || 0);
    
    // Get age statistics
    const ageResult = await pool.query(`
      SELECT 
        COUNT(*) as total_old 
      FROM streetview_cache 
      WHERE last_updated < NOW() - INTERVAL '90 days'
    `);
    const oldImagesCount = parseInt(ageResult.rows[0].total_old);
    
    // Calculate estimated cost savings (assume $7 per 1000 Street View API calls)
    const estimatedSavings = (totalApiCallsSaved / 1000) * 7;
    
    return {
      totalCached,
      totalApiCallsSaved,
      oldImagesCount,
      estimatedSavings: estimatedSavings.toFixed(2)
    };
  } catch (error) {
    log(`Error getting cache stats: ${error.message}`);
    return {
      totalCached: 0,
      totalApiCallsSaved: 0,
      oldImagesCount: 0,
      estimatedSavings: 0
    };
  }
}

// Export functions
module.exports = {
  initialize,
  cacheStreetViewImage,
  checkCachedStreetView,
  getStreetViewForLaundromat,
  cacheAllStreetViews,
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
        
        log('===== Street View Cache Statistics =====');
        log(`Total cached images: ${stats.totalCached}`);
        log(`Total API calls saved: ${stats.totalApiCallsSaved}`);
        log(`Images older than 90 days: ${stats.oldImagesCount}`);
        log(`Estimated cost savings: $${stats.estimatedSavings}`);
      } else if (args.includes('--cache-all')) {
        // Cache all laundromat Street Views
        log('Starting batch caching of all Street View images...');
        await cacheAllStreetViews();
      } else if (args.includes('--test')) {
        // Test with a single location
        const latitude = args[args.indexOf('--test') + 1] || 37.7749;
        const longitude = args[args.indexOf('--test') + 2] || -122.4194;
        
        log(`Testing Street View cache for location: ${latitude}, ${longitude}`);
        const result = await cacheStreetViewImage(latitude, longitude);
        
        if (result.cached) {
          log(`Successfully cached Street View image: ${result.filename}`);
        } else {
          log(`Failed to cache Street View image: ${result.error}`);
        }
      } else {
        // Print usage
        log('Usage:');
        log('  node cache-streetview-images.js --stats       (Show cache statistics)');
        log('  node cache-streetview-images.js --cache-all   (Cache all laundromat Street Views)');
        log('  node cache-streetview-images.js --test lat lng (Test caching a specific location)');
      }
    } catch (error) {
      log(`Error: ${error.message}`);
    } finally {
      pool.end();
    }
  })();
}