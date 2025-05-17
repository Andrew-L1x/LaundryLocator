/**
 * Micro-Import Script for Large Laundromat Dataset
 * 
 * This script is designed to process the data in extremely small batches (1-3 records)
 * for maximum reliability. It's perfect for continuous incremental importing.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

// Load environment variables
dotenv.config();

// Use standard pg connection that works reliably
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuration settings
const BATCH_SIZE = 3; // Process exactly 3 records at a time for ultra-reliable imports
const STATE_PRIORITY = [
  // High priority states first as requested
  "TX", "CA", "NY", "FL", "IL", "PA",
  // Remaining states in alphabetical order
  "AL", "AK", "AZ", "AR", "CO", "CT", "DE", "GA", "HI", "ID", 
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", 
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NC", "ND", 
  "OH", "OK", "OR", "RI", "SC", "SD", "TN", "UT", "VT", "VA", 
  "WA", "WV", "WI", "WY", "DC"
]; // Prioritized state order

// File for storing progress
const PROGRESS_FILE = 'import-progress.json';

/**
 * Get progress data
 */
function getProgressData() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (error) {
      console.error('Error reading progress file:', error.message);
    }
  }
  return {};
}

/**
 * Save progress data
 */
function saveProgressData(progressData) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
  } catch (error) {
    console.error('Error saving progress file:', error.message);
  }
}

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  const stateMap = {
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
  return stateMap[abbr] || abbr;
}

/**
 * Generate a slug for a laundromat
 */
