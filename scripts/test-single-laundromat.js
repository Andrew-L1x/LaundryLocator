/**
 * Test Single Laundromat Enhancement
 * 
 * This script enhances a single laundromat with nearby places data
 * for testing purposes.
 */

import pg from 'pg';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Google Maps API key from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Function to log operations
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync('test-enhancement.log', `[${timestamp}] ${message}\n`);
}

// Process place data into a standardized format
function processPlaceData(place) {
  if (!place) return null;
  
  // Map place types to more user-friendly categories
  let category = 'Point of Interest';
  if (place.types) {
    if (place.types.includes('restaurant')) category = 'Restaurant';
    else if (place.types.includes('cafe')) category = 'Café';
    else if (place.types.includes('bar')) category = 'Bar';
    else if (place.types.includes('grocery_or_supermarket')) category = 'Grocery Store';
    else if (place.types.includes('convenience_store')) category = 'Convenience Store';
    else if (place.types.includes('park')) category = 'Park';
    else if (place.types.includes('library')) category = 'Library';
    else if (place.types.includes('shopping_mall')) category = 'Shopping';
  }
  
  // Format price level
  let priceLevel = '';
  if (place.price_level !== undefined) {
    if (place.price_level === 0) priceLevel = 'Free';
    else if (place.price_level === 1) priceLevel = '$';
    else if (place.price_level === 2) priceLevel = '$$';
    else if (place.price_level === 3) priceLevel = '$$$';
    else if (place.price_level === 4) priceLevel = '$$$$';
  }
  
  // Build standardized place data
  return {
    name: place.name,
    category,
    vicinity: place.vicinity || place.formatted_address,
    rating: place.rating,
    priceLevel,
    photoUrl: place.photos && place.photos.length > 0 
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
      : null,
    placeId: place.place_id,
    types: place.types,
    walkingDistance: '5-10 min walk' // Placeholder
  };
}

// Search for nearby places using text search
async function findNearbyPlaces(address, city, state, type) {
  try {
    const fullAddress = `${address}, ${city}, ${state}`;
    const query = `${type.replace(/_/g, ' ')} near ${fullAddress}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    log(`Searching for ${type} near "${fullAddress}"`);
    
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      log(`Found ${response.data.results.length} ${type} places`);
      return response.data.results;
    } else {
      log(`No results found for ${type} near "${fullAddress}" (Status: ${response.data.status})`);
      return [];
    }
  } catch (error) {
    log(`Error searching for ${type}: ${error.message}`);
    return [];
  }
}

// Enhance a single laundromat
async function enhanceSingleLaundromat(laundromat_id) {
  const client = await pool.connect();
  
  try {
    // Get laundromat details
    const getLaundromat = 'SELECT id, name, address, city, state FROM laundromats WHERE id = $1';
    const result = await client.query(getLaundromat, [laundromat_id]);
    
    if (result.rows.length === 0) {
      log(`Laundromat with ID ${laundromat_id} not found`);
      return false;
    }
    
    const laundromat = result.rows[0];
    log(`Processing laundromat: ${laundromat.name} in ${laundromat.city}, ${laundromat.state}`);
    
    // Categories of places to search for
    const placeTypes = {
      food: 'restaurant',
      parks: 'park',
      shopping: 'shopping_mall',
      cafe: 'cafe',
      store: 'convenience_store'
    };
    
    // Hold all nearby places
    const nearbyPlaces = {
      food: [],
      activities: [],
      shopping: [],
      transit: [],
      community: []
    };
    
    // Search for each type of place
    for (const [category, type] of Object.entries(placeTypes)) {
      const places = await findNearbyPlaces(
        laundromat.address,
        laundromat.city,
        laundromat.state,
        type
      );
      
      // Process the first 3 results for each category
      const processedPlaces = places.slice(0, 3).map(place => processPlaceData(place));
      
      // Assign to appropriate category
      if (type === 'restaurant' || type === 'cafe') {
        nearbyPlaces.food = [...nearbyPlaces.food, ...processedPlaces];
      } else if (type === 'park') {
        nearbyPlaces.activities = [...nearbyPlaces.activities, ...processedPlaces];
      } else if (type === 'shopping_mall' || type === 'convenience_store' || type === 'store') {
        nearbyPlaces.shopping = [...nearbyPlaces.shopping, ...processedPlaces];
      }
      
      // Add a delay between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Update the database
    log(`Storing nearby places data for laundromat ID ${laundromat.id}`);
    const updateQuery = `
      UPDATE laundromats
      SET nearby_places = $1
      WHERE id = $2
      RETURNING id
    `;
    
    const updateResult = await client.query(updateQuery, [JSON.stringify(nearbyPlaces), laundromat.id]);
    
    if (updateResult.rowCount === 0) {
      log(`ERROR: Laundromat ID ${laundromat.id} not found when updating nearby_places`);
      return false;
    }
    
    log(`Successfully enhanced laundromat ID ${laundromat.id}`);
    return true;
  } catch (error) {
    log(`Error enhancing laundromat: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  const laundromat_id = process.argv[2] || 99; // Default to ID 99 or use command line argument
  
  log(`Starting enhancement test for laundromat ID ${laundromat_id}`);
  
  try {
    const success = await enhanceSingleLaundromat(laundromat_id);
    
    if (success) {
      log(`Test completed successfully for laundromat ID ${laundromat_id}`);
    } else {
      log(`Test failed for laundromat ID ${laundromat_id}`);
    }
  } catch (error) {
    log(`Unexpected error: ${error.message}`);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

// Run the main function
main();