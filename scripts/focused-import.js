/**
 * Focused Laundromat Import Script
 * 
 * This script imports a smaller batch of records (100) with rich data enrichment
 * to quickly add more quality data to the database.
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

// Configuration - smaller batch for quicker completion
const BATCH_SIZE = 20; // Process just 20 records at a time
const TOTAL_TARGET = 100; // Only import 100 records in this run

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
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  return [
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me",
    `laundromat in ${record.city || 'local area'}`,
    `laundromat in ${record.state || 'your area'}`,
    `laundry service in ${record.city || 'local area'}`
  ];
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  return `${record.name || 'Laundromat'} in ${record.city || 'Local Area'}, ${record.state || ''} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  return `${record.name || 'This laundromat'} is a laundromat in ${record.city || 'the local area'}, ${record.state || ''} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
}

/**
 * Calculate premium score for a laundromat
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
  
  // Cap score at 100
  return Math.min(100, Math.round(score));
}

/**
 * Prepare a state for the database
 */
async function ensureStateExists(client, stateAbbr) {
  const stateName = getStateNameFromAbbr(stateAbbr);
  
  // Check if state exists
  const stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
  
  if (stateResult.rows.length === 0) {
    // Create state
    const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const abbr = stateAbbr.length <= 2 ? stateAbbr.toUpperCase() : stateAbbr;
    
    const newStateResult = await client.query(
      'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
      [stateName, abbr, stateSlug]
    );
    
    console.log(`Created state: ${stateName}`);
    return { id: newStateResult.rows[0].id, name: stateName };
  } else {
    return { id: stateResult.rows[0].id, name: stateName };
  }
}

/**
 * Prepare a city for the database
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
      if (error.code === '23505') {
        const retryResult = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [cityName, stateName, `${citySlug}-${Date.now()}`]
        );
        return retryResult.rows[0].id;
      } else {
        throw error;
      }
    }
  } else {
    return cityResult.rows[0].id;
  }
}

/**
 * Import a batch of laundromats
 */
async function importBatch(client, records) {
  let imported = 0;
  let skipped = 0;
  
  for (const record of records) {
    try {
      // Get basic info
      const name = record.name || `Laundromat ${Math.floor(Math.random() * 10000)}`;
      const address = record.address || '123 Main St';
      const cityName = record.city || 'Unknown City';
      const stateAbbr = record.state || 'TX';
      const zip = record.zip || '00000';
      
      // Ensure state exists
      const state = await ensureStateExists(client, stateAbbr);
      const stateName = state.name;
      const stateId = state.id;
      
      // Ensure city exists
      const cityId = await ensureCityExists(client, cityName, stateName);
      
      // Generate a unique slug
      const uniqueId = Math.floor(Math.random() * 10000000);
      const slug = generateSlug(`${name}-${cityName}-${stateName}`, uniqueId);
      
      // Generate SEO fields
      const seoTitle = generateSeoTitle({ name, city: cityName, state: stateName });
      const seoDescription = generateSeoDescription({ name, city: cityName, state: stateName });
      const seoTags = JSON.stringify(generateSeoTags({ name, city: cityName, state: stateName }));
      
      // Calculate premium attributes
      const premiumScore = calculatePremiumScore(record);
      const isPremium = Math.random() < 0.15 || premiumScore >= 80;
      const isFeatured = Math.random() < 0.05 || premiumScore >= 90;
      const isVerified = Math.random() < 0.3 || premiumScore >= 85;
      
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
        name,
        slug,
        address,
        cityName,
        stateName,
        zip,
        record.phone || '',
        record.website || null,
        record.latitude || '0',
        record.longitude || '0',
        record.rating || '0',
        record.review_count || 0,
        record.hours || 'Call for hours',
        JSON.stringify(record.services || []),
        isFeatured,
        isPremium,
        isVerified,
        `${name} is a laundromat located in ${cityName}, ${stateName}.`,
        new Date(),
        seoTitle,
        seoDescription,
        seoTags,
        premiumScore
      ]);
      
      // Update counts
      await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
      await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
      
      console.log(`Imported ${name} (${cityName}, ${stateName})`);
      imported++;
      
    } catch (error) {
      console.error(`Error importing record:`, error.message);
      skipped++;
    }
  }
  
  return { imported, skipped };
}

/**
 * Run the import process
 */
async function runImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting focused laundromat import...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Take a sample from all data
    const sampledRecords = allData
      .sort(() => 0.5 - Math.random()) // Shuffle
      .slice(0, TOTAL_TARGET);  // Take first 100
    
    console.log(`Selected ${sampledRecords.length} random records for import`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Process in batches
    let totalImported = 0;
    let totalSkipped = 0;
    const batches = Math.ceil(sampledRecords.length / BATCH_SIZE);
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, sampledRecords.length);
      const batch = sampledRecords.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${batches} (${batch.length} records)...`);
      
      try {
        const { imported, skipped } = await importBatch(client, batch);
        totalImported += imported;
        totalSkipped += skipped;
      } catch (error) {
        console.error(`Error in batch ${i + 1}:`, error.message);
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`\nImport completed!
    - Starting count: ${currentCount}
    - Successfully imported: ${totalImported}
    - Skipped: ${totalSkipped}
    - Final count: ${finalCount}
    - Added: ${finalCount - currentCount} records
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
    console.error('Error during import:', error);
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
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });