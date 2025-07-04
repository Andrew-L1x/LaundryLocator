/**
 * Enhanced Laundromat Data with Google Places API
 * 
 * This script enhances laundromat data with real information from Google Places API:
 * - Nearby restaurants, cafes, and shops
 * - Points of interest and activities nearby
 * - Public transportation options
 * - Location-specific features
 */

import pg from 'pg';
import fs from 'fs';
import axios from 'axios';

// Initialize database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Google Maps API key from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Function to log operations
function log(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('google-places-enhancement.log', logMessage + '\n');
}

// Function to get nearby places from Google Places API
async function getNearbyPlaces(latitude, longitude, type, radius = 500) {
  // Use a larger initial radius for rural areas
  const initialRadius = 1500; // 1.5km (nearly a mile)
  let currentRadius = radius || initialRadius;
  const maxRadius = 5000; // 5km maximum search radius (about 3 miles)
  
  try {
    // Try with initial radius
    let response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location: `${latitude},${longitude}`,
        radius: currentRadius,
        type,
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    // If no results, gradually increase radius up to maxRadius
    if (response.data.status === 'ZERO_RESULTS' && currentRadius < maxRadius) {
      currentRadius = Math.min(currentRadius * 2, maxRadius);
      log(`No results found at ${radius}m, increasing radius to ${currentRadius}m`);
      
      response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location: `${latitude},${longitude}`,
          radius: currentRadius,
          type,
          key: GOOGLE_MAPS_API_KEY
        }
      });
      
      // If still no results, try one more time with max radius
      if (response.data.status === 'ZERO_RESULTS' && currentRadius < maxRadius) {
        currentRadius = maxRadius;
        log(`Still no results, trying maximum radius of ${maxRadius}m`);
        
        response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
          params: {
            location: `${latitude},${longitude}`,
            radius: currentRadius,
            type,
            key: GOOGLE_MAPS_API_KEY
          }
        });
      }
    }
    
    if (response.data.status === 'OK') {
      const results = response.data.results.slice(0, 5); // Limit to 5 results
      
      // Add distance information to each place for better walking time estimates
      results.forEach(place => {
        if (place.geometry && place.geometry.location) {
          const placeLat = place.geometry.location.lat;
          const placeLng = place.geometry.location.lng;
          
          // Calculate distance (Haversine formula would be more accurate, but this is simpler)
          const latDistance = Math.abs(placeLat - latitude);
          const lngDistance = Math.abs(placeLng - longitude);
          const distance = Math.sqrt(latDistance * latDistance + lngDistance * lngDistance) * 111000; // rough meters
          
          place.distance = distance;
        }
      });
      
      return results;
    }
    
    if (response.data.status === 'ZERO_RESULTS') {
      log(`No ${type} places found within ${currentRadius}m`);
      return [];
    }
    
    log(`Error getting nearby ${type} places: ${response.data.status}`);
    return [];
  } catch (error) {
    log(`API Error getting nearby ${type} places: ${error.message}`);
    return [];
  }
}

// Function to get place details from Google Places API
async function getPlaceDetails(placeId) {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,vicinity,rating,price_level,types,opening_hours',
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.status === 'OK') {
      return response.data.result;
    }
    
    log(`Error getting place details: ${response.data.status}`);
    return null;
  } catch (error) {
    log(`API Error getting place details: ${error.message}`);
    return null;
  }
}

