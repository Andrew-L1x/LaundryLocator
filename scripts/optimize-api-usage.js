/**
 * API Cost Optimization Script
 * 
 * This script provides functions to help reduce API costs through:
 * 1. Batching multiple API requests together
 * 2. Using proper retry strategies with exponential backoff
 * 3. Prioritizing requests based on importance
 * 4. Implementing request throttling to prevent hitting rate limits
 * 5. Smart region-based processing to optimize geocoding requests
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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
    path.join(process.cwd(), 'api-optimization.log'),
    `[${timestamp}] ${message}\n`
  );
}

/**
 * Create an API request queue with priority and rate limiting
 */
class ApiRequestQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.concurrency = options.concurrency || 1;
    this.activeRequests = 0;
    this.rateLimitMs = options.rateLimitMs || 1000; // Default 1 second between requests
    this.lastRequestTime = 0;
    this.maxRetries = options.maxRetries || 3;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.savedRequests = 0;
  }

  /**
   * Add a request to the queue with optional priority
   * @param {Function} requestFn - Function that returns a promise for the API request
   * @param {Object} options - Request options
   * @param {number} options.priority - Priority level (higher = more important)
   * @param {string} options.cacheKey - Key to check for cached results
   * @param {Function} options.cacheCheckFn - Function to check if result is cached
   * @param {Function} options.cacheSaveFn - Function to save result to cache
   */
  addRequest(requestFn, options = {}) {
    const request = {
      fn: requestFn,
      priority: options.priority || 1,
      retries: 0,
      cacheKey: options.cacheKey,
      cacheCheckFn: options.cacheCheckFn,
      cacheSaveFn: options.cacheSaveFn,
      ...options
    };

    this.queue.push(request);
    this.queue.sort((a, b) => b.priority - a.priority); // Sort by priority (descending)

    if (!this.processing) {
      this.processQueue();
    }

    return new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
  }

  /**
   * Process the queue with concurrency and rate limiting
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we've hit concurrency limit
      if (this.activeRequests >= this.concurrency) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Get the next request (highest priority first)
      const request = this.queue.shift();

      // Check if result is already cached
      if (request.cacheKey && request.cacheCheckFn) {
        try {
          const cachedResult = await request.cacheCheckFn(request.cacheKey);
          if (cachedResult) {
            log(`Cache hit for key: ${request.cacheKey}`);
            request.resolve(cachedResult);
            this.savedRequests++;
            continue;
          }
        } catch (error) {
          log(`Error checking cache: ${error.message}`);
        }
      }

      // Handle rate limiting
      const now = Date.now();
      const timeToWait = Math.max(0, this.rateLimitMs - (now - this.lastRequestTime));
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }

      // Execute the request
      this.activeRequests++;
      this.totalRequests++;
      this.lastRequestTime = Date.now();

      this.executeRequest(request).catch(error => {
        log(`Unhandled error in executeRequest: ${error.message}`);
      });
    }

    this.processing = false;
  }

  /**
   * Execute a single request with retry logic
   */
  async executeRequest(request) {
    try {
      const result = await request.fn();

      // Cache the successful result if possible
      if (request.cacheKey && request.cacheSaveFn) {
        try {
          await request.cacheSaveFn(request.cacheKey, result);
        } catch (error) {
          log(`Error saving to cache: ${error.message}`);
        }
      }

      this.successfulRequests++;
      request.resolve(result);
    } catch (error) {
      // Handle retry logic for retryable errors
      const isRetryable = !error.response || error.response.status >= 500 || 
                        error.response.status === 429 || error.code === 'ECONNRESET';
      
      if (isRetryable && request.retries < this.maxRetries) {
        request.retries++;
        
        // Exponential backoff for retries
        const backoffMs = Math.min(1000 * Math.pow(2, request.retries), 30000);
        log(`Retrying request (attempt ${request.retries}/${this.maxRetries}) after ${backoffMs}ms`);
        
        setTimeout(() => {
          this.queue.unshift(request); // Add back to the front of the queue
          this.processQueue();
        }, backoffMs);
      } else {
        // Max retries reached or non-retryable error
        this.failedRequests++;
        request.reject(error);
      }
    } finally {
      this.activeRequests--;
      
      // Continue processing the queue
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Get statistics about the request queue
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      savedRequests: this.savedRequests
    };
  }
}

/**
 * Optimize geocoding by batching requests for nearby locations
 */
class GeocodeOptimizer {
  constructor(googleMapsApiKey) {
    this.apiKey = googleMapsApiKey;
    this.cache = {}; // In-memory cache (can be replaced with database)
    this.queue = new ApiRequestQueue({
      concurrency: 5,
      rateLimitMs: 200, // 5 requests per second (conservative)
      maxRetries: 3
    });
  }

