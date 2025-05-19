/**
 * Batch Text Conversion Script
 * 
 * This script converts Google Places API data to text format for all laundromats
 * to significantly reduce API costs. The script:
 * 
 * 1. Processes laundromats in batches to avoid memory issues
 * 2. Converts business hours, reviews, photos, and nearby places to text format
 * 3. Stores the converted data in the places_text_data column
 * 4. Tracks progress and can resume from failures
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuration
const BATCH_SIZE = 100;
const LOG_FILE = 'text-conversion.log';
const PROGRESS_FILE = 'text-conversion-progress.json';

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also append to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

/**
 * Load progress from file or initialize new progress
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  // Default progress
  return {
    lastProcessedId: 0,
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString()
  };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  progress.lastUpdateTime = new Date().toISOString();
  
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    log(`Error saving progress file: ${error.message}`);
  }
}

/**
 * Get count of laundromats
 */
async function getLaundromatCount() {
  try {
    const query = 'SELECT COUNT(*) FROM laundromats';
    const result = await pool.query(query);
    return parseInt(result.rows[0].count);
  } catch (error) {
    log(`Error getting laundromat count: ${error.message}`);
    return 0;
  }
}

/**
 * Get batch of laundromats
 */
async function getLaundromatBatch(lastId, batchSize) {
  try {
    const query = `
      SELECT 
        id, 
        name, 
        business_hours,
        google_place_id,
        google_details,
        nearby_places,
        places_text_data
      FROM laundromats
      WHERE id > $1
      ORDER BY id
      LIMIT $2
    `;
    
    const result = await pool.query(query, [lastId, batchSize]);
    return result.rows;
  } catch (error) {
    log(`Error getting laundromat batch: ${error.message}`);
    return [];
  }
}

/**
 * Convert business hours to text format
 */
function convertHoursToText(businessHours) {
  if (!Array.isArray(businessHours) || businessHours.length === 0) {
    return [];
  }
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const result = [];
  
  // Create a map to hold days and their opening/closing times
  const dayMap = {};
  
  // Initialize all days as "Closed"
  days.forEach(day => {
    dayMap[day] = "Closed";
  });
  
  // Fill in actual hours
  businessHours.forEach(period => {
    if (!period || typeof period !== 'object') return;
    
    try {
      if (period.open && typeof period.open === 'object' && 
          period.close && typeof period.close === 'object') {
        
        if (typeof period.open.day === 'number' && period.open.day >= 0 && period.open.day <= 6) {
          const day = days[period.open.day];
          let openTime = 'Unknown';
          let closeTime = 'Unknown';
          
          if (typeof period.open.time === 'string' && period.open.time.length >= 4) {
            // Convert 24-hour time to 12-hour format
            const hour = parseInt(period.open.time.slice(0, 2));
            const minute = period.open.time.slice(2);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            openTime = `${hour12}:${minute} ${ampm}`;
          }
          
          if (typeof period.close.time === 'string' && period.close.time.length >= 4) {
            // Convert 24-hour time to 12-hour format
            const hour = parseInt(period.close.time.slice(0, 2));
            const minute = period.close.time.slice(2);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            closeTime = `${hour12}:${minute} ${ampm}`;
          }
          
          dayMap[day] = `${openTime} – ${closeTime}`;
        }
      }
    } catch (error) {
      console.error(`Error processing hours for period:`, period, error);
    }
  });
  
  // Check for 24-hour operation
  const allSameHours = new Set(Object.values(dayMap)).size === 1 && 
                      Object.values(dayMap)[0].includes('12:00 AM – 11:59 PM');
  
  if (allSameHours) {
    return ['Open 24 hours, 7 days a week'];
  }
  
  // Convert map to array of strings
  days.forEach(day => {
    result.push(`${day}: ${dayMap[day]}`);
  });
  
  return result;
}

/**
 * Process reviews for text storage
 */
