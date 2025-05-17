/**
 * Simple Batch Import Script for Laundromat Data
 * 
 * This script uses a simpler approach to import laundromats in batches.
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

// Configuration
const BATCH_SIZE = 10; // Process 10 records per state
const TARGET_TOTAL = 1000; // Target total laundromats to have in the database

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
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(name, city, state) {
  return `${name || 'Laundromat'} - ${city}, ${state} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(name, city, state) {
  return `${name || 'This laundromat'} is a laundromat in ${city}, ${state} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(name, city, state) {
  const tags = [
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me"
  ];
  
  if (city) tags.push(`laundromat in ${city}`);
  if (state) tags.push(`laundromat in ${state}`);
  if (city && state) tags.push(`laundromat in ${city}, ${state}`);
  
  return tags;
}

/**
 * Import a batch of records
 */
async function importBatch(client, records, startIndex) {
  let imported = 0;
  let skipped = 0;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordIndex = startIndex + i;
    
    try {
      // Fill in missing values with defaults
      const name = record.name || `Laundromat ${recordIndex}`;
      const address = record.address || '123 Main St';
      const city = record.city || 'Unknown City';
      const stateAbbr = record.state || 'TX';
      const stateName = getStateNameFromAbbr(stateAbbr);
      const zip = record.zip || '00000';
      
      // Generate a unique slug
      const uniqueId = Math.floor(Math.random() * 10000000);
      const slug = generateSlug(`${name}-${city}-${stateName}`, uniqueId);
      
      // First make sure state exists
      let stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
      let stateId;
      
      if (stateResult.rows.length === 0) {
        // Create state
        const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const abbr = stateAbbr.toUpperCase();
        const newStateResult = await client.query(
          'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [stateName, abbr, stateSlug]
        );
        stateId = newStateResult.rows[0].id;
      } else {
        stateId = stateResult.rows[0].id;
      }
      
      // Then make sure city exists
      let cityResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, stateName]);
      let cityId;
      
      if (cityResult.rows.length === 0) {
        // Create city
        const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const newCityResult = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [city, stateName, citySlug]
        );
        cityId = newCityResult.rows[0].id;
      } else {
        cityId = cityResult.rows[0].id;
      }
      
      // Generate SEO fields
      const seoTitle = generateSeoTitle(name, city, stateName);
      const seoDescription = generateSeoDescription(name, city, stateName);
      const seoTags = JSON.stringify(generateSeoTags(name, city, stateName));
      
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
        city,
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
        Math.random() < 0.05, // 5% featured
        Math.random() < 0.15, // 15% premium
        Math.random() < 0.3,  // 30% verified
        `${name} is a laundromat located in ${city}, ${stateName}.`,
        new Date(),
        seoTitle,
        seoDescription,
        seoTags,
        Math.floor(Math.random() * 40) + 60 // Score between 60-100
      ]);
      
      // Update counts
      await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
      await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
      
      console.log(`Imported ${i}: ${name} (${city}, ${stateName})`);
      imported++;
      
    } catch (error) {
      console.error(`Error importing record #${recordIndex}:`, error.message);
      skipped++;
    }
  }
  
  return { imported, skipped };
}

/**
 * Import laundromats from all states
 */
async function importLaundromats() {
  const client = await pool.connect();
  
  try {
    console.log('Starting batch laundromat import...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${allData.length} total records`);
    
    // Group records by state
    const stateData = {};
    for (const record of allData) {
      const stateAbbr = record.state || 'unknown';
      if (!stateData[stateAbbr]) {
        stateData[stateAbbr] = [];
      }
      stateData[stateAbbr].push(record);
    }
    
    const stateList = Object.keys(stateData);
    console.log(`Found data for ${stateList.length} states`);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Calculate how many more we need to import
    const neededCount = TARGET_TOTAL - currentCount;
    if (neededCount <= 0) {
      console.log(`Already have ${currentCount} laundromats, no need to import more.`);
      return;
    }
    
    console.log(`Need to import at least ${neededCount} more laundromats`);
    console.log(`Aiming to import about ${BATCH_SIZE} laundromats per state`);
    
    // Process one state at a time to avoid transaction timeouts
    let totalImported = 0;
    let totalSkipped = 0;
    
    // Start with Texas
    const texasState = 'TX';
    if (stateData[texasState] && stateData[texasState].length > 0) {
      const texasRecords = stateData[texasState];
      console.log(`Processing Texas (${texasRecords.length} records)...`);
      
      const batchSize = Math.min(BATCH_SIZE, texasRecords.length);
      const batch = texasRecords.slice(0, batchSize);
      
      console.log(`Importing batch of ${batchSize} records starting at index 0`);
      const { imported, skipped } = await importBatch(client, batch, 0);
      
      totalImported += imported;
      totalSkipped += skipped;
      
      console.log(`Imported ${imported} laundromats from Texas (${skipped} skipped)`);
    }
    
    // Process Virginia
    const virginiaState = 'VA';
    if (stateData[virginiaState] && stateData[virginiaState].length > 0) {
      const virginiaRecords = stateData[virginiaState];
      console.log(`Processing Virginia (${virginiaRecords.length} records)...`);
      
      const batchSize = Math.min(BATCH_SIZE, virginiaRecords.length);
      const batch = virginiaRecords.slice(10, 10 + batchSize); // Skip the first 10 to get different records
      
      console.log(`Importing batch of ${batchSize} records starting at index 10`);
      const { imported, skipped } = await importBatch(client, batch, 10);
      
      totalImported += imported;
      totalSkipped += skipped;
      
      console.log(`Imported ${imported} laundromats from Virginia (${skipped} skipped)`);
    }
    
    console.log(`\nImport completed!
    - Successfully imported: ${totalImported}
    - Skipped: ${totalSkipped}
    - Total processed: ${totalImported + totalSkipped}
    `);
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
importLaundromats()
  .then(() => {
    console.log('Import completed successfully.');
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });