/**
 * Cache Google Maps Geocoding Results
 * 
 * This script implements a geocoding cache system to reduce redundant API calls.
 * It stores previous geocoding results in the database so we don't have to 
 * repeatedly geocode the same addresses.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

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
    path.join(process.cwd(), 'geocoding-cache.log'),
    `[${timestamp}] ${message}\n`
  );
}

/**
 * Ensure the geocoding_cache table exists in the database
 */
async function ensureGeoCacheTable() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS geocoding_cache (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL UNIQUE,
        result JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS geocoding_cache_query_idx ON geocoding_cache(query);
    `;
    
    await pool.query(query);
    log('Ensured geocoding_cache table exists');
    return true;
  } catch (error) {
    log(`Error creating geocoding_cache table: ${error.message}`);
    return false;
  }
}

/**
 * Get cached geocoding result or null if not found
 */
async function getCachedGeocode(query) {
  try {
    const result = await pool.query(
      'SELECT result FROM geocoding_cache WHERE query = $1',
      [query]
    );
    
    if (result.rows.length > 0) {
      // Update last_used timestamp
      await pool.query(
        'UPDATE geocoding_cache SET last_used = NOW() WHERE query = $1',
        [query]
      );
      
      log(`Cache hit for query: ${query}`);
      return result.rows[0].result;
    }
    
    log(`Cache miss for query: ${query}`);
    return null;
  } catch (error) {
    log(`Error getting cached geocode: ${error.message}`);
    return null;
  }
}

/**
 * Save geocoding result to cache
 */
async function cacheGeocodingResult(query, result) {
  try {
    await pool.query(
      'INSERT INTO geocoding_cache (query, result) VALUES ($1, $2) ON CONFLICT (query) DO UPDATE SET result = $2, last_used = NOW()',
      [query, result]
    );
    
    log(`Cached result for query: ${query}`);
    return true;
  } catch (error) {
    log(`Error caching geocode result: ${error.message}`);
    return false;
  }
}

/**
 * Calculate cache statistics
 */
async function getCacheStats() {
  try {
    const totalQuery = 'SELECT COUNT(*) as total FROM geocoding_cache';
    const totalResult = await pool.query(totalQuery);
    const total = parseInt(totalResult.rows[0].total);
    
    const recentlyUsedQuery = 'SELECT COUNT(*) as recent FROM geocoding_cache WHERE last_used > NOW() - INTERVAL \'7 days\'';
    const recentResult = await pool.query(recentlyUsedQuery);
    const recent = parseInt(recentResult.rows[0].recent);
    
    const oldestQuery = 'SELECT MIN(created_at) as oldest FROM geocoding_cache';
    const oldestResult = await pool.query(oldestQuery);
    const oldest = oldestResult.rows[0].oldest;
    
    return {
      total,
      recentlyUsed: recent,
      usagePercentage: total > 0 ? Math.round((recent / total) * 100) : 0,
      oldestEntry: oldest
    };
  } catch (error) {
    log(`Error getting cache stats: ${error.message}`);
    return {
      total: 0,
      recentlyUsed: 0,
      usagePercentage: 0,
      oldestEntry: null
    };
  }
}

/**
 * Prune old unused cache entries to prevent bloat
 */
async function pruneOldCacheEntries(daysOld = 90) {
  try {
    const result = await pool.query(
      'DELETE FROM geocoding_cache WHERE last_used < NOW() - INTERVAL \'$1 days\'',
      [daysOld]
    );
    
    log(`Pruned ${result.rowCount} old cache entries`);
    return result.rowCount;
  } catch (error) {
    log(`Error pruning old cache entries: ${error.message}`);
    return 0;
  }
}

// Export functions for use in other files
module.exports = {
  ensureGeoCacheTable,
  getCachedGeocode,
  cacheGeocodingResult,
  getCacheStats,
  pruneOldCacheEntries
};

// Allow direct execution for maintenance
if (require.main === module) {
  (async () => {
    try {
      await ensureGeoCacheTable();
      const stats = await getCacheStats();
      
      log('===== Geocoding Cache Statistics =====');
      log(`Total cache entries: ${stats.total}`);
      log(`Recently used (7 days): ${stats.recentlyUsed} (${stats.usagePercentage}%)`);
      log(`Oldest entry: ${stats.oldestEntry}`);
      
      // Prune old entries if requested via command-line arg
      if (process.argv.includes('--prune')) {
        const days = parseInt(process.argv[process.argv.indexOf('--prune') + 1] || '90');
        await pruneOldCacheEntries(days);
      }
      
    } catch (error) {
      log(`Error in main execution: ${error.message}`);
    } finally {
      pool.end();
    }
  })();
}