function processReviews(googleDetails) {
  if (!googleDetails || !googleDetails.reviews || !Array.isArray(googleDetails.reviews)) {
    return [];
  }
  
  return googleDetails.reviews.map(review => {
    if (!review || typeof review !== 'object') return null;
    
    try {
      return {
        author: review.author_name || review.author || 'Anonymous',
        rating: review.rating || 0,
        text: review.text || '',
        time: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
        language: review.language || 'en'
      };
    } catch (error) {
      console.error(`Error processing review:`, review, error);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Process photos for text storage
 */
function processPhotos(googleDetails) {
  if (!googleDetails || !googleDetails.photos || !Array.isArray(googleDetails.photos)) {
    return [];
  }
  
  return googleDetails.photos.map((photo, index) => {
    if (!photo || typeof photo !== 'object') return null;
    
    try {
      return {
        id: index,
        reference: photo.photo_reference || '',
        width: photo.width || 0,
        height: photo.height || 0,
        attribution: photo.html_attributions && photo.html_attributions.length > 0 ? 
                    photo.html_attributions[0] : ''
      };
    } catch (error) {
      console.error(`Error processing photo:`, photo, error);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Format nearby places for text storage
 */
function formatNearbyPlaces(nearbyPlaces) {
  if (!Array.isArray(nearbyPlaces) || nearbyPlaces.length === 0) {
    return {};
  }
  
  const placesByType = {};
  
  nearbyPlaces.forEach(place => {
    if (!place || typeof place !== 'object') return;
    
    try {
      // Get the primary type of the place
      const types = place.types || [];
      const type = types.length > 0 ? types[0] : 'other';
      
      if (!placesByType[type]) {
        placesByType[type] = [];
      }
      
      placesByType[type].push({
        name: place.name || 'Unknown Place',
        vicinity: place.vicinity || '',
        distance: place.distance || null,
        rating: place.rating || null,
        placeId: place.place_id || null
      });
    } catch (error) {
      console.error(`Error processing nearby place:`, place, error);
    }
  });
  
  return placesByType;
}

/**
 * Extract amenities from details
 */
function extractAmenities(googleDetails) {
  const amenities = ['Laundromat'];
  
  // Check for common amenities based on available fields
  if (googleDetails) {
    if (googleDetails.wheelchair_accessible_entrance) {
      amenities.push('Wheelchair Accessible');
    }
    
    if (googleDetails.serves_beer || googleDetails.serves_wine) {
      amenities.push('Refreshments Available');
    }
    
    if (googleDetails.has_tv || googleDetails.has_wifi) {
      amenities.push('Entertainment');
    }
  }
  
  return amenities;
}

/**
 * Convert laundromat data to text format
 */
function convertToTextFormat(laundromat) {
  // Create the text-based data structure
  const textData = {
    weekdayText: [],
    reviews: [],
    photoRefs: [],
    nearbyPlaces: {},
    amenities: ['Laundromat', 'Local Service'],
    lastUpdated: new Date().toISOString()
  };
  
  // Process business hours
  if (Array.isArray(laundromat.business_hours)) {
    textData.weekdayText = convertHoursToText(laundromat.business_hours);
  } else if (laundromat.google_details && 
             laundromat.google_details.opening_hours && 
             Array.isArray(laundromat.google_details.opening_hours.periods)) {
    textData.weekdayText = convertHoursToText(laundromat.google_details.opening_hours.periods);
  } else if (laundromat.google_details && 
             laundromat.google_details.opening_hours && 
             Array.isArray(laundromat.google_details.opening_hours.weekday_text)) {
    textData.weekdayText = laundromat.google_details.opening_hours.weekday_text;
  }
  
  // Process reviews
  if (laundromat.google_details) {
    textData.reviews = processReviews(laundromat.google_details);
    textData.photoRefs = processPhotos(laundromat.google_details);
    
    // Add more amenities if available
    const detailAmenities = extractAmenities(laundromat.google_details);
    textData.amenities = [...new Set([...textData.amenities, ...detailAmenities])];
  }
  
  // Process nearby places
  if (Array.isArray(laundromat.nearby_places)) {
    textData.nearbyPlaces = formatNearbyPlaces(laundromat.nearby_places);
  }
  
  return textData;
}

/**
 * Process a single laundromat
 */
async function processLaundromat(laundromat) {
  try {
    // Skip if already has text data
    if (laundromat.places_text_data && 
        Object.keys(laundromat.places_text_data).length > 0) {
      return {
        id: laundromat.id,
        status: 'skipped',
        reason: 'already has text data'
      };
    }
    
    // Check if we have any data to convert
    const hasSourceData = laundromat.business_hours || 
                        (laundromat.google_details && Object.keys(laundromat.google_details).length > 0) ||
                        (laundromat.nearby_places && laundromat.nearby_places.length > 0);
    
    if (!hasSourceData) {
      return {
        id: laundromat.id,
        status: 'skipped',
        reason: 'no source data available'
      };
    }
    
    // Convert to text format
    const textData = convertToTextFormat(laundromat);
    
    // Save to database
    const updateQuery = `
      UPDATE laundromats
      SET places_text_data = $1
      WHERE id = $2
    `;
    
    await pool.query(updateQuery, [textData, laundromat.id]);
    
    return {
      id: laundromat.id,
      status: 'success',
      dataSize: JSON.stringify(textData).length
    };
  } catch (error) {
    return {
      id: laundromat.id,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Process a batch of laundromats
 */
async function processBatch(lastId, batchSize, progress) {
  const laundromats = await getLaundromatBatch(lastId, batchSize);
  
  if (laundromats.length === 0) {
    return { 
      lastId,
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      hasMore: false
    };
  }
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  log(`Processing batch of ${laundromats.length} laundromats starting after ID ${lastId}`);
  
  for (const laundromat of laundromats) {
    const result = await processLaundromat(laundromat);
    
    if (result.status === 'success') {
      successCount++;
      progress.successCount++;
      log(`✓ ID ${laundromat.id} - ${laundromat.name}: Converted to text (${result.dataSize} bytes)`);
    } else if (result.status === 'error') {
      errorCount++;
      progress.errorCount++;
      log(`✗ ID ${laundromat.id} - ${laundromat.name}: Error - ${result.error}`);
    } else if (result.status === 'skipped') {
      skippedCount++;
      log(`○ ID ${laundromat.id} - ${laundromat.name}: Skipped - ${result.reason}`);
    }
    
    // Update last processed ID
    progress.lastProcessedId = laundromat.id;
    progress.totalProcessed++;
    
    // Save progress every 10 laundromats
    if (progress.totalProcessed % 10 === 0) {
      saveProgress(progress);
    }
  }
  
  // Get the last ID from the batch
  const newLastId = laundromats[laundromats.length - 1].id;
  
  return {
    lastId: newLastId,
    processedCount: laundromats.length,
    successCount,
    errorCount,
    skippedCount,
    hasMore: laundromats.length === batchSize
  };
}

/**
 * Process all laundromats
 */
async function processAllLaundromats() {
  // Load progress
  const progress = loadProgress();
  let lastId = progress.lastProcessedId;
  
  log(`Starting text conversion from last processed ID: ${lastId}`);
  log(`Progress so far: ${progress.totalProcessed} processed, ${progress.successCount} successful, ${progress.errorCount} errors`);
  
  // Get total count for progress reporting
  const totalCount = await getLaundromatCount();
  log(`Total laundromats in database: ${totalCount}`);
  
  let hasMore = true;
  
  while (hasMore) {
    const batchResult = await processBatch(lastId, BATCH_SIZE, progress);
    
    lastId = batchResult.lastId;
    hasMore = batchResult.hasMore;
    
    log(`Batch complete: ${batchResult.processedCount} processed, ${batchResult.successCount} successful, ${batchResult.errorCount} errors, ${batchResult.skippedCount} skipped`);
    
    // Save progress after each batch
    saveProgress(progress);
    
    // Calculate overall progress
    const percentComplete = (progress.totalProcessed / totalCount * 100).toFixed(2);
    log(`Overall progress: ${percentComplete}% (${progress.totalProcessed}/${totalCount})`);
    
    // Optional: Add a small delay between batches to reduce database load
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`Text conversion complete! Total processed: ${progress.totalProcessed}, successful: ${progress.successCount}, errors: ${progress.errorCount}`);
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting batch text conversion');
    
    // Initialize log file
    if (fs.existsSync(LOG_FILE)) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      fs.renameSync(LOG_FILE, `${LOG_FILE}.${timestamp}.bak`);
    }
    fs.writeFileSync(LOG_FILE, `Text conversion started at ${new Date().toISOString()}\n`);
    
    // Process all laundromats
    await processAllLaundromats();
    
    log('Batch text conversion completed successfully');
  } catch (error) {
    log(`Unhandled error: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();