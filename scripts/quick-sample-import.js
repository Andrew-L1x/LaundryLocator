/**
 * Quick Sample Import Script
 * 
 * This script imports a small representative sample of laundromats (2-3 per state)
 * to allow for immediate testing while the full import runs in the background
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';
const { Pool } = pg;

// Define the utility functions directly since we can't import from CJS

/**
 * Convert state abbreviation to full name
 */
function getStateNameFromAbbr(abbr) {
  const stateMap = {
    'AL': 'Alabama',
    'AK': 'Alaska',
    'AZ': 'Arizona',
    'AR': 'Arkansas',
    'CA': 'California',
    'CO': 'Colorado',
    'CT': 'Connecticut',
    'DE': 'Delaware',
    'FL': 'Florida',
    'GA': 'Georgia',
    'HI': 'Hawaii',
    'ID': 'Idaho',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'KY': 'Kentucky',
    'LA': 'Louisiana',
    'ME': 'Maine',
    'MD': 'Maryland',
    'MA': 'Massachusetts',
    'MI': 'Michigan',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'NE': 'Nebraska',
    'NV': 'Nevada',
    'NH': 'New Hampshire',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NY': 'New York',
    'NC': 'North Carolina',
    'ND': 'North Dakota',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'PA': 'Pennsylvania',
    'RI': 'Rhode Island',
    'SC': 'South Carolina',
    'SD': 'South Dakota',
    'TN': 'Tennessee',
    'TX': 'Texas',
    'UT': 'Utah',
    'VT': 'Vermont',
    'VA': 'Virginia',
    'WA': 'Washington',
    'WV': 'West Virginia',
    'WI': 'Wisconsin',
    'WY': 'Wyoming',
    'DC': 'District of Columbia'
  };
  
  return stateMap[abbr.toUpperCase()] || null;
}

/**
 * Normalize address for deduplication
 */
function normalizeAddress(address, city, state, zip) {
  if (!address) return '';
  
  const normalized = address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,/g, '')
    .replace(/\./g, '')
    .replace(/avenue/g, 'ave')
    .replace(/street/g, 'st')
    .replace(/road/g, 'rd')
    .replace(/boulevard/g, 'blvd')
    .replace(/drive/g, 'dr')
    .replace(/lane/g, 'ln')
    .replace(/court/g, 'ct')
    .replace(/circle/g, 'cir')
    .replace(/highway/g, 'hwy')
    .replace(/suite/g, 'ste')
    .replace(/unit/g, '')
    .replace(/apt/g, '')
    .replace(/#/g, '')
    .trim();
    
  return `${normalized}, ${city.toLowerCase()}, ${state.toLowerCase()} ${zip}`;
}

/**
 * Generate a slug for the laundromat
 */
function generateSlug(name, city, state) {
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
    
  const citySlug = city
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
    
  const stateSlug = state
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
    
  return `${nameSlug}-${citySlug}-${stateSlug}`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    'laundromat',
    'laundry service',
    'wash and fold',
    'coin laundry',
    'self-service laundry',
    `laundromat in ${record.city}`,
    `laundromat near me`,
    `${record.city} laundry`,
    `${record.state} laundromat`,
    `${record.city} ${record.state} laundromat`,
    `laundromat ${record.zip}`,
    'coin-operated laundry',
    'laundry facilities',
    'commercial laundry',
    'drop-off laundry service'
  ];
  
  return tags;
}

/**
 * Calculate a premium score
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Basic information completeness
  if (record.name) score += 5;
  if (record.address) score += 5;
  if (record.phone) score += 5;
  if (record.website) score += 10;
  if (record.hours) score += 10;
  
  // Location data
  if (record.latitude && record.longitude) score += 10;
  
  // Services and amenities
  const services = record.services || [];
  score += Math.min(services.length * 2, 20);
  
  const amenities = record.amenities || [];
  score += Math.min(amenities.length * 2, 20);
  
  // Rating and reviews
  const rating = parseFloat(record.rating) || 0;
  score += Math.round(rating * 5);
  
  return Math.min(score, 100);
}

/**
 * Enrich a laundromat record
 */