function generateSlug(text, uniqueId) {
  if (!text) return '';
  // Convert to lowercase, replace non-alphanumeric with hyphens
  return `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${uniqueId}`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    'laundromat', 'laundry service', 'coin laundry', 'self-service laundry',
    'washing machines', 'dryers', 'clean clothes',
    `laundromat in ${record.city}`, `laundry in ${record.city}`,
    `laundromat in ${record.city}, ${record.state}`,
    `${record.city} laundromat`, `${record.state} laundromat`,
    'laundromat near me', 'laundry near me', 'coin laundry near me',
    'laundry services', '24 hour laundromat', 
    'affordable laundry', 'laundry facilities'
  ];
  
  // Add specific services as tags if they exist
  if (record.services && record.services.length > 0) {
    record.services.forEach(service => {
      tags.push(service.toLowerCase());
    });
  }
  
  // Add rating-based tags
  if (record.rating && record.rating >= 4.5) {
    tags.push('best laundromat', 'top-rated laundromat', 'highest rated laundromat');
  } else if (record.rating && record.rating >= 4.0) {
    tags.push('highly rated laundromat', 'quality laundromat');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Generate a concise SEO title
 */
function generateSeoTitle(record) {
  let title = `${record.name} - Laundromat in ${record.city}, ${record.state}`;
  
  // Add a rating mention if it's high
  if (record.rating && record.rating >= 4.5) {
    title = `${record.name} - Top-Rated Laundromat in ${record.city}, ${record.state}`;
  }
  
  return title;
}

/**
 * Generate SEO description
 */
function generateSeoDescription(record) {
  let description = `Visit ${record.name}, a convenient laundromat located in ${record.city}, ${record.state}. `;
  
  // Add address
  description += `Located at ${record.address}, `;
  
  // Add services if available
  if (record.services && record.services.length > 0) {
    const servicesText = record.services.slice(0, 3).join(', ');
    description += `offering ${servicesText}${record.services.length > 3 ? ' and more' : ''}. `;
  } else {
    description += 'offering quality laundry services. ';
  }
  
  // Add rating if available
  if (record.rating) {
    description += `Rated ${record.rating}/5 by customers. `;
  }
  
  // Add hours if available
  if (record.hours && record.hours !== 'N/A') {
    description += `Hours: ${record.hours}. `;
  }
  
  // Add contact info
  description += `Call ${record.phone} for more information. Find the best laundromat near you in ${record.city}!`;
  
  return description;
}

/**
 * Calculate premium score
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Rating-based score (0-50 points)
  if (record.rating) {
    score += record.rating * 10; // 0-50 points
  }
  
  // Services-based score (0-20 points)
  if (record.services && record.services.length > 0) {
    score += Math.min(record.services.length * 2, 20); // 2 points per service, max 20
  }
  
  // Has website (10 points)
  if (record.website && record.website !== 'N/A') {
    score += 10;
  }
  
  // Has hours (5 points)
  if (record.hours && record.hours !== 'N/A') {
    score += 5;
  }
  
  // Has reviews (0-15 points)
  if (record.reviewCount) {
    score += Math.min(record.reviewCount / 2, 15); // 0.5 points per review, max 15
  }
  
  return Math.round(score);
}

/**
 * Pre-process records to prepare for database insertion
 */
function prepareRecords(records) {
  return records.map(record => {
    // Create a rich slug
    const slug = generateSlug(record.name, record.id);
    
    // Generate SEO content
    const seoTitle = generateSeoTitle(record);
    const seoDescription = generateSeoDescription(record);
    const seoTags = generateSeoTags(record);
    
    // Calculate premium score
    const premiumScore = calculatePremiumScore(record);
    
    // Check if the record has coordinates
    const hasCoordinates = record.latitude && record.longitude && 
                          record.latitude !== 'N/A' && record.longitude !== 'N/A';
    
    // Normalize services array
    let services = [];
    if (record.services) {
      if (typeof record.services === 'string') {
        services = record.services.split(',').map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(record.services)) {
        services = record.services;
      }
    }
    
    // Return the enriched record
    return {
      ...record,
      slug,
      seoTitle,
      seoDescription,
      seoTags,
      premiumScore,
      hasCoordinates,
      services,
      stateAbbr: record.stateAbbr || record.state, // Keep the abbreviation
      state: getStateNameFromAbbr(record.stateAbbr || record.state), // Full state name
    };
  });
}

/**
 * Ensure a state exists in the database
 */
async function ensureStateExists(client, stateName, stateAbbr, statesCache = {}) {
  // Check cache first
  if (statesCache[stateAbbr]) {
    return statesCache[stateAbbr];
  }
  
  try {
    // Check if state exists
    const stateResult = await client.query(
      'SELECT id FROM states WHERE LOWER(abbr) = LOWER($1)',
      [stateAbbr]
    );
    
    if (stateResult.rows.length > 0) {
      const stateId = stateResult.rows[0].id;
      statesCache[stateAbbr] = stateId;
      return stateId;
    }
    
    // Create state if not exists
    const insertResult = await client.query(
      'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3) RETURNING id',
      [stateName, stateName.toLowerCase().replace(/\s+/g, '-'), stateAbbr]
    );
    
    const stateId = insertResult.rows[0].id;
    statesCache[stateAbbr] = stateId;
    return stateId;
  } catch (error) {
    console.error(`Error ensuring state exists for ${stateName} (${stateAbbr}):`, error.message);
    throw error;
  }
}

/**
 * Ensure a city exists in the database
 */
async function ensureCityExists(client, cityName, stateName, citiesCache = {}) {
  // Create a cache key
  const cacheKey = `${cityName}-${stateName}`.toLowerCase();
  
  // Check cache first
  if (citiesCache[cacheKey]) {
    return citiesCache[cacheKey];
  }
  
  try {
    // Get state ID
    const stateResult = await client.query(
      'SELECT id FROM states WHERE LOWER(name) = LOWER($1)',
      [stateName]
    );
    
    if (stateResult.rows.length === 0) {
      throw new Error(`State not found: ${stateName}`);
    }
    
    const stateId = stateResult.rows[0].id;
    
    // Check if city exists
    const cityResult = await client.query(
      'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND state_id = $2',
      [cityName, stateId]
    );
    
    if (cityResult.rows.length > 0) {
      const cityId = cityResult.rows[0].id;
      citiesCache[cacheKey] = cityId;
      return cityId;
    }
    
    // Create city if not exists
    console.log(`Created city: ${cityName}, ${stateName}`);
    const insertResult = await client.query(
      'INSERT INTO cities (name, slug, state_id) VALUES ($1, $2, $3) RETURNING id',
      [cityName, cityName.toLowerCase().replace(/\s+/g, '-'), stateId]
    );
    
    const cityId = insertResult.rows[0].id;
    citiesCache[cacheKey] = cityId;
    return cityId;
  } catch (error) {
    console.error(`Error ensuring city exists for ${cityName}, ${stateName}:`, error.message);
    throw error;
  }
}

/**
 * Process a single record
 */
async function processRecord(client, record, statesCache, citiesCache) {
  try {
    // Ensure state exists
    const stateId = await ensureStateExists(client, record.state, record.stateAbbr, statesCache);
    
    // Ensure city exists
    const cityId = await ensureCityExists(client, record.city, record.state, citiesCache);
    
    // Format the services array as JSON
    const servicesJson = JSON.stringify(record.services || []);
    
    // Check if laundromat exists
    const existingResult = await client.query(
      'SELECT id FROM laundromats WHERE name = $1 AND address = $2 AND city = $3 AND state = $4',
      [record.name, record.address, record.city, record.state]
    );
    
    if (existingResult.rows.length > 0) {
      // Skip existing laundromat
      return { inserted: false, id: existingResult.rows[0].id };
    }
    
    // Insert the laundromat
    const insertResult = await client.query(`
      INSERT INTO laundromats (
        name, slug, address, city, state, zip, phone, 
        website, latitude, longitude, rating, review_count,
        hours, services, amenities, payment_methods, machines,
        dryer_types, washer_types, seo_title, seo_description, seo_tags,
        premium_score, has_coordinates, city_id, state_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 
        $8, $9, $10, $11, $12, 
        $13, $14, $15, $16, $17, 
        $18, $19, $20, $21, $22, 
        $23, $24, $25, $26
      ) RETURNING id
    `, [
      record.name, record.slug, record.address, record.city, record.state, record.zip, record.phone,
      record.website || null, record.latitude, record.longitude, record.rating || null, record.reviewCount || null,
      record.hours || null, servicesJson, JSON.stringify(record.amenities || []), JSON.stringify(record.paymentMethods || []), JSON.stringify(record.machines || []),
      JSON.stringify(record.dryerTypes || []), JSON.stringify(record.washerTypes || []), record.seoTitle, record.seoDescription, JSON.stringify(record.seoTags || []),
      record.premiumScore, record.hasCoordinates, cityId, stateId
    ]);
    
    return { inserted: true, id: insertResult.rows[0].id };
  } catch (error) {
    console.error(`Error processing record ${record.name}:`, error.message);
    return { inserted: false, error: error.message };
  }
}

/**
 * Run the micro import process
 */
async function runMicroImport() {
  console.log('Starting micro import for laundromat data...');
  const startTime = Date.now();
  
  // Get connection from the pool
  const client = await pool.connect();
  
  try {
    // Get current count
    const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const startingCount = parseInt(countResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Load progress data
    let progressData = getProgressData();
    
    // Load Excel file
    const excelFile = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    if (!fs.existsSync(excelFile)) {
      throw new Error(`Excel file not found: ${excelFile}`);
    }
    
    console.log(`Reading Excel file: ${excelFile}`);
    const workbook = xlsx.readFile(excelFile);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    console.log(`Read ${jsonData.length} records from Excel file`);
    
    // Group records by state
    const recordsByState = {};
    jsonData.forEach(record => {
      if (!record.stateAbbr) {
        // Extract state abbreviation from state field if needed
        if (record.state && record.state.length === 2) {
          record.stateAbbr = record.state;
          record.state = getStateNameFromAbbr(record.state);
        } else {
          // Skip records without a valid state
          return;
        }
      }
      
      // Initialize state array if needed
      if (!recordsByState[record.stateAbbr]) {
        recordsByState[record.stateAbbr] = [];
      }
      
      // Add record to the state array
      recordsByState[record.stateAbbr].push(record);
    });
    
    // Find the next state to process
    let nextState = null;
    let stateRecords = [];
    
    for (const stateAbbr of STATE_PRIORITY) {
      if (!recordsByState[stateAbbr] || recordsByState[stateAbbr].length === 0) {
        // Skip states with no records
        if (!progressData[stateAbbr]) {
          progressData[stateAbbr] = { 
            completed: true, 
            total: 0, 
            processed: 0 
          };
          console.log(`No records found for ${getStateNameFromAbbr(stateAbbr)}, marking as completed`);
          saveProgressData(progressData);
        }
        continue;
      }
      
      // Skip completed states
      if (progressData[stateAbbr] && progressData[stateAbbr].completed) {
        continue;
      }
      
      // Initialize progress for this state if needed
      if (!progressData[stateAbbr]) {
        progressData[stateAbbr] = {
          completed: false,
          total: recordsByState[stateAbbr].length,
          processed: 0
        };
      }
      
      // If we haven't processed all records for this state, use it
      if (progressData[stateAbbr].processed < progressData[stateAbbr].total) {
        nextState = stateAbbr;
        stateRecords = recordsByState[stateAbbr];
        break;
      }
    }
    
    // If no state is left to process, we're done
    if (!nextState) {
      console.log('All states have been processed. Import is complete!');
      return { 
        success: true, 
        message: 'All states processed', 
        startingCount, 
        finalCount: startingCount, 
        recordsInserted: 0 
      };
    }
    
    console.log(`Selected ${nextState} as next state to process`);
    saveProgressData(progressData);
    
    // Get the offset for this state
    const offset = progressData[nextState].processed;
    const stateTotal = progressData[nextState].total;
    
    console.log(`Processing ${getStateNameFromAbbr(nextState)}: ${offset}/${stateTotal} completed so far`);
    
    // Calculate batch end (ensuring we don't go past the end of the array)
    const batchEnd = Math.min(offset + BATCH_SIZE, stateTotal);
    const batchSize = batchEnd - offset;
    
    if (batchSize <= 0) {
      // This should not happen if our logic is correct, but just in case
      progressData[nextState].completed = true;
      saveProgressData(progressData);
      return { 
        success: true, 
        message: `No more records for ${nextState}`, 
        startingCount, 
        finalCount: startingCount, 
        recordsInserted: 0 
      };
    }
    
    console.log(`Processing batch of ${batchSize} records for ${nextState} (offset: ${offset})`);
    
    // Get the batch of records
    const batch = stateRecords.slice(offset, batchEnd);
    
    // Prepare the records
    const preparedRecords = prepareRecords(batch);
    
    // Insert the records
    await client.query('BEGIN'); // Start transaction
    
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process records one by one for maximum stability
    const statesCache = {};
    const citiesCache = {};
    
    for (const record of preparedRecords) {
      const result = await processRecord(client, record, statesCache, citiesCache);
      
      if (result.inserted) {
        inserted++;
      } else if (result.error) {
        errors++;
        console.error(`Error processing ${record.name}:`, result.error);
      } else {
        skipped++;
      }
    }
    
    await client.query('COMMIT'); // Commit transaction
    
    // Update progress
    progressData[nextState].processed += batchSize;
    
    // Check if state is complete
    if (progressData[nextState].processed >= progressData[nextState].total) {
      progressData[nextState].completed = true;
      console.log(`Completed import for ${getStateNameFromAbbr(nextState)}`);
    }
    
    saveProgressData(progressData);
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    // Calculate total progress
    const completedStates = Object.keys(progressData).filter(state => progressData[state].completed).length;
    const totalStates = STATE_PRIORITY.length;
    const percentComplete = ((completedStates / totalStates) * 100).toFixed(2);
    
    console.log(`
      Import session completed!
      Starting count: ${startingCount}
      Records inserted: ${inserted}
      Records skipped: ${skipped}
      Final count: ${finalCount}
      Added: ${finalCount - startingCount} new records
      
      Overall progress: ${completedStates}/${totalStates} (${percentComplete}%)
      
      Run this script again to continue importing with the next state.
    `);
    
    // Get list of completed and remaining states
    const completedStatesList = Object.keys(progressData)
      .filter(state => progressData[state].completed)
      .sort();
      
    const remainingStatesList = STATE_PRIORITY
      .filter(state => !progressData[state] || !progressData[state].completed)
      .sort();
      
    console.log(`Completed states (${completedStatesList.length}): ${completedStatesList.join(', ')}`);
    console.log(`Remaining states (${remainingStatesList.length}): ${remainingStatesList.join(', ')}`);
    
    // Calculate duration
    const durationMs = Date.now() - startTime;
    console.log(`Import Duration: ${(durationMs / 1000).toFixed(3)}s`);
    
    console.log('Import process completed. Run this script again to continue importing.');
    
    return {
      success: true,
      startingCount,
      finalCount,
      recordsInserted: inserted,
      recordsSkipped: skipped,
      stateProcessed: nextState,
      completedStates: completedStatesList.length,
      remainingStates: remainingStatesList.length
    };
  } catch (error) {
    console.error('Error during import:', error.message);
    await client.query('ROLLBACK'); // Rollback transaction on error
    return { success: false, error: error.message };
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

// Run the import function
runMicroImport().catch(error => {
  console.error('Fatal error during import:', error);
  process.exit(1);
});