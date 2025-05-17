/**
 * Batch Import Script
 * 
 * This script imports laundromat data in batches to gradually populate the database
 * with more records while avoiding timeouts.
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get current directory path (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// State abbreviation to full name mapping
const stateNameMap = {
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

/**
 * Generate a slug from a name and location
 */
function generateSlug(name, city, state) {
  if (!name || !city || !state) {
    // Generate a random slug if any required fields are missing
    return `laundromat-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  // Generate slug from name, city, and state
  const baseSlug = `${name}-${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove non-alphanumeric characters except spaces and hyphens
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .trim();
    
  return baseSlug;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  const cityState = record.city && record.state ? 
    `in ${record.city}, ${getStateNameFromAbbr(record.state)}` : '';
  
  return `${record.name} is a laundromat ${cityState} offering convenient laundry services. Find directions, hours, and more information about this laundromat location.`;
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  const cityState = record.city && record.state ? 
    `- ${record.city}, ${getStateNameFromAbbr(record.state)}` : '';
  
  return `${record.name} ${cityState} | Laundromat Near Me`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me"
  ];
  
  if (record.city) tags.push(`laundromat in ${record.city}`);
  if (record.state) tags.push(`laundromat in ${getStateNameFromAbbr(record.state)}`);
  if (record.city && record.state) tags.push(`laundromat in ${record.city}, ${getStateNameFromAbbr(record.state)}`);
  
  // Add additional service-related tags
  if (record.services) {
    if (record.services.includes('Wash & Fold')) {
      tags.push('wash and fold', 'wash and fold service');
    }
    if (record.services.includes('Dry Cleaning')) {
      tags.push('dry cleaning', 'dry cleaning service');
    }
    if (record.services.includes('Self-Service')) {
      tags.push('self-service laundry', 'coin operated');
    }
  }
  
  return tags;
}

/**
 * Calculate premium score for a laundromat
 */
function calculatePremiumScore(record) {
  let score = 50; // Base score
  
  // Add points for completeness
  if (record.name) score += 5;
  if (record.address) score += 5;
  if (record.phone) score += 5;
  if (record.website) score += 10;
  if (record.hours) score += 5;
  if (record.latitude && record.longitude) score += 10;
  
  // Add points for services
  if (record.services && Array.isArray(record.services)) {
    score += Math.min(record.services.length * 2, 10);
  }
  
  // Add points for reviews
  if (record.rating && record.review_count) {
    const ratingScore = parseFloat(record.rating) || 0;
    const reviewCountScore = parseInt(record.review_count) || 0;
    
    score += Math.min(Math.round(ratingScore * 3), 15);
    score += Math.min(Math.round(reviewCountScore / 10), 15);
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Normalize services array
 */
function normalizeServices(services) {
  if (!services) return [];
  if (typeof services === 'string') {
    try {
      return JSON.parse(services);
    } catch (e) {
      return [services];
    }
  }
  if (Array.isArray(services)) return services;
  return [];
}

/**
 * Enrich a laundromat record
 */
function enrichLaundromat(record) {
  // Convert state abbreviation to full name
  if (record.state && record.state.length === 2) {
    record.state = getStateNameFromAbbr(record.state);
  }
  
  // Generate slug from name, city, state
  record.slug = generateSlug(record.name, record.city, record.state);
  
  // Generate SEO fields
  record.seo_title = generateSeoTitle(record);
  record.seo_description = generateSeoDescription(record);
  record.seo_tags = generateSeoTags(record);
  
  // Calculate premium score
  record.premium_score = calculatePremiumScore(record);
  
  // Set default values for required fields
  record.is_premium = false;
  record.is_featured = false;
  record.is_verified = false;
  
  // Normalize services
  record.services = normalizeServices(record.services);
  
  // Return enriched record
  return record;
}

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  if (abbr.length > 2) return abbr; // Already a full name
  return stateNameMap[abbr.toUpperCase()] || abbr;
}

/**
 * Get or create a city record
 */
async function getOrCreateCity(client, cityName, stateName) {
  if (!cityName || !stateName) return null;
  
  // Get state ID
  const stateResult = await client.query(
    'SELECT id FROM states WHERE name = $1 OR abbr = $1',
    [stateName]
  );
  
  if (stateResult.rows.length === 0) {
    console.log(`State not found: ${stateName}`);
    return null;
  }
  
  const stateId = stateResult.rows[0].id;
  
  // Generate slug
  const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Check if city exists
  const existingCity = await client.query(
    'SELECT id FROM cities WHERE name = $1 AND state_id = $2',
    [cityName, stateId]
  );
  
  if (existingCity.rows.length > 0) {
    return existingCity.rows[0].id;
  }
  
  // Create new city
  const newCity = await client.query(
    'INSERT INTO cities (name, slug, state_id, laundry_count) VALUES ($1, $2, $3, $4) RETURNING id',
    [cityName, citySlug, stateId, 0]
  );
  
  return newCity.rows[0].id;
}

/**
 * Update laundry count for a city and state
 */
async function updateLaundryCounts(client, cityId, stateId) {
  if (cityId) {
    await client.query(
      'UPDATE cities SET laundry_count = (SELECT COUNT(*) FROM laundromats WHERE city_id = $1) WHERE id = $1',
      [cityId]
    );
  }
  
  if (stateId) {
    await client.query(
      'UPDATE states SET laundry_count = (SELECT COUNT(*) FROM laundromats WHERE state_id = $1) WHERE id = $1',
      [stateId]
    );
  }
}

/**
 * Import a single laundromat
 */
async function importLaundromat(client, record) {
  try {
    // Get full state name
    const stateName = getStateNameFromAbbr(record.state);
    
    // Get state ID
    const stateResult = await client.query(
      'SELECT id FROM states WHERE name = $1 OR abbr = $1',
      [stateName]
    );
    
    if (stateResult.rows.length === 0) {
      console.log(`State not found: ${stateName}`);
      return false;
    }
    
    const stateId = stateResult.rows[0].id;
    
    // Get or create city
    const cityId = await getOrCreateCity(client, record.city, stateName);
    
    if (!cityId) {
      console.log(`Failed to get or create city: ${record.city}`);
      return false;
    }
    
    // Check if laundromat with same name and address exists
    const existingLaundromat = await client.query(
      'SELECT id FROM laundromats WHERE name = $1 AND address = $2 AND city_id = $3',
      [record.name, record.address, cityId]
    );
    
    if (existingLaundromat.rows.length > 0) {
      console.log(`Laundromat already exists: ${record.name} at ${record.address}`);
      return false;
    }
    
    // Prepare services as JSON
    const services = Array.isArray(record.services) ? JSON.stringify(record.services) : '[]';
    const seoTags = Array.isArray(record.seo_tags) ? JSON.stringify(record.seo_tags) : '[]';
    
    // Insert laundromat
    await client.query(
      `INSERT INTO laundromats (
        name, slug, address, city, state, zip, phone, website,
        latitude, longitude, rating, review_count, hours, services,
        description, is_featured, is_premium, is_verified,
        image_url, created_at, city_id, state_id, seo_title,
        seo_description, seo_tags, premium_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
      [
        record.name,
        record.slug,
        record.address,
        record.city,
        stateName,
        record.zip,
        record.phone || '',
        record.website || null,
        record.latitude || '0',
        record.longitude || '0',
        record.rating || '0',
        record.review_count || 0,
        record.hours || 'Call for hours',
        services,
        record.description || `${record.name} is a laundromat located in ${record.city}, ${stateName}.`,
        record.is_featured || false,
        record.is_premium || false,
        record.is_verified || false,
        record.image_url || null,
        new Date(),
        cityId,
        stateId,
        record.seo_title,
        record.seo_description,
        seoTags,
        record.premium_score || 50
      ]
    );
    
    // Update city and state laundry counts
    await updateLaundryCounts(client, cityId, stateId);
    
    return true;
  } catch (error) {
    console.error(`Error importing laundromat ${record.name}:`, error);
    return false;
  }
}

/**
 * Process a batch of laundromats
 */
async function processBatch(records, batchStart, batchSize) {
  const client = await pool.connect();
  
  try {
    let imported = 0;
    let skipped = 0;
    
    await client.query('BEGIN');
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Skip records without minimum required fields
      if (!record.name || !record.state) {
        skipped++;
        continue;
      }
      
      // Enrich the record with SEO fields and slug
      const enrichedRecord = enrichLaundromat(record);
      
      // Add default values for essential fields if missing
      if (!enrichedRecord.address) enrichedRecord.address = "123 Main St";
      if (!enrichedRecord.city) enrichedRecord.city = "Unknown City";
      if (!enrichedRecord.zip) enrichedRecord.zip = "00000";
      
      const result = await importLaundromat(client, enrichedRecord);
      
      if (result) {
        imported++;
        console.log(`Imported (${batchStart + i}): ${record.name} (${record.city}, ${record.state})`);
      } else {
        skipped++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`
      Batch completed:
      - Imported: ${imported}
      - Skipped: ${skipped}
      - Total: ${records.length}
    `);
    
    return { imported, skipped };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing batch:', error);
    return { imported: 0, skipped: 0, error };
  } finally {
    client.release();
  }
}

/**
 * Read data and process in batches
 */
async function importData() {
  try {
    console.log('Starting batch import...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    
    console.log(`Reading Excel file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.log('Available files in directory:');
      const files = fs.readdirSync(path.join(process.cwd(), 'attached_assets'));
      console.log(files);
      throw new Error('Excel file not found');
    }
    
    // Read the file as binary
    const workbook = xlsx.readFile(filePath, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${rawData.length} total records`);
    
    // Save progress file path
    const progressFilePath = path.join(process.cwd(), 'data', 'import-progress.json');
    
    // Load progress if exists
    let startIndex = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    
    if (fs.existsSync(progressFilePath)) {
      const progress = JSON.parse(fs.readFileSync(progressFilePath, 'utf8'));
      startIndex = progress.nextIndex || 0;
      totalImported = progress.totalImported || 0;
      totalSkipped = progress.totalSkipped || 0;
      
      console.log(`Resuming from index ${startIndex}`);
    }
    
    // Process data in batches
    const batchSize = 10; // Process 10 records at a time to avoid timeouts
    
    for (let i = startIndex; i < Math.min(rawData.length, startIndex + 100); i += batchSize) {
      const batch = rawData.slice(i, i + batchSize);
      
      console.log(`Processing batch ${i / batchSize + 1} (records ${i + 1}-${i + batch.length})...`);
      
      const { imported, skipped } = await processBatch(batch, i, batchSize);
      
      totalImported += imported;
      totalSkipped += skipped;
      
      // Save progress
      fs.writeFileSync(progressFilePath, JSON.stringify({
        nextIndex: i + batchSize,
        totalImported,
        totalSkipped,
        totalRecords: rawData.length,
        lastUpdate: new Date().toISOString()
      }));
      
      // Small delay between batches to allow HTTP requests to process
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`
      Import completed:
      - Total imported: ${totalImported}
      - Total skipped: ${totalSkipped}
      - Total processed: ${Math.min(rawData.length, startIndex + 100)}
      - Total records: ${rawData.length}
    `);
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    pool.end();
  }
}

/**
 * Create data directory if it doesn't exist
 */
function ensureDirectoryExists() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Main function
 */
async function main() {
  ensureDirectoryExists();
  await importData();
}

// Run the import
main().catch(console.error);