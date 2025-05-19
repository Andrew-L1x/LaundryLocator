/**
 * Test Script for Text-Based API Cost Savings
 * 
 * This script demonstrates the text-based data conversion for Google API responses
 * to significantly reduce API costs.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    log(`Database connection successful: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    log(`Database connection error: ${error.message}`);
    return false;
  }
}

/**
 * Check if a laundromat has places_text_data
 */
async function checkTextData(id) {
  try {
    const query = `
      SELECT 
        id, 
        name, 
        places_text_data,
        google_place_id IS NOT NULL AS has_place_id,
        business_hours IS NOT NULL AND business_hours != '[]' AS has_hours,
        google_reviews IS NOT NULL AND google_reviews != '[]' AS has_reviews,
        google_photos IS NOT NULL AND google_photos != '[]' AS has_photos,
        nearby_places IS NOT NULL AND nearby_places != '[]' AS has_nearby
      FROM laundromats
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      log(`No laundromat found with ID ${id}`);
      return null;
    }
    
    const laundromat = result.rows[0];
    
    log(`Laundromat: ${laundromat.name} (ID: ${laundromat.id})`);
    log(`Has Google Place ID: ${laundromat.has_place_id}`);
    log(`Has Business Hours: ${laundromat.has_hours}`);
    log(`Has Google Reviews: ${laundromat.has_reviews}`);
    log(`Has Google Photos: ${laundromat.has_photos}`);
    log(`Has Nearby Places: ${laundromat.has_nearby}`);
    
    if (laundromat.places_text_data) {
      log('Places Text Data Structure:');
      for (const key in laundromat.places_text_data) {
        if (Array.isArray(laundromat.places_text_data[key])) {
          log(`- ${key}: Array with ${laundromat.places_text_data[key].length} items`);
        } else if (typeof laundromat.places_text_data[key] === 'object') {
          log(`- ${key}: Object with ${Object.keys(laundromat.places_text_data[key]).length} keys`);
        } else {
          log(`- ${key}: ${laundromat.places_text_data[key]}`);
        }
      }
    } else {
      log('No places_text_data found. This laundromat could benefit from conversion.');
    }
    
    return laundromat;
  } catch (error) {
    log(`Error checking text data: ${error.message}`);
    return null;
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
 * Sample conversion of a laundromat's data to text format
 */
async function testConversion(id) {
  try {
    // Get laundromat data
    const query = 'SELECT * FROM laundromats WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      log(`No laundromat found with ID ${id}`);
      return false;
    }
    
    const laundromat = result.rows[0];
    
    // Create the text-based data structure
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
      log(`Converted ${textData.weekdayText.length} days of business hours`);
      
      // Show sample of converted hours
      if (textData.weekdayText.length > 0) {
        log('Sample of converted hours:');
        textData.weekdayText.slice(0, 3).forEach(day => log(`  ${day}`));
      }
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
      
      log(`Converted ${textData.reviews.length} reviews`);
      
      // Show sample of converted reviews
      if (textData.reviews.length > 0) {
        log('Sample of converted review:');
        const sample = textData.reviews[0];
        log(`  Author: ${sample.author}`);
        log(`  Rating: ${sample.rating}`);
        log(`  Text: ${sample.text.slice(0, 50)}...`);
      }
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
      
      log(`Converted ${textData.photoRefs.length} photo references`);
    }
    
    // Process nearby places
    if (Array.isArray(laundromat.nearby_places)) {
      // Group nearby places by type
      laundromat.nearby_places.forEach(place => {
        if (!place || typeof place !== 'object') return;
        
        try {
          // Get the primary type of the place
          const types = place.types || [];
          const type = types[0] || 'other';
          
          if (!textData.nearbyPlaces[type]) {
            textData.nearbyPlaces[type] = [];
          }
          
          textData.nearbyPlaces[type].push({
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
      
      const placeTypes = Object.keys(textData.nearbyPlaces);
      log(`Processed nearby places into ${placeTypes.length} types`);
      
      if (placeTypes.length > 0) {
        log('Types of nearby places:');
        placeTypes.forEach(type => {
          log(`  ${type}: ${textData.nearbyPlaces[type].length} places`);
        });
      }
    }
    
    // This is a demo - we won't actually update the database
    log(`Successfully generated text data for laundromat ${laundromat.id} (${laundromat.name})`);
    log(`Text data size: ${JSON.stringify(textData).length} bytes`);
    
    // Calculate savings
    const originalSize = JSON.stringify({
      business_hours: laundromat.business_hours || [],
      google_reviews: laundromat.google_reviews || [],
      google_photos: laundromat.google_photos || [],
      nearby_places: laundromat.nearby_places || []
    }).length;
    
    log(`Original data size: ${originalSize} bytes`);
    log(`Compression ratio: ${Math.round((JSON.stringify(textData).length / originalSize) * 100)}%`);
    
    // For this demo, returning the text data without saving it
    return textData;
  } catch (error) {
    log(`Error in test conversion: ${error.message}`);
    return null;
  }
}

/**
 * Get sample laundromat IDs for testing
 */
async function getSampleLaundromatIds() {
  try {
    const query = `
      SELECT id, name
      FROM laundromats
      WHERE 
        (business_hours IS NOT NULL OR google_reviews IS NOT NULL OR nearby_places IS NOT NULL)
        AND (places_text_data IS NULL OR places_text_data = '{}')
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    log(`Error getting sample laundromats: ${error.message}`);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      log('Exiting due to database connection issues');
      return;
    }
    
    // Get sample laundromats
    const samples = await getSampleLaundromatIds();
    log(`Found ${samples.length} sample laundromats for testing`);
    
    if (samples.length === 0) {
      // Try with a specific ID that might have data
      log('Trying with a specific laundromat ID (385)...');
      await checkTextData(385);
      await testConversion(385);
    } else {
      // Test with first sample
      const sample = samples[0];
      log(`Testing with laundromat: ${sample.name} (ID: ${sample.id})`);
      
      // Check current state
      await checkTextData(sample.id);
      
      // Test conversion
      await testConversion(sample.id);
    }
    
    log('Test completed successfully');
  } catch (error) {
    log(`Unhandled error: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();