// Process place data into a more structured format
function processPlaceData(place) {
  const priceLevel = place.price_level ? '$'.repeat(place.price_level) : '$';
  
  // Determine a rough walking time (very approximate)
  let walkingDistance = '5-10 min walk';
  if (place.distance) {
    if (place.distance < 100) {
      walkingDistance = '1 min walk';
    } else if (place.distance < 300) {
      walkingDistance = '3-5 min walk';
    } else if (place.distance < 500) {
      walkingDistance = '5-7 min walk';
    } else if (place.distance < 800) {
      walkingDistance = '8-10 min walk';
    } else {
      walkingDistance = '15+ min walk';
    }
  }
  
  // Extract category from types
  let category = '';
  if (place.types) {
    if (place.types.includes('restaurant')) {
      category = 'Restaurant';
    } else if (place.types.includes('cafe')) {
      category = 'Cafe';
    } else if (place.types.includes('bar')) {
      category = 'Bar';
    } else if (place.types.includes('bakery')) {
      category = 'Bakery';
    } else if (place.types.includes('grocery_or_supermarket') || place.types.includes('convenience_store')) {
      category = 'Grocery';
    } else if (place.types.includes('park')) {
      category = 'Park';
    } else if (place.types.includes('library')) {
      category = 'Library';
    } else if (place.types.includes('shopping_mall')) {
      category = 'Mall';
    } else if (place.types.includes('bus_station')) {
      category = 'Bus Stop';
    } else if (place.types.includes('subway_station')) {
      category = 'Subway';
    } else if (place.types.includes('train_station')) {
      category = 'Train';
    } else {
      // Use the first non-generic type
      const nonGenericTypes = place.types.filter(t => 
        !['point_of_interest', 'establishment', 'food', 'store'].includes(t)
      );
      category = nonGenericTypes.length > 0 
        ? nonGenericTypes[0].replace(/_/g, ' ') 
        : 'Business';
    }
  }
  
  return {
    name: place.name,
    vicinity: place.vicinity,
    category,
    priceLevel,
    rating: place.rating,
    walkingDistance
  };
}

// Enhance a single laundromat with Google Places data
async function enhanceLaundromat(laundromat) {
  try {
    const { id, latitude, longitude, city, state } = laundromat;
    
    if (!latitude || !longitude || latitude === '0' || longitude === '0') {
      log(`Skipping laundromat ID ${id} - invalid coordinates: ${latitude},${longitude}`);
      return false;
    }
    
    log(`Enhancing laundromat ID ${id} at ${latitude},${longitude} in ${city}, ${state}`);
    
    const nearby = {
      restaurants: [],
      activities: [],
      transit: []
    };
    
    // Get nearby restaurants and cafes plus other food options
    const foodPlaces = await getNearbyPlaces(latitude, longitude, 'restaurant');
    const cafes = await getNearbyPlaces(latitude, longitude, 'cafe');
    
    // In rural areas, try convenience stores and grocery stores too
    let bakeries = [];
    let groceries = [];
    let convenienceStores = [];
    
    // If we didn't find enough food places, add other options
    if ([...foodPlaces, ...cafes].length < 2) {
      bakeries = await getNearbyPlaces(latitude, longitude, 'bakery');
      groceries = await getNearbyPlaces(latitude, longitude, 'grocery_or_supermarket');
      convenienceStores = await getNearbyPlaces(latitude, longitude, 'convenience_store');
    }
    
    // Combine and limit to 3 total
    const combinedFood = [...foodPlaces, ...cafes, ...bakeries, ...groceries, ...convenienceStores].slice(0, 3);
    nearby.restaurants = combinedFood.map(place => processPlaceData(place));
    
    // Add a 1-second delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get nearby activities - expanded for rural areas
    const parks = await getNearbyPlaces(latitude, longitude, 'park');
    const libraries = await getNearbyPlaces(latitude, longitude, 'library');
    let shopping = await getNearbyPlaces(latitude, longitude, 'shopping_mall');
    
    // If we don't have enough activities, look for more rural-friendly options
    if ([...parks, ...libraries, ...shopping].length < 2) {
      const churchesAndPlaces = await getNearbyPlaces(latitude, longitude, 'church');
      const localStores = await getNearbyPlaces(latitude, longitude, 'store');
      const postOffices = await getNearbyPlaces(latitude, longitude, 'post_office');
      
      // Add these to shopping since they're often places people visit while doing laundry
      shopping = [...shopping, ...localStores, ...churchesAndPlaces, ...postOffices];
    }
    
    // Combine and limit to 3 total
    const combinedActivities = [...parks, ...libraries, ...shopping].slice(0, 3);
    nearby.activities = combinedActivities.map(place => processPlaceData(place));
    
    // Add a 1-second delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get nearby transit options - expanded for rural areas
    const busStops = await getNearbyPlaces(latitude, longitude, 'bus_station');
    const trainStations = await getNearbyPlaces(latitude, longitude, 'train_station');
    const subwayStations = await getNearbyPlaces(latitude, longitude, 'subway_station');
    
    // In rural areas, also look for gas stations as they're important landmarks
    let gasStations = [];
    if ([...busStops, ...trainStations, ...subwayStations].length < 1) {
      gasStations = await getNearbyPlaces(latitude, longitude, 'gas_station');
    }
    
    // Combine and limit to 2 total
    const combinedTransit = [...busStops, ...trainStations, ...subwayStations, ...gasStations].slice(0, 2);
    nearby.transit = combinedTransit.map(place => processPlaceData(place));
    
    // Update the database with the new information
    const query = `
      UPDATE laundromats
      SET nearby_places = $1
      WHERE id = $2
    `;
    
    const client = await pool.connect();
    try {
      await client.query(query, [JSON.stringify(nearby), id]);
      log(`Successfully updated laundromat ID ${id} with nearby places data`);
      return true;
    } catch (error) {
      log(`Error updating laundromat ID ${id}: ${error.message}`);
      return false;
    } finally {
      client.release();
    }
    
  } catch (error) {
    log(`Error processing laundromat ID ${laundromat.id}: ${error.message}`);
    return false;
  }
}

// Get laundromats from database
async function getLaundromats(limit = 10, offset = 0) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT id, name, latitude, longitude, city, state
      FROM laundromats
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude != '0' AND longitude != '0'
      ORDER BY id
      LIMIT $1 OFFSET $2
    `;
    
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  } catch (error) {
    log(`Error getting laundromats: ${error.message}`);
    return [];
  } finally {
    client.release();
  }
}

// Add nearby_places column if it doesn't exist
async function ensureNearbyPlacesColumn() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE laundromats
      ADD COLUMN IF NOT EXISTS nearby_places JSONB
    `);
    log('Added nearby_places column to laundromats table (if it didn\'t exist)');
  } catch (error) {
    log(`Error adding nearby_places column: ${error.message}`);
  } finally {
    client.release();
  }
}

// Process laundromats in batches
async function processBatch(batchSize, offset) {
  // Get a batch of laundromats
  const laundromats = await getLaundromats(batchSize, offset);
  
  if (laundromats.length === 0) {
    log(`No more laundromats to process starting from offset ${offset}`);
    return 0;
  }
  
  log(`Processing batch of ${laundromats.length} laundromats starting from offset ${offset}`);
  let successCount = 0;
  
  // Process each laundromat in the batch
  for (const laundromat of laundromats) {
    const success = await enhanceLaundromat(laundromat);
    if (success) {
      successCount++;
    }
    
    // Add a short delay between laundromats to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  log(`Completed batch: ${successCount}/${laundromats.length} laundromats successfully processed`);
  return laundromats.length;
}

// Main function
async function main() {
  try {
    // Ensure the necessary column exists
    await ensureNearbyPlacesColumn();
    
    const batchSize = 10; // Process 10 laundromats at a time to avoid rate limits
    let offset = 0;
    let processedCount = 0;
    let batchProcessed = 0;
    
    // Process in batches until all laundromats are processed
    do {
      batchProcessed = await processBatch(batchSize, offset);
      processedCount += batchProcessed;
      offset += batchSize;
      
      // Log progress
      log(`Progress: ${processedCount} laundromats processed so far`);
      
      // Add a delay between batches to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } while (batchProcessed > 0);
    
    log(`All done! Total laundromats processed: ${processedCount}`);
  } catch (error) {
    log(`Unexpected error in main function: ${error.message}`);
  } finally {
    await pool.end();
    log('Database connection closed');
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});