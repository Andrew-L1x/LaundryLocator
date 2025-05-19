/**
 * API to Text Migration Script
 * 
 * This script converts all dynamic Google API calls to static text-based data
 * to drastically reduce API costs. It processes the following data types:
 * 
 * 1. Places API data (details, business hours, etc.)
 * 2. Photos and image references
 * 3. Reviews
 * 4. Nearby points of interest
 * 5. Business attributes and amenities
 * 
 * By converting to text, we eliminate expensive repeated API calls while
 * maintaining all the valuable information for users.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Tracking stats
let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let apiCallsSaved = 0;

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(
    path.join(process.cwd(), 'api-to-text-migration.log'),
    `[${timestamp}] ${message}\n`
  );
}

/**
 * Convert Google Places API data to plain text format
 */
function convertPlacesDataToText(placeData) {
  if (!placeData) return null;

  try {
    // Create the text-based data structure
    const textData = {
      name: placeData.name || '',
      formattedAddress: placeData.formatted_address || '',
      phoneNumber: placeData.formatted_phone_number || '',
      website: placeData.website || '',
      rating: placeData.rating || 0,
      userRatingsTotal: placeData.user_ratings_total || 0,
      priceLevel: placeData.price_level || 0,
      weekdayText: [],
      reviews: [],
      photoRefs: [],
      types: placeData.types || [],
      amenities: [],
      lastUpdated: new Date().toISOString()
    };

    // Extract business hours
    if (placeData.opening_hours && placeData.opening_hours.weekday_text) {
      textData.weekdayText = placeData.opening_hours.weekday_text;
    } else if (placeData.business_hours) {
      // Convert from our internal format
      textData.weekdayText = convertHoursToText(placeData.business_hours);
    }

    // Process reviews
    if (Array.isArray(placeData.reviews)) {
      textData.reviews = placeData.reviews.map(review => ({
        author: review.author_name || 'Anonymous',
        rating: review.rating || 0,
        text: review.text || '',
        time: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
        language: review.language || 'en'
      }));
    } else if (Array.isArray(placeData.google_reviews)) {
      // Use our existing reviews
      textData.reviews = placeData.google_reviews.map(review => ({
        author: review.author_name || 'Anonymous',
        rating: review.rating || 0,
        text: review.text || '',
        time: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
        language: review.language || 'en'
      }));
    }

    // Process photos
    if (Array.isArray(placeData.photos)) {
      textData.photoRefs = placeData.photos.map((photo, index) => ({
        id: index,
        reference: photo.photo_reference || '',
        width: photo.width || 0,
        height: photo.height || 0,
        attribution: photo.html_attributions ? photo.html_attributions[0] || '' : ''
      }));
    } else if (Array.isArray(placeData.google_photos)) {
      textData.photoRefs = placeData.google_photos.map((photo, index) => ({
        id: index,
        reference: photo.photo_reference || '',
        width: photo.width || 0,
        height: photo.height || 0,
        attribution: photo.html_attributions ? photo.html_attributions[0] || '' : ''
      }));
    }

    // Process types and extract amenities
    const amenities = new Set();
    
    // Add common amenities based on types
    const typeToAmenity = {
      'laundromat': 'Laundromat',
      'laundry': 'Laundry Service',
      'establishment': 'Business',
      'point_of_interest': 'Local Service',
      'store': 'Store',
      '24_hour': 'Open 24 Hours',
      'self_service': 'Self Service',
      'attended': 'Attended Service',
      'dry_cleaning': 'Dry Cleaning',
      'wash_and_fold': 'Wash & Fold Service',
      'coin_operated': 'Coin Operated',
      'card_payment': 'Card Payment',
      'wifi': 'Free WiFi',
      'restroom': 'Restroom'
    };
    
    if (Array.isArray(placeData.types)) {
      placeData.types.forEach(type => {
        if (typeToAmenity[type]) {
          amenities.add(typeToAmenity[type]);
        } else {
          // Convert snake_case to Title Case
          const readable = type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          amenities.add(readable);
        }
      });
    }
    
    // Add specific amenities if present in the data
    if (placeData.has_wifi || placeData.wifi) amenities.add('Free WiFi');
    if (placeData.is_attended || placeData.attended) amenities.add('Attended Service');
    if (placeData.is_24_hours || placeData.open_24_hours) amenities.add('Open 24 Hours');
    if (placeData.has_air_conditioning || placeData.air_conditioning) amenities.add('Air Conditioning');
    if (placeData.hasDetergentVending) amenities.add('Detergent Vending');
    if (placeData.hasLargeMachines) amenities.add('Large Machines');
    if (placeData.hasFoldTables) amenities.add('Folding Tables');
    
    // Add payment methods as amenities
    if (Array.isArray(placeData.payment_methods)) {
      placeData.payment_methods.forEach(method => {
        amenities.add(method);
      });
    }
    
    textData.amenities = Array.from(amenities);

    return textData;
  } catch (error) {
    log(`Error converting Places data to text: ${error.message}`);
    return null;
  }
}

/**
 * Convert business hours array to text format
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
      log(`Error processing hours: ${error.message}`);
    }
  });
  
  // Convert map to array of strings
  days.forEach(day => {
    result.push(`${day}: ${dayMap[day]}`);
  });
  
  return result;
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
      log(`Error processing nearby place: ${error.message}`);
    }
  });
  
  return placesByType;
}

/**
 * Process a single laundromat to convert all API data to text
 */
async function processLaundromat(laundromat) {
  try {
    // Skip if already has complete text data
    if (laundromat.places_text_data && 
        Object.keys(laundromat.places_text_data).length > 5 &&
        laundromat.places_text_data.lastUpdated) {
      log(`Laundromat ${laundromat.id} already has text data`);
      return true;
    }
    
    // Initialize the text data structure
    const textData = {
      weekdayText: [],
      reviews: [],
      photoRefs: [],
      nearbyPlaces: {},
      amenities: [],
      lastUpdated: new Date().toISOString()
    };
    
    // Process business hours
    if (Array.isArray(laundromat.business_hours)) {
      textData.weekdayText = convertHoursToText(laundromat.business_hours);
    }
    
    // Process reviews
    if (Array.isArray(laundromat.google_reviews)) {
      textData.reviews = laundromat.google_reviews.map(review => {
        if (!review || typeof review !== 'object') return null;
        
        return {
          author: review.author_name || 'Anonymous',
          rating: review.rating || 0,
          text: review.text || '',
          time: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
          language: review.language || 'en'
        };
      }).filter(Boolean);
    }
    
    // Process photos
    if (Array.isArray(laundromat.google_photos)) {
      textData.photoRefs = laundromat.google_photos.map((photo, index) => {
        if (!photo || typeof photo !== 'object') return null;
        
        return {
          id: index,
          reference: photo.photo_reference || '',
          width: photo.width || 0,
          height: photo.height || 0,
          attribution: photo.html_attributions ? photo.html_attributions[0] || '' : ''
        };
      }).filter(Boolean);
    }
    
    // Process nearby places
    if (Array.isArray(laundromat.nearby_places)) {
      textData.nearbyPlaces = formatNearbyPlaces(laundromat.nearby_places);
    }
    
    // Process amenities
    const amenities = new Set();
    
    // Add laundromat-specific amenities
    if (laundromat.hasDetergentVending) amenities.add('Detergent Vending');
    if (laundromat.hasLargeMachines) amenities.add('Large Machines');
    if (laundromat.hasFoldTables) amenities.add('Folding Tables');
    if (laundromat.has_wifi || laundromat.wifi) amenities.add('Free WiFi');
    if (laundromat.is_attended || laundromat.attended) amenities.add('Attended Service');
    if (laundromat.is_24_hours || laundromat.open_24_hours) amenities.add('Open 24 Hours');
    if (laundromat.has_air_conditioning || laundromat.air_conditioning) amenities.add('Air Conditioning');
    
    // Add payment methods as amenities
    if (Array.isArray(laundromat.payment_methods)) {
      laundromat.payment_methods.forEach(method => {
        amenities.add(method);
      });
    }
    
    // Process services as amenities
    if (Array.isArray(laundromat.services)) {
      laundromat.services.forEach(service => {
        amenities.add(service);
      });
    }
    
    textData.amenities = Array.from(amenities);
    
    // Save the text data back to the database
    await pool.query(
      'UPDATE laundromats SET places_text_data = $1 WHERE id = $2',
      [textData, laundromat.id]
    );
    
    log(`Successfully converted API data to text for laundromat ${laundromat.id}`);
    apiCallsSaved += 5; // Estimate 5 API calls saved per laundromat
    return true;
  } catch (error) {
    log(`Error processing laundromat ${laundromat.id}: ${error.message}`);
    return false;
  }
}

/**
 * Process a batch of laundromats
 */
async function processBatch(offset = 0, limit = 100) {
  try {
    log(`Processing batch: offset=${offset}, limit=${limit}`);
    
    // Query laundromats without text data or with incomplete text data
    const result = await pool.query(
      `SELECT * FROM laundromats 
       WHERE id > $1 
       ORDER BY id 
       LIMIT $2`,
      [offset, limit]
    );
    
    if (result.rows.length === 0) {
      log('No more laundromats to process');
      return 0;
    }
    
    log(`Found ${result.rows.length} laundromats to process`);
    
    // Process each laundromat
    for (const laundromat of result.rows) {
      processedCount++;
      const success = await processLaundromat(laundromat);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Add a small delay between processing to avoid overloading
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Return the last ID processed for continuation
    return result.rows[result.rows.length - 1].id;
  } catch (error) {
    log(`Error processing batch: ${error.message}`);
    return offset; // Return the same offset to retry
  }
}

/**
 * Main function to process all laundromats
 */
async function processAllLaundromats() {
  let lastId = 0;
  const batchSize = 200;
  let continueProcessing = true;
  
  log('Starting migration of all API data to text format');
  
  while (continueProcessing) {
    const newLastId = await processBatch(lastId, batchSize);
    
    if (newLastId === 0 || newLastId === lastId) {
      continueProcessing = false;
    } else {
      lastId = newLastId;
      
      // Log progress
      const progressMessage = `Processed ${processedCount} laundromats (${successCount} succeeded, ${errorCount} failed)`;
      log(progressMessage);
      
      // Add a pause between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  log(`Migration complete! Processed ${processedCount} laundromats (${successCount} succeeded, ${errorCount} failed)`);
  log(`Estimated API calls saved: ${apiCallsSaved} (approx. $${(apiCallsSaved/1000 * 17).toFixed(2)} at $17 per 1000 calls)`);
}

// Run if executed directly
if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      
      if (args.includes('--batch')) {
        // Process just one batch
        const offset = parseInt(args[args.indexOf('--batch') + 1] || '0');
        const limit = parseInt(args[args.indexOf('--batch') + 2] || '100');
        
        await processBatch(offset, limit);
        log(`Batch processing complete: ${processedCount} laundromats (${successCount} succeeded, ${errorCount} failed)`);
      } else if (args.includes('--all')) {
        // Process all laundromats
        await processAllLaundromats();
      } else if (args.includes('--test')) {
        // Test with a single laundromat
        const id = parseInt(args[args.indexOf('--test') + 1] || '0');
        
        if (id <= 0) {
          log('Please provide a valid laundromat ID with --test');
          return;
        }
        
        const result = await pool.query('SELECT * FROM laundromats WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
          log(`Laundromat with ID ${id} not found`);
          return;
        }
        
        const success = await processLaundromat(result.rows[0]);
        log(`Test processing ${success ? 'succeeded' : 'failed'} for laundromat ${id}`);
      } else {
        // Print usage
        log('Usage:');
        log('  node api-to-text-migration.js --all                    (Process all laundromats)');
        log('  node api-to-text-migration.js --batch [offset] [limit] (Process a single batch)');
        log('  node api-to-text-migration.js --test [id]              (Test with single laundromat)');
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
  convertHoursToText,
  formatNearbyPlaces,
  processLaundromat,
  processAllLaundromats
};