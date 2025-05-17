/**
 * Larger Batch Import Script for Laundromat Data
 * 
 * This script imports laundromat data in larger batches to add
 * more records at once to the database.
 */

import { createReadStream } from 'fs';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import xlsx from 'xlsx';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const BATCH_SIZE = 25; // Larger batch size
const STATE_OFFSET_PATTERN = /-offset.txt$/;
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';
const PROGRESS_FILE = 'import-progress.json';

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
  // Normalize the text by removing non-alphanumeric characters and replacing spaces with hyphens
  let slug = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  
  // Append a portion of the unique ID to ensure uniqueness
  slug = `${slug}-${uniqueId.toString().substring(0, 8)}`;
  
  return slug;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  // Base tags that are always included
  const baseTags = ['laundromat', 'laundry', 'washing machine', 'dryer'];
  
  // Location-specific tags
  const locationTags = [
    `${record.city} laundromat`,
    `${record.state} laundromat`,
    `laundromat in ${record.city}`,
    `laundromat near me`,
    `${record.city} ${record.state} laundry`,
    `${record.zip} laundromat`
  ];
  
  // Feature-based tags based on services
  const featureTags = [];
  if (record.services && record.services.length > 0) {
    const servicesList = Array.isArray(record.services) ? record.services : [record.services];
    
    if (servicesList.some(s => s.toLowerCase().includes('24'))) {
      featureTags.push('24 hour laundromat', 'open 24 hours');
    }
    
    if (servicesList.some(s => s.toLowerCase().includes('coin'))) {
      featureTags.push('coin laundry', 'coin-operated');
    }
    
    if (servicesList.some(s => s.toLowerCase().includes('wash'))) {
      featureTags.push('wash and fold', 'laundry service');
    }
    
    if (servicesList.some(s => s.toLowerCase().includes('dry'))) {
      featureTags.push('dry cleaning', 'dry cleaner');
    }
    
    if (servicesList.some(s => s.toLowerCase().includes('card'))) {
      featureTags.push('card-operated laundry', 'credit card laundromat');
    }
  }
  
  // Combine all tags and remove duplicates
  const allTags = [...baseTags, ...locationTags, ...featureTags];
  const uniqueTags = [...new Set(allTags)];
  
  return uniqueTags;
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  return `${record.name} - Laundromat in ${record.city}, ${record.state}`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  let desc = `Visit ${record.name}, a convenient laundromat located in ${record.city}, ${record.state}. `;
  
  // Add address
  desc += `Find us at ${record.address}, ${record.city}, ${record.state} ${record.zip}. `;
  
  // Add services if available
  if (record.services && record.services.length > 0) {
    const servicesList = Array.isArray(record.services) ? record.services : [record.services];
    if (servicesList.length > 0) {
      desc += `Services include: ${servicesList.join(', ')}. `;
    }
  }
  
  // Add hours if available
  if (record.hours) {
    desc += `Hours: ${record.hours}. `;
  }
  
  // Add contact info
  if (record.phone) {
    desc += `Contact us at ${record.phone}. `;
  }
  
  // Add near me phrase for SEO
  desc += 'Looking for a laundromat near me? We\'re conveniently located to serve your laundry needs.';
  
  return desc;
}

/**
 * Calculate premium score for a laundromat
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Base score from rating (0-5 stars)
  if (record.rating) {
    score += parseFloat(record.rating) * 4; // Up to 20 points
  }
  
  // More services = higher score (up to 20 points)
  if (record.services && record.services.length) {
    const servicesList = Array.isArray(record.services) ? record.services : [record.services];
    score += Math.min(servicesList.length * 2, 20);
  }
  
  // Review count (up to 20 points)
  if (record.reviewCount) {
    const reviews = parseInt(record.reviewCount);
    score += Math.min(reviews / 5, 20);
  }
  
  // Website bonus (10 points)
  if (record.website) {
    score += 10;
  }
  
  // Hours listed bonus (10 points)
  if (record.hours) {
    score += 10;
  }
  
  // Photo count bonus (up to 10 points)
  if (record.photoCount) {
    const photos = parseInt(record.photoCount);
    score += Math.min(photos, 10);
  }
  
  // Normalize to 0-100 scale
  score = Math.round(Math.min(score, 100));
  
  return score;
}

/**
 * Prepare a state for the database
 */
