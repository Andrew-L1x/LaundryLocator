/**
 * Automated Import and Address Fixing Script
 * 
 * This script runs a continuous loop to:
 * 1. Import 5 laundromat records
 * 2. Fix 5 placeholder addresses
 * 3. Repeat for a specified number of cycles or until stopped
 * 
 * Run with: node scripts/auto-import-and-fix.js
 */

import pg from 'pg';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Batch sizes
  importBatchSize: 25, // Number of records to import in each batch
  fixBatchSize: 20,    // Number of addresses to fix in each batch
  
  // File paths
  sourceFile: 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx',
  importProgressFile: 'data/auto-import-progress.json',
  logFile: 'data/auto-import-log.txt',
  
  // Automation settings
  maxCycles: 10000,    // Maximum number of cycles to run (safeguard)
  delayBetweenCycles: 5000, // 5 seconds between cycles
  delayBetweenApiCalls: 200, // 200ms between geocoding calls
  
  // Google Maps API settings
  maxRetries: 3       // Max retries for geocoding
};

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// Database connection using individual parameters
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false // For Neon database
  }
});

// Helper function for logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}`;
  console.log(logEntry);
  
  fs.appendFileSync(CONFIG.logFile, logEntry + '\n');
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test database connection
async function testConnection() {
  try {
    log('Testing database connection...');
    const client = await pool.connect();
    log('Database connection successful!');
    
    // Log connection details (without password)
    log(`Connected to: ${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE} as ${process.env.PGUSER}`);
    
    const result = await client.query('SELECT COUNT(*) FROM laundromats');
    log(`Current laundromat count: ${result.rows[0].count}`);
    
    client.release();
    return true;
  } catch (error) {
    log(`Database connection error: ${error.message}`);
    log('Check your .env file and make sure the connection parameters are correct');
    return false;
  }
}

// Load or create progress tracking
function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.importProgressFile)) {
      const data = fs.readFileSync(CONFIG.importProgressFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  return { 
    position: 0, 
    totalImported: 0,
    totalAddressesFixed: 0,
    cycles: 0,
    startTime: new Date().toISOString(),
    lastRunTime: null
  };
}

// Save progress
function saveProgress(progress) {
  progress.lastRunTime = new Date().toISOString();
  fs.writeFileSync(CONFIG.importProgressFile, JSON.stringify(progress, null, 2));
}

// Get total laundromats in database
async function getTotalLaundromats() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM laundromats');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    log(`Error getting total laundromats: ${error.message}`);
    return 0;
  }
}

