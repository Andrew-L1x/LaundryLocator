/**
 * Large Manual Import Script
 * 
 * This script imports a large batch of laundromat records in one go
 * for a specific state.
 */

import { Pool } from 'pg';
import xlsx from 'xlsx';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const BATCH_SIZE = 50; // Much larger batch size
const STATE_TO_IMPORT = "NY"; // Change this to the state you want to import
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';

// Database connection
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
function generateSlug(name, city, state) {
  // Create a base slug from name, city, and state
  const baseSlug = `${name} ${city} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-');        // Replace spaces with hyphens
  
  // Add a random string to ensure uniqueness
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${randomStr}`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  // Base tags that always apply
  const baseTags = ['laundromat', 'laundry', 'wash', 'dry', 'cleaning'];
  
  // Location-based tags
  const locationTags = [
    `${record.city} laundromat`,
    `laundromat in ${record.city}`,
    `${record.state} laundromat`,
    `${record.city} ${record.state} laundry`,
    `laundromat near me`,
    `${record.zip} laundromat`
  ];
  
  // Service-based tags
  const serviceTags = [];
  if (record.services) {
    const services = Array.isArray(record.services) ? record.services : [record.services];
    if (services.some(s => s?.toLowerCase().includes('24'))) {
      serviceTags.push('24 hour laundromat', 'open 24 hours');
    }
    if (services.some(s => s?.toLowerCase().includes('coin'))) {
      serviceTags.push('coin laundry', 'coin operated');
    }
    if (services.some(s => s?.toLowerCase().includes('fold'))) {
      serviceTags.push('wash and fold', 'laundry service');
    }
    if (services.some(s => s?.toLowerCase().includes('dry'))) {
      serviceTags.push('dry cleaning');
    }
    if (services.some(s => s?.toLowerCase().includes('card'))) {
      serviceTags.push('card operated', 'credit card payment');
    }
  }
  
  // Combine all tags and remove duplicates
  return [...new Set([...baseTags, ...locationTags, ...serviceTags])];
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  let description = `${record.name} is a convenient laundromat located in ${record.city}, ${record.state}. `;
  
  // Add address
  description += `Find us at ${record.address}, ${record.city}, ${record.state} ${record.zip}. `;
  
  // Add services if available
  if (record.services) {
    const services = Array.isArray(record.services) ? record.services : [record.services];
    if (services.length > 0) {
      description += `Our services include: ${services.join(', ')}. `;
    }
  }
  
  // Add hours if available
  if (record.hours) {
    description += `Hours of operation: ${record.hours}. `;
  }
  
  // Add contact info
  if (record.phone) {
    description += `Call us at ${record.phone}. `;
  }
  
  // Add SEO phrase
  description += 'Looking for a laundromat near me? We\'re conveniently located to serve all your laundry needs!';
  
  return description;
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  return `${record.name} - Laundromat in ${record.city}, ${record.state}`;
}

/**
 * Calculate premium score for a laundromat
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Rating score (0-20 points)
  if (record.rating) {
    score += Math.min(parseFloat(record.rating) * 4, 20);
  }
  
  // Review count (0-20 points)
  if (record.reviewCount) {
    score += Math.min(parseInt(record.reviewCount) / 5, 20);
  }
  
  // Services (0-20 points)
  if (record.services) {
    const services = Array.isArray(record.services) ? record.services : [record.services];
    score += Math.min(services.length * 2, 20);
  }
  
  // Website bonus (10 points)
  if (record.website) {
    score += 10;
  }
  
  // Hours bonus (10 points)
  if (record.hours) {
    score += 10;
  }
  
  // Photos bonus (0-10 points)
  if (record.photoCount) {
    score += Math.min(parseInt(record.photoCount), 10);
  }
  
  // Payment types bonus (0-10 points)
  if (record.acceptedPaymentTypes) {
    const paymentTypes = Array.isArray(record.acceptedPaymentTypes) 
      ? record.acceptedPaymentTypes 
      : [record.acceptedPaymentTypes];
    score += Math.min(paymentTypes.length * 2, 10);
  }
  
  // Ensure score is between 0-100
  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Run the large import process
 */
