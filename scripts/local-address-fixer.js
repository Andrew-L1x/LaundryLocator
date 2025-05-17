/**
 * Local Address Fixer Script
 * 
 * This script is optimized for local/WSL execution to fix all placeholder
 * addresses in the database using the Google Maps API.
 * 
 * Usage:
 * 1. Copy this to your local machine
 * 2. Install dependencies: npm install pg axios dotenv fs-extra
 * 3. Create a .env file with:
 *    DATABASE_URL=your_postgres_connection_string
 *    GOOGLE_MAPS_API_KEY=your_google_maps_api_key
 * 4. Run: node local-address-fixer.js
 * 
 * This script will run in bulk mode, processing many addresses at once
 * without running into Replit's memory limitations.
 */

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Configuration
const CONFIG = {
  // Processing settings
  batchSize: 100,        // Process 100 records per batch
  delayBetweenRequests: 200, // 200ms delay between geocoding requests
  maxRetries: 3,         // Max retries for failed geocoding
  
  // Logging settings
  logToFile: true,
  logFile: 'address-fix.log',
  
  // Progress tracking
  progressFile: 'address-fix-progress.json',
  
  // Query to find placeholder addresses
  placeholderQuery: `
    SELECT id, name, latitude, longitude
    FROM laundromats
    WHERE (
      address LIKE '%123 Main%' 
      OR address LIKE '%Placeholder%'
      OR address LIKE 'Unknown%'
      OR address = ''
    )
    AND latitude IS NOT NULL 
    AND longitude IS NOT NULL
    AND latitude != '' 
    AND longitude != ''
    ORDER BY id
    LIMIT $1 OFFSET $2
  `
};

// Create database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20 // Increase connection pool size for local execution
});

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Logging function
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  console.log(logEntry);
  
  if (CONFIG.logToFile) {
    fs.appendFileSync(CONFIG.logFile, logEntry + '\n');
  }
}

// Save progress to file
function saveProgress(position, completed, attempted) {
  const progress = {
    position,
    completed,
    attempted,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
  log(`Progress saved: ${position} (${completed}/${attempted} completed)`);
}

// Load progress from file
function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      const data = fs.readFileSync(CONFIG.progressFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`, 'error');
  }
  
  return { position: 0, completed: 0, attempted: 0 };
}

/**
 * Get real address using Google Maps Reverse Geocoding API
 */
async function getRealAddress(latitude, longitude, retries = 0) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable not set');
  }
  
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
    } else if (response.data.status === 'OVER_QUERY_LIMIT' && retries < CONFIG.maxRetries) {
      // Handle rate limiting with exponential backoff
      const delay = Math.pow(2, retries) * 1000;
      log(`Rate limit hit, retrying in ${delay}ms`, 'warn');
      await sleep(delay);
      return getRealAddress(latitude, longitude, retries + 1);
    } else {
      log(`Geocoding API error: ${response.data.status} for coordinates ${latitude},${longitude}`, 'error');
      return { success: false, error: response.data.status };
    }
  } catch (error) {
    if (retries < CONFIG.maxRetries) {
      const delay = Math.pow(2, retries) * 1000;
      log(`Network error, retrying in ${delay}ms: ${error.message}`, 'warn');
      await sleep(delay);
      return getRealAddress(latitude, longitude, retries + 1);
    }
    
    log(`Error getting address from Google Maps: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Fix a single address
 */
async function fixAddress(id, name, addressData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if a city record exists for this city/state
    let cityId = null;
    let stateId = null;
    
    if (addressData.state) {
      // Look up or create state
      const stateQuery = 'SELECT id FROM states WHERE code = $1';
      const stateResult = await client.query(stateQuery, [addressData.state]);
      
      if (stateResult.rows.length > 0) {
        stateId = stateResult.rows[0].id;
      } else {
        // Insert state if not found
        const insertStateQuery = 'INSERT INTO states (code, name) VALUES ($1, $2) RETURNING id';
        const insertStateResult = await client.query(insertStateQuery, [
          addressData.state,
          getStateNameFromAbbr(addressData.state)
        ]);
        stateId = insertStateResult.rows[0].id;
      }
      
      // Now handle city if we have a state
      if (stateId && addressData.city) {
        const cityQuery = 'SELECT id FROM cities WHERE name = $1 AND state_id = $2';
        const cityResult = await client.query(cityQuery, [addressData.city, stateId]);
        
        if (cityResult.rows.length > 0) {
          cityId = cityResult.rows[0].id;
        } else {
          // Insert city if not found
          const insertCityQuery = 'INSERT INTO cities (name, state_id) VALUES ($1, $2) RETURNING id';
          const insertCityResult = await client.query(insertCityQuery, [addressData.city, stateId]);
          cityId = insertCityResult.rows[0].id;
        }
      }
    }
    
    // Update the laundromat
    const updateQuery = `
      UPDATE laundromats
      SET 
        address = $1, 
        city = $2, 
        state = $3, 
        zip = $4,
        city_id = $5,
        state_id = $6,
        slug = CASE WHEN slug LIKE '%unknown-city%' OR slug LIKE '%unknown-state%' 
              THEN $7 ELSE slug END,
        updated_at = NOW()
      WHERE id = $8
    `;
    
    // Generate a slug for completely unknown locations
    const slug = generateSlug(
      name || 'unnamed-laundromat', 
      addressData.city || 'unknown-city', 
      addressData.state || 'unknown-state'
    );
    
    await client.query(updateQuery, [
      addressData.streetAddress,
      addressData.city,
      addressData.state,
      addressData.zip,
      cityId,
      stateId,
      slug,
      id
    ]);
    
    // Update counts if needed
    if (cityId && stateId) {
      try {
        await updateLaundryCount(client, cityId, stateId);
      } catch (countError) {
        // Non-fatal error, just log it
        log(`Warning: Couldn't update laundry count: ${countError.message}`, 'warn');
      }
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Error updating laundromat ${id}: ${error.message}`, 'error');
    return false;
  } finally {
    client.release();
  }
}

/**
 * Generate a slug from a name and location
 */
function generateSlug(name, city, state) {
  if (!name) name = 'unnamed-laundromat';
  if (!city) city = 'unknown-city';
  if (!state) state = 'unknown-state';
  
  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };
  
  return `${slugify(name)}-${slugify(city)}-${slugify(state)}`;
}

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  const states = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
  };
  
  return states[abbr] || 'Unknown State';
}

/**
 * Update laundromat count for city and state
 */
async function updateLaundryCount(client, cityId, stateId) {
  // Update city count
  const cityCountQuery = `
    UPDATE cities 
    SET laundromat_count = (
      SELECT COUNT(*) FROM laundromats 
      WHERE city_id = $1
    )
    WHERE id = $1
  `;
  await client.query(cityCountQuery, [cityId]);
  
  // Update state count
  const stateCountQuery = `
    UPDATE states 
    SET laundromat_count = (
      SELECT COUNT(*) FROM laundromats 
      WHERE state_id = $1
    )
    WHERE id = $1
  `;
  await client.query(stateCountQuery, [stateId]);
}

/**
 * Get total count of placeholder addresses
 */
async function getPlaceholderCount() {
  try {
    const query = `
      SELECT COUNT(*) FROM laundromats
      WHERE (
        address LIKE '%123 Main%' 
        OR address LIKE '%Placeholder%'
        OR address LIKE 'Unknown%'
        OR address = ''
      )
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
      AND latitude != '' 
      AND longitude != ''
    `;
    
    const result = await pool.query(query);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    log(`Error getting placeholder count: ${error.message}`, 'error');
    return 0;
  }
}

/**
 * Get laundromats with placeholder addresses
 */
async function getPlaceholderBatch(limit, offset) {
  try {
    const result = await pool.query(CONFIG.placeholderQuery, [limit, offset]);
    return result.rows;
  } catch (error) {
    log(`Error getting placeholder laundromats: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Process a batch of laundromats
 */
async function processBatch(offset) {
  // Get laundromats with placeholder addresses
  const laundromats = await getPlaceholderBatch(CONFIG.batchSize, offset);
  
  if (laundromats.length === 0) {
    log('No more placeholder addresses to fix');
    return { success: 0, fail: 0, done: true };
  }
  
  log(`Processing batch of ${laundromats.length} placeholder addresses starting at offset ${offset}`);
  
  let successCount = 0;
  let failCount = 0;
  
  // Process each laundromat
  for (const laundromat of laundromats) {
    const { id, name, latitude, longitude } = laundromat;
    
    log(`Processing laundromat ${id} "${name}" at coordinates ${latitude},${longitude}`);
    
    // Get real address from Google Maps
    const addressData = await getRealAddress(latitude, longitude);
    
    if (addressData.success) {
      log(`Got address for laundromat ${id}: ${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zip}`);
      
      // Update the laundromat
      const updated = await fixAddress(id, name, addressData);
      
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
    await sleep(CONFIG.delayBetweenRequests);
  }
  
  log(`Batch complete: ${successCount} updated, ${failCount} failed`);
  return { success: successCount, fail: failCount, done: false };
}

/**
 * Main function to fix all placeholder addresses
 */
async function fixAllPlaceholderAddresses() {
  try {
    // Load progress
    const progress = loadProgress();
    let { position, completed, attempted } = progress;
    
    // Get initial count
    const initialCount = await getPlaceholderCount();
    log(`Starting address fixing: ${initialCount} placeholder addresses found`);
    log(`Resuming from position ${position} (${completed}/${attempted} completed)`);
    
    // Process in batches until done
    let done = false;
    
    while (!done) {
      const result = await processBatch(position);
      
      // Update position and counts
      position += CONFIG.batchSize;
      completed += result.success;
      attempted += (result.success + result.fail);
      
      // Save progress
      saveProgress(position, completed, attempted);
      
      // Check if we're done
      done = result.done;
      
      if (!done) {
        // Get current count to show progress
        const currentCount = await getPlaceholderCount();
        log(`Progress: ${initialCount - currentCount}/${initialCount} addresses fixed (${completed} this session)`);
      }
    }
    
    // Final count
    const finalCount = await getPlaceholderCount();
    log(`Address fixing complete: ${initialCount - finalCount}/${initialCount} addresses fixed`);
    log(`${finalCount} placeholder addresses remaining`);
    
    return { fixed: initialCount - finalCount, remaining: finalCount };
  } catch (error) {
    log(`Error fixing addresses: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  log('='.repeat(80));
  log('LOCAL ADDRESS FIXER STARTING');
  log('='.repeat(80));
  
  try {
    await fixAllPlaceholderAddresses();
    
    log('='.repeat(80));
    log('ADDRESS FIXING COMPLETED SUCCESSFULLY');
    log('='.repeat(80));
  } catch (error) {
    log('='.repeat(80));
    log(`FATAL ERROR: ${error.message}`, 'error');
    log('='.repeat(80));
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}