// Get count of placeholder addresses
async function getPlaceholderCount() {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) FROM laundromats
      WHERE (address IS NULL OR TRIM(address) = '' OR 
             address LIKE '%123 Main%' OR 
             address LIKE '%Placeholder%' OR
             address LIKE 'address%' OR
             address LIKE '%unknown%' OR
             address LIKE '%tbd%' OR
             address LIKE '%to be determined%')
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude != '' AND longitude != ''
    `);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    log(`Error getting placeholder count: ${error.message}`);
    return 0;
  }
}

// Get full state name from abbreviation
function getStateNameFromAbbr(abbr) {
  const states = {
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
  
  return states[abbr] || 'Unknown State';
}

// Generate a slug for the laundromat
function generateSlug(name, city, state) {
  if (!name) name = 'unnamed-laundromat';
  if (!city) city = 'unknown-city';
  if (!state) state = 'unknown-state';
  
  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };
  
  return `${slugify(name)}-${slugify(city)}-${slugify(state)}`;
}

// Generate SEO tags for a laundromat
function generateSeoTags(record) {
  const tags = [
    'laundromat',
    'laundry service',
    'washing machine',
    'dryer'
  ];
  
  // Location-based tags
  if (record.city) tags.push(`laundromat in ${record.city}`);
  if (record.state) tags.push(`${record.state} laundromat`);
  if (record.zip) tags.push(`laundromat ${record.zip}`);
  
  // Special features
  if (record.is24Hours) tags.push('24 hour laundromat');
  if (record.hasAttendant) tags.push('attended laundromat');
  
  return tags;
}

// Generate SEO description for a laundromat
function generateSeoDescription(record) {
  const name = record.name || 'This laundromat';
  const city = record.city || 'the area';
  const state = record.state ? getStateNameFromAbbr(record.state) : '';
  
  let description = `${name} is a convenient laundromat located in ${city}`;
  if (state) description += `, ${state}`;
  description += '. ';
  
  // Add operating hours
  if (record.is24Hours) {
    description += 'Open 24 hours a day for your convenience. ';
  } else if (record.hours) {
    description += `Open ${record.hours}. `;
  }
  
  // Add special features
  const features = [];
  if (record.hasWifi) features.push('free WiFi');
  if (record.hasAttendant) features.push('friendly attendants');
  if (record.hasCoinMachines) features.push('coin-operated machines');
  if (record.hasCardMachines) features.push('card-operated machines');
  if (record.hasVending) features.push('vending machines');
  
  if (features.length > 0) {
    description += `Amenities include ${features.join(', ')}. `;
  }
  
  // Add search-friendly closing
  description += `Find clean, well-maintained laundry equipment at this local laundromat in ${city}.`;
  
  return description;
}

// Generate SEO title for a laundromat
function generateSeoTitle(record) {
  const name = record.name || 'Local Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  
  let title = name;
  
  if (city && state) {
    title += ` - Laundromat in ${city}, ${state}`;
  } else if (city) {
    title += ` - Laundromat in ${city}`;
  } else if (state) {
    title += ` - Laundromat in ${state}`;
  }
  
  return title;
}

// Calculate premium score
function calculatePremiumScore(record) {
  let score = 50; // Start with a base score
  
  // Adjust based on ratings
  if (record.rating) score += (record.rating * 5);
  
  // Adjust for features
  if (record.is24Hours) score += 10;
  if (record.hasWifi) score += 5;
  if (record.hasAttendant) score += 8;
  if (record.hasVending) score += 3;
  if (record.hasCardMachines) score += 7;
  
  // Cap the score at 100
  return Math.min(100, Math.round(score));
}

// Import a single laundromat
async function importLaundromat(client, record) {
  try {
    // These fields need to be jsonb type
    const services = record.services || [];
    const amenities = {
      wifi: record.hasWifi || false,
      attended: record.hasAttendant || false,
      vending: record.hasVending || false,
      cardMachines: record.hasCardMachines || false,
      coinMachines: record.hasCoinMachines || false
    };
    
    // Prepare features
    let features = '';
    if (record.hasWifi) features += 'WiFi,';
    if (record.hasAttendant) features += 'Attended,';
    if (record.hasVending) features += 'Vending,';
    if (record.hasCardMachines) features += 'Card Machines,';
    if (record.hasCoinMachines) features += 'Coin Machines,';
    if (features.endsWith(',')) features = features.slice(0, -1);
    
    // Prepare record for insertion
    const slug = generateSlug(record.name, record.city, record.state);
    const seoTitle = generateSeoTitle(record);
    const seoDescription = generateSeoDescription(record);
    const seoTagsArray = generateSeoTags(record);
    const premiumScore = calculatePremiumScore(record);
    
    // Create a description with location details and amenities
    const description = `${record.name || 'This laundromat'} provides quality laundry services in ${record.city || 'the local area'}. ${seoDescription}`;
    
    // Machine count data
    const machineCount = {
      washers: record.washerCount || Math.floor(Math.random() * 10) + 5,
      dryers: record.dryerCount || Math.floor(Math.random() * 8) + 4
    };
    
    // Payment methods
    const paymentMethods = 'Cash, Credit Card, Debit Card';
    
    // Listing type
    const listingType = 'standard';
    
    // Promotional text
    const promotionalText = record.hasPromo ? 
      `Special offer! First-time customers receive 10% off their first wash at ${record.name}` : '';
    
    // Insert laundromat using the actual schema columns
    const insertQuery = `
      INSERT INTO laundromats (
        name, slug, address, city, state, zip,
        latitude, longitude, phone, website,
        hours, rating, seo_title, seo_description, 
        seo_tags, premium_score, features,
        services, amenities, is_premium, is_featured,
        created_at, review_count, wifi, parking,
        delivery, pickup, drop_off, self_service, 
        full_service, dry_cleaning, machine_count,
        description, image_url, payment_methods,
        listing_type, promotional_text
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 
        $7, $8, $9, $10, 
        $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32,
        $33, $34, $35,
        $36, $37
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `;
    
    const insertValues = [
      record.name || 'Unnamed Laundromat',
      slug,
      record.address || '123 Main St',
      record.city || 'Unknown City',
      record.state || 'XX',
      record.zip || '',
      record.latitude || null,
      record.longitude || null,
      record.phone || '',
      record.website || '',
      record.hours || '',
      record.rating || '0',
      seoTitle,
      seoDescription,
      JSON.stringify(seoTagsArray),
      premiumScore,
      features,
      JSON.stringify(services),
      JSON.stringify(amenities),
      false, // is_premium
      false, // is_featured
      new Date(),
      0, // review_count
      record.hasWifi || false, // wifi
      record.hasParking || false, // parking
      record.hasDelivery || false, // delivery
      record.hasPickup || false, // pickup
      record.hasDropOff || false, // drop_off
      true, // self_service
      record.hasFullService || false, // full_service
      record.hasDryCleaning || false, // dry_cleaning
      JSON.stringify(machineCount), // machine_count
      description, // description
      record.imageUrl || '', // image_url
      paymentMethods, // payment_methods
      listingType, // listing_type
      promotionalText // promotional_text
    ];
    
    const result = await client.query(insertQuery, insertValues);
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    return null;
  } catch (error) {
    log(`Error importing laundromat ${record.name}: ${error.message}`);
    throw error;
  }
}

// Process a small batch of laundromats for import
async function processBatch(allRecords, startIndex) {
  const client = await pool.connect();
  let importedCount = 0;
  
  try {
    await client.query('BEGIN');
    
    const endIndex = Math.min(startIndex + CONFIG.importBatchSize, allRecords.length);
    log(`Processing records ${startIndex} to ${endIndex - 1}`);
    
    for (let i = startIndex; i < endIndex; i++) {
      const record = allRecords[i];
      
      try {
        // Import the laundromat
        const id = await importLaundromat(client, record);
        
        if (id) {
          importedCount++;
          log(`Successfully imported laundromat: ${record.name || 'Unnamed'}`);
        } else {
          log(`Skipped duplicate laundromat: ${record.name || 'Unnamed'}`);
        }
      } catch (error) {
        log(`Error importing laundromat ${record.name || 'Unnamed'}: ${error.message}`);
      }
    }
    
    await client.query('COMMIT');
    return importedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Batch processing error: ${error.message}`);
    return 0;
  } finally {
    client.release();
  }
}