async function ensureStateExists(client, stateAbbr) {
  const stateName = getStateNameFromAbbr(stateAbbr);
  
  // Check if state exists
  const stateQuery = 'SELECT id FROM states WHERE abbr = $1';
  const stateResult = await client.query(stateQuery, [stateAbbr]);
  
  if (stateResult.rows.length > 0) {
    return { 
      id: stateResult.rows[0].id,
      name: stateName,
      abbr: stateAbbr
    };
  }
  
  // Create new state
  const slug = stateName.toLowerCase().replace(/\s+/g, '-');
  const insertQuery = 'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3) RETURNING id';
  const insertResult = await client.query(insertQuery, [stateName, slug, stateAbbr]);
  
  return {
    id: insertResult.rows[0].id,
    name: stateName,
    abbr: stateAbbr
  };
}

/**
 * Prepare a city for the database
 */
async function ensureCityExists(client, cityName, stateName) {
  // Check if city exists
  const cityQuery = 'SELECT id FROM cities WHERE name = $1 AND state = $2';
  const cityResult = await client.query(cityQuery, [cityName, stateName]);
  
  if (cityResult.rows.length > 0) {
    return cityResult.rows[0].id;
  }
  
  // Create new city
  const slug = cityName.toLowerCase().replace(/\s+/g, '-');
  const insertQuery = 'INSERT INTO cities (name, slug, state, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id';
  const insertResult = await client.query(insertQuery, [cityName, slug, stateName, 0]);
  
  return insertResult.rows[0].id;
}

/**
 * Import a batch of laundromats
 */
async function importBatch(client, records) {
  let insertedCount = 0;
  
  for (const record of records) {
    try {
      // Prepare state
      const stateAbbr = record.state.toUpperCase();
      const state = await ensureStateExists(client, stateAbbr);
      
      // Prepare city
      const cityId = await ensureCityExists(client, record.city, state.name);
      
      // Generate additional fields
      const slug = generateSlug(record.name, record.id);
      const seoTags = generateSeoTags(record);
      const seoTitle = generateSeoTitle(record);
      const seoDescription = generateSeoDescription(record);
      const premiumScore = calculatePremiumScore(record);
      
      // Insert laundromat
      const insertQuery = `
        INSERT INTO laundromats (
          name, slug, address, city, state, zip, phone, website,
          latitude, longitude, rating, review_count, photo_count,
          hours, services, accepted_payment_types, features, price_range,
          seo_title, seo_description, seo_tags, premium_score,
          is_claimed, is_premium, is_featured, city_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22,
          $23, $24, $25, $26
        )
        ON CONFLICT (slug) DO NOTHING
        RETURNING id
      `;
      
      const insertResult = await client.query(insertQuery, [
        record.name, slug, record.address, record.city, record.state, record.zip, record.phone, record.website,
        record.latitude, record.longitude, record.rating, record.reviewCount, record.photoCount,
        record.hours, Array.isArray(record.services) ? record.services : [record.services], 
        record.acceptedPaymentTypes, record.features, record.priceRange,
        seoTitle, seoDescription, seoTags, premiumScore,
        false, false, false, cityId
      ]);
      
      if (insertResult.rows.length > 0) {
        insertedCount++;
        
        // Update city's laundry count
        await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
      }
    } catch (error) {
      console.error(`Error importing laundromat ${record.name}: ${error.message}`);
    }
  }
  
  return insertedCount;
}

/**
 * Process one state at a time
 */
async function processState(client, stateAbbr, records, offset = 0) {
  // Filter records for this state
  const stateRecords = records.filter(r => r.state?.toUpperCase() === stateAbbr);
  
  // Get the total number of records for this state
  const total = stateRecords.length;
  console.log(`Processing ${stateAbbr} (${getStateNameFromAbbr(stateAbbr)}): ${offset}/${total} completed so far`);
  
  if (offset >= total) {
    console.log(`Completed import for ${stateAbbr}`);
    // Write a completion file for this state
    fs.writeFileSync(`${stateAbbr.toLowerCase()}-offset.txt`, total.toString());
    return { count: 0, completed: true };
  }
  
  // Get the current batch
  const end = Math.min(offset + BATCH_SIZE, total);
  const batch = stateRecords.slice(offset, end);
  console.log(`Processing batch of ${batch.length} records for ${stateAbbr} (offset: ${offset})`);
  
  // Import the batch
  const insertedCount = await importBatch(client, batch);
  
  // Update the offset if we haven't reached the end
  if (end < total) {
    fs.writeFileSync(`${stateAbbr.toLowerCase()}-offset.txt`, end.toString());
    return { count: insertedCount, completed: false, newOffset: end };
  }
  
  // We've completed this state
  console.log(`Completed import for ${stateAbbr}`);
  fs.writeFileSync(`${stateAbbr.toLowerCase()}-offset.txt`, total.toString());
  return { count: insertedCount, completed: true };
}

