/**
 * Chunk Import Script for Laundromat Data
 * 
 * This script processes a small batch (50 records) at a time to avoid timeouts
 * and ensure reliable data import.
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

// Configuration - small batch size for fast completion
const BATCH_SIZE = 50; // Process 50 records at a time to avoid timeouts
const STATES_TO_PROCESS = ["TX", "CA", "NY"]; // Focus on top states first

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
 * Generate SEO tags for a laundromat - pre-enriched to save processing time
 */
function generateSeoTags(record) {
  const tags = [
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me"
  ];
  
  if (record.city) tags.push(`laundromat in ${record.city}`);
  if (record.state) tags.push(`laundromat in ${record.state}`);
  if (record.city && record.state) tags.push(`laundromat in ${record.city}, ${record.state}`);
  
  return tags;
}

/**
 * Generate a concise SEO title - pre-enriched to save processing time
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
 * Generate SEO description - pre-enriched to save processing time
 */
function generateSeoDescription(record) {
  const name = record.name || 'This laundromat';
  const city = record.city || 'the area';
  const state = record.state || '';
  const locationPhrase = state ? `${city}, ${state}` : city;
  
  return `${name} is a laundromat in ${locationPhrase} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
}

/**
 * Calculate a premium score based on ratings and features
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
    
    // Generate SEO fields
    const seoTitle = generateSeoTitle({ name, city, state: stateName });
    const seoDescription = generateSeoDescription({ name, city, state: stateName });
    const seoTags = JSON.stringify(generateSeoTags({ name, city, state: stateName }));
    
    // Calculate premium attributes
    const premiumScore = calculatePremiumScore(record);
    const isPremium = Math.random() < 0.15 || premiumScore >= 75;
    const isFeatured = Math.random() < 0.05 || premiumScore >= 90;
    const isVerified = Math.random() < 0.3 || premiumScore >= 80;
    
    // Generate unique ID for slug
    const uniqueId = Math.floor(Math.random() * 10000000);
    const slug = generateSlug(`${name}-${city}-${stateName}`, uniqueId);
    
    return {
      original: record,
      enriched: {
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
        services: record.services || [],
        isFeatured,
        isPremium,
        isVerified,
        description: `${name} is a laundromat located in ${city}, ${stateName}.`,
        seoTitle,
        seoDescription,
        seoTags,
        premiumScore
      }
    };
  });
}

/**
 * Ensure a state exists in the database
 */
async function ensureStateExists(client, stateName, stateAbbr) {
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
    return newStateResult.rows[0].id;
  } else {
    return stateResult.rows[0].id;
  }
}

/**
 * Ensure a city exists in the database
 */
async function ensureCityExists(client, cityName, stateName) {
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
      return newCityResult.rows[0].id;
    } catch (error) {
      // If error, try with even more unique slug
      const retrySlug = `${citySlug}-${Date.now()}`;
      const retryResult = await client.query(
        'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
        [cityName, stateName, retrySlug]
      );
      return retryResult.rows[0].id;
    }
  } else {
    return cityResult.rows[0].id;
  }
}

/**
 * Insert a batch of laundromats
 */
async function insertLaundromats(client, preparedRecords) {
  const results = {
    inserted: 0,
    skipped: 0
  };
  
  for (const item of preparedRecords) {
    const record = item.enriched;
    
    try {
      // Ensure state exists
      const stateId = await ensureStateExists(client, record.stateName, record.stateAbbr);
      
      // Ensure city exists
      const cityId = await ensureCityExists(client, record.city, record.stateName);
      
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
        JSON.stringify(record.services),
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
      
      results.inserted++;
      console.log(`Imported ${record.name} (${record.city}, ${record.stateName})`);
      
    } catch (error) {
      results.skipped++;
      console.error(`Error importing ${record.name}:`, error.message);
    }
  }
  
  return results;
}

/**
 * Process one state at a time
 */
async function processState(client, stateAbbr, records, offset = 0) {
  const stateRecords = records.filter(r => r.state === stateAbbr);
  
  if (stateRecords.length === 0) {
    console.log(`No records found for state ${stateAbbr}`);
    return { inserted: 0, skipped: 0 };
  }
  
  console.log(`Found ${stateRecords.length} records for state ${stateAbbr}`);
  
  // Take a batch from the offset
  const endOffset = Math.min(offset + BATCH_SIZE, stateRecords.length);
  const stateBatch = stateRecords.slice(offset, endOffset);
  
  console.log(`Processing batch of ${stateBatch.length} records for ${stateAbbr} (${offset} to ${endOffset})`);
  
  // Prepare the records (do data enrichment)
  const enrichedRecords = prepareRecords(stateBatch);
  
  // Insert the records
  const results = await insertLaundromats(client, enrichedRecords);
  
  console.log(`Completed batch for ${stateAbbr}: ${results.inserted} inserted, ${results.skipped} skipped`);
  return results;
}

/**
 * Run the import process
 */
async function runImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting chunk import for laundromat data...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Read ${allData.length} records from Excel file`);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Get state offsets - check if we've stored state import progress
    let stateOffsets = {};
    try {
      if (fs.existsSync('import-state-offsets.json')) {
        const offsetData = fs.readFileSync('import-state-offsets.json', 'utf8');
        stateOffsets = JSON.parse(offsetData);
      }
    } catch (error) {
      console.log('No previous offset data found, starting fresh');
    }
    
    // Begin transaction for the whole import
    await client.query('BEGIN');
    
    let totalResults = { inserted: 0, skipped: 0 };
    
    // Process each state
    for (const stateAbbr of STATES_TO_PROCESS) {
      const offset = stateOffsets[stateAbbr] || 0;
      const results = await processState(client, stateAbbr, allData, offset);
      
      totalResults.inserted += results.inserted;
      totalResults.skipped += results.skipped;
      
      // Update offset for this state
      stateOffsets[stateAbbr] = offset + BATCH_SIZE;
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Save state offsets for next run
    fs.writeFileSync('import-state-offsets.json', JSON.stringify(stateOffsets, null, 2));
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`
      Import completed!
      Starting count: ${currentCount}
      Records inserted: ${totalResults.inserted}
      Records skipped: ${totalResults.skipped}
      Final count: ${finalCount}
      Added: ${finalCount - currentCount} new records
    `);
    
    // Show state breakdown
    const stateBreakdown = await client.query('SELECT name, laundry_count FROM states ORDER BY laundry_count DESC LIMIT 10');
    console.log('\nTop 10 states by laundromat count:');
    for (const row of stateBreakdown.rows) {
      console.log(`${row.name}: ${row.laundry_count}`);
    }
    
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
    console.log('Import process completed. Run this script again to import more records.');
  })
  .catch(error => {
    console.error('Fatal error during import:', error);
    console.timeEnd('Import Duration');
  });