async function runLargeImport() {
  const startTime = Date.now();
  const client = await pool.connect();
  
  try {
    // Get current count
    const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const startingCount = parseInt(countResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Load Excel data
    console.log(`Reading Excel file: ${SOURCE_FILE}`);
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Read ${data.length} total records from Excel file`);
    
    // Filter records for the specified state
    const stateRecords = data.filter(record => 
      record.state && record.state.trim().toUpperCase() === STATE_TO_IMPORT
    );
    console.log(`Found ${stateRecords.length} records for ${STATE_TO_IMPORT} (${getStateNameFromAbbr(STATE_TO_IMPORT)})`);
    
    // Get existing records for this state
    const existingResult = await client.query(
      'SELECT COUNT(*) FROM laundromats WHERE state = $1',
      [STATE_TO_IMPORT]
    );
    const existingCount = parseInt(existingResult.rows[0].count);
    console.log(`Already have ${existingCount} records for ${STATE_TO_IMPORT} in the database`);
    
    // Start transaction
    await client.query('BEGIN');
    
    // Ensure state exists in states table
    const stateName = getStateNameFromAbbr(STATE_TO_IMPORT);
    console.log(`Ensuring state exists: ${STATE_TO_IMPORT} (${stateName})`);
    
    let stateId;
    const stateResult = await client.query(
      'SELECT id FROM states WHERE abbr = $1',
      [STATE_TO_IMPORT]
    );
    
    if (stateResult.rows.length > 0) {
      stateId = stateResult.rows[0].id;
      console.log(`Found existing state with ID: ${stateId}`);
    } else {
      const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
      const insertStateResult = await client.query(
        'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3) RETURNING id',
        [stateName, stateSlug, STATE_TO_IMPORT]
      );
      stateId = insertStateResult.rows[0].id;
      console.log(`Created new state with ID: ${stateId}`);
    }
    
    // Process records in a batch
    console.log(`Processing up to ${BATCH_SIZE} records...`);
    const recordsToProcess = stateRecords.slice(0, BATCH_SIZE);
    
    let insertedCount = 0;
    let cityCache = {};
    
    for (const record of recordsToProcess) {
      try {
        // Handle potential missing fields
        if (!record.city || !record.name) {
          console.log(`Skipping record with missing required fields: ${JSON.stringify(record)}`);
          continue;
        }
        
        // Get or create city
        let cityId;
        const cacheKey = `${record.city}-${stateName}`;
        
        if (cityCache[cacheKey]) {
          cityId = cityCache[cacheKey];
        } else {
          const cityResult = await client.query(
            'SELECT id FROM cities WHERE name = $1 AND state = $2',
            [record.city, stateName]
          );
          
          if (cityResult.rows.length > 0) {
            cityId = cityResult.rows[0].id;
          } else {
            const citySlug = record.city.toLowerCase().replace(/\s+/g, '-');
            const insertCityResult = await client.query(
              'INSERT INTO cities (name, slug, state, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
              [record.city, citySlug, stateName, 0]
            );
            cityId = insertCityResult.rows[0].id;
          }
          
          cityCache[cacheKey] = cityId;
        }
        
        // Generate additional fields
        const slug = generateSlug(record.name, record.city, STATE_TO_IMPORT);
        const seoTags = generateSeoTags(record);
        const seoTitle = generateSeoTitle(record);
        const seoDescription = generateSeoDescription(record);
        const premiumScore = calculatePremiumScore(record);
        
        // Insert laundromat
        const result = await client.query(`
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
        `, [
          record.name, slug, record.address, record.city, record.state, record.zip, record.phone, record.website,
          record.latitude, record.longitude, record.rating, record.reviewCount, record.photoCount,
          record.hours, Array.isArray(record.services) ? record.services : [record.services], 
          record.acceptedPaymentTypes, record.features, record.priceRange,
          seoTitle, seoDescription, seoTags, premiumScore,
          false, false, false, cityId
        ]);
        
        if (result.rows.length > 0) {
          insertedCount++;
          
          // Update city laundry count
          await client.query(
            'UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1',
            [cityId]
          );
        }
      } catch (error) {
        console.error(`Error processing record: ${error.message}`);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`
======== Import Summary ========
State: ${STATE_TO_IMPORT} (${getStateNameFromAbbr(STATE_TO_IMPORT)})
Starting count: ${startingCount}
Records processed: ${recordsToProcess.length}
Records inserted: ${insertedCount}
Final count: ${finalCount}
Total added: ${finalCount - startingCount}
Duration: ${duration} seconds
===============================
    `);
    
    // Check for remaining records
    const remainingCount = stateRecords.length - BATCH_SIZE;
    if (remainingCount > 0) {
      console.log(`There are ${remainingCount} more records for ${STATE_TO_IMPORT} that can be imported.`);
      console.log(`To import more records, change the BATCH_SIZE or run the script again.`);
    } else {
      console.log(`All records for ${STATE_TO_IMPORT} have been processed.`);
    }
    
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error(`Fatal error: ${error.message}`);
  } finally {
    client.release();
  }
}

// Run the import
console.log(`Starting large import for ${STATE_TO_IMPORT}...`);
runLargeImport().then(() => {
  console.log('Import process completed.');
  pool.end();
}).catch(error => {
  console.error(`Unhandled error: ${error.stack}`);
  pool.end(1);
});