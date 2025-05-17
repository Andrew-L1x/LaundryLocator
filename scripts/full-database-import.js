/**
 * Full Database Import Script for Laundromat Data
 * 
 * This script efficiently imports the full dataset of 27,000+ laundromats from the Excel file.
 * It uses batched processing to handle the large volume, with resumable functionality in case of interruptions.
 * 
 * Features:
 * - Processes data in configurable batch sizes
 * - Includes progress tracking and resumable functionality
 * - Handles duplicate detection
 * - Updates city and state counts automatically
 * - Provides detailed logging and error handling
 * 
 * Usage:
 * node scripts/full-database-import.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { format } from 'date-fns';

// Load environment variables
dotenv.config();

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Configure paths and settings
const SOURCE_FILE = path.join(cwd, 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');
const PROGRESS_FILE = path.join(cwd, 'data/import_progress.json');
const BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES = 1000; // ms

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Progress tracking
let progress = {
  totalRecords: 0,
  processedRecords: 0,
  imported: 0,
  skipped: 0,
  errors: 0,
  lastBatchIndex: 0,
  startTime: null,
  lastUpdateTime: null
};

/**
 * Load progress from file if it exists
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const savedProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      console.log('Resuming from previous import session');
      return savedProgress;
    }
  } catch (error) {
    console.warn('Could not load progress file, starting fresh:', error.message);
  }
  return {
    totalRecords: 0,
    processedRecords: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    lastBatchIndex: 0,
    startTime: null,
    lastUpdateTime: null
  };
}

/**
 * Save current progress to file
 */
