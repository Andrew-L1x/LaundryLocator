/**
 * Background Laundromat Import Service
 * 
 * This script runs as a background service to continuously import
 * laundromat data in small batches with automatic pauses and retry logic.
 * 
 * Usage:
 * - Run with: node scripts/background-import.js
 * - Press Ctrl+C to stop gracefully
 */

import fs from 'fs/promises';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import xlsx from 'xlsx';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants
const BATCH_SIZE = 50;
const PAUSE_BETWEEN_BATCHES = 5000; // 5 seconds
const EXCEL_FILE = './attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';
const PROGRESS_FILE = './import-progress.json';
const LOG_FILE = './import-log.json';
const PID_FILE = './import-service.pid';
const TOTAL_RECORDS = 27188;

// State mapping for full names
const STATE_MAPPING = {
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

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function updateStatus(status) {
  process.stdout.write(`\r${status}`.padEnd(100));
}

/**
 * Get current laundromat count from the database
 */
async function getCurrentCount() {
  const result = await pool.query('SELECT COUNT(*) FROM laundromats');
  return parseInt(result.rows[0].count);
}

/**
 * Load or initialize progress tracking file
 */
async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Create a new progress object if file doesn't exist
    const startTime = Date.now();
    return {
      totalImported: 0,
      lastBatchSize: 0,
      lastRunTime: 0,
      currentState: null,
      currentOffset: 0,
      completedStates: [],
      remainingStates: Object.keys(STATE_MAPPING),
      batchesRun: 0,
      totalRunTime: 0,
      startTime,
      recordsPerMinute: 0,
      errors: [],
      lastUpdate: new Date().toISOString()
    };
  }
}

/**
 * Save progress to file
 */
async function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Append to log file
 */
async function logOperation(operation) {
  try {
    let logs = [];
    try {
      const data = await fs.readFile(LOG_FILE, 'utf8');
      logs = JSON.parse(data);
    } catch (e) {
      // File doesn't exist, start with empty array
    }
    
    logs.push({
      timestamp: new Date().toISOString(),
      ...operation
    });
    
    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error(`Error logging operation: ${error.message}`);
  }
}

function getStateNameFromAbbr(abbr) {
  return STATE_MAPPING[abbr] || abbr;
}

function generateSlug(name, city, state) {
  if (!name) return '';
  
  const base = (name + '-' + city + '-' + state)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return base;
}

function generateSeoTags(record) {
  const tags = [];
  
  // Location-based tags
  tags.push(`laundromat in ${record.city}`);
  tags.push(`laundromat in ${record.city} ${record.state}`);
  tags.push(`${record.city} laundry services`);
  
  // Service-based tags
  if (record.services && record.services.length > 0) {
    record.services.forEach(service => {
      tags.push(`${service} in ${record.city}`);
    });
  }
  
  // Feature-based tags
  if (record.open24Hours) tags.push('24 hour laundromat');
  if (record.attendant) tags.push('attended laundromat');
  if (record.wifi) tags.push('laundromat with wifi');
  if (record.dropOffService) tags.push('drop-off laundry service');
  
  return tags.filter(Boolean).join(',');
}

function generateSeoDescription(record) {
  let description = `${record.name} is a laundromat located in ${record.city}, ${record.state_full || record.state}`;
  
  if (record.address) {
    description += ` at ${record.address}`;
  }
  
  if (record.rating && record.ratingCount) {
    description += `. Rated ${record.rating}/5 based on ${record.ratingCount} reviews`;
  }
  
  // Add hours if available
  if (record.hours) {
    if (record.open24Hours) {
      description += `. Open 24 hours a day for your convenience`;
    } else {
      description += `. ${record.hours}`;
    }
  }
  
  // Add services
  if (record.services && record.services.length > 0) {
    description += `. Services include: ${record.services.join(', ')}`;
  }
  
  // Add features
  const features = [];
  if (record.wifi) features.push('free WiFi');
  if (record.attendant) features.push('attended service');
  if (record.dropOffService) features.push('drop-off laundry');
  
  if (features.length > 0) {
    description += `. Features: ${features.join(', ')}`;
  }
  
  description += `. Call ${record.phone} for more information.`;
  
  return description;
}

function generateSeoTitle(record) {
  let title = `${record.name} - Laundromat in ${record.city}, ${record.state}`;
  
  // Add a key feature if available
  if (record.open24Hours) {
    title = `${record.name} - 24 Hour Laundromat in ${record.city}, ${record.state}`;
  } else if (record.dropOffService) {
    title = `${record.name} - Drop-off Laundry Service in ${record.city}, ${record.state}`;
  }
  
  return title;
}

/**
 * Run a single import batch
 */
async function runImportBatch() {
  // Load current progress
  const progress = await loadProgress();
  const startTime = Date.now();
  
  try {
    // Select next state to process if none is in progress
    if (!progress.currentState) {
      if (progress.remainingStates.length === 0) {
        log('All states have been processed. Import complete!');
        return false;
      }
      
      progress.currentState = progress.remainingStates[0];
      progress.currentOffset = 0;
    }
    
    const currentState = progress.currentState;
    const offset = progress.currentOffset || 0;
    
    log(`Processing ${currentState} - Offset: ${offset}`);
    
    // Load Excel workbook
    const workbook = xlsx.readFile(EXCEL_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    
    // Filter records for current state
    const stateRecords = jsonData.filter(record => 
      record.state === currentState || 
      record.state === getStateNameFromAbbr(currentState)
    );
    
    // No records for this state, move to next
    if (stateRecords.length === 0) {
      log(`No records found for ${currentState}, moving to next state`);
      
      // Mark state as completed
      if (!progress.completedStates) {
        progress.completedStates = [];
      }
      progress.completedStates.push(currentState);
      
      // Ensure remainingStates is initialized
      if (!progress.remainingStates) {
        progress.remainingStates = Object.keys(STATE_MAPPING);
      }
      
      progress.remainingStates = progress.remainingStates.filter(s => s !== currentState);
      progress.currentState = null;
      progress.currentOffset = 0;
      
      await saveProgress(progress);
      return true;
    }
    
    // Get batch of records
    const batch = stateRecords.slice(offset, offset + BATCH_SIZE);
    
    if (batch.length === 0) {
      log(`All ${stateRecords.length} records for ${currentState} processed, moving to next state`);
      
      // Mark state as completed
      if (!progress.completedStates) {
        progress.completedStates = [];
      }
      progress.completedStates.push(currentState);
      
      // Ensure remainingStates is initialized
      if (!progress.remainingStates) {
        progress.remainingStates = Object.keys(STATE_MAPPING);
      }
      
      progress.remainingStates = progress.remainingStates.filter(s => s !== currentState);
      progress.currentState = null;
      progress.currentOffset = 0;
      
      await saveProgress(progress);
      return true;
    }
    
    // Process batch
    log(`Processing batch of ${batch.length} records for ${currentState}`);
    
    // Start a database transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get or create state
      const stateName = getStateNameFromAbbr(currentState);
      const stateSlug = stateName.toLowerCase().replace(/\\s+/g, '-');
      
      const stateResult = await client.query(
        'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3) ON CONFLICT (abbr) DO UPDATE SET name = $1, slug = $2 RETURNING id',
        [stateName, stateSlug, currentState]
      );
      
      const stateId = stateResult.rows[0].id;
      
      // Create a map to track cities
      const cityMap = new Map();
      
      // Process each record
      for (const record of batch) {
        try {
          // Enrich record data
          const stateAbbr = record.state.length <= 2 ? record.state : 
                           Object.entries(STATE_MAPPING).find(([abbr, name]) => name === record.state)?.[0] || record.state;
          const stateFull = record.state.length <= 2 ? getStateNameFromAbbr(record.state) : record.state;
          
          // Get or create city
          let cityId;
          const cityName = record.city ? record.city.trim() : 'Unknown';
          
          if (cityMap.has(cityName)) {
            cityId = cityMap.get(cityName);
          } else {
            const citySlug = cityName.toLowerCase().replace(/\\s+/g, '-');
            
            const cityResult = await client.query(
              'INSERT INTO cities (name, slug, state_id) VALUES ($1, $2, $3) ON CONFLICT (name, state_id) DO UPDATE SET slug = $2 RETURNING id',
              [cityName, citySlug, stateId]
            );
            
            cityId = cityResult.rows[0].id;
            cityMap.set(cityName, cityId);
          }
          
          // Generate slug
          const slug = generateSlug(record.title, cityName, stateFull);
          
          // Parse services
          let services = [];
          if (record.services && typeof record.services === 'string') {
            services = record.services.split(',').map(s => s.trim()).filter(Boolean);
          }
          
          // Prepare additional fields
          const open24Hours = (record.hours && record.hours.toLowerCase().includes('24 hour')) || 
                             (record.title && record.title.toLowerCase().includes('24 hour'));
          
          const dropOffService = services.some(s => 
            s.toLowerCase().includes('drop') && s.toLowerCase().includes('off')
          );
          
          const pickup = services.some(s => 
            s.toLowerCase().includes('pickup') || s.toLowerCase().includes('pick up')
          );
          
          const delivery = services.some(s => 
            s.toLowerCase().includes('delivery')
          );
          
          const dryClean = services.some(s => 
            s.toLowerCase().includes('dry clean')
          );
          
          const wifi = services.some(s => 
            s.toLowerCase().includes('wifi') || s.toLowerCase().includes('wi-fi')
          );
          
          const attendant = services.some(s => 
            s.toLowerCase().includes('attendant') || s.toLowerCase().includes('attended')
          );
          
          // Generate SEO data
          const seoTitle = generateSeoTitle({
            ...record,
            state_full: stateFull,
            services,
            open24Hours,
            dropOffService
          });
          
          const seoDescription = generateSeoDescription({
            ...record,
            state_full: stateFull,
            services,
            open24Hours,
            wifi,
            attendant,
            dropOffService
          });
          
          const seoTags = generateSeoTags({
            ...record,
            state_full: stateFull,
            services,
            open24Hours,
            wifi,
            attendant,
            dropOffService
          });
          
          // Calculate premium score
          let premiumScore = 0;
          
          if (record.rating) {
            premiumScore += parseFloat(record.rating) * 10;
          }
          
          if (record.ratingCount) {
            premiumScore += Math.min(parseInt(record.ratingCount) / 10, 20);
          }
          
          if (services && services.length > 0) {
            premiumScore += services.length * 5;
          }
          
          if (open24Hours) premiumScore += 15;
          if (dropOffService) premiumScore += 10;
          if (pickup) premiumScore += 10;
          if (delivery) premiumScore += 10;
          if (dryClean) premiumScore += 5;
          if (wifi) premiumScore += 5;
          if (attendant) premiumScore += 5;
          
          premiumScore = Math.min(Math.round(premiumScore), 100);
          
          // Insert laundromat record
          await client.query(
            \`INSERT INTO laundromats (
              name, slug, address, city, state, zip, phone, website, 
              latitude, longitude, hours, rating, rating_count, premium_score,
              description, seo_title, seo_description, seo_tags, services,
              open_24_hours, drop_off_service, pickup, delivery, dry_clean, 
              wifi, attendant, city_id, state_id, is_premium
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 
              $9, $10, $11, $12, $13, $14,
              $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24,
              $25, $26, $27, $28, $29
            ) ON CONFLICT (slug) DO NOTHING\`,
            [
              record.title, slug, record.address, cityName, stateFull, record.zipcode, 
              record.phone, record.website || null, record.latitude, record.longitude,
              record.hours || null, record.rating || null, record.ratingCount || null, premiumScore,
              record.description || seoDescription, seoTitle, seoDescription, seoTags, services,
              open24Hours, dropOffService, pickup, delivery, dryClean,
              wifi, attendant, cityId, stateId, false
            ]
          );
        } catch (error) {
          // Log error but continue with other records
          console.error(`Error processing record: ${error.message}`);
          
          if (!progress.errors) {
            progress.errors = [];
          }
          
          progress.errors.push({
            timestamp: new Date().toISOString(),
            message: error.message,
            record: record.title
          });
        }
      }
      
      // Update city and state laundry counts
      await client.query(
        'UPDATE cities c SET laundry_count = (SELECT COUNT(*) FROM laundromats l WHERE l.city_id = c.id)'
      );
      
      await client.query(
        'UPDATE states s SET laundry_count = (SELECT COUNT(*) FROM laundromats l WHERE l.state_id = s.id)'
      );
      
      await client.query('COMMIT');
      
      // Update progress
      progress.currentOffset += batch.length;
      progress.totalImported += batch.length;
      progress.lastBatchSize = batch.length;
      progress.batchesRun += 1;
      
      const runTime = Date.now() - startTime;
      progress.lastRunTime = runTime;
      progress.totalRunTime += runTime;
      
      // Calculate records per minute
      const elapsedMinutes = progress.totalRunTime / 1000 / 60;
      if (elapsedMinutes > 0) {
        progress.recordsPerMinute = progress.totalImported / elapsedMinutes;
      }
      
      await saveProgress(progress);
      
      // Log operation
      await logOperation({
        type: 'batch_import',
        state: currentState,
        batchSize: batch.length,
        offset: offset,
        recordsImported: batch.length,
        runTime
      });
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    log(`Error in batch: ${error.message}`);
    
    if (!progress.errors) {
      progress.errors = [];
    }
    
    progress.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message
    });
    
    await saveProgress(progress);
    
    // Log error
    await logOperation({
      type: 'error',
      message: error.message
    });
    
    return true; // Continue with next batch despite error
  }
}

/**
 * Check if we should stop the import process
 */
function shouldStop() {
  try {
    // Check for a stop file
    if (fs.existsSync('/home/runner/workspace/import-stop')) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Main background import loop
 */
async function startBackgroundImport() {
  // Save PID
  await fs.writeFile(PID_FILE, process.pid.toString());
  
  log('Starting background import process');
  
  let isRunning = true;
  let consecutiveErrors = 0;
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    log('Received shutdown signal, finishing current batch...');
    isRunning = false;
  });
  
  try {
    // Get starting count
    const startCount = await getCurrentCount();
    log(`Starting import process with ${startCount} existing records`);
    
    // Main import loop
    while (isRunning) {
      try {
        if (shouldStop()) {
          log('Stop file detected, shutting down gracefully');
          break;
        }
        
        const result = await runImportBatch();
        
        // If runImportBatch returns false, we're done
        if (result === false) {
          log('Import process complete!');
          break;
        }
        
        // Reset error counter after successful batch
        consecutiveErrors = 0;
        
        // Pause between batches
        await sleep(PAUSE_BETWEEN_BATCHES);
      } catch (error) {
        log(`Error in import loop: ${error.message}`);
        consecutiveErrors++;
        
        // If we have too many consecutive errors, take a longer break
        if (consecutiveErrors > 5) {
          log(`Too many consecutive errors (${consecutiveErrors}), taking a longer break...`);
          await sleep(PAUSE_BETWEEN_BATCHES * 6);
        } else {
          await sleep(PAUSE_BETWEEN_BATCHES);
        }
      }
    }
    
    // Get final count
    const endCount = await getCurrentCount();
    log(`Import process completed. Added ${endCount - startCount} records for a total of ${endCount}`);
  } catch (error) {
    log(`Fatal error in import process: ${error.message}`);
  } finally {
    // Clean up
    try {
      await fs.unlink(PID_FILE);
    } catch (e) {
      // Ignore errors when removing PID file
    }
    
    // Close database pool
    await pool.end();
    
    log('Background import process finished');
  }
}

// Start the import process
startBackgroundImport().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});