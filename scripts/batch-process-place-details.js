/**
 * Batch Place Details Processing Script
 * 
 * This script converts existing Google Places API data to static text format
 * for all laundromats, significantly reducing API costs by eliminating redundant
 * Place Details API calls which are the most expensive part of the Places API.
 * 
 * Place Details calls cost approximately $17 per 1000 calls, making this one of
 * the most expensive APIs in use by the LaundryLocator application.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(
    path.join(process.cwd(), 'place-details-conversion.log'),
    `[${timestamp}] ${message}\n`
  );
}

/**
 * Check if a laundromat already has places_text_data
 */
async function hasTextData(laundromat) {
  return !!(laundromat.places_text_data && 
         Object.keys(laundromat.places_text_data).length > 0);
}

/**
 * Convert business hours object to text weekday format
 * Example: ["Monday: 9:00 AM – 8:00 PM", "Tuesday: 9:00 AM – 8:00 PM", ...]
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
      log(`Error processing hours for period: ${JSON.stringify(period)}: ${error.message}`);
    }
  });
  
  // Convert map to array of strings
  days.forEach(day => {
    result.push(`${day}: ${dayMap[day]}`);
  });
  
  return result;
}

/**
 * Convert reviews array to text format
 */
function convertReviewsToText(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return [];
  }
  
  return reviews.map(review => {
    if (!review || typeof review !== 'object') return null;
    
    try {
      // Format date
      let dateText = 'Unknown date';
      if (review.time) {
        const date = new Date(review.time * 1000);
        dateText = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      // Create a text representation of the review
      return {
        author: review.author_name || 'Anonymous',
        rating: review.rating || 0,
        text: review.text || '',
        date: dateText
      };
    } catch (error) {
      log(`Error processing review: ${JSON.stringify(review)}: ${error.message}`);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Convert photo references to text URLs or minimal data
 */
function convertPhotosToText(photos, placeId) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }
  
  return photos.map((photo, index) => {
    if (!photo || typeof photo !== 'object') return null;
    
    try {
      return {
        index,
        reference: photo.photo_reference || null,
        width: photo.width || 0,
        height: photo.height || 0,
        caption: photo.html_attributions ? 
          photo.html_attributions[0]?.replace(/<[^>]*>/g, '') || '' : ''
      };
    } catch (error) {
      log(`Error processing photo: ${JSON.stringify(photo)}: ${error.message}`);
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
      const type = types[0] || 'other';
      
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
      log(`Error processing nearby place: ${JSON.stringify(place)}: ${error.message}`);
    }
  });
  
  return placesByType;
}

/**
 * Convert all Google Places API data to text format for a laundromat
 */
function convertPlacesDataToText(laundromat) {
  // Skip if already processed
  if (hasTextData(laundromat)) {
    return laundromat;
  }
  
  try {
    // Create the text-based data structure
    const textData = {
      weekdayText: [],
      reviews: [],
      photoRefs: [],
      nearbyPlaces: {},
      amenities: [],
      lastUpdated: new Date().toISOString()
    };
    
    // Convert business hours
    if (Array.isArray(laundromat.business_hours)) {
      textData.weekdayText = convertHoursToText(laundromat.business_hours);
    }
    
    // Convert reviews
    if (Array.isArray(laundromat.google_reviews)) {
      textData.reviews = convertReviewsToText(laundromat.google_reviews);
    }
    
    // Convert photos
    if (Array.isArray(laundromat.google_photos)) {
      textData.photoRefs = convertPhotosToText(laundromat.google_photos, laundromat.google_place_id);
    }
    
    // Convert nearby places
    if (Array.isArray(laundromat.nearby_places) && laundromat.nearby_places.length > 0) {
      textData.nearbyPlaces = formatNearbyPlaces(laundromat.nearby_places);
    }
    
    // Extract amenities from place details types and attributes
    const amenities = new Set();
    
    // Add types as amenities
    if (Array.isArray(laundromat.google_types)) {
      laundromat.google_types.forEach(type => {
        const readable = type.replace(/_/g, ' ');
        amenities.add(readable);
      });
    }
    
    // Add payment methods as amenities
    if (Array.isArray(laundromat.payment_methods)) {
      laundromat.payment_methods.forEach(method => {
        amenities.add(method);
      });
    }
    
    // Add boolean amenities
    if (laundromat.hasDetergentVending) amenities.add('Detergent Vending');
    if (laundromat.hasLargeMachines) amenities.add('Large Machines');
    if (laundromat.hasFoldTables) amenities.add('Folding Tables');
    if (laundromat.has_wifi) amenities.add('WiFi');
    if (laundromat.is_attended) amenities.add('Attended');
    if (laundromat.is_24_hours) amenities.add('Open 24 Hours');
    if (laundromat.has_air_conditioning) amenities.add('Air Conditioning');
    
    textData.amenities = Array.from(amenities);
    
    // Update the laundromat with the new text data
    return {
      ...laundromat,
      places_text_data: textData
    };
  } catch (error) {
    log(`Error converting Places data to text for laundromat ${laundromat.id}: ${error.message}`);
    return laundromat;
  }
}

/**
 * Process a batch of laundromats and convert their Google Places API data to text
 */
async function processBatch(client, offset = 0, limit = 100) {
  try {
    log(`Processing batch: offset=${offset}, limit=${limit}`);
    
    // Get laundromats with Places API data but no text version yet
    const query = `
      SELECT l.*
      FROM laundromats l
      WHERE 
        (l.google_place_id IS NOT NULL OR l.business_hours IS NOT NULL OR l.nearby_places IS NOT NULL)
        AND (l.places_text_data IS NULL OR l.places_text_data = '{}')
      ORDER BY l.id
      LIMIT $1 OFFSET $2
    `;
    
    const result = await client.query(query, [limit, offset]);
    
    if (result.rows.length === 0) {
      log('No more laundromats to process');
      return 0;
    }
    
    log(`Found ${result.rows.length} laundromats to process`);
    let updatedCount = 0;
    
    // Process each laundromat
    for (const laundromat of result.rows) {
      try {
        // Skip if already has text data
        if (await hasTextData(laundromat)) {
          log(`Skipping laundromat ${laundromat.id}: already has text data`);
          continue;
        }
        
        // Convert to text format
        const updatedLaundromat = convertPlacesDataToText(laundromat);
        
        // Save back to database
        const updateQuery = `
          UPDATE laundromats
          SET places_text_data = $1
          WHERE id = $2
        `;
        
        await client.query(updateQuery, [updatedLaundromat.places_text_data, laundromat.id]);
        updatedCount++;
        
        log(`Updated laundromat ${laundromat.id}: converted Places API data to text format`);
      } catch (error) {
        log(`Error processing laundromat ${laundromat.id}: ${error.message}`);
      }
    }
    
    log(`Batch complete: updated ${updatedCount}/${result.rows.length} laundromats`);
    return result.rows.length;
  } catch (error) {
    log(`Error processing batch: ${error.message}`);
    return 0;
  }
}

/**
 * Process all laundromats to convert Google Places API data to text format
 */
async function processAllLaundromats() {
  const client = await pool.connect();
  
  try {
    let offset = 0;
    const batchSize = 100;
    let totalProcessed = 0;
    let continueProcessing = true;
    
    while (continueProcessing) {
      const processed = await processBatch(client, offset, batchSize);
      
      if (processed === 0) {
        continueProcessing = false;
      } else {
        totalProcessed += processed;
        offset += batchSize;
        
        // Log progress
        log(`Progress: processed ${totalProcessed} laundromats`);
        
        // Add a pause between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    log(`Completed converting Places API data to text for ${totalProcessed} laundromats`);
  } catch (error) {
    log(`Error processing all laundromats: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Check database for laundromats without text-based Places data
 */
async function checkUnprocessedCount() {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM laundromats
      WHERE 
        (google_place_id IS NOT NULL OR business_hours IS NOT NULL OR nearby_places IS NOT NULL)
        AND (places_text_data IS NULL OR places_text_data = '{}')
    `;
    
    const result = await pool.query(query);
    const count = parseInt(result.rows[0].count);
    
    log(`Found ${count} laundromats that need Places API data conversion to text`);
    return count;
  } catch (error) {
    log(`Error checking unprocessed count: ${error.message}`);
    return 0;
  }
}

/**
 * Get stats on cost savings
 */
async function getStatistics() {
  try {
    // Count laundromats with text data
    const textDataQuery = `
      SELECT COUNT(*) as count
      FROM laundromats
      WHERE places_text_data IS NOT NULL AND places_text_data != '{}'
    `;
    
    const textDataResult = await pool.query(textDataQuery);
    const textDataCount = parseInt(textDataResult.rows[0].count);
    
    // Count hits to the text data (tracked in server logs)
    // This will be a placeholder until we implement actual tracking
    const estimatedHits = textDataCount * 5; // Assume each converted record is viewed 5 times
    
    // Calculate savings (Place Details costs ~$17 per 1000 requests)
    const estimatedSavings = (estimatedHits / 1000) * 17;
    
    return {
      convertedRecords: textDataCount,
      estimatedHits,
      estimatedSavings: estimatedSavings.toFixed(2)
    };
  } catch (error) {
    log(`Error getting statistics: ${error.message}`);
    return {
      convertedRecords: 0,
      estimatedHits: 0,
      estimatedSavings: 0
    };
  }
}

// Run if executed directly
if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      
      if (args.includes('--stats')) {
        const unprocessedCount = await checkUnprocessedCount();
        const stats = await getStatistics();
        
        log('===== Place Details Text Conversion Statistics =====');
        log(`Total laundromats with converted Places data: ${stats.convertedRecords}`);
        log(`Laundromats still needing conversion: ${unprocessedCount}`);
        log(`Estimated API calls saved: ${stats.estimatedHits}`);
        log(`Estimated cost savings: $${stats.estimatedSavings}`);
      } else if (args.includes('--process')) {
        await processAllLaundromats();
      } else {
        log('Usage:');
        log('  node batch-process-place-details.js --stats    (Show statistics)');
        log('  node batch-process-place-details.js --process  (Process all laundromats)');
      }
    } catch (error) {
      log(`Error in main execution: ${error.message}`);
    } finally {
      await pool.end();
    }
  })();
}

module.exports = {
  convertPlacesDataToText,
  processAllLaundromats,
  checkUnprocessedCount,
  getStatistics
};