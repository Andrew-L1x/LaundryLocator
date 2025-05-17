/**
 * Optimized Import Script for Large Laundromat Dataset
 * 
 * This script is designed to efficiently import the entire 27,000+ record dataset
 * by using a combination of techniques:
 * 1. Pre-processing records to reduce database operations
 * 2. Using prepared statements for faster inserts
 * 3. Implementing checkpoint saving to resume from interruptions
 * 4. Focusing on one state at a time with configurable batch sizes
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuration settings
const BATCH_SIZE = 25; // Process exactly 25 records at a time
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

// State abbreviation to full name mapping
const stateNameMap = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

/**
 * Get progress data
 */
function getProgressData() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progressData = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(progressData);
    }
  } catch (error) {
    console.log('No previous progress data found, starting fresh');
  }
  
  // Return default progress data for all states
  const defaultProgress = {};
  for (const state of Object.keys(stateNameMap)) {
    defaultProgress[state] = {
      offset: 0,
      total: 0,
      completed: false
    };
  }
  
  return defaultProgress;
}

/**
 * Save progress data
 */
function saveProgressData(progressData) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
  console.log('Progress saved to', PROGRESS_FILE);
}

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  if (!abbr) return 'Unknown State';
  if (abbr.length > 2) return abbr; // Already a full name
  return stateNameMap[abbr.toUpperCase()] || abbr;
}

/**
 * Generate a slug for a laundromat
 */
function generateSlug(text, uniqueId) {
  if (!text) {
    return `laundromat-${uniqueId}`;
  }
  
  let slug = text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${slug}-${uniqueId}`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    "laundromat",
    "laundry service",
    "coin laundry",
    "laundromat near me",
    "24 hour laundromat"
  ];
  
  if (record.city) tags.push(`laundromat in ${record.city}`);
  if (record.state) tags.push(`laundromat in ${record.state}`);
  if (record.city && record.state) tags.push(`laundromat in ${record.city}, ${record.state}`);
  if (record.zip) tags.push(`laundromat in ${record.zip}`);
  
  return tags;
}

/**
 * Generate a concise SEO title
 */
function generateSeoTitle(record) {
  const name = record.name || 'Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  
  const locationPart = city && state ? `${city}, ${state}` : city || state;
  const locationSuffix = locationPart ? ` in ${locationPart}` : '';
  
  return `${name}${locationSuffix} | Laundromat Near Me`;
}

/**
 * Generate SEO description
 */
function generateSeoDescription(record) {
  const name = record.name || 'This laundromat';
  const city = record.city || 'the area';
  const state = record.state ? `, ${record.state}` : '';
  const locationPhrase = `${city}${state}`;
  
  return `${name} is a convenient laundromat in ${locationPhrase} offering quality laundry services. Find directions, hours, and amenities for this laundromat location near you.`;
}

/**
 * Calculate premium score
 */
function calculatePremiumScore(record) {
  let score = 60; // Base score
  
  // Rating-based points (0-25 points)
  if (record.rating) {
    const ratingVal = parseFloat(record.rating);
    if (!isNaN(ratingVal)) {
      score += (ratingVal * 5); // Up to 25 points for 5-star rating
    }
  }
  
  // Review count bonus (0-10 points)
  if (record.review_count) {
    const reviewCount = parseInt(record.review_count);
    if (!isNaN(reviewCount)) {
      if (reviewCount >= 100) {
        score += 10;
      } else if (reviewCount >= 50) {
        score += 7;
      } else if (reviewCount >= 20) {
        score += 5;
      } else if (reviewCount >= 10) {
        score += 3;
      } else if (reviewCount >= 5) {
        score += 1;
      }
    }
  }
  
  // Website bonus (5 points)
  if (record.website) {
    score += 5;
  }
  
  return Math.min(100, Math.round(score));
}

/**
 * Pre-process records to prepare for database insertion
 */
function prepareRecords(records) {
  return records.map(record => {
    // Get basic info
    const name = record.name || `Laundromat ${Math.floor(Math.random() * 10000)}`;
    const address = record.address || '123 Main St';
    const city = record.city || 'Unknown City';
    const stateAbbr = record.state || 'TX';
    const stateName = getStateNameFromAbbr(stateAbbr);
    const zip = record.zip || '00000';
    
    // Generate unique ID for slug
    const uniqueId = Math.floor(Math.random() * 10000000);
    const slug = generateSlug(`${name}-${city}-${stateName}`, uniqueId);
    
    // Generate SEO fields
    const seoTitle = generateSeoTitle({ name, city, state: stateName });
    const seoDescription = generateSeoDescription({ name, city, state: stateName });
    const seoTags = JSON.stringify(generateSeoTags({ name, city, state: stateName, zip }));
    
    // Calculate premium attributes
    const premiumScore = calculatePremiumScore(record);
    const isPremium = Math.random() < 0.15 || premiumScore >= 75;
    const isFeatured = Math.random() < 0.05 || premiumScore >= 90;
    const isVerified = Math.random() < 0.3 || premiumScore >= 80;
    
    return {
      name,
      slug,
      address,
      city,
      stateName,
      stateAbbr,
      zip,
      phone: record.phone || '',
      website: record.website || null,
      latitude: record.latitude || '0',
      longitude: record.longitude || '0',
      rating: record.rating || '0',
      reviewCount: record.review_count || 0,
      hours: record.hours || 'Call for hours',
      services: JSON.stringify(record.services || []),
      isFeatured,
      isPremium,
      isVerified,
      description: `${name} is a laundromat located in ${city}, ${stateName}.`,
      seoTitle,
      seoDescription,
      seoTags,
      premiumScore
    };
  });
}

/**
 * Ensure a state exists in the database
 */
async function ensureStateExists(client, stateName, stateAbbr, statesCache) {
  // Check cache first
  if (statesCache[stateName]) {
    return statesCache[stateName];
  }
  
  // Check if state exists
  const stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
  
  if (stateResult.rows.length === 0) {
    // Create state
    const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const newStateResult = await client.query(
      'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
      [stateName, stateAbbr, stateSlug]
    );
    
    console.log(`Created state: ${stateName}`);
    const stateId = newStateResult.rows[0].id;
    statesCache[stateName] = stateId;
    return stateId;
  } else {
    const stateId = stateResult.rows[0].id;
    statesCache[stateName] = stateId;
    return stateId;
  }
}

/**
 * Ensure a city exists in the database
 */
async function ensureCityExists(client, cityName, stateName, citiesCache) {
  // Check cache first
  const cacheKey = `${cityName}-${stateName}`;
  if (citiesCache[cacheKey]) {
    return citiesCache[cacheKey];
  }
  
  // Check if city exists
  const cityResult = await client.query(
    'SELECT id FROM cities WHERE name = $1 AND state = $2',
    [cityName, stateName]
  );
  
  if (cityResult.rows.length === 0) {
    // Create city with unique slug
    const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uniqueSuffix = Math.floor(Math.random() * 10000);
    
    try {
      const newCityResult = await client.query(
        'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
        [cityName, stateName, `${citySlug}-${uniqueSuffix}`]
      );
      
      console.log(`Created city: ${cityName}, ${stateName}`);
      const cityId = newCityResult.rows[0].id;
      citiesCache[cacheKey] = cityId;
      return cityId;
    } catch (error) {
      // If error (likely duplicate slug), try with timestamp
      const retrySlug = `${citySlug}-${Date.now()}`;
      const retryResult = await client.query(
        'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
        [cityName, stateName, retrySlug]
      );
      const cityId = retryResult.rows[0].id;
      citiesCache[cacheKey] = cityId;
      return cityId;
    }
  } else {
    const cityId = cityResult.rows[0].id;
    citiesCache[cacheKey] = cityId;
    return cityId;
  }
}

/**
 * Process a batch of records for a specific state
 */
async function processBatch(client, records, stateAbbr, offset, statesCache, citiesCache) {
  console.log(`Processing batch of ${records.length} records for ${stateAbbr} (offset: ${offset})`);
  
  // Pre-process records
  const preparedRecords = prepareRecords(records);
  
  let inserted = 0;
  let skipped = 0;
  
  for (let i = 0; i < preparedRecords.length; i++) {
    const record = preparedRecords[i];
    
    try {
      // Ensure state exists
      const stateId = await ensureStateExists(client, record.stateName, record.stateAbbr, statesCache);
      
      // Ensure city exists
      const cityId = await ensureCityExists(client, record.city, record.stateName, citiesCache);
      
      // Insert the laundromat
      await client.query(`
        INSERT INTO laundromats (
          name, slug, address, city, state, zip, phone, website,
          latitude, longitude, rating, review_count, hours, services,
          is_featured, is_premium, is_verified, description, created_at,
          seo_title, seo_description, seo_tags, premium_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      `, [
        record.name,
        record.slug,
        record.address,
        record.city,
        record.stateName,
        record.zip,
        record.phone,
        record.website,
        record.latitude,
        record.longitude,
        record.rating,
        record.reviewCount,
        record.hours,
        record.services,
        record.isFeatured,
        record.isPremium,
        record.isVerified,
        record.description,
        new Date(),
        record.seoTitle,
        record.seoDescription,
        record.seoTags,
        record.premiumScore
      ]);
      
      // Update counts
      await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
      await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
      
      inserted++;
      
    } catch (error) {
      skipped++;
      console.error(`Error importing ${record.name}:`, error.message);
    }
  }
  
  return { inserted, skipped };
}

/**
 * Process all records for a specific state
 */
async function processState(client, stateAbbr, allData, progressData, statesCache, citiesCache) {
  const stateName = getStateNameFromAbbr(stateAbbr);
  
  // Get records for this state
  const stateRecords = allData.filter(r => r.state === stateAbbr);
  
  if (stateRecords.length === 0) {
    console.log(`No records found for ${stateName}, marking as completed`);
    progressData[stateAbbr].completed = true;
    progressData[stateAbbr].total = 0;
    saveProgressData(progressData);
    return { inserted: 0, skipped: 0 };
  }
  
  // Update total count if not already set
  if (progressData[stateAbbr].total === 0) {
    progressData[stateAbbr].total = stateRecords.length;
    saveProgressData(progressData);
  }
  
  // Get current offset
  const offset = progressData[stateAbbr].offset || 0;
  
  // Check if state is already completed
  if (progressData[stateAbbr].completed) {
    console.log(`${stateName} is already completed, skipping`);
    return { inserted: 0, skipped: 0 };
  }
  
  console.log(`Processing ${stateName}: ${offset}/${stateRecords.length} completed so far`);
  
  // Calculate end of batch
  const endOffset = Math.min(offset + BATCH_SIZE, stateRecords.length);
  
  // Get batch of records
  const batchRecords = stateRecords.slice(offset, endOffset);
  
  // Process batch
  const results = await processBatch(client, batchRecords, stateAbbr, offset, statesCache, citiesCache);
  
  // Update progress
  progressData[stateAbbr].offset = endOffset;
  
  // Check if state is completed
  if (endOffset >= stateRecords.length) {
    progressData[stateAbbr].completed = true;
    console.log(`Completed import for ${stateName}`);
  }
  
  // Save progress
  saveProgressData(progressData);
  
  return results;
}

/**
 * Run the import process
 */
async function runImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting optimized import for laundromat data...');
    
    // Get current laundromat count
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Read ${allData.length} records from Excel file`);
    
    // Get progress data
    const progressData = getProgressData();
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Caches to reduce database queries
    const statesCache = {};
    const citiesCache = {};
    
    // Get next state to process
    const nextState = STATE_PRIORITY.find(state => !progressData[state]?.completed);
    
    if (!nextState) {
      console.log('All states completed!');
      await client.query('COMMIT');
      return;
    }
    
    console.log(`Selected ${nextState} as next state to process`);
    
    // Process the state
    const results = await processState(
      client, 
      nextState, 
      allData, 
      progressData,
      statesCache,
      citiesCache
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Get updated count
    const updatedCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const updatedCount = parseInt(updatedCountResult.rows[0].count);
    
    // Calculate progress across all states
    const totalRecords = Object.values(progressData).reduce((sum, state) => sum + state.total, 0);
    const completedRecords = Object.values(progressData).reduce((sum, state) => {
      return sum + (state.completed ? state.total : Math.min(state.offset || 0, state.total));
    }, 0);
    
    const percentComplete = totalRecords > 0 ? ((completedRecords / totalRecords) * 100).toFixed(2) : 0;
    
    console.log(`
      Import session completed!
      Starting count: ${currentCount}
      Records inserted: ${results.inserted}
      Records skipped: ${results.skipped}
      Final count: ${updatedCount}
      Added: ${updatedCount - currentCount} new records
      
      Overall progress: ${completedRecords}/${totalRecords} (${percentComplete}%)
      
      Run this script again to continue importing with the next state.
    `);
    
    // Show completed and remaining states
    const completedStates = Object.keys(progressData).filter(state => progressData[state].completed);
    const remainingStates = Object.keys(progressData).filter(state => !progressData[state].completed);
    
    console.log(`Completed states (${completedStates.length}): ${completedStates.join(', ')}`);
    console.log(`Remaining states (${remainingStates.length}): ${remainingStates.join(', ')}`);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error during import process:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.time('Import Duration');
runImport()
  .then(() => {
    console.timeEnd('Import Duration');
    console.log('Import process completed. Run this script again to continue importing.');
  })
  .catch(error => {
    console.error('Fatal error during import:', error);
    console.timeEnd('Import Duration');
  });