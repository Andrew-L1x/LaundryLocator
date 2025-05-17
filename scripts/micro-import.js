/**
 * Micro Import Script for Laundromat Data
 * 
 * This script imports a very small batch (20 records) to ensure it completes
 * within the execution time limits.
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

// Target states - just a few to focus on
const TARGET_STATES = ["FL", "IL", "PA"]; // Next set after TX, CA, NY

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  const stateMap = {
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
  
  if (!abbr) return 'Unknown State';
  if (abbr.length > 2) return abbr; // Already a full name
  return stateMap[abbr.toUpperCase()] || abbr;
}

/**
 * Run the micro import process
 */
async function runMicroImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting micro laundromat import...');
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${allData.length} records in Excel file`);
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Sample records from target states - take just 20 in total
    let selectedRecords = [];
    for (const stateAbbr of TARGET_STATES) {
      const stateRecords = allData.filter(r => r.state === stateAbbr);
      if (stateRecords.length > 0) {
        console.log(`Found ${stateRecords.length} records for ${stateAbbr}`);
        // Take up to 7 records from each state (7*3 = 21 max)
        const stateSample = stateRecords.slice(0, 7);
        selectedRecords = selectedRecords.concat(stateSample);
      }
    }
    
    // Limit to 20 total
    selectedRecords = selectedRecords.slice(0, 20);
    console.log(`Selected ${selectedRecords.length} records to import`);
    
    // Process each record
    let importedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < selectedRecords.length; i++) {
      const record = selectedRecords[i];
      
      try {
        // Get basic info
        const name = record.name || `Laundromat ${Math.floor(Math.random() * 10000)}`;
        const address = record.address || '123 Main St';
        const city = record.city || 'Unknown City';
        const stateAbbr = record.state || 'TX';
        const stateName = getStateNameFromAbbr(stateAbbr);
        const zip = record.zip || '00000';
        
        // Generate a slug
        const uniqueId = Math.floor(Math.random() * 10000000);
        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uniqueId}`;
        
        // Check if state exists
        let stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
        let stateId;
        
        if (stateResult.rows.length === 0) {
          // Create state
          const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const stateInsertResult = await client.query(
            'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
            [stateName, stateAbbr.toUpperCase(), stateSlug]
          );
          stateId = stateInsertResult.rows[0].id;
          console.log(`Created state: ${stateName}`);
        } else {
          stateId = stateResult.rows[0].id;
        }
        
        // Check if city exists
        let cityResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, stateName]);
        let cityId;
        
        if (cityResult.rows.length === 0) {
          // Create city
          const citySlug = `${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uniqueId}`;
          const cityInsertResult = await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
            [city, stateName, citySlug]
          );
          cityId = cityInsertResult.rows[0].id;
          console.log(`Created city: ${city}, ${stateName}`);
        } else {
          cityId = cityResult.rows[0].id;
        }
        
        // Generate SEO fields
        const seoTitle = `${name} in ${city}, ${stateName} | Laundromat Near Me`;
        const seoDescription = `${name} is a laundromat in ${city}, ${stateName} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
        const seoTags = JSON.stringify([
          "laundromat",
          "laundry",
          "coin laundry",
          "laundromat near me",
          `laundromat in ${city}`,
          `laundromat in ${stateName}`,
          `laundromat in ${city}, ${stateName}`
        ]);
        
        // Calculate premium score
        let premiumScore = 70; // Base score
        if (record.rating) {
          premiumScore += parseFloat(record.rating) * 5;
        }
        if (record.website) {
          premiumScore += 5;
        }
        premiumScore = Math.min(100, Math.round(premiumScore));
        
        // Set premium attributes based on score
        const isPremium = Math.random() < 0.15 || premiumScore >= 75;
        const isFeatured = Math.random() < 0.05 || premiumScore >= 90;
        const isVerified = Math.random() < 0.3 || premiumScore >= 80;
        
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
        
        console.log(`Imported ${i+1}/${selectedRecords.length}: ${name} (${city}, ${stateName})`);
        importedCount++;
        
      } catch (error) {
        console.error(`Error importing record #${i+1}:`, error.message);
        skippedCount++;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`
      Import completed successfully!
      - Starting count: ${currentCount}
      - Imported: ${importedCount}
      - Skipped: ${skippedCount}
      - Final count: ${finalCount}
      - Added: ${finalCount - currentCount} new records
    `);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error during import:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.time('Import Duration');
runMicroImport()
  .then(() => {
    console.timeEnd('Import Duration');
    console.log('Micro import completed. Run this script again for more imports.');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });