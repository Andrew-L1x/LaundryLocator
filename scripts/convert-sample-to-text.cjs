/**
 * Convert Sample Laundromat Data to Text Format
 * 
 * This script converts a sample laundromat's Google API data to text format
 * and saves it back to the database, demonstrating the cost savings approach.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Get a sample laundromat
 */
async function getSampleLaundromat() {
  try {
    // Try to get a laundromat with business_hours data
    const query = `
      SELECT id, name, business_hours, nearby_places
      FROM laundromats
      WHERE business_hours IS NOT NULL AND business_hours != '[]'
      LIMIT 1
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      log('No laundromat found with business_hours data');
      
      // Try with any laundromat
      const fallbackQuery = 'SELECT id, name FROM laundromats LIMIT 1';
      const fallbackResult = await pool.query(fallbackQuery);
      
      if (fallbackResult.rows.length === 0) {
        log('No laundromats found in the database');
        return null;
      }
      
      return fallbackResult.rows[0];
    }
    
    return result.rows[0];
  } catch (error) {
    log(`Error getting sample laundromat: ${error.message}`);
    return null;
  }
}

/**
 * Convert business hours to text format
 */
function convertHoursToText(businessHours) {
  if (!Array.isArray(businessHours) || businessHours.length === 0) {
    return ['No business hours available'];
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
 * Convert and save text data for the sample laundromat
 */
async function convertAndSaveSample() {
  try {
    const laundromat = await getSampleLaundromat();
    
    if (!laundromat) {
      log('Could not find a sample laundromat');
      return false;
    }
    
    log(`Converting data for laundromat: ${laundromat.name} (ID: ${laundromat.id})`);
    
    // Create text-based data structure
    const textData = {
      weekdayText: [],
      reviews: [],
      photoRefs: [],
      nearbyPlaces: {},
      amenities: ['Laundromat', 'Local Service'],
      lastUpdated: new Date().toISOString()
    };
    
    // Convert business hours if available
    if (laundromat.business_hours) {
      textData.weekdayText = convertHoursToText(laundromat.business_hours);
      log(`Converted ${textData.weekdayText.length} days of business hours`);
    }
    
    // Convert nearby places if available
    if (laundromat.nearby_places) {
      textData.nearbyPlaces = formatNearbyPlaces(laundromat.nearby_places);
      const placeTypes = Object.keys(textData.nearbyPlaces);
      log(`Processed nearby places into ${placeTypes.length} types`);
    }
    
    // Save text data back to the database
    const updateQuery = `
      UPDATE laundromats
      SET places_text_data = $1
      WHERE id = $2
    `;
    
    await pool.query(updateQuery, [textData, laundromat.id]);
    log(`Successfully saved text data for laundromat ${laundromat.id}`);
    
    // Verify the saved data
    const verifyQuery = `
      SELECT id, name, places_text_data
      FROM laundromats
      WHERE id = $1
    `;
    
    const verifyResult = await pool.query(verifyQuery, [laundromat.id]);
    
    if (verifyResult.rows.length > 0 && verifyResult.rows[0].places_text_data) {
      log('Verification successful - text data was saved correctly');
      log(`Text data size: ${JSON.stringify(verifyResult.rows[0].places_text_data).length} bytes`);
      
      // Original data size (if available)
      let originalSize = 0;
      if (laundromat.business_hours || laundromat.nearby_places) {
        originalSize = JSON.stringify({
          business_hours: laundromat.business_hours || [],
          nearby_places: laundromat.nearby_places || []
        }).length;
        
        log(`Original data size: ${originalSize} bytes`);
        if (originalSize > 0) {
          const ratio = Math.round((JSON.stringify(textData).length / originalSize) * 100);
          log(`Compression ratio: ${ratio}%`);
        }
      }
      
      return true;
    } else {
      log('Verification failed - could not retrieve saved text data');
      return false;
    }
  } catch (error) {
    log(`Error in convertAndSaveSample: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    log('Starting sample text conversion');
    
    const success = await convertAndSaveSample();
    
    if (success) {
      log('Sample conversion completed successfully');
    } else {
      log('Sample conversion failed');
    }
  } catch (error) {
    log(`Unhandled error: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();