// Import a batch of laundromats
async function importBatch(progress) {
  try {
    // Load workbook - just the necessary part
    log(`Reading data from ${CONFIG.sourceFile}`);
    const workbook = xlsx.readFile(CONFIG.sourceFile);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRecords = xlsx.utils.sheet_to_json(worksheet);
    
    log(`Total records in file: ${allRecords.length}`);
    log(`Current position: ${progress.position}`);
    
    // Process batch
    if (progress.position < allRecords.length) {
      const importedCount = await processBatch(allRecords, progress.position);
      
      // Update progress
      const newPosition = Math.min(progress.position + CONFIG.importBatchSize, allRecords.length);
      const totalImported = progress.totalImported + importedCount;
      
      progress.position = newPosition;
      progress.totalImported = totalImported;
      
      log(`Successfully imported ${importedCount} laundromats`);
      log(`Total imported so far: ${totalImported}`);
      log(`Next batch will start from position ${newPosition}`);
      
      return importedCount;
    } else {
      log('All records have been processed');
      return 0;
    }
  } catch (error) {
    log(`Import error: ${error.message}`);
    return 0;
  }
}

// Get real address using Google Maps Reverse Geocoding API
async function getRealAddress(latitude, longitude, retries = 0) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable not set');
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      // Get the most detailed result (usually the first one)
      const result = response.data.results[0];
      
      // Extract components
      const streetNumber = result.address_components.find(comp => comp.types.includes('street_number'))?.long_name || '';
      const street = result.address_components.find(comp => comp.types.includes('route'))?.long_name || '';
      const city = result.address_components.find(comp => comp.types.includes('locality'))?.long_name || 
                  result.address_components.find(comp => comp.types.includes('administrative_area_level_3'))?.long_name || '';
      const state = result.address_components.find(comp => comp.types.includes('administrative_area_level_1'))?.short_name || '';
      const zip = result.address_components.find(comp => comp.types.includes('postal_code'))?.long_name || '';
      
      // Get formatted address
      const formattedAddress = result.formatted_address;
      const streetAddress = streetNumber && street ? `${streetNumber} ${street}` : formattedAddress.split(',')[0];
      
      return {
        success: true,
        streetAddress,
        city,
        state,
        zip,
        formattedAddress
      };
    } else if (response.data.status === 'OVER_QUERY_LIMIT' && retries < CONFIG.maxRetries) {
      // Handle rate limiting with exponential backoff
      const delay = Math.pow(2, retries) * 1000;
      log(`Rate limit hit, retrying in ${delay}ms`, 'warn');
      await sleep(delay);
      return getRealAddress(latitude, longitude, retries + 1);
    } else {
      log(`Geocoding API error: ${response.data.status} for coordinates ${latitude},${longitude}`);
      return { success: false, error: response.data.status };
    }
  } catch (error) {
    if (retries < CONFIG.maxRetries) {
      const delay = Math.pow(2, retries) * 1000;
      log(`Network error, retrying in ${delay}ms: ${error.message}`);
      await sleep(delay);
      return getRealAddress(latitude, longitude, retries + 1);
    }
    
    log(`Error getting address from Google Maps: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Get laundromats with placeholder addresses
async function getPlaceholderLaundromats(limit) {
  try {
    const query = `
      SELECT id, name, latitude, longitude
      FROM laundromats
      WHERE (address IS NULL OR TRIM(address) = '' OR 
             address LIKE '%123 Main%' OR 
             address LIKE '%Placeholder%' OR
             address LIKE 'address%' OR
             address LIKE '%unknown%' OR
             address LIKE '%tbd%' OR
             address LIKE '%to be determined%')
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude != '' AND longitude != ''
      ORDER BY id
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    log(`Error getting placeholder laundromats: ${error.message}`);
    return [];
  }
}

// Fix a single address
async function fixAddress(id, name, addressData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update the laundromat - removed updated_at since it doesn't exist
    const updateQuery = `
      UPDATE laundromats
      SET 
        address = $1, 
        city = $2, 
        state = $3, 
        zip = $4,
        slug = CASE WHEN slug LIKE '%unknown-city%' OR slug LIKE '%unknown-state%' 
              THEN $5 ELSE slug END
      WHERE id = $6
    `;
    
    // Generate a slug for completely unknown locations
    const slug = generateSlug(
      name || 'unnamed-laundromat', 
      addressData.city || 'unknown-city', 
      addressData.state || 'unknown-state'
    );
    
    await client.query(updateQuery, [
      addressData.streetAddress,
      addressData.city,
      addressData.state,
      addressData.zip,
      slug,
      id
    ]);
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Error updating laundromat ${id}: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Fix a batch of placeholder addresses
async function fixAddressBatch() {
  let successCount = 0;
  let failCount = 0;
  
  try {
    // Get laundromats with placeholder addresses
    const laundromats = await getPlaceholderLaundromats(CONFIG.fixBatchSize);
    
    if (laundromats.length === 0) {
      log('No placeholder addresses to fix');
      return 0;
    }
    
    log(`Found ${laundromats.length} laundromats with placeholder addresses`);
    
    // Process each laundromat
    for (const laundromat of laundromats) {
      const { id, name, latitude, longitude } = laundromat;
      
      log(`Processing laundromat ${id} at coordinates ${latitude},${longitude}`);
      
      // Get real address from Google Maps
      const addressData = await getRealAddress(latitude, longitude);
      
      if (addressData.success) {
        log(`Got address for laundromat ${id}: ${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zip}`);
        
        // Update the laundromat
        const updated = await fixAddress(id, name, addressData);
        
        if (updated) {
          successCount++;
          log(`Updated laundromat ${id} with new address`);
        } else {
          failCount++;
          log(`Failed to update laundromat ${id}`);
        }
      } else {
        failCount++;
        log(`Failed to get address for laundromat ${id}: ${addressData.error}`);
      }
      
      // Rate limiting - don't overload the Google Maps API
      await sleep(CONFIG.delayBetweenApiCalls);
    }
    
    log(`Batch complete: ${successCount} updated, ${failCount} failed`);
    return successCount;
  } catch (error) {
    log(`Error fixing addresses: ${error.message}`);
    return 0;
  }
}

// Run one cycle of import and fix
async function runCycle(progress) {
  try {
    // Step 1: Import a batch
    log(`Starting import batch for cycle ${progress.cycles + 1}`);
    const importedCount = await importBatch(progress);
    log(`Completed import batch, added ${importedCount} new records`);
    
    // Step 2: Fix addresses
    log(`Starting address fix batch for cycle ${progress.cycles + 1}`);
    const fixedCount = await fixAddressBatch();
    log(`Completed address fix batch, fixed ${fixedCount} addresses`);
    
    // Update progress
    progress.totalAddressesFixed += fixedCount;
    progress.cycles++;
    
    // Get current counts
    const totalLaundromats = await getTotalLaundromats();
    const placeholderCount = await getPlaceholderCount();
    
    log(`Current status: ${totalLaundromats} total laundromats, ${placeholderCount} placeholder addresses`);
    log(`Progress: Imported ${progress.totalImported} records, fixed ${progress.totalAddressesFixed} addresses in ${progress.cycles} cycles`);
    
    return { importedCount, fixedCount };
  } catch (error) {
    log(`Error in cycle ${progress.cycles + 1}: ${error.message}`);
    return { importedCount: 0, fixedCount: 0 };
  }
}

// Main function
async function main() {
  log('='.repeat(50));
  log('AUTOMATED IMPORT AND ADDRESS FIXING STARTED');
  log('='.repeat(50));
  
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      log('Database connection failed - cannot proceed');
      return;
    }
    
    // Load progress
    const progress = loadProgress();
    log(`Resuming from position ${progress.position} (${progress.totalImported} imported, ${progress.totalAddressesFixed} addresses fixed so far)`);
    
    // Get initial counts
    const initialLaundromats = await getTotalLaundromats();
    const initialPlaceholders = await getPlaceholderCount();
    
    log(`Initial status: ${initialLaundromats} total laundromats, ${initialPlaceholders} placeholder addresses`);
    
    // Main loop
    let cycleCount = 0;
    while (cycleCount < CONFIG.maxCycles) {
      log(`Starting cycle ${progress.cycles + 1}`);
      
      // Run one cycle
      const { importedCount, fixedCount } = await runCycle(progress);
      
      // Save progress
      saveProgress(progress);
      
      // Check if we should continue
      if (progress.position >= Number.MAX_SAFE_INTEGER) {
        log('All records have been processed, stopping automation');
        break;
      }
      
      // Pause between cycles
      log(`Cycle ${progress.cycles} complete, pausing for ${CONFIG.delayBetweenCycles / 1000} seconds`);
      await sleep(CONFIG.delayBetweenCycles);
      
      cycleCount++;
    }
    
    // Get final counts
    const finalLaundromats = await getTotalLaundromats();
    const finalPlaceholders = await getPlaceholderCount();
    
    log('='.repeat(50));
    log('AUTOMATION COMPLETED');
    log('='.repeat(50));
    log(`Initial status: ${initialLaundromats} total laundromats, ${initialPlaceholders} placeholder addresses`);
    log(`Final status: ${finalLaundromats} total laundromats, ${finalPlaceholders} placeholder addresses`);
    log(`Added ${finalLaundromats - initialLaundromats} new laundromats`);
    log(`Fixed ${initialPlaceholders - finalPlaceholders} placeholder addresses`);
    log(`Total cycles run: ${progress.cycles}`);
    log('='.repeat(50));
  } catch (error) {
    log(`Fatal error: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  log('Received SIGINT signal, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});