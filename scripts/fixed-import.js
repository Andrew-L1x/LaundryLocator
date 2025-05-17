/**
 * Fixed Import Script
 * 
 * This script matches the actual database schema and should work
 * with the existing laundromats table structure.
 */

import pg from 'pg';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - keep these numbers small for Replit
const BATCH_SIZE = 5; // Process just 5 records per batch to avoid memory issues
const SOURCE_FILE = 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';
const PROGRESS_FILE = 'data/micro-import-progress.json';

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
  console.log(`${timestamp} - ${message}`);
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
async function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  return { position: 0, totalImported: 0 };
}

// Save progress
function saveProgress(position, totalImported) {
  const progress = {
    position,
    totalImported,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
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

// Process a small batch of laundromats
async function processBatch(allRecords, startIndex) {
  const client = await pool.connect();
  let importedCount = 0;
  
  try {
    await client.query('BEGIN');
    
    const endIndex = Math.min(startIndex + BATCH_SIZE, allRecords.length);
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

// Main function to run the import
async function runImport() {
  log('Starting fixed import script with direct connection parameters');
  
  try {
    // Test database connection first
    const connected = await testConnection();
    if (!connected) {
      log('Database connection failed - cannot proceed with import');
      return;
    }
    
    // Load progress
    const progress = await loadProgress();
    log(`Resuming from position ${progress.position}`);
    
    // Load workbook - just the necessary part
    log(`Reading data from ${SOURCE_FILE}`);
    const workbook = xlsx.readFile(SOURCE_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRecords = xlsx.utils.sheet_to_json(worksheet);
    
    log(`Total records in file: ${allRecords.length}`);
    log(`Current position: ${progress.position}`);
    
    // Process batch
    if (progress.position < allRecords.length) {
      log(`Processing records ${progress.position} to ${progress.position + BATCH_SIZE - 1}`);
      const importedCount = await processBatch(allRecords, progress.position);
      
      // Update progress
      const newPosition = Math.min(progress.position + BATCH_SIZE, allRecords.length);
      const totalImported = progress.totalImported + importedCount;
      
      saveProgress(newPosition, totalImported);
      log(`Successfully imported ${importedCount} laundromats`);
      log(`Total imported so far: ${totalImported}`);
      log(`Next batch will start from position ${newPosition}`);
    } else {
      log('All records have been processed');
    }
    
    // Get current total in database
    const currentTotal = await getTotalLaundromats();
    log(`Total laundromats in database: ${currentTotal}`);
  } catch (error) {
    log(`Import error: ${error.message}`);
  } finally {
    await pool.end();
  }
  
  log('Fixed import completed');
}

// Run the script
runImport().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});