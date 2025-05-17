/**
 * Import Mini Batch Script
 * 
 * This script imports a small batch of laundromats (25 at a time)
 * from the Outscraper data file to avoid memory issues on Replit.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configure logging
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'import.log');
const PROGRESS_FILE = path.join(process.cwd(), 'import-progress.json');
const BATCH_SIZE = 25;

// Log function with timestamps
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}`;
  console.log(logEntry);
  fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

// State abbreviation to full name mapping
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

// Generate a slug from text
function generateSlug(name, city, state) {
  const base = [
    name, 
    city, 
    state
  ]
    .map(s => s ? s.toLowerCase() : '')
    .map(s => s.replace(/[^a-z0-9]+/g, '-'))
    .map(s => s.replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-');
  
  return base || 'unnamed-laundromat';
}

// Generate SEO description
function generateSeoDescription(record) {
  const name = record.name || 'Our laundromat';
  const city = record.city || 'the area';
  const state = record.state || '';
  
  const location = state ? `${city}, ${state}` : city;
  
  const descriptions = [
    `${name} provides quality laundry services in ${location}.`,
    `Visit ${name} in ${location} for all your laundry needs.`,
    `${name} offers convenient laundry services for ${location} residents.`,
    `Looking for a laundromat in ${location}? ${name} has you covered.`,
    `${name} is your go-to laundromat in ${location}.`
  ];
  
  // Random description to add variety
  const randomIndex = Math.floor(Math.random() * descriptions.length);
  return descriptions[randomIndex];
}

// Get state name from abbreviation
function getStateNameFromAbbr(abbr) {
  return stateMap[abbr] || abbr;
}

// Load or initialize progress tracking
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  // Initial progress
  return {
    position: 0,
    totalImported: 0,
    lastBatchSize: 0,
    lastBatchTime: null
  };
}

// Save progress
function saveProgress(progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Function to get or create a state
async function getOrCreateState(client, stateAbbr) {
  try {
    // Check if state exists
    const stateQuery = 'SELECT id FROM states WHERE code = $1';
    const stateResult = await client.query(stateQuery, [stateAbbr]);
    
    if (stateResult.rows.length > 0) {
      return stateResult.rows[0].id;
    }
    
    // State doesn't exist, create it
    const stateName = getStateNameFromAbbr(stateAbbr);
    const insertStateQuery = 'INSERT INTO states (code, name) VALUES ($1, $2) RETURNING id';
    const insertResult = await client.query(insertStateQuery, [stateAbbr, stateName]);
    
    return insertResult.rows[0].id;
  } catch (error) {
    log(`Error getting/creating state ${stateAbbr}: ${error.message}`);
    throw error;
  }
}

// Function to get or create a city
async function getOrCreateCity(client, cityName, stateId) {
  try {
    // Check if city exists
    const cityQuery = 'SELECT id FROM cities WHERE name ILIKE $1 AND "stateId" = $2';
    const cityResult = await client.query(cityQuery, [cityName, stateId]);
    
    if (cityResult.rows.length > 0) {
      return cityResult.rows[0].id;
    }
    
    // City doesn't exist, create it
    const slug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const insertCityQuery = 'INSERT INTO cities (name, "stateId", slug, "laundryCount") VALUES ($1, $2, $3, $4) RETURNING id';
    const insertResult = await client.query(insertCityQuery, [cityName, stateId, slug, 0]);
    
    return insertResult.rows[0].id;
  } catch (error) {
    log(`Error getting/creating city ${cityName}: ${error.message}`);
    throw error;
  }
}

// Update city laundry count
async function updateCityLaundryCount(client, cityId) {
  try {
    const countQuery = 'SELECT COUNT(*) FROM laundromats WHERE "cityId" = $1';
    const countResult = await client.query(countQuery, [cityId]);
    const count = countResult.rows[0].count;
    
    const updateQuery = 'UPDATE cities SET "laundryCount" = $1 WHERE id = $2';
    await client.query(updateQuery, [count, cityId]);
  } catch (error) {
    log(`Error updating laundry count for city ${cityId}: ${error.message}`);
  }
}

// Process the Excel file and extract a batch of laundromats
async function processExcelBatch(progress) {
  try {
    const excelFile = path.join(process.cwd(), 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');
    
    if (!fs.existsSync(excelFile)) {
      log(`Excel file not found: ${excelFile}`);
      return { success: false, records: [], message: 'Excel file not found' };
    }
    
    // Read Excel file
    const workbook = xlsx.readFile(excelFile);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const allRecords = xlsx.utils.sheet_to_json(worksheet);
    
    log(`Total records in file: ${allRecords.length}`);
    log(`Current position: ${progress.position}`);
    
    // Extract the batch we want to process
    const endPosition = Math.min(progress.position + BATCH_SIZE, allRecords.length);
    const batchRecords = allRecords.slice(progress.position, endPosition);
    
    log(`Processing records ${progress.position + 1} to ${endPosition}`);
    
    // Prepare processed records
    const processedRecords = batchRecords.map(record => {
      // Parse address
      let address = record.address || '';
      let city = '';
      let state = '';
      let zip = '';
      
      const addressParts = address.split(',').map(part => part.trim());
      
      if (addressParts.length >= 3) {
        // Last part usually contains state and zip
        const lastPart = addressParts[addressParts.length - 1];
        const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
        
        if (stateZipMatch) {
          state = stateZipMatch[1];
          zip = stateZipMatch[2];
        }
        
        // Second to last part usually contains city
        city = addressParts[addressParts.length - 2];
        
        // First parts are the street address
        address = addressParts.slice(0, addressParts.length - 2).join(', ');
      }
      
      // Handle missing or incomplete data
      if (!address || address.length < 5) {
        address = '123 Main St'; // Placeholder, will be fixed later with coordinates
      }
      
      if (!city) {
        city = 'Unknown City';
      }
      
      if (!state) {
        state = 'XX';
      }
      
      if (!zip) {
        zip = '00000';
      }
      
      // Parse coordinates
      let latitude = '';
      let longitude = '';
      
      if (record.gps_coordinates) {
        const coordParts = record.gps_coordinates.split(',').map(part => part.trim());
        if (coordParts.length >= 2) {
          latitude = coordParts[0];
          longitude = coordParts[1];
        }
      }
      
      // Generate hours in JSON format
      const hours = JSON.stringify({
        "Monday": "7:00 AM - 10:00 PM",
        "Tuesday": "7:00 AM - 10:00 PM",
        "Wednesday": "7:00 AM - 10:00 PM",
        "Thursday": "7:00 AM - 10:00 PM",
        "Friday": "7:00 AM - 10:00 PM",
        "Saturday": "7:00 AM - 10:00 PM",
        "Sunday": "7:00 AM - 10:00 PM"
      });
      
      // Generate services in JSON format
      const services = JSON.stringify([
        "self-service",
        "coin-operated",
        "card-payment"
      ]);
      
      // Generate amenities in JSON format
      const amenities = JSON.stringify([
        "vending-machines",
        "seating-area"
      ]);
      
      // Parse rating
      let rating = '0';
      if (record.rating) {
        const ratingMatch = record.rating.toString().match(/(\d+\.\d+|\d+)/);
        if (ratingMatch) {
          rating = ratingMatch[1];
        }
      }
      
      // Parse review count
      let reviewCount = 0;
      if (record.reviews) {
        const reviewMatch = record.reviews.toString().match(/(\d+)/);
        if (reviewMatch) {
          reviewCount = parseInt(reviewMatch[1], 10);
        }
      }
      
      // Create enriched record
      const name = record.title || 'Unnamed Laundromat';
      const slug = generateSlug(name, city, state);
      const description = generateSeoDescription({
        name,
        city,
        state
      });
      
      return {
        name,
        slug,
        address,
        city,
        state,
        zip,
        phone: record.phone || '',
        website: record.website || null,
        latitude,
        longitude,
        rating,
        hours,
        services,
        amenities,
        description,
        reviewCount,
        listingType: 'standard',
        isFeatured: false,
        isPremium: false,
        createdAt: new Date()
      };
    });
    
    return {
      success: true,
      records: processedRecords,
      newPosition: endPosition,
      isComplete: endPosition >= allRecords.length
    };
  } catch (error) {
    log(`Error processing Excel batch: ${error.message}`);
    return { success: false, records: [], message: error.message };
  }
}

// Import a batch of laundromats to the database
async function importBatch(records) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let successCount = 0;
    
    for (const record of records) {
      try {
        // Get or create state
        const stateId = await getOrCreateState(client, record.state);
        
        // Get or create city
        const cityId = await getOrCreateCity(client, record.city, stateId);
        
        // Check if laundromat with similar name and location already exists
        const checkQuery = `
          SELECT id FROM laundromats 
          WHERE name ILIKE $1 AND "cityId" = $2 AND "stateId" = $3
        `;
        const checkResult = await client.query(checkQuery, [record.name, cityId, stateId]);
        
        if (checkResult.rows.length > 0) {
          log(`Skipping duplicate laundromat: ${record.name} in ${record.city}, ${record.state}`);
          continue;
        }
        
        // Insert the laundromat
        const insertQuery = `
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website,
            latitude, longitude, rating, hours, services, amenities,
            description, "reviewCount", "listingType", "isFeatured", "isPremium",
            "createdAt", "cityId", "stateId"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19,
            $20, $21, $22
          )
        `;
        
        await client.query(insertQuery, [
          record.name, record.slug, record.address, record.city, record.state, record.zip,
          record.phone, record.website, record.latitude, record.longitude, record.rating,
          record.hours, record.services, record.amenities, record.description,
          record.reviewCount, record.listingType, record.isFeatured, record.isPremium,
          record.createdAt, cityId, stateId
        ]);
        
        // Update city laundry count
        await updateCityLaundryCount(client, cityId);
        
        successCount++;
        log(`Imported laundromat: ${record.name} in ${record.city}, ${record.state}`);
      } catch (error) {
        log(`Error importing laundromat ${record.name}: ${error.message}`);
      }
    }
    
    await client.query('COMMIT');
    return { success: true, count: successCount };
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Transaction error: ${error.message}`);
    return { success: false, message: error.message };
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  log('Starting mini-batch import');
  
  // Load progress
  const progress = loadProgress();
  log(`Resuming from position ${progress.position}`);
  
  // Process a batch
  const batchResult = await processExcelBatch(progress);
  
  if (!batchResult.success) {
    log(`Failed to process batch: ${batchResult.message}`);
    return;
  }
  
  // Import the processed records
  const importResult = await importBatch(batchResult.records);
  
  if (importResult.success) {
    // Update progress
    progress.position = batchResult.newPosition;
    progress.totalImported += importResult.count;
    progress.lastBatchSize = importResult.count;
    progress.lastBatchTime = new Date().toISOString();
    saveProgress(progress);
    
    log(`Successfully imported ${importResult.count} laundromats`);
    log(`Total imported so far: ${progress.totalImported}`);
    
    if (batchResult.isComplete) {
      log('All records have been processed from the Excel file');
    } else {
      log(`Next batch will start from position ${progress.position}`);
    }
  } else {
    log(`Import failed: ${importResult.message}`);
  }
  
  // Get current count
  const countResult = await pool.query('SELECT COUNT(*) FROM laundromats');
  const totalCount = countResult.rows[0].count;
  log(`Total laundromats in database: ${totalCount}`);
  
  log('Mini-batch import completed');
}

// Run the script
main()
  .then(() => {
    setTimeout(() => {
      pool.end();
      process.exit(0);
    }, 1000);
  })
  .catch(error => {
    log(`Unhandled error: ${error.message}`);
    setTimeout(() => {
      pool.end();
      process.exit(1);
    }, 1000);
  });