function saveProgress() {
  progress.lastUpdateTime = new Date().toISOString();
  
  // Ensure the data directory exists
  const dataDir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Calculate estimated time remaining
 */
function calculateETA() {
  if (!progress.startTime || progress.processedRecords === 0) {
    return 'Calculating...';
  }
  
  const elapsedMs = new Date().getTime() - new Date(progress.startTime).getTime();
  const recordsPerMs = progress.processedRecords / elapsedMs;
  const remainingRecords = progress.totalRecords - progress.processedRecords;
  const remainingMs = remainingRecords / recordsPerMs;
  
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  
  return `${minutes}m ${seconds}s`;
}

/**
 * Normalize address for deduplication
 */
function normalizeAddress(address, city, state, zip) {
  if (!address || !city || !state) return '';
  
  // Remove common words, punctuation, and normalize whitespace
  let normalized = `${address}, ${city}, ${state} ${zip || ''}`.toLowerCase();
  normalized = normalized.replace(/,/g, '');
  normalized = normalized.replace(/\./g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Generate a slug for the laundromat
 */
function generateSlug(name, city, state) {
  if (!name || !city || !state) {
    const random = Math.floor(Math.random() * 1000000);
    return `laundromat-${random}`;
  }
  
  // Create a slug with name-city-state format
  let slug = `${name}-${city}-${state}`.toLowerCase();
  
  // Remove special characters
  slug = slug.replace(/&/g, 'and');
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');
  
  return slug;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    'laundromat', 
    'laundry service', 
    'coin laundry',
    'laundromat near me',
    'self-service laundry'
  ];
  
  // Add location-based tags
  if (record.city && record.state) {
    tags.push(`laundromat in ${record.city}`);
    tags.push(`${record.city} laundry service`);
    tags.push(`${record.city} ${record.state} laundromat`);
    tags.push(`laundry near ${record.city}`);
  }
  
  // Add special features as tags if applicable
  if (record.hours && record.hours.toLowerCase().includes('24')) {
    tags.push('24 hour laundromat');
    tags.push('24-hour laundry service');
  }
  
  return tags;
}

/**
 * Calculate a premium score
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Points for having complete basic info
  if (record.name) score += 10;
  if (record.address) score += 10;
  if (record.phone) score += 5;
  if (record.website) score += 15;
  if (record.hours) score += 10;
  
  // Points for ratings
  if (record.rating) {
    const numRating = parseFloat(record.rating);
    if (!isNaN(numRating)) {
      if (numRating >= 4.5) score += 20;
      else if (numRating >= 4.0) score += 15;
      else if (numRating >= 3.5) score += 10;
      else if (numRating >= 3.0) score += 5;
    }
  }
  
  // Points for review count
  if (record.reviewCount) {
    const reviewCount = parseInt(record.reviewCount);
    if (!isNaN(reviewCount)) {
      if (reviewCount >= 50) score += 20;
      else if (reviewCount >= 25) score += 15;
      else if (reviewCount >= 10) score += 10;
      else if (reviewCount >= 5) score += 5;
    }
  }
  
  return score;
}

/**
 * Enrich a laundromat record with additional data
 */
function enrichLaundromat(record) {
  // Generate default hours if missing
  if (!record.hours) {
    record.hours = "Monday-Sunday: 8:00AM-8:00PM";
  }
  
  // Generate services as array if needed
  let services = [];
  if (Array.isArray(record.services)) {
    services = record.services;
  } else if (typeof record.services === 'string') {
    services = record.services.split(',').map(s => s.trim());
  } else {
    // Default services
    services = [
      'Self-service laundry',
      'Coin-operated washing machines',
      'High-capacity dryers',
      'Vending machines',
      'Change machine'
    ];
  }
  
  // Calculate premium score
  const premiumScore = calculatePremiumScore(record);
  
  // Determine if premium based on score
  const isPremium = premiumScore >= 50;
  
  // Determine if featured (top-tier)
  const isFeatured = premiumScore >= 75;
  
  // Generate SEO data
  const seoTags = generateSeoTags(record);
  
  // Generate a slug
  const slug = generateSlug(record.name, record.city, record.state);
  
  // Normalize addresses
  const normalizedAddress = normalizeAddress(record.address, record.city, record.state, record.zip);
  
  // Add default description
  const description = record.description || `${record.name} is a ${isPremium ? 'premium' : 'top-rated'} laundromat located in ${record.city}, ${record.state}. Visit us for clean, convenient laundry services.`;
  
  // Return the enriched record
  return {
    ...record,
    slug,
    normalizedAddress,
    isPremium,
    isFeatured,
    services,
    premiumScore,
    seoTags,
    description,
    listingType: isFeatured ? 'featured' : (isPremium ? 'premium' : 'basic'),
    verified: true,
  };
}

/**
 * Check if a city exists and create it if not
 */
async function getOrCreateCity(client, cityName, stateAbbr) {
  if (!cityName || !stateAbbr) {
    throw new Error('City name and state abbreviation are required');
  }
  
  const citySlug = cityName.toLowerCase().replace(/\s+/g, '-');
  
  // Check if city exists
  const cityQuery = `
    SELECT id FROM cities 
    WHERE LOWER(name) = LOWER($1) AND LOWER(state) = LOWER($2)
    LIMIT 1
  `;
  
  const cityResult = await client.query(cityQuery, [cityName, stateAbbr]);
  
  if (cityResult.rows.length > 0) {
    return cityResult.rows[0].id;
  }
  
  // City doesn't exist, check if state exists
  const stateQuery = `
    SELECT id FROM states
    WHERE LOWER(abbr) = LOWER($1)
    LIMIT 1
  `;
  
  const stateResult = await client.query(stateQuery, [stateAbbr]);
  
  let stateId;
  
  if (stateResult.rows.length > 0) {
    stateId = stateResult.rows[0].id;
  } else {
    // Create state if it doesn't exist
    const stateFullName = getStateNameFromAbbr(stateAbbr) || stateAbbr;
    const stateSlug = stateFullName.toLowerCase().replace(/\s+/g, '-');
    
    const insertStateQuery = `
      INSERT INTO states (name, abbr, slug, laundry_count, created_at, updated_at)
      VALUES ($1, $2, $3, 0, NOW(), NOW())
      RETURNING id
    `;
    
    const insertStateResult = await client.query(insertStateQuery, [
      stateFullName,
      stateAbbr,
      stateSlug
    ]);
    
    stateId = insertStateResult.rows[0].id;
  }
  
  // Create the city
  const insertCityQuery = `
    INSERT INTO cities (name, state, state_id, slug, laundry_count, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
    RETURNING id
  `;
  
  const insertCityResult = await client.query(insertCityQuery, [
    cityName,
    stateAbbr,
    stateId,
    citySlug
  ]);
  
  return insertCityResult.rows[0].id;
}

/**
 * Update counts for a location after adding a laundromat
 */
async function updateLocationCounts(client, cityId, stateAbbr) {
  // Update city count
  await client.query(`
    UPDATE cities 
    SET laundry_count = (
      SELECT COUNT(*) FROM laundromats WHERE city_id = $1
    )
    WHERE id = $1
  `, [cityId]);
  
  // Update state count
  await client.query(`
    UPDATE states 
    SET laundry_count = (
      SELECT COUNT(*) FROM laundromats 
      WHERE state = $1
    )
    WHERE abbr = $1
  `, [stateAbbr]);
}

/**
 * Convert state abbreviation to full name
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
  
  return states[abbr.toUpperCase()] || abbr;
}

/**
 * Import a single laundromat
 */
async function importLaundromat(client, record) {
  // Skip if essential fields are missing
  if (!record.name || !record.city || !record.state) {
    throw new Error('Missing essential fields (name, city, state)');
  }
  
  // Get or create city
  const cityId = await getOrCreateCity(client, record.city, record.state);
  
  // Check for existing laundromat to avoid duplicates
  const checkQuery = `
    SELECT id FROM laundromats 
    WHERE slug = $1 OR (
      LOWER(name) = LOWER($2) AND
      LOWER(city) = LOWER($3) AND
      LOWER(state) = LOWER($4)
    )
    LIMIT 1
  `;
  
  const checkResult = await client.query(checkQuery, [
    record.slug,
    record.name,
    record.city,
    record.state
  ]);
  
  if (checkResult.rows.length > 0) {
    // Laundromat already exists
    return { success: false, action: 'skipped', id: checkResult.rows[0].id };
  }
  
  // Prepare services for database storage
  const servicesJson = JSON.stringify(record.services || []);
  const seoTagsJson = JSON.stringify(record.seoTags || []);
  
  // Insert the laundromat
  const insertQuery = `
    INSERT INTO laundromats (
      name, slug, address, city, state, zip, phone, website,
      latitude, longitude, rating, review_count, hours, 
      services, description, is_premium, is_featured,
      image_url, listing_type, city_id,
      created_at, verified, amenities
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 
      $9, $10, $11, $12, $13, 
      $14, $15, $16, $17,
      $18, $19, $20,
      NOW(), $21, $22
    )
    RETURNING id
  `;
  
  // Prepare amenities
  const amenitiesJson = JSON.stringify(record.amenities || []);
  
  const insertResult = await client.query(insertQuery, [
    record.name,
    record.slug,
    record.address || '',
    record.city,
    record.state,
    record.zip || '',
    record.phone || '',
    record.website || null,
    record.latitude || '0',
    record.longitude || '0',
    record.rating || '0',
    record.reviewCount || 0,
    record.hours || '',
    servicesJson,
    record.description || '',
    record.isPremium || false,
    record.isFeatured || false,
    record.imageUrl || null,
    record.listingType || 'basic',
    cityId,
    record.verified || true,
    amenitiesJson
  ]);
  
  // Update location counts
  await updateLocationCounts(client, cityId, record.state);
  
  return { success: true, action: 'imported', id: insertResult.rows[0].id };
}

/**
 * Process a batch of records
 */
async function processBatch(records, batchIndex) {
  console.log(`\n=== Processing batch ${batchIndex + 1} (${records.length} records) ===`);
  
  const client = await pool.connect();
  let batchImported = 0;
  let batchSkipped = 0;
  let batchErrors = 0;
  
  try {
    // Begin a transaction
    await client.query('BEGIN');
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordIndex = batchIndex * BATCH_SIZE + i;
      progress.processedRecords++;
      
      try {
        // Enrich the laundromat data
        const enrichedRecord = enrichLaundromat(record);
        
        // Import the enriched record
        const result = await importLaundromat(client, enrichedRecord);
        
        if (result.success) {
          batchImported++;
          progress.imported++;
        } else {
          batchSkipped++;
          progress.skipped++;
        }
        
        // Log progress periodically
        if (progress.processedRecords % 10 === 0 || i === records.length - 1) {
          const percent = ((progress.processedRecords / progress.totalRecords) * 100).toFixed(2);
          const eta = calculateETA();
          process.stdout.write(`\rProgress: ${progress.processedRecords}/${progress.totalRecords} (${percent}%) - ETA: ${eta}`);
        }
      } catch (error) {
        console.error(`\nError importing record ${recordIndex + 1}:`, error.message);
        batchErrors++;
        progress.errors++;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Save progress to file
    progress.lastBatchIndex = batchIndex + 1;
    saveProgress();
    
    console.log(`\n=== Batch ${batchIndex + 1} complete: ${batchImported} imported, ${batchSkipped} skipped, ${batchErrors} errors ===`);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('\nBatch error:', error.message);
    throw error;
  } finally {
    client.release();
  }
  
  return { batchImported, batchSkipped, batchErrors };
}

/**
 * Main import function
 */
async function importData() {
  try {
    console.log('=== Starting Full Database Import ===');
    console.log(`Reading Excel file: ${SOURCE_FILE}`);
    
    // Load saved progress if exists
    progress = loadProgress();
    
    // Read the Excel file if starting fresh
    let allData = [];
    
    if (progress.processedRecords === 0) {
      // Starting a new import
      progress.startTime = new Date().toISOString();
      
      // Read the Excel file
      const workbook = xlsx.readFile(SOURCE_FILE);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      allData = xlsx.utils.sheet_to_json(sheet);
      progress.totalRecords = allData.length;
      
      console.log(`Found ${progress.totalRecords} records in Excel file`);
      saveProgress();
    } else {
      // Resuming previous import
      console.log(`Resuming import at record ${progress.processedRecords} of ${progress.totalRecords}`);
      
      // Re-read the Excel file
      const workbook = xlsx.readFile(SOURCE_FILE);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      allData = xlsx.utils.sheet_to_json(sheet);
    }
    
    // Calculate batches
    const batches = [];
    for (let i = progress.lastBatchIndex; i * BATCH_SIZE < allData.length; i++) {
      const startIndex = i * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, allData.length);
      batches.push(allData.slice(startIndex, endIndex));
    }
    
    console.log(`Processing ${batches.length} batches (${BATCH_SIZE} records per batch)`);
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      await processBatch(batches[i], progress.lastBatchIndex + i);
      
      // Add delay between batches to prevent overloading the database
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Calculate timing statistics
    const startTime = new Date(progress.startTime);
    const endTime = new Date();
    const elapsedMs = endTime.getTime() - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    
    // Display final results
    console.log('\n=== Import Complete ===');
    console.log(`Total records processed: ${progress.totalRecords}`);
    console.log(`Imported: ${progress.imported}`);
    console.log(`Skipped: ${progress.skipped}`);
    console.log(`Errors: ${progress.errors}`);
    console.log(`Time elapsed: ${elapsedMinutes}m ${elapsedSeconds}s`);
    console.log('=== End of Import ===');
    
  } catch (error) {
    console.error('Import failed:', error.message);
    throw error;
  } finally {
    // Close the database pool
    await pool.end();
    
    // Mark as complete in progress file
    progress.completed = true;
    progress.completedAt = new Date().toISOString();
    saveProgress();
  }
}

// Run the main function
importData().then(() => {
  console.log('Import process completed.');
}).catch(error => {
  console.error('Import process failed:', error);
  process.exit(1);
});