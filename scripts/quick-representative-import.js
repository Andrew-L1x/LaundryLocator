/**
 * Quick Representative Data Import
 * 
 * This script imports a representative sample of laundromats from every state
 * to provide quick testing data while the full import runs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Source file
const SOURCE_FILE = path.join(cwd, 'data/import_ready_laundromats.json');

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Statistics tracking
let stats = {
  total: 0,
  imported: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now()
};

// State mapping
const STATE_ABBR_MAP = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
  'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
  'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
  'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
  'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
  'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
  'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
};

// State name map (reverse of the above)
const STATE_NAME_MAP = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

/**
 * Import data for every state
 */
async function importRepresentativeData() {
  try {
    console.log(`Reading data file: ${SOURCE_FILE}`);
    
    // Read the JSON file
    const fileData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    
    if (!Array.isArray(fileData)) {
      throw new Error('File data must be an array');
    }
    
    // Normalize state abbreviations
    console.log('Normalizing record data...');
    const normalizedData = fileData.map(record => {
      try {
        // Get proper state abbreviation
        let stateAbbr = record.state;
        if (stateAbbr && stateAbbr.length > 2) {
          stateAbbr = STATE_ABBR_MAP[stateAbbr.toUpperCase()] || stateAbbr;
        } else if (stateAbbr && stateAbbr.length === 2) {
          stateAbbr = stateAbbr.toUpperCase();
        }
        
        return {
          ...record,
          state: stateAbbr
        };
      } catch (err) {
        console.error('Error normalizing record:', err);
        return record;
      }
    });
    
    // Select a representative sample from each state
    console.log('Selecting representative samples...');
    const sampleSize = 5; // Records per state
    const stateData = {};
    
    // Group data by state
    for (const record of normalizedData) {
      if (!record.state) continue;
      
      const state = record.state.toUpperCase();
      if (!stateData[state]) {
        stateData[state] = [];
      }
      
      if (stateData[state].length < sampleSize) {
        stateData[state].push(record);
      }
    }
    
    // Combine all state samples
    const sampleData = [];
    for (const state in stateData) {
      sampleData.push(...stateData[state]);
    }
    
    stats.total = sampleData.length;
    console.log(`Selected ${stats.total} representative records from ${Object.keys(stateData).length} states`);
    
    // Import the sample data
    for (const record of sampleData) {
      try {
        const result = await importRecord(record);
        if (result) {
          stats.imported++;
        } else {
          stats.skipped++;
        }
      } catch (err) {
        console.error(`Error importing record ${record.name}:`, err.message);
        stats.errors++;
      }
    }
    
    const elapsedTime = (Date.now() - stats.startTime) / 1000;
    console.log(`\nRepresentative import completed in ${elapsedTime.toFixed(2)} seconds`);
    console.log(`Total records: ${stats.total}`);
    console.log(`Imported: ${stats.imported}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
    return stats;
  } catch (error) {
    console.error('Import error:', error.message);
    throw error;
  }
}

/**
 * Import a single record
 */
async function importRecord(record) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Prepare JSON fields
    const services = Array.isArray(record.services) 
      ? JSON.stringify(record.services) 
      : JSON.stringify(['Self-service laundry', 'Coin-operated washing machines']);
      
    const amenities = Array.isArray(record.amenities) 
      ? JSON.stringify(record.amenities) 
      : JSON.stringify(['Vending machines', 'Seating area']);
      
    const machineCount = record.machineCount 
      ? JSON.stringify(record.machineCount) 
      : JSON.stringify({ washers: Math.floor(Math.random() * 20) + 10, dryers: Math.floor(Math.random() * 15) + 8 });
      
    // Create or find the city
    const cityName = record.city;
    const stateAbbr = record.state;
    let cityId = null;
    
    if (cityName && stateAbbr) {
      const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;
      
      // Try to find existing city
      const cityResult = await client.query(
        'SELECT id FROM cities WHERE slug = $1',
        [citySlug]
      );
      
      if (cityResult.rows.length > 0) {
        cityId = cityResult.rows[0].id;
      } else {
        // Create a new city
        try {
          const newCityResult = await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
            [cityName, stateAbbr, citySlug]
          );
          cityId = newCityResult.rows[0].id;
        } catch (err) {
          console.error(`Error creating city ${cityName}, ${stateAbbr}:`, err.message);
        }
      }
    }
    
    // Insert the laundromat
    const result = await client.query(`
      INSERT INTO laundromats (
        name, slug, address, city, state, zip, phone, website, 
        latitude, longitude, rating, review_count, hours, 
        services, amenities, machine_count, listing_type, is_featured,
        verified, image_url, description, created_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `, [
      record.name,
      record.slug,
      record.address,
      record.city,
      record.state,
      record.zip,
      record.phone,
      record.website,
      record.latitude,
      record.longitude,
      record.rating,
      record.reviewCount || 0,
      record.hours || "Monday-Sunday: 8:00AM-8:00PM",
      services,
      amenities,
      machineCount,
      record.listingType || 'basic',
      record.isFeatured || false,
      record.verified || true,
      record.imageUrl,
      record.seoDescription || record.description || '',
      new Date()
    ]);
    
    let success = false;
    
    if (result.rowCount > 0) {
      // Update city count if we have a city
      if (cityId) {
        await client.query(
          'UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1',
          [cityId]
        );
      }
      
      // Update state count
      if (stateAbbr) {
        await client.query(
          'UPDATE states SET laundry_count = laundry_count + 1 WHERE abbr = $1',
          [stateAbbr]
        );
      }
      
      success = true;
    }
    
    await client.query('COMMIT');
    return success;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Start the import
console.log('=== Starting Representative Data Import ===');
importRepresentativeData()
  .then(() => {
    console.log('Import completed successfully!');
    pool.end();
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    pool.end();
    process.exit(1);
  });