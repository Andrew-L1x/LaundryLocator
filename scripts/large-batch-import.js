/**
 * Large Batch Import Script for WSL/Local PC
 * 
 * This script is optimized for running on a local machine with more resources
 * to process the entire laundromat dataset at once.
 * 
 * To run on your local PC/WSL:
 * 1. Copy this file to your local machine
 * 2. Ensure you have Node.js installed
 * 3. Install required packages: npm install pg xlsx axios dotenv fs-extra
 * 4. Create a .env file with DATABASE_URL and GOOGLE_MAPS_API_KEY
 * 5. Run: node large-batch-import.js
 * 
 * This script can process the entire dataset in one go, with proper transaction
 * handling, error recovery, and detailed logging.
 */

require('dotenv').config();
const { Pool } = require('pg');
const xlsx = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// ============= CONFIGURATION =============
const CONFIG = {
  // Source file settings
  sourceFile: 'Outscraper-20250515181738xl3e_laundromat.xlsx',
  
  // Processing settings
  batchSize: 500,        // Process 500 records per batch
  delayBetweenBatches: 2000, // 2 second pause between batches
  
  // Database retry settings
  maxRetries: 5,         // Max retries for database operations
  retryDelay: 1000,      // 1 second delay between retries
  
  // Geocoding settings (for fixing addresses)
  geocodeBatchSize: 50,  // Geocode 50 records per batch
  geocodeDelayBetween: 200, // 200ms delay between geocoding requests
  
  // Logging settings
  detailedLogging: true, // Set to false for less verbose output
  logToFile: true,       // Log to file
  logFile: 'large-import.log',
  
  // Progress tracking
  saveProgressInterval: 50, // Save progress every 50 records
  progressFile: 'import-progress.json'
};

// ============= SETUP =============
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.error('Create a .env file with DATABASE_URL=your_database_connection_string');
  process.exit(1);
}

// Create database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Increase pool settings for better performance on local machine
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// ============= HELPER FUNCTIONS =============
// Sleep function
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
function saveProgress(position, totalImported, errors = []) {
  const progress = {
    position,
    totalImported,
    timestamp: new Date().toISOString(),
    errors: errors.slice(-100) // Keep only last 100 errors
  };
  
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
  
  if (CONFIG.detailedLogging) {
    log(`Progress saved: ${position}/${totalImported}`);
  }
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
  
  return { position: 0, totalImported: 0, errors: [] };
}

// Get full state name from abbreviation
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

// Generate a slug from a name and location
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

// Generate SEO tags for a laundromat
function generateSeoTags(record) {
  const tags = [];
  
  // Basic tags
  tags.push('laundromat');
  tags.push('laundry service');
  tags.push('washing machine');
  tags.push('dryer');
  
  // Location-based tags
  if (record.city) tags.push(`laundromat in ${record.city}`);
  if (record.state) tags.push(`${record.state} laundromat`);
  if (record.zip) tags.push(`laundromat ${record.zip}`);
  
  // Services-based tags
  if (record.services && record.services.length > 0) {
    record.services.forEach(service => {
      tags.push(service.toLowerCase());
    });
  }
  
  // Special features
  if (record.is24Hours) tags.push('24 hour laundromat');
  if (record.hasAttendant) tags.push('attended laundromat');
  
  return tags.join(',');
}

// Generate SEO description for a laundromat
function generateSeoDescription(record) {
  const name = record.name || 'This laundromat';
  const city = record.city || 'the area';
  const state = record.state ? getStateNameFromAbbr(record.state) : '';
  
  let description = `${name} is a convenient laundromat located in ${city}`;
  if (state) description += `, ${state}`;
  description += '. ';
  
  // Add services information
  if (record.services && record.services.length > 0) {
    description += `Services include ${record.services.join(', ')}. `;
  }
  
  // Add operating hours
  if (record.is24Hours) {
    description += 'Open 24 hours a day for your convenience. ';
  } else if (record.hours) {
    description += `Open ${record.hours}. `;
  }
  
  // Add special features
  const features = [];
  if (record.hasWifi) features.push('free WiFi');
  if (record.hasAttendant) features.push('friendly attendants');
  if (record.hasCoinMachines) features.push('coin-operated machines');
  if (record.hasCardMachines) features.push('card-operated machines');
  if (record.hasVending) features.push('vending machines');
  
  if (features.length > 0) {
    description += `Amenities include ${features.join(', ')}. `;
  }
  
  // Add search-friendly closing
  description += `Find clean, well-maintained laundry equipment at this local laundromat in ${city}.`;
  
  return description;
}

// Generate SEO title for a laundromat
function generateSeoTitle(record) {
  const name = record.name || 'Local Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  
  let title = name;
  
  if (city && state) {
    title += ` - Laundromat in ${city}, ${state}`;
  } else if (city) {
    title += ` - Laundromat in ${city}`;
  } else if (state) {
    title += ` - Laundromat in ${state}`;
  }
  
  return title;
}

// Calculate premium score
function calculatePremiumScore(record) {
  let score = 50; // Start with a base score
  
  // Adjust based on ratings
  if (record.rating) score += (record.rating * 5);
  
  // Adjust for features
  if (record.is24Hours) score += 10;
  if (record.hasWifi) score += 5;
  if (record.hasAttendant) score += 8;
  if (record.hasVending) score += 3;
  if (record.hasCardMachines) score += 7;
  
  // Adjust for services
  if (record.services) {
    const serviceCount = record.services.length;
    score += (serviceCount * 3);
  }
  
  // Cap the score at 100
  return Math.min(100, Math.round(score));
}

// ============= DATABASE OPERATIONS =============
// Ensure state exists
async function ensureStateExists(client, stateCode, stateName) {
  try {
    // Check if state exists
    const stateQuery = 'SELECT id FROM states WHERE code = $1';
    const stateResult = await client.query(stateQuery, [stateCode]);
    
    if (stateResult.rows.length > 0) {
      return stateResult.rows[0].id;
    }
    
    // Insert state if it doesn't exist
    const insertQuery = 'INSERT INTO states (code, name) VALUES ($1, $2) RETURNING id';
    const insertResult = await client.query(insertQuery, [stateCode, stateName]);
    
    return insertResult.rows[0].id;
  } catch (error) {
    throw new Error(`Error ensuring state exists: ${error.message}`);
  }
}

// Ensure city exists
async function ensureCityExists(client, cityName, stateId) {
  try {
    // Check if city exists
    const cityQuery = 'SELECT id FROM cities WHERE name = $1 AND state_id = $2';
    const cityResult = await client.query(cityQuery, [cityName, stateId]);
    
    if (cityResult.rows.length > 0) {
      return cityResult.rows[0].id;
    }
    
    // Insert city if it doesn't exist
    const insertQuery = 'INSERT INTO cities (name, state_id) VALUES ($1, $2) RETURNING id';
    const insertResult = await client.query(insertQuery, [cityName, stateId]);
    
    return insertResult.rows[0].id;
  } catch (error) {
    throw new Error(`Error ensuring city exists: ${error.message}`);
  }
}

// Update laundromat count
async function updateLaundryCount(client, cityId, stateId) {
  try {
    // Count laundromats in city
    const countQuery = 'SELECT COUNT(*) FROM laundromats WHERE city_id = $1';
    const countResult = await client.query(countQuery, [cityId]);
    const count = parseInt(countResult.rows[0].count, 10);
    
    // Update city
    await client.query('UPDATE cities SET laundromat_count = $1 WHERE id = $2', [count, cityId]);
    
    // Update state count
    const stateCountQuery = 'SELECT COUNT(*) FROM laundromats WHERE state_id = $1';
    const stateCountResult = await client.query(stateCountQuery, [stateId]);
    const stateCount = parseInt(stateCountResult.rows[0].count, 10);
    
    await client.query('UPDATE states SET laundromat_count = $1 WHERE id = $2', [stateCount, stateId]);
  } catch (error) {
    log(`Error updating laundromat count: ${error.message}`, 'error');
    // Don't throw - this is not critical
  }
}

// Normalize services array
function normalizeServices(services) {
  if (!services) return [];
  if (typeof services === 'string') {
    // Try to parse JSON string
    try {
      return JSON.parse(services);
    } catch (e) {
      // If not valid JSON, split by comma
      return services.split(',').map(s => s.trim());
    }
  }
  if (Array.isArray(services)) {
    return services;
  }
  return [];
}

// Enrich a record with derived fields
function enrichLaundromat(record) {
  // Ensure state has full name
  if (record.state && record.state.length === 2) {
    record.stateName = getStateNameFromAbbr(record.state);
  }
  
  // Normalize services
  record.services = normalizeServices(record.services);
  
  // Generate slug if not present
  if (!record.slug) {
    record.slug = generateSlug(record.name, record.city, record.state);
  }
  
  // Generate SEO fields
  record.seoTags = generateSeoTags(record);
  record.seoTitle = generateSeoTitle(record);
  record.seoDescription = generateSeoDescription(record);
  
  // Calculate premium score
  record.premiumScore = calculatePremiumScore(record);
  
  return record;
}

// Add a single laundromat
async function addLaundromat(client, record) {
  try {
    // Process location data
    let stateId = null;
    let cityId = null;
    
    if (record.state) {
      const stateCode = record.state.toUpperCase();
      const stateName = record.stateName || getStateNameFromAbbr(stateCode);
      stateId = await ensureStateExists(client, stateCode, stateName);
    }
    
    if (record.city && stateId) {
      cityId = await ensureCityExists(client, record.city, stateId);
    }
    
    // Prepare services array
    const services = record.services || [];
    
    // Insert the laundromat
    const insertQuery = `
      INSERT INTO laundromats (
        name, address, city, state, zip, 
        latitude, longitude, phone, website, 
        hours, services, state_id, city_id,
        slug, seo_title, seo_description, seo_tags,
        is_24_hours, has_wifi, has_attendant, 
        has_vending, has_card_machines, has_coin_machines,
        premium_score, featured_until, premium_until
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, 
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, 
        $21, $22, $23,
        $24, $25, $26
      )
      ON CONFLICT (slug) DO UPDATE
      SET name = $1, address = $2
      RETURNING id
    `;
    
    const insertValues = [
      record.name || 'Unnamed Laundromat',
      record.address || 'Unknown Address',
      record.city || 'Unknown City',
      record.state || 'XX',
      record.zip || '',
      record.latitude || null,
      record.longitude || null,
      record.phone || '',
      record.website || '',
      record.hours || '',
      services,
      stateId,
      cityId,
      record.slug || generateSlug(record.name, record.city, record.state),
      record.seoTitle || generateSeoTitle(record),
      record.seoDescription || generateSeoDescription(record),
      record.seoTags || generateSeoTags(record),
      record.is24Hours || false,
      record.hasWifi || false,
      record.hasAttendant || false,
      record.hasVending || false,
      record.hasCardMachines || false,
      record.hasCoinMachines || false,
      record.premiumScore || calculatePremiumScore(record),
      null, // featured_until 
      null  // premium_until
    ];
    
    const result = await client.query(insertQuery, insertValues);
    const laundryId = result.rows[0].id;
    
    // Update counts
    if (cityId && stateId) {
      await updateLaundryCount(client, cityId, stateId);
    }
    
    return laundryId;
  } catch (error) {
    throw new Error(`Error adding laundromat: ${error.message}`);
  }
}

