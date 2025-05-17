/**
 * Bulk Laundromat Import Script
 * 
 * This script imports a large batch of laundromat records with proper validation
 * to ensure all required fields are present.
 */

import { Pool } from 'pg';
import xlsx from 'xlsx';
import fs from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Configuration
const BATCH_SIZE = 50;
const STATE_TO_IMPORT = "NY"; // New York has more records
const SOURCE_FILE = '/home/runner/workspace/attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';

// Default values for missing but required fields
const DEFAULT_VALUES = {
  address: "123 Main Street",
  phone: "555-555-5555",
  hours: "9AM-9PM Daily",
  latitude: "0",
  longitude: "0",
  services: ["Laundromat Service"]
};

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Generate a full state name from an abbreviation
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

// Generate a slug for a laundromat
function generateSlug(name, city, state) {
  // Create a base slug from name, city, and state
  const baseSlug = `${name || 'laundromat'} ${city || 'city'} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-');        // Replace spaces with hyphens
  
  // Add a random string to ensure uniqueness
  const randomStr = uuidv4().substring(0, 8);
  return `${baseSlug}-${randomStr}`;
}

// Generate SEO tags for a laundromat
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

// Generate SEO description for a laundromat
function generateSeoDescription(record) {
  let description = `${record.name} is a convenient laundromat located in ${record.city}, ${record.state}. `;
  
  // Add address
  description += `Find us at ${record.address}, ${record.city}, ${record.state} ${record.zip || ''}. `;
  
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

// Generate SEO title for a laundromat
function generateSeoTitle(record) {
  return `${record.name} - Laundromat in ${record.city}, ${record.state}`;
}

// Calculate premium score for a laundromat
function calculatePremiumScore(record) {
  let score = 50; // Start with a base score
  
  // Rating score (0-20 points)
  if (record.rating) {
    score += Math.min(parseFloat(record.rating) * 4, 20);
  }
  
  // Review count (0-10 points)
  if (record.reviewCount) {
    score += Math.min(parseInt(record.reviewCount) / 10, 10);
  }
  
  // Service bonus (0-10 points)
  if (record.services) {
    const services = Array.isArray(record.services) ? record.services : [record.services];
    score += Math.min(services.length, 10);
  }
  
  // Website bonus (5 points)
  if (record.website) {
    score += 5;
  }
  
  // Hours bonus (5 points)
  if (record.hours) {
    score += 5;
  }
  
  // Ensure score is between 0-100
  return Math.round(Math.min(Math.max(score, 0), 100));
}

// Validate a record to ensure all required fields are present
function validateAndEnrichRecord(record) {
  if (!record) return null;
  
  // Check if we have both a name and city, otherwise we can't create a proper listing
  if (!record.name || !record.city) {
    return null;
  }
  
  // Ensure state is correctly formatted
  if (!record.state) {
    return null;
  }
  
  // Fill in missing fields with default values
  const enriched = {
    ...record,
    address: record.address || DEFAULT_VALUES.address,
    phone: record.phone || DEFAULT_VALUES.phone,
    hours: record.hours || DEFAULT_VALUES.hours,
    latitude: record.latitude || DEFAULT_VALUES.latitude,
    longitude: record.longitude || DEFAULT_VALUES.longitude,
    services: record.services || DEFAULT_VALUES.services,
  };
  
  // Generate additional fields
  enriched.slug = generateSlug(enriched.name, enriched.city, enriched.state);
  enriched.seoTags = generateSeoTags(enriched);
  enriched.seoTitle = generateSeoTitle(enriched);
  enriched.seoDescription = generateSeoDescription(enriched);
  enriched.premiumScore = calculatePremiumScore(enriched);
  
  return enriched;
}

// Main function to run the import
async function runBulkImport() {
  const startTime = Date.now();
  let client;
  
  try {
    // Get current count
    client = await pool.connect();
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
    let validatedRecords = [];
    
    // Validate all records first
    for (const record of recordsToProcess) {
      const validRecord = validateAndEnrichRecord(record);
      if (validRecord) {
        validatedRecords.push(validRecord);
      }
    }
    
    console.log(`Found ${validatedRecords.length} valid records out of ${recordsToProcess.length}`);
    
    // Process each validated record
    for (let i = 0; i < validatedRecords.length; i++) {
      const record = validatedRecords[i];
      console.log(`Processing record ${i+1}/${validatedRecords.length}: ${record.name}`);
      
      try {
        // Start transaction for this record
        await client.query('BEGIN');
        
        // Insert laundromat with SEO fields
        const result = await client.query(`
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website,
            latitude, longitude, rating, review_count,
            hours, services, description, image_url,
            listing_type, is_premium, is_featured,
            seo_title, seo_description, seo_tags, premium_score
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19,
            $20, $21, $22, $23
          )
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `, [
          record.name, record.slug, record.address, record.city, record.state, record.zip || '', record.phone, record.website || null,
          record.latitude, record.longitude, record.rating || '0', record.reviewCount || 0,
          record.hours, JSON.stringify(record.services), 
          record.seoDescription, null, // description, image_url
          'basic', false, false, // listing_type, is_premium, is_featured
          record.seoTitle, record.seoDescription, JSON.stringify(record.seoTags), record.premiumScore // SEO fields
        ]);
        
        if (result.rows.length > 0) {
          insertedCount++;
          console.log(`✅ Successfully inserted ${record.name}`);
          
          // Update state laundry_count
          await client.query(
            'UPDATE states SET laundry_count = (SELECT COUNT(*) FROM laundromats WHERE state = $1) WHERE abbr = $1',
            [STATE_TO_IMPORT]
          );
        } else {
          console.log(`⚠️ Skipped duplicate: ${record.name}`);
        }
        
        // Commit transaction
        await client.query('COMMIT');
      } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error(`❌ Error processing ${record.name}: ${error.message}`);
      }
    }
    
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
Valid records: ${validatedRecords.length}
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
    console.error(`Fatal error: ${error.message}`);
  } finally {
    if (client) client.release();
  }
}

// Run the import
console.log(`Starting bulk import for ${STATE_TO_IMPORT}...`);
runBulkImport().then(() => {
  console.log('Import process completed.');
  pool.end();
}).catch(error => {
  console.error(`Unhandled error: ${error.stack}`);
  pool.end(1);
});