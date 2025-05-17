/**
 * Enhance Specific Laundromat with Google Places API
 * 
 * This script enhances a specific laundromat with nearby place data
 * from Google Places API.
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
  fs.appendFileSync('specific-laundromat-enhancement.log', logMessage + '\n');
}

// Function to get nearby places from Google Places API
async function getNearbyPlaces(latitude, longitude, type, radius = 500) {
  // Use a larger initial radius for rural areas
  const initialRadius = 3000; // 3km (about 1.9 miles)
  let currentRadius = radius || initialRadius;
  const maxRadius = 10000; // 10km maximum search radius (about 6.2 miles)
  
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

// Process place data into a more structured format
function processPlaceData(place) {
  const priceLevel = place.price_level ? '$'.repeat(place.price_level) : '$';
  
  // Determine a rough walking time (very approximate)
  let walkingDistance = '5-10 min walk';
  if (place.distance) {
    if (place.distance < 200) {
      walkingDistance = '1-2 min walk';
    } else if (place.distance < 400) {
      walkingDistance = '3-5 min walk';
    } else if (place.distance < 800) {
      walkingDistance = '8-10 min walk';
    } else if (place.distance < 1600) {
      walkingDistance = '15-20 min walk';
    } else if (place.distance < 3200) {
      walkingDistance = '30-40 min walk';
    } else {
      walkingDistance = 'Drive required'; // For rural areas
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
    } else if (place.types.includes('grocery_or_supermarket')) {
      category = 'Grocery';
    } else if (place.types.includes('convenience_store')) {
      category = 'Convenience Store';
    } else if (place.types.includes('park')) {
      category = 'Park';
    } else if (place.types.includes('library')) {
      category = 'Library';
    } else if (place.types.includes('shopping_mall')) {
      category = 'Mall';
    } else if (place.types.includes('church')) {
      category = 'Church';
    } else if (place.types.includes('store')) {
      category = 'Store';
    } else if (place.types.includes('post_office')) {
      category = 'Post Office';
    } else if (place.types.includes('bus_station')) {
      category = 'Bus Stop';
    } else if (place.types.includes('subway_station')) {
      category = 'Subway';
    } else if (place.types.includes('train_station')) {
      category = 'Train';
    } else if (place.types.includes('gas_station')) {
      category = 'Gas Station';
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

// Enhance a specific laundromat with Google Places data
async function enhanceSpecificLaundromat(laundryId) {
  const client = await pool.connect();
  
  try {
    // Get the specific laundromat
    const query = `
      SELECT id, name, latitude, longitude, city, state
      FROM laundromats
      WHERE id = $1
    `;
    
    const result = await client.query(query, [laundryId]);
    
    if (result.rows.length === 0) {
      log(`Laundromat with ID ${laundryId} not found`);
      return false;
    }
    
    const laundromat = result.rows[0];
    const { latitude, longitude, city, state } = laundromat;
    
    if (!latitude || !longitude || latitude === '0' || longitude === '0') {
      log(`Skipping laundromat ID ${laundryId} - invalid coordinates: ${latitude},${longitude}`);
      return false;
    }
    
    log(`Enhancing laundromat ID ${laundryId} at ${latitude},${longitude} in ${city}, ${state}`);
    
    // Structure for nearby places
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
    const updateQuery = `
      UPDATE laundromats
      SET nearby_places = $1
      WHERE id = $2
    `;
    
    await client.query(updateQuery, [JSON.stringify(nearby), laundryId]);
    log(`Successfully updated laundromat ID ${laundryId} with nearby places data`);
    return true;
    
  } catch (error) {
    log(`Error enhancing laundromat ID ${laundryId}: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Get ID of laundromat by name
async function getLaundryIdByName(name, city, state) {
  const client = await pool.connect();
  try {
    const namePattern = `%${name}%`;
    const query = `
      SELECT id FROM laundromats
      WHERE name ILIKE $1 AND city = $2 AND state = $3
      LIMIT 1
    `;
    
    const result = await client.query(query, [namePattern, city, state]);
    
    if (result.rows.length === 0) {
      log(`No laundromat found with name containing "${name}" in ${city}, ${state}`);
      return null;
    }
    
    return result.rows[0].id;
  } catch (error) {
    log(`Error finding laundromat: ${error.message}`);
    return null;
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  try {
    // Get laundromat ID for "The" Coin Laundry in Lyons, Kansas
    const laundryId = await getLaundryIdByName('The Coin Laundry', 'Lyons', 'Kansas');
    
    if (!laundryId) {
      log('Could not find the specified laundromat');
      // Try direct ID lookup for the laundromat you mentioned
      log('Trying direct ID for The Coin Laundry in Lyons, Kansas');
      await enhanceSpecificLaundromat(3912);
    } else {
      log(`Found laundromat with ID: ${laundryId}`);
      await enhanceSpecificLaundromat(laundryId);
    }
    
    log('Enhancement process complete');
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