// Process a batch of records with transaction
async function processBatch(records, startIndex, endIndex) {
  let client = null;
  let successCount = 0;
  const errors = [];
  
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    for (let i = startIndex; i < endIndex && i < records.length; i++) {
      try {
        // Enrich record before adding
        const enrichedRecord = enrichLaundromat(records[i]);
        
        // Add to database
        await addLaundromat(client, enrichedRecord);
        successCount++;
        
        // Log progress periodically
        if (CONFIG.detailedLogging && successCount % 10 === 0) {
          log(`Progress: ${i + 1}/${records.length} records processed`);
        }
        
        // Save progress periodically
        if ((i - startIndex + 1) % CONFIG.saveProgressInterval === 0) {
          await client.query('COMMIT');
          await client.query('BEGIN');
          saveProgress(i + 1, successCount, errors);
        }
      } catch (error) {
        errors.push({
          index: i,
          message: error.message,
          record: records[i].name || 'Unknown'
        });
        
        if (CONFIG.detailedLogging) {
          log(`Error processing record ${i}: ${error.message}`, 'error');
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    return { successCount, errors };
  } catch (error) {
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        log(`Rollback error: ${rollbackError.message}`, 'error');
      }
    }
    
    throw new Error(`Batch processing error: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// ============= MAIN IMPORT FUNCTION =============
async function importLaundromats() {
  let workbook = null;
  let records = [];
  
  try {
    // Load progress
    const progress = loadProgress();
    log(`Starting import from position ${progress.position}`);
    
    // Load workbook
    log(`Reading Excel file: ${CONFIG.sourceFile}`);
    workbook = xlsx.readFile(CONFIG.sourceFile);
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    records = xlsx.utils.sheet_to_json(worksheet);
    log(`Loaded ${records.length} records from Excel file`);
    
    // Process in batches
    let position = progress.position;
    let totalSuccessCount = progress.totalImported;
    const allErrors = [];
    
    while (position < records.length) {
      const batchEnd = Math.min(position + CONFIG.batchSize, records.length);
      log(`Processing batch from ${position} to ${batchEnd - 1}`);
      
      // Process batch
      const { successCount, errors } = await processBatch(records, position, batchEnd);
      
      // Update counters
      position = batchEnd;
      totalSuccessCount += successCount;
      allErrors.push(...errors);
      
      // Save progress
      saveProgress(position, totalSuccessCount, allErrors);
      
      // Log batch results
      log(`Batch complete: ${successCount} imported successfully, ${errors.length} errors`);
      log(`Total progress: ${position}/${records.length} records processed, ${totalSuccessCount} imported successfully`);
      
      // Pause between batches
      if (position < records.length) {
        log(`Pausing for ${CONFIG.delayBetweenBatches}ms before next batch`);
        await sleep(CONFIG.delayBetweenBatches);
      }
    }
    
    // Final status
    log(`Import complete: ${totalSuccessCount} records imported successfully`);
    if (allErrors.length > 0) {
      log(`${allErrors.length} errors occurred during import`, 'warn');
      fs.writeFileSync('import-errors.json', JSON.stringify(allErrors, null, 2));
      log('Error details written to import-errors.json');
    }
  } catch (error) {
    log(`Import failed: ${error.message}`, 'error');
    throw error;
  }
}

// ============= GEOCODE FUNCTIONS =============
async function reverseGeocode(latitude, longitude) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable not set');
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
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
      return { success: false, error: response.data.status };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fixPlaceholderAddresses() {
  log('Starting fix of placeholder addresses');
  
  try {
    // Get laundromats with placeholder addresses
    const query = `
      SELECT id, latitude, longitude
      FROM laundromats
      WHERE (address LIKE '%123 Main%' OR address LIKE '%Placeholder%')
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude != '' AND longitude != ''
      LIMIT ${CONFIG.geocodeBatchSize}
    `;
    
    const client = await pool.connect();
    const result = await client.query(query);
    client.release();
    
    const laundromats = result.rows;
    
    if (laundromats.length === 0) {
      log('No placeholder addresses to fix');
      return 0;
    }
    
    log(`Found ${laundromats.length} laundromats with placeholder addresses`);
    
    let successCount = 0;
    
    for (const laundromat of laundromats) {
      const { id, latitude, longitude } = laundromat;
      
      log(`Processing laundromat ${id} at coordinates ${latitude},${longitude}`);
      
      // Get real address from Google Maps
      const addressData = await reverseGeocode(latitude, longitude);
      
      if (addressData.success) {
        log(`Got address for laundromat ${id}: ${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zip}`);
        
        // Update the laundromat
        const updateClient = await pool.connect();
        try {
          await updateClient.query('BEGIN');
          
          const updateQuery = `
            UPDATE laundromats
            SET address = $1, city = $2, state = $3, zip = $4
            WHERE id = $5
          `;
          
          await updateClient.query(updateQuery, [
            addressData.streetAddress,
            addressData.city,
            addressData.state,
            addressData.zip,
            id
          ]);
          
          await updateClient.query('COMMIT');
          successCount++;
          log(`Updated laundromat ${id} with new address`);
        } catch (error) {
          await updateClient.query('ROLLBACK');
          log(`Failed to update laundromat ${id}: ${error.message}`, 'error');
        } finally {
          updateClient.release();
        }
      } else {
        log(`Failed to get address for laundromat ${id}: ${addressData.error}`, 'error');
      }
      
      // Rate limiting - don't overload the Google Maps API
      await sleep(CONFIG.geocodeDelayBetween);
    }
    
    log(`Address fixing complete: ${successCount}/${laundromats.length} addresses updated`);
    return successCount;
  } catch (error) {
    log(`Error fixing addresses: ${error.message}`, 'error');
    return 0;
  }
}

// ============= MAIN =============
async function main() {
  log('='.repeat(80));
  log('LARGE BATCH IMPORT STARTING');
  log('='.repeat(80));
  
  try {
    // Start with import
    await importLaundromats();
    
    // Fix placeholder addresses
    log('='.repeat(80));
    log('STARTING ADDRESS FIXING');
    log('='.repeat(80));
    await fixPlaceholderAddresses();
    
    log('='.repeat(80));
    log('ALL OPERATIONS COMPLETED SUCCESSFULLY');
    log('='.repeat(80));
  } catch (error) {
    log('='.repeat(80));
    log(`FATAL ERROR: ${error.message}`, 'error');
    log('='.repeat(80));
  } finally {
    await pool.end();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});