  /**
   * Get geocoding result (coordinates) for an address
   */
  async geocodeAddress(address) {
    const cacheKey = `geocode_${address.replace(/\s+/g, '_').toLowerCase()}`;
    
    return this.queue.addRequest(
      async () => {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address,
            key: this.apiKey
          }
        });
        
        if (response.data.status === 'OK' && response.data.results.length > 0) {
          return response.data.results[0].geometry.location;
        }
        
        throw new Error(`Geocoding failed with status: ${response.data.status}`);
      },
      {
        priority: 1,
        cacheKey,
        cacheCheckFn: async (key) => {
          // Check in-memory cache first
          if (this.cache[key]) return this.cache[key];
          
          // Then check database
          try {
            const result = await pool.query(
              'SELECT result FROM geocoding_cache WHERE query = $1',
              [address]
            );
            
            if (result.rows.length > 0) {
              // Update cache and return
              this.cache[key] = result.rows[0].result;
              return result.rows[0].result;
            }
          } catch (error) {
            log(`DB cache check error: ${error.message}`);
          }
          
          return null;
        },
        cacheSaveFn: async (key, value) => {
          // Save to in-memory cache
          this.cache[key] = value;
          
          // Save to database
          try {
            await pool.query(
              'INSERT INTO geocoding_cache (query, result) VALUES ($1, $2) ON CONFLICT (query) DO UPDATE SET result = $2, last_used = NOW()',
              [address, value]
            );
          } catch (error) {
            log(`DB cache save error: ${error.message}`);
          }
        }
      }
    );
  }

  /**
   * Batch geocode multiple addresses in an optimal way
   * Groups addresses by region to improve cache hits
   */
  async batchGeocodeAddresses(addresses) {
    // Group addresses by state/region to increase cache hit likelihood
    const addressesByRegion = {};
    
    addresses.forEach(address => {
      // Extract state or region from address for grouping
      const match = address.match(/([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/i);
      const region = match ? match[1].toUpperCase() : 'UNKNOWN';
      
      if (!addressesByRegion[region]) {
        addressesByRegion[region] = [];
      }
      
      addressesByRegion[region].push(address);
    });
    
    // Process each region sequentially for better cache locality
    const results = {};
    
    for (const region of Object.keys(addressesByRegion)) {
      const regionAddresses = addressesByRegion[region];
      log(`Processing ${regionAddresses.length} addresses in region ${region}`);
      
      // Process addresses in this region concurrently
      const regionResults = await Promise.all(
        regionAddresses.map(address => this.geocodeAddress(address))
      );
      
      // Add to results
      regionAddresses.forEach((address, i) => {
        results[address] = regionResults[i];
      });
    }
    
    return results;
  }
}

/**
 * Optimize Places API usage
 */
class PlacesApiOptimizer {
  constructor(googleMapsApiKey) {
    this.apiKey = googleMapsApiKey;
    this.cache = {};
    this.queue = new ApiRequestQueue({
      concurrency: 3,
      rateLimitMs: 334, // ~3 requests per second (conservative)
      maxRetries: 3
    });
  }

  /**
   * Get nearby places with optimal caching and queuing
   */
  async getNearbyPlaces(latitude, longitude, type, radius = 500) {
    const cacheKey = `nearby_${latitude.toFixed(4)}_${longitude.toFixed(4)}_${type}_${radius}`;
    
    return this.queue.addRequest(
      async () => {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
          params: {
            location: `${latitude},${longitude}`,
            radius,
            type,
            key: this.apiKey
          }
        });
        
        if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
          return response.data.results || [];
        }
        
        throw new Error(`Places API request failed with status: ${response.data.status}`);
      },
      {
        priority: 1,
        cacheKey,
        cacheCheckFn: async (key) => {
          // Check in-memory cache first
          if (this.cache[key]) return this.cache[key];
          
          // Then check database
          try {
            const tableName = 'places_api_cache';
            const result = await pool.query(
              `SELECT result, created_at FROM ${tableName} WHERE cache_key = $1`,
              [cacheKey]
            );
            
            if (result.rows.length > 0) {
              // Check if cache is still fresh (1 month)
              const createdAt = new Date(result.rows[0].created_at);
              const now = new Date();
              const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
              
              if (ageInDays <= 30) {
                this.cache[key] = result.rows[0].result;
                return result.rows[0].result;
              }
              
              log(`Cache expired for key: ${cacheKey} (${ageInDays.toFixed(1)} days old)`);
            }
          } catch (error) {
            log(`DB cache check error: ${error.message}`);
          }
          
          return null;
        },
        cacheSaveFn: async (key, value) => {
          // Save to in-memory cache
          this.cache[key] = value;
          
          // Save to database
          try {
            const tableName = 'places_api_cache';
            
            // Ensure table exists
            await pool.query(`
              CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                cache_key TEXT NOT NULL UNIQUE,
                result JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              )
            `);
            
            await pool.query(
              `INSERT INTO ${tableName} (cache_key, result) 
               VALUES ($1, $2) 
               ON CONFLICT (cache_key) 
               DO UPDATE SET result = $2, created_at = NOW()`,
              [cacheKey, value]
            );
          } catch (error) {
            log(`DB cache save error: ${error.message}`);
          }
        }
      }
    );
  }

  /**
   * Get place details with optimal caching and queuing
   */
  async getPlaceDetails(placeId) {
    const cacheKey = `place_${placeId}`;
    
    return this.queue.addRequest(
      async () => {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
          params: {
            place_id: placeId,
            fields: 'name,formatted_address,geometry,photos,rating,reviews,opening_hours,website,formatted_phone_number,types',
            key: this.apiKey
          }
        });
        
        if (response.data.status === 'OK') {
          return response.data.result;
        }
        
        throw new Error(`Place details request failed with status: ${response.data.status}`);
      },
      {
        priority: 2, // Higher priority than nearby search
        cacheKey,
        cacheCheckFn: async (key) => {
          // Check in-memory cache first
          if (this.cache[key]) return this.cache[key];
          
          // Then check database
          try {
            const tableName = 'place_details_cache';
            const result = await pool.query(
              `SELECT result, created_at FROM ${tableName} WHERE cache_key = $1`,
              [cacheKey]
            );
            
            if (result.rows.length > 0) {
              // Place details can be cached longer (3 months)
              const createdAt = new Date(result.rows[0].created_at);
              const now = new Date();
              const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
              
              if (ageInDays <= 90) {
                this.cache[key] = result.rows[0].result;
                return result.rows[0].result;
              }
            }
          } catch (error) {
            log(`DB cache check error: ${error.message}`);
          }
          
          return null;
        },
        cacheSaveFn: async (key, value) => {
          // Save to in-memory cache
          this.cache[key] = value;
          
          // Save to database
          try {
            const tableName = 'place_details_cache';
            
            // Ensure table exists
            await pool.query(`
              CREATE TABLE IF NOT EXISTS ${tableName} (
                id SERIAL PRIMARY KEY,
                cache_key TEXT NOT NULL UNIQUE,
                result JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              )
            `);
            
            await pool.query(
              `INSERT INTO ${tableName} (cache_key, result) 
               VALUES ($1, $2) 
               ON CONFLICT (cache_key) 
               DO UPDATE SET result = $2, created_at = NOW()`,
              [cacheKey, value]
            );
          } catch (error) {
            log(`DB cache save error: ${error.message}`);
          }
        }
      }
    );
  }
}

