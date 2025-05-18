/**
 * Enhanced Google Places Details for Laundromats
 * 
 * This script fetches detailed information from Google Places API for each laundromat
 * including operating hours, additional photos, reviews, and detailed attributes.
 * 
 * It processes laundromats in small batches and saves progress to allow for interruption
 * and resumption.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('GOOGLE_MAPS_API_KEY environment variable not set!');
  process.exit(1);
}

// Constants
const BATCH_SIZE = 5; // Process 5 laundromats at a time
const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds between batches
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between API calls
const PROGRESS_FILE = 'laundromat-details-progress.json';

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  fs.appendFileSync('laundromat-details-enhancement.log', logMessage + '\n');
}

// Load or initialize progress tracking
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error reading progress file: ${error.message}`);
  }
  
  return {
    lastProcessedId: 0,
    processedCount: 0,
    totalProcessed: 0,
    batchStart: 0
  };
}

// Save progress
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    log(`Progress saved: Processed ${progress.processedCount} laundromats (total: ${progress.totalProcessed})`);
  } catch (error) {
    log(`Error saving progress: ${error.message}`);
  }
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Find Google Place ID for a laundromat
async function findPlaceId(laundromat) {
  try {
    const { name, address, city, state, zip, latitude, longitude } = laundromat;
    
    // Try to find the place by name and location
    const searchQuery = encodeURIComponent(`${name} laundromat ${address || ''} ${city} ${state}`);
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: searchQuery,
        key: GOOGLE_MAPS_API_KEY,
        location: `${latitude},${longitude}`,
        radius: 5000
      }
    });
    
    if (response.data.results && response.data.results.length > 0) {
      // Match the first result that seems to be a laundromat
      const possibleMatches = response.data.results.filter(place => 
        place.name.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(place.name.toLowerCase()) ||
        place.types.some(type => 
          ['laundry', 'laundromat', 'establishment'].includes(type.toLowerCase())
        )
      );
      
      if (possibleMatches.length > 0) {
        return possibleMatches[0].place_id;
      }
    }
    
    log(`No place ID found for laundromat: ${name} in ${city}, ${state}`);
    return null;
  } catch (error) {
    log(`Error finding place ID: ${error.message}`);
    return null;
  }
}

// Get detailed place information from Google Places API
async function getPlaceDetails(placeId) {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,formatted_phone_number,website,opening_hours,price_level,rating,reviews,photos,address_components,types,business_status',
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.result) {
      return response.data.result;
    }
    
    log(`No details found for place ID: ${placeId}`);
    return null;
  } catch (error) {
    log(`Error getting place details: ${error.message}`);
    return null;
  }
}

// Process detailed place information
function processPlaceDetails(details) {
  if (!details) return null;
  
  // Extract business hours
  let businessHours = null;
  if (details.opening_hours && details.opening_hours.periods) {
    businessHours = details.opening_hours.periods.map(period => ({
      open: {
        day: period.open.day,
        time: period.open.time,
      },
      close: period.close ? {
        day: period.close.day,
        time: period.close.time
      } : null
    }));
  }

  // Extract up to 5 reviews
  const reviews = details.reviews 
    ? details.reviews.slice(0, 5).map(review => ({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time
      }))
    : [];
  
  // Extract up to 3 photo references
  const photoRefs = details.photos 
    ? details.photos.slice(0, 3).map(photo => photo.photo_reference)
    : [];
    
  // Check if it's 24 hours
  const is24Hours = businessHours && businessHours.some(period => 
    !period.close || 
    (period.open.time === "0000" && period.close.time === "2359") ||
    (period.open.time === "0000" && period.close.time === "0000")
  );
  
  // Determine common amenities based on reviews
  const amenities = {
    hasWifi: checkAmenityFromReviews(reviews, ['wifi', 'internet', 'wireless']),
    hasCoinOp: checkAmenityFromReviews(reviews, ['coin', 'quarters', 'coins']),
    hasCardPayment: checkAmenityFromReviews(reviews, ['card', 'credit', 'debit', 'pay with card']),
    hasAttendant: checkAmenityFromReviews(reviews, ['attendant', 'staff', 'employee']),
    hasLargeLoads: checkAmenityFromReviews(reviews, ['large', 'big', 'industrial', 'commercial']),
    hasDryClean: checkAmenityFromReviews(reviews, ['dry clean', 'dry cleaning', 'drycleaning']),
    hasVendingMachine: checkAmenityFromReviews(reviews, ['vending', 'food', 'snack', 'drink']),
  };
  
  return {
    placeId: details.place_id,
    formattedAddress: details.formatted_address,
    formattedPhone: details.formatted_phone_number,
    website: details.website,
    rating: details.rating,
    businessHours,
    is24Hours,
    reviews,
    photoRefs,
    amenities,
    types: details.types,
    businessStatus: details.business_status
  };
}

// Check if reviews mention certain amenities
function checkAmenityFromReviews(reviews, keywords) {
  if (!reviews || reviews.length === 0) return null;
  
  const reviewText = reviews.map(r => r.text || '').join(' ').toLowerCase();
  return keywords.some(keyword => reviewText.includes(keyword)) ? true : null;
}

// Get photo URL
function getPhotoUrl(photoRef) {
  if (!photoRef) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
}

// Enhance a single laundromat with detailed Google Places data
async function enhanceLaundromat(laundromat, client) {
  try {
    const { id, name, city, state } = laundromat;
    log(`Enhancing laundromat: ${name} in ${city}, ${state} (ID: ${id})`);
    
    // Get Place ID
    const placeId = await findPlaceId(laundromat);
    if (!placeId) {
      log(`No place ID found for laundromat ID ${id}, skipping enhancement`);
      return false;
    }
    
    // Get Place Details
    const placeDetails = await getPlaceDetails(placeId);
    if (!placeDetails) {
      log(`No details found for laundromat ID ${id}, skipping enhancement`);
      return false;
    }
    
    // Process Place Details
    const enhancedDetails = processPlaceDetails(placeDetails);
    if (!enhancedDetails) {
      log(`Failed to process details for laundromat ID ${id}, skipping enhancement`);
      return false;
    }
    
    // Update database with enhanced details
    await client.query(
      `UPDATE laundromats 
       SET 
         google_place_id = $1,
         google_details = $2,
         business_hours = $3,
         is_24_hours = $4,
         updated_at = NOW()
       WHERE id = $5`,
      [
        placeId,
        JSON.stringify(enhancedDetails),
        JSON.stringify(enhancedDetails.businessHours),
        enhancedDetails.is24Hours,
        id
      ]
    );
    
    log(`Successfully enhanced laundromat ID ${id} with Google Places details`);
    return true;
  } catch (error) {
    log(`Error enhancing laundromat ID ${laundromat.id}: ${error.message}`);
    return false;
  }
}

// Process a batch of laundromats
async function processBatch(laundromats, progress, client) {
  let successCount = 0;
  
  for (let i = 0; i < laundromats.length; i++) {
    try {
      const success = await enhanceLaundromat(laundromats[i], client);
      if (success) successCount++;
      
      // Save the last processed ID
      progress.lastProcessedId = laundromats[i].id;
      progress.processedCount++;
      progress.totalProcessed++;
      
      // Save progress periodically
      if (i % 5 === 0) {
        saveProgress(progress);
      }
      
      // Add delay between requests to avoid rate limiting
      if (i < laundromats.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      log(`Error processing laundromat ID ${laundromats[i].id}: ${error.message}`);
    }
  }
  
  return successCount;
}

// Main function to process batches of laundromats
async function processBatches() {
  const progress = loadProgress();
  const client = await pool.connect();
  
  try {
    // Get total count for progress tracking
    const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const totalLaundromats = parseInt(countResult.rows[0].count);
    
    log(`Starting enhancement process. Total laundromats: ${totalLaundromats}`);
    log(`Resuming from laundromat ID: ${progress.lastProcessedId}`);
    
    let batchStart = progress.batchStart || 0;
    let keepProcessing = true;
    
    while (keepProcessing) {
      // Get next batch of laundromats
      const laundromatResult = await client.query(
        `SELECT * FROM laundromats 
         WHERE id > $1 
         ORDER BY id ASC 
         LIMIT $2`,
        [progress.lastProcessedId, BATCH_SIZE]
      );
      
      const batch = laundromatResult.rows;
      
      if (batch.length === 0) {
        log('No more laundromats to process. Enhancement complete!');
        keepProcessing = false;
        break;
      }
      
      log(`Processing batch of ${batch.length} laundromats starting from ID ${batch[0].id}`);
      
      // Process the batch
      const successCount = await processBatch(batch, progress, client);
      progress.batchStart = batchStart + BATCH_SIZE;
      
      // Save progress
      saveProgress(progress);
      
      // Calculate and log progress percentage
      const percentComplete = ((progress.totalProcessed / totalLaundromats) * 100).toFixed(2);
      log(`Batch complete. ${successCount}/${batch.length} laundromats enhanced successfully.`);
      log(`Overall progress: ${progress.totalProcessed}/${totalLaundromats} (${percentComplete}%)`);
      
      // Add delay between batches
      if (keepProcessing && batch.length === BATCH_SIZE) {
        log(`Waiting ${DELAY_BETWEEN_BATCHES/1000} seconds before processing next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
      
      batchStart += BATCH_SIZE;
    }
  } catch (error) {
    log(`Error in batch processing: ${error.message}`);
  } finally {
    client.release();
    log('Enhancement process stopped. You can resume it later.');
  }
}

// Main function
async function main() {
  try {
    log('Starting Google Places detailed enhancement process...');
    
    // Ensure log file exists
    if (!fs.existsSync('laundromat-details-enhancement.log')) {
      fs.writeFileSync('laundromat-details-enhancement.log', '');
    }
    
    await processBatches();
  } catch (error) {
    log(`Error in main process: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Start the enhancement process
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});