function enrichLaundromat(record) {
  const enriched = { ...record };
  
  // Generate slug if not present
  if (!enriched.slug) {
    enriched.slug = generateSlug(enriched.name, enriched.city, enriched.state);
  }
  
  // Generate SEO data
  enriched.seoTitle = `${enriched.name} - Laundromat in ${enriched.city}, ${enriched.state}`;
  enriched.seoDescription = `Find ${enriched.name}, a convenient laundromat located at ${enriched.address} in ${enriched.city}, ${enriched.state}. Open daily with modern equipment.`;
  enriched.seoTags = generateSeoTags(enriched);
  
  // Calculate premium score
  enriched.premiumScore = calculatePremiumScore(enriched);
  
  // Parse services from string to array if needed
  if (typeof enriched.services === 'string') {
    enriched.services = enriched.services.split(',').map(s => s.trim());
  } else if (!enriched.services) {
    enriched.services = [];
  }
  
  // Parse amenities from string to array if needed
  if (typeof enriched.amenities === 'string') {
    enriched.amenities = enriched.amenities.split(',').map(a => a.trim());
  } else if (!enriched.amenities) {
    enriched.amenities = [];
  }
  
  // Normalize address for deduplication
  enriched.normalizedAddress = normalizeAddress(
    enriched.address, 
    enriched.city,
    enriched.state,
    enriched.zip
  );
  
  // Set premium flag
  enriched.isPremium = enriched.premiumScore >= 70;
  enriched.isVerified = true;
  
  return enriched;
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Get a sample of laundromats from each state
 */
async function getSampleData() {
  console.log('Reading Excel file for sample data...');
  
  // Read the Excel file using import.meta.url instead of __dirname
  const currentFilePath = new URL(import.meta.url).pathname;
  const rootDir = path.dirname(path.dirname(currentFilePath));
  const excelPath = path.join(rootDir, 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${rawData.length} total records`);
  
  // Get a map of state abbreviations to find samples for each
  const stateMap = new Map();
  
  // First pass: Categorize laundromats by state
  rawData.forEach(record => {
    const state = record.state;
    if (!state) return;
    
    if (!stateMap.has(state)) {
      stateMap.set(state, []);
    }
    
    // Add all records, we'll fill missing fields later
    stateMap.get(state).push(record);
  });
  
  // Print state statistics
  console.log(`Found records from ${stateMap.size} states`);
  
  // Debug which fields might be missing
  let missingName = 0, missingAddress = 0, missingCity = 0, missingZip = 0;
  
  for (const records of stateMap.values()) {
    for (const record of records) {
      if (!record.name) missingName++;
      if (!record.address) missingAddress++;
      if (!record.city) missingCity++;
      if (!record.zip) missingZip++;
    }
  }
  
  console.log(`Missing fields stats:
    - Missing name: ${missingName}
    - Missing address: ${missingAddress}
    - Missing city: ${missingCity}
    - Missing zip: ${missingZip}
  `);
  
  // Get 3 samples from each state, or all if less than 3
  const sampleData = [];
  for (const [state, records] of stateMap.entries()) {
    // Skip if no valid records for this state
    if (records.length === 0) continue;
    
    // Choose up to 3 records randomly
    const sampleSize = Math.min(3, records.length);
    const stateRecords = records.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
    
    // Enrich and add to sample data with default values for missing fields
    stateRecords.forEach(record => {
      // Provide default values for missing required fields
      const completeRecord = {
        // Use existing values or provide defaults
        name: record.name || `Laundromat in ${record.city || record.state}`,
        address: record.address || `123 Main St`,
        city: record.city || 'Unknown City',
        state: record.state, // State is always present (filtered earlier)
        zip: record.zip || '00000',
        
        // Copy other fields as is
        phone: record.phone || '',
        website: record.website || null,
        latitude: record.latitude || '0',
        longitude: record.longitude || '0',
        hours: record.hours || 'Call for hours',
        services: record.services || [],
        amenities: record.amenities || [],
        
        // Additional fields from the original record
        ...record
      };
      
      sampleData.push(enrichLaundromat(completeRecord));
    });
  }
  
  console.log(`Created sample of ${sampleData.length} laundromats from ${stateMap.size} states`);
  return sampleData;
}

/**
 * Check if a city exists and create it if not
 */
async function getOrCreateCity(client, cityName, stateAbbr) {
  if (!cityName || !stateAbbr) {
    throw new Error('City name and state abbreviation are required');
  }
  
  const citySlug = cityName.toLowerCase().replace(/\s+/g, '-');
  
  // Check if city exists
  const cityQuery = `
    SELECT id FROM cities 
    WHERE LOWER(name) = LOWER($1) AND LOWER(state) = LOWER($2)
    LIMIT 1
  `;
  
  const cityResult = await client.query(cityQuery, [cityName, stateAbbr]);
  
  if (cityResult.rows.length > 0) {
    return cityResult.rows[0].id;
  }
  
  // City doesn't exist, ensure state exists
  await getOrCreateState(client, stateAbbr);
  
  try {
    // Check for any existing city with the same slug
    const checkSlugQuery = `SELECT id FROM cities WHERE slug = $1`;
    const checkSlugResult = await client.query(checkSlugQuery, [citySlug]);
    
    if (checkSlugResult.rows.length > 0) {
      // A city with this slug already exists, use a more unique slug
      const uniqueCitySlug = `${citySlug}-${stateAbbr.toLowerCase()}`;
      
      const insertCityQuery = `
        INSERT INTO cities (name, state, slug, laundry_count)
        VALUES ($1, $2, $3, 0)
        RETURNING id
      `;
      
      const insertCityResult = await client.query(insertCityQuery, [
        cityName,
        stateAbbr,
        uniqueCitySlug
      ]);
      
      return insertCityResult.rows[0].id;
    } else {
      // No city with this slug exists, proceed with regular insert
      const insertCityQuery = `
        INSERT INTO cities (name, state, slug, laundry_count)
        VALUES ($1, $2, $3, 0)
        RETURNING id
      `;
      
      const insertCityResult = await client.query(insertCityQuery, [
        cityName,
        stateAbbr,
        citySlug
      ]);
      
      return insertCityResult.rows[0].id;
    }
  } catch (error) {
    // If we're still getting an error, try one more approach with a very unique slug
    const fallbackSlug = `${citySlug}-${stateAbbr.toLowerCase()}-${Math.floor(Math.random() * 10000)}`;
    
    const insertCityQuery = `
      INSERT INTO cities (name, state, slug, laundry_count)
      VALUES ($1, $2, $3, 0)
      RETURNING id
    `;
    
    const insertCityResult = await client.query(insertCityQuery, [
      cityName,
      stateAbbr,
      fallbackSlug
    ]);
    
    return insertCityResult.rows[0].id;
  }
}

/**
 * Ensure state exists in the database
 */
async function getOrCreateState(client, stateAbbr) {
  const stateQuery = `
    SELECT id FROM states
    WHERE LOWER(abbr) = LOWER($1)
    LIMIT 1
  `;
  
  const stateResult = await client.query(stateQuery, [stateAbbr]);
  
  if (stateResult.rows.length > 0) {
    return stateResult.rows[0].id;
  }
  
  // Create state if it doesn't exist
  const stateFullName = getStateNameFromAbbr(stateAbbr) || stateAbbr;
  const stateSlug = stateFullName.toLowerCase().replace(/\s+/g, '-');
  
  // Check for any existing state with the same slug
  const checkSlugQuery = `SELECT id FROM states WHERE slug = $1`;
  const checkSlugResult = await client.query(checkSlugQuery, [stateSlug]);
  
  if (checkSlugResult.rows.length > 0) {
    // A state with this slug already exists, just return its ID
    return checkSlugResult.rows[0].id;
  }
  
  try {
    const insertStateQuery = `
      INSERT INTO states (name, abbr, slug, laundry_count)
      VALUES ($1, $2, $3, 0)
      RETURNING id
    `;
    
    const insertStateResult = await client.query(insertStateQuery, [
      stateFullName,
      stateAbbr,
      stateSlug
    ]);
    
    return insertStateResult.rows[0].id;
  } catch (error) {
    // If there was an error (likely a duplicate), check if the state exists by abbr
    const stateCheck = await client.query(`SELECT id FROM states WHERE LOWER(abbr) = LOWER($1)`, [stateAbbr]);
    if (stateCheck.rows.length > 0) {
      return stateCheck.rows[0].id;
    }
    
    // If we're still having issues, try one more time with a unique slug
    const uniqueStateSlug = `${stateSlug}-${Math.floor(Math.random() * 1000)}`;
    const insertUniqueQuery = `
      INSERT INTO states (name, abbr, slug, laundry_count)
      VALUES ($1, $2, $3, 0)
      RETURNING id
    `;
    
    const uniqueResult = await client.query(insertUniqueQuery, [
      stateFullName,
      stateAbbr,
      uniqueStateSlug
    ]);
    
    return uniqueResult.rows[0].id;
  }
}

/**
 * Update counts for a location after adding a laundromat
 */
async function updateLocationCounts(client, cityName, stateAbbr) {
  // Update city count
  await client.query(`
    UPDATE cities 
    SET laundry_count = (
      SELECT COUNT(*) FROM laundromats 
      WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2)
    )
    WHERE LOWER(name) = LOWER($1) AND LOWER(state) = LOWER($2)
  `, [cityName, stateAbbr]);
  
  // Update state count
  await client.query(`
    UPDATE states 
    SET laundry_count = (
      SELECT COUNT(*) FROM laundromats 
      WHERE LOWER(state) = LOWER($1)
    )
    WHERE LOWER(abbr) = LOWER($1)
  `, [stateAbbr]);
}

/**
 * Import a single laundromat
 */
async function importLaundromat(client, record) {
  try {
    // Generate laundromat slug if not already present
    if (!record.slug) {
      record.slug = generateSlug(record.name, record.city, record.state);
    }
    
    // Check if the laundromat already exists
    const existingQuery = `
      SELECT id FROM laundromats
      WHERE slug = $1 OR (
        LOWER(name) = LOWER($2) AND
        LOWER(address) = LOWER($3) AND
        LOWER(city) = LOWER($4) AND
        LOWER(state) = LOWER($5)
      )
      LIMIT 1
    `;
    
    const existingResult = await client.query(existingQuery, [
      record.slug,
      record.name,
      record.address,
      record.city,
      record.state
    ]);
    
    if (existingResult.rows.length > 0) {
      // Already exists, no need to import
      return { success: true, action: 'skipped', id: existingResult.rows[0].id };
    }
    
    // Ensure the city exists
    await getOrCreateCity(client, record.city, record.state);
    
    // Services as JSON
    const servicesJson = JSON.stringify(record.services || []);
    const amenitiesJson = JSON.stringify(record.amenities || []);
    const machineCountJson = JSON.stringify(record.machineCount || {});
    
    // Insert the laundromat
    const insertQuery = `
      INSERT INTO laundromats (
        name, slug, address, city, state, zip, phone, website,
        latitude, longitude, hours, services, description, seo_title,
        seo_description, seo_tags, amenities, machine_count, premium_score,
        is_premium, is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id
    `;
    
    const insertResult = await client.query(insertQuery, [
      record.name,
      record.slug,
      record.address,
      record.city,
      record.state,
      record.zip,
      record.phone,
      record.website || null,
      record.latitude,
      record.longitude,
      record.hours || '',
      servicesJson,
      record.description || '',
      record.seoTitle || '',
      record.seoDescription || '',
      JSON.stringify(record.seoTags || []),
      amenitiesJson,
      machineCountJson,
      record.premiumScore || 0,
      record.isPremium || false,
      record.isVerified || false
    ]);
    
    // Update location counts
    await updateLocationCounts(client, record.city, record.state);
    
    return { success: true, action: 'imported', id: insertResult.rows[0].id };
  } catch (error) {
    console.error(`Error importing laundromat ${record.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Import sample data
 */
async function importSampleData() {
  console.log('Starting quick sample import...');
  
  // Get sample data
  const sampleData = await getSampleData();
  
  // Create a client
  const client = await pool.connect();
  
  try {
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Import each record
    for (let i = 0; i < sampleData.length; i++) {
      const record = sampleData[i];
      console.log(`Importing sample ${i + 1}/${sampleData.length}: ${record.name} (${record.city}, ${record.state})`);
      
      const result = await importLaundromat(client, record);
      
      if (result.success) {
        if (result.action === 'imported') {
          importedCount++;
        } else if (result.action === 'skipped') {
          skippedCount++;
        }
      } else {
        console.error(`Error importing ${record.name}: ${result.error}`);
        errorCount++;
      }
    }
    
    console.log(`
      Sample import complete:
      - Imported: ${importedCount}
      - Skipped: ${skippedCount}
      - Errors: ${errorCount}
      - Total: ${sampleData.length}
    `);
  } catch (error) {
    console.error('Error during sample import:', error);
  } finally {
    client.release();
  }
}

// Run the script
importSampleData().then(() => {
  console.log('Sample import complete. Exiting...');
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error during sample import:', err);
  process.exit(1);
});