// Export classes for use in other scripts
module.exports = {
  ApiRequestQueue,
  GeocodeOptimizer,
  PlacesApiOptimizer
};

// For direct execution
if (require.main === module) {
  (async () => {
    try {
      log('API Cost Optimization script started');
      
      // Example usage (not run by default)
      if (process.argv.includes('--example')) {
        const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error('VITE_GOOGLE_MAPS_API_KEY is required');
        }
        
        // Example geocoding
        const geocoder = new GeocodeOptimizer(GOOGLE_MAPS_API_KEY);
        const coordinates = await geocoder.geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');
        log(`Coordinates: ${JSON.stringify(coordinates)}`);
        
        // Example nearby places
        const placesApi = new PlacesApiOptimizer(GOOGLE_MAPS_API_KEY);
        const places = await placesApi.getNearbyPlaces(coordinates.lat, coordinates.lng, 'restaurant', 1000);
        log(`Found ${places.length} nearby restaurants`);
        
        // Get details for first place
        if (places.length > 0) {
          const details = await placesApi.getPlaceDetails(places[0].place_id);
          log(`Details for ${details.name}: ${details.formatted_address}`);
        }
      }
      
      // Create tables if needed
      if (process.argv.includes('--init')) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS geocoding_cache (
            id SERIAL PRIMARY KEY,
            query TEXT NOT NULL UNIQUE,
            result JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS geocoding_cache_query_idx ON geocoding_cache(query);
          
          CREATE TABLE IF NOT EXISTS places_api_cache (
            id SERIAL PRIMARY KEY,
            cache_key TEXT NOT NULL UNIQUE,
            result JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS places_api_cache_key_idx ON places_api_cache(cache_key);
          
          CREATE TABLE IF NOT EXISTS place_details_cache (
            id SERIAL PRIMARY KEY,
            cache_key TEXT NOT NULL UNIQUE,
            result JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS place_details_cache_key_idx ON place_details_cache(cache_key);
        `);
        
        log('Created cache tables in database');
      }
    } catch (error) {
      log(`Error: ${error.message}`);
      console.error(error);
    } finally {
      await pool.end();
    }
  })();
}