/**
 * Run the import process
 */
async function runImport() {
  const startTime = Date.now();
  let client = null;
  
  try {
    // Get current laundromat count
    client = await pool.connect();
    const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const startingCount = parseInt(countResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Read the data from Excel file
    console.log(`Reading Excel file: ${SOURCE_FILE}`);
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(sheet);
    console.log(`Read ${jsonData.length} records from Excel file`);
    
    // Get current progress
    let progress = { currentState: null, statesCompleted: [] };
    if (fs.existsSync(PROGRESS_FILE)) {
      try {
        progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      } catch (error) {
        console.error(`Error reading progress file: ${error.message}`);
      }
    }
    
    // Get completed states from offset files
    const files = fs.readdirSync('.');
    const offsetFiles = files.filter(file => STATE_OFFSET_PATTERN.test(file));
    const completedStates = [];
    
    for (const file of offsetFiles) {
      const stateAbbr = file.split('-')[0].toUpperCase();
      const content = fs.readFileSync(file, 'utf8').trim();
      const total = parseInt(content);
      
      // Check if this state has all records processed
      const stateRecords = jsonData.filter(r => r.state?.toUpperCase() === stateAbbr);
      if (total >= stateRecords.length) {
        completedStates.push(stateAbbr);
      }
    }
    
    progress.statesCompleted = completedStates;
    
    // Get all available states from the data
    const allStates = [...new Set(jsonData.map(r => r.state?.toUpperCase()).filter(Boolean))];
    const remainingStates = allStates.filter(state => !completedStates.includes(state));
    
    if (remainingStates.length === 0) {
      console.log('All states have been processed. Import is complete.');
      return { success: true, recordsInserted: 0, completed: true };
    }
    
    // Select the next state to process
    let stateToProcess = progress.currentState;
    if (!stateToProcess || completedStates.includes(stateToProcess)) {
      stateToProcess = remainingStates[0];
    }
    
    console.log(`Selected ${stateToProcess} as next state to process`);
    progress.currentState = stateToProcess;
    
    // Get the current offset for this state
    let offset = 0;
    const offsetFile = `${stateToProcess.toLowerCase()}-offset.txt`;
    if (fs.existsSync(offsetFile)) {
      offset = parseInt(fs.readFileSync(offsetFile, 'utf8').trim());
    }
    
    // Process the state
    const result = await processState(client, stateToProcess, jsonData, offset);
    
    // Update progress
    if (result.completed) {
      if (!progress.statesCompleted.includes(stateToProcess)) {
        progress.statesCompleted.push(stateToProcess);
      }
      progress.currentState = null;
    } else if (result.newOffset) {
      // State not completed, but we have a new offset
      progress.currentState = stateToProcess;
    }
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log('Progress saved to import-progress.json');
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    // Calculate progress stats
    const totalStates = allStates.length;
    const statesCompleted = progress.statesCompleted.length;
    const overallProgress = ((statesCompleted / totalStates) * 100).toFixed(2);
    
    console.log(`
      Import session completed!
      Starting count: ${startingCount}
      Records inserted: ${result.count}
      Records skipped: ${BATCH_SIZE - result.count}
      Final count: ${finalCount}
      Added: ${finalCount - startingCount} new records
      
      Overall progress: ${statesCompleted}/${totalStates} (${overallProgress}%)
      
      Run this script again to continue importing with the next state.
    `);
    
    // Calculate completion time
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(3);
    
    // Show completed and remaining states
    console.log(`Completed states (${completedStates.length}): ${completedStates.join(', ') || 'None'}`);
    console.log(`Remaining states (${remainingStates.length}): ${remainingStates.join(', ') || 'None'}`);
    
    console.log(`Import Duration: ${duration}s`);
    
    return { 
      success: true, 
      recordsInserted: result.count, 
      totalCount: finalCount,
      completed: result.completed
    };
    
  } catch (error) {
    console.error(`Error in import process: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      client.release();
    }
    console.log('Import process completed. Run this script again to continue importing.');
  }
}

// Run the import process
runImport().then(() => {
  pool.end();
}).catch(error => {
  console.error(`Fatal error: ${error.stack}`);
  pool.end();
});