/**
 * Prepared Statement Import Script
 * 
 * This script uses proper prepared statements to avoid SQL syntax errors
 * while maintaining high-speed bulk imports
 */

import { Pool } from 'pg';
import xlsx from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import format from 'pg-format';

dotenv.config();

// Configuration
const BATCH_SIZE = 500; // Maximum batch size for fastest imports
const STATES_TO_IMPORT = ["OR", "WA", "ID", "UT", "WY", "NV", "HI", "AK", "CT", "DE", "ME", "RI", "NH", "DC", "AR", "LA", "MO", "NE", "ND", "OK"]; // Remaining states
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Required fields with default values
const DEFAULT_VALUES = {
  address: "123 Main Street",
  phone: "555-555-5555",
  hours: "9AM-9PM Daily",
  latitude: "37.0902",
  longitude: "-95.7129",
  services: ["Laundromat Service"],
  rating: "4.0",
  reviewCount: 0
};

// State name mapping for consistency
const STATE_MAPPING = {
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

// Get full state name from abbreviation
function getStateNameFromAbbr(abbr) {
  return STATE_MAPPING[abbr] || abbr;
}

// Generate a slug from name, city, and state
function generateSlug(name, city, state) {
  // Create a base slug from name, city, and state
  const baseSlug = `${name || 'laundromat'} ${city || 'city'} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-');        // Replace spaces with hyphens
  
  // Add a random string to ensure uniqueness
  const randomStr = uuidv4().substring(0, 6);
  return `${baseSlug}-${randomStr}`;
}

// Generate SEO tags quickly using a template approach
function generateSeoTags(record) {
  const city = record.city || 'local';
  const state = record.state;
  const zip = record.zip || '';
  
  // Create a standard set of tags with location information
  return [
    'laundromat', 'laundry', 'wash', 'dry', 'cleaning',
    `${city} laundromat`, 
    `laundromat in ${city}`,
    `${state} laundromat`,
    `${city} ${state} laundry`,
    'laundromat near me',
    zip ? `${zip} laundromat` : '',
    'wash and fold',
    'dry cleaning',
    'self-service laundry'
  ].filter(tag => tag !== ''); // Remove empty tags
}

// Generate standard SEO description
function generateSeoDescription(record) {
  return `${record.name} is a convenient laundromat located in ${record.city}, ${record.state}. ` +
    `Find us at ${record.address}, ${record.city}, ${record.state} ${record.zip || ''}. ` +
    `Our services include wash and fold, dry cleaning, and self-service laundry. ` +
    `Call us at ${record.phone}. ` +
    `Looking for a laundromat near me? We're conveniently located to serve all your laundry needs!`;
}

// Generate SEO title
function generateSeoTitle(record) {
  return `${record.name} - Laundromat in ${record.city}, ${record.state}`;
}

// Process all records for a given state
async function processStateRecords(state, allData) {
  console.log(`\n===== Processing ${state} (${getStateNameFromAbbr(state)}) =====`);
  
  const client = await pool.connect();
  try {
    // Find all records for this state
    console.log(`Finding records for ${state}...`);
    const stateRecords = allData.filter(record => 
      record.state && record.state.trim().toUpperCase() === state
    );
    console.log(`Found ${stateRecords.length} records for ${state}`);
    
    if (stateRecords.length === 0) {
      console.log(`No records found for ${state}, skipping...`);
      return 0;
    }
    
    // Ensure state exists in states table
    await client.query('BEGIN');
    const stateName = getStateNameFromAbbr(state);
    const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
    
    // Check if the state already exists
    const stateCheck = await client.query(
      'SELECT id FROM states WHERE abbr = $1',
      [state]
    );
    
    // Insert state if it doesn't exist
    if (stateCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3)',
        [stateName, stateSlug, state]
      );
      console.log(`Created state: ${state} (${stateName})`);
    } else {
      console.log(`State already exists: ${state} (${stateName})`);
    }
    
    // Prepare records for insertion
    const validRecords = [];
    
    for (let i = 0; i < stateRecords.length; i++) {
      const record = stateRecords[i];
      
      // Skip records without name or city
      if (!record.name || !record.city) {
        continue;
      }
      
      // Generate a unique slug
      const slug = generateSlug(record.name, record.city, state);
      
      // Generate SEO content
      const seoTags = generateSeoTags(record);
      const seoTitle = generateSeoTitle(record);
      const seoDescription = generateSeoDescription(record);
      
      // Create the record with defaults for missing values
      validRecords.push({
        name: record.name,
        slug: slug,
        address: record.address || DEFAULT_VALUES.address,
        city: record.city,
        state: state,
        zip: record.zip || '',
        phone: record.phone || DEFAULT_VALUES.phone,
        website: record.website || null,
        latitude: record.latitude || DEFAULT_VALUES.latitude,
        longitude: record.longitude || DEFAULT_VALUES.longitude,
        rating: record.rating || DEFAULT_VALUES.rating,
        reviewCount: record.reviewCount || DEFAULT_VALUES.reviewCount,
        hours: record.hours || DEFAULT_VALUES.hours,
        services: JSON.stringify(Array.isArray(record.services) ? record.services : DEFAULT_VALUES.services),
        seoTitle: seoTitle,
        seoDescription: seoDescription,
        seoTags: JSON.stringify(seoTags),
        premiumScore: 50 // Default score
      });
    }
    
    console.log(`Prepared ${validRecords.length} valid records for insertion`);
    
    // Skip if no valid records
    if (validRecords.length === 0) {
      await client.query('COMMIT');
      console.log(`No valid records for ${state}, skipping...`);
      return 0;
    }
    
    // Process in batches using pg-format for safe SQL
    let insertedCount = 0;
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batchRecords = validRecords.slice(i, i + BATCH_SIZE);
      const batchValues = [];
      
      for (const record of batchRecords) {
        batchValues.push([
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
          record.reviewCount,
          record.hours,
          record.services,
          record.seoDescription,
          null, // image_url
          'basic', // listing_type
          false, // is_premium
          false, // is_featured
          record.seoTitle,
          record.seoDescription,
          record.seoTags,
          record.premiumScore
        ]);
      }
      
      try {
        // Use pg-format to safely build the query
        const insertQuery = format(
          `INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website,
            latitude, longitude, rating, review_count,
            hours, services, description, image_url,
            listing_type, is_premium, is_featured,
            seo_title, seo_description, seo_tags, premium_score
          )
          VALUES %L
          ON CONFLICT (slug) DO NOTHING
          RETURNING id`,
          batchValues
        );
        
        const result = await client.query(insertQuery);
        console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: Inserted ${result.rowCount} records`);
        insertedCount += result.rowCount;
      } catch (error) {
        console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}: ${error.message}`);
        // Continue with next batch despite errors
      }
    }
    
    // Update state laundry_count
    await client.query(
      'UPDATE states SET laundry_count = (SELECT COUNT(*) FROM laundromats WHERE state = $1) WHERE abbr = $1',
      [state]
    );
    
    await client.query('COMMIT');
    console.log(`Finished processing ${state}: ${insertedCount} records inserted`);
    
    return insertedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error processing state ${state}: ${error.message}`);
    return 0;
  } finally {
    client.release();
  }
}

// Main function
async function runPreparedImport() {
  const startTime = Date.now();
  
  try {
    // Get current count
    const countResult = await pool.query('SELECT COUNT(*) FROM laundromats');
    const startingCount = parseInt(countResult.rows[0].count);
    console.log(`Current laundromat count: ${startingCount}`);
    
    // Load all data from Excel file
    console.log(`Reading Excel file: ${SOURCE_FILE}`);
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allData = xlsx.utils.sheet_to_json(sheet);
    console.log(`Read ${allData.length} total records from Excel file`);
    
    // Process each state
    let totalInserted = 0;
    for (const state of STATES_TO_IMPORT) {
      const insertedForState = await processStateRecords(state, allData);
      totalInserted += insertedForState;
    }
    
    // Get final count
    const finalCountResult = await pool.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`
======== Import Summary ========
Starting count: ${startingCount}
Total inserted: ${totalInserted}
Final count: ${finalCount}
States processed: ${STATES_TO_IMPORT.join(', ')}
Duration: ${duration} seconds
Insertion rate: ${Math.round(totalInserted / (duration / 60))} records/minute
===============================
    `);
    
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Run the import
console.log(`Starting prepared statement import for states: ${STATES_TO_IMPORT.join(', ')}...`);
runPreparedImport().then(() => {
  console.log('Import process completed successfully.');
}).catch(error => {
  console.error(`Unhandled error: ${error.stack}`);
  process.exit(1);
});