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
  const cityState = city && state ? 
    `- ${city}, ${state}` : '';
  
  return `${name || 'Laundromat'} ${cityState} | Laundromat Near Me`;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(name, city, state) {
  const cityState = city && state ? 
    `in ${city}, ${state}` : '';
  
  return `${name || 'This laundromat'} is a laundromat ${cityState} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
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
  console.log(`Importing batch of ${records.length} records starting at index ${startIndex}`);
  
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
      
      // Generate SEO fields
      const seoTitle = generateSeoTitle(name, city, stateName);
      const seoDescription = generateSeoDescription(name, city, stateName);
      const seoTags = JSON.stringify(generateSeoTags(name, city, stateName));
      
      // Generate premium features (randomly assign some as premium/featured)
      const isPremium = Math.random() < 0.15;
      const isFeatured = Math.random() < 0.05; 
      const isVerified = Math.random() < 0.3;
      const premiumScore = Math.floor(Math.random() * 40) + 60; // Score between 60-100
      
      // Check if state exists, if not create it
      let stateIdResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
      let stateId;
      
      if (stateIdResult.rows.length === 0) {
        // Create state
        const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const stateInsertResult = await client.query(
          'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [stateName, stateAbbr.toUpperCase(), stateSlug]
        );
        stateId = stateInsertResult.rows[0].id;
      } else {
        stateId = stateIdResult.rows[0].id;
      }
      
      // Check if city exists, if not create it
      let cityIdResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, stateName]);
      let cityId;
      
      if (cityIdResult.rows.length === 0) {
        // Create city with unique slug
        const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000);
        const cityInsertResult = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [city, stateName, citySlug]
        );
        cityId = cityInsertResult.rows[0].id;
      } else {
        cityId = cityIdResult.rows[0].id;
      }
      
      // Insert laundromat
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
        isFeatured,
        isPremium,
        isVerified,
        `${name} is a laundromat located in ${city}, ${stateName}.`,
        new Date(),
        seoTitle,
        seoDescription,
        seoTags,
        premiumScore
      ]);
      
      // Update counts
      await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [cityId]);
      await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [stateId]);
      
      imported++;
      
      if (i % 10 === 0) {
        console.log(`Imported ${recordIndex}: ${name} (${city}, ${stateName})`);
      }
    } catch (error) {
      console.error(`Error importing #${recordIndex}:`, error.message);
      skipped++;
    }
  }
  
  return { imported, skipped };
}

/**
 * Import laundromats from all states
 */
async function importLaundromats() {
  let client;
  
  try {
    client = await pool.connect();
    
    console.log('Starting batch laundromat import...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.log('Available files:');
      console.log(fs.readdirSync(path.join(process.cwd(), 'attached_assets')));
      throw new Error('Excel file not found');
    }
    
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
    const startingCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Calculate how many to import (aim for at least 1000 total)
    const targetCount = Math.max(1000, startingCount + 500);
    const needToImport = targetCount - startingCount;
    console.log(`Need to import at least ${needToImport} more laundromats`);
    
    // Import a fair sample from each state
    let totalImported = 0;
    let totalSkipped = 0;
    
    // Calculate roughly how many from each state to reach our target
    const perState = Math.ceil(needToImport / stateList.length);
    console.log(`Aiming to import about ${perState} laundromats per state`);
    
    for (const stateAbbr of stateList) {
      // Skip if we've already imported enough
      if (totalImported >= needToImport) {
        break;
      }
      
      const records = stateData[stateAbbr];
      const stateName = getStateNameFromAbbr(stateAbbr);
      
      console.log(`\nProcessing ${stateName} (${records.length} records)...`);
      
      // Take a sample from this state
      const sampleSize = Math.min(perState, records.length);
      
      // Get a random sample
      const shuffled = [...records].sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, sampleSize);
      
      // Import this batch
      try {
        const { imported, skipped } = await importBatch(client, sample, totalImported);
        totalImported += imported;
        totalSkipped += skipped;
        
        console.log(`Imported ${imported} laundromats from ${stateName} (${skipped} skipped)`);
      } catch (error) {
        console.error(`Error processing ${stateName}:`, error);
      }
    }
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`\nImport completed! Stats:
    - Starting count: ${startingCount}
    - Target: ${targetCount}
    - Imported in this run: ${totalImported}
    - Final count: ${finalCount}
    - Skipped: ${totalSkipped}
    `);
    
    // Show state breakdown
    const stateBreakdown = await client.query('SELECT name, laundry_count FROM states ORDER BY laundry_count DESC LIMIT 10');
    console.log('\nTop 10 states by laundromat count:');
    for (const row of stateBreakdown.rows) {
      console.log(`${row.name}: ${row.laundry_count}`);
    }
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the import
console.time('Import Duration');
importLaundromats()
  .then(() => {
    console.timeEnd('Import Duration');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });