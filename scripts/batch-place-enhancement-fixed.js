/**
 * Batch Google Places Enhancement for Laundromats
 * 
 * This script processes laundromats in small batches with proper delays between
 * operations to respect API rate limits. It saves progress to a file so it can be
 * stopped and resumed at any time.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize database connection with SSL required
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Google Maps API key from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Configuration
const BATCH_SIZE = 25; // Process 25 laundromats at a time
const LAUNDROMATS_PER_RUN = 100; // Process 100 laundromats in one execution
const DELAY_BETWEEN_LAUNDROMATS = 3000; // 3 seconds between laundromats
const DELAY_BETWEEN_BATCHES = 15000; // 15 seconds between batches
const PROGRESS_FILE = 'place-enhancement-progress.json';

// Function to log operations
function log(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('batch-place-enhancement.log', logMessage + '\n');
}

// Load or initialize progress tracking
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const fileContent = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    log(`Error reading progress file: ${error.message}`);
  }
  
  // Default progress object
  return {
    lastProcessedId: 0,
    processedCount: 0,
    total: 0,
    totalLaundromats: 0
  };
}

// Save progress to file
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    log(`Error saving progress file: ${error.message}`);
  }
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
    else if (place.types.includes('bus_station')) category = 'Bus Stop';
    else if (place.types.includes('subway_station')) category = 'Subway';
    else if (place.types.includes('train_station')) category = 'Train';
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
  
  // Determine approximate walking distance
  const walkingDistance = '5-10 min walk'; // Default estimate
  
  return {
    name: place.name,
    vicinity: place.vicinity || place.formatted_address,
    category,
    priceLevel,
    rating: place.rating,
    placeId: place.place_id,
    photoUrl: place.photos && place.photos.length > 0 
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
      : null,
    walkingDistance
  };
}

// Helper function to find places using text search
async function findPlacesWithTextSearch(searchQuery, type) {
  try {
    // Hide API key in logs
    const safeQuery = searchQuery.includes(GOOGLE_MAPS_API_KEY) 
      ? searchQuery.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN') 
      : searchQuery;
    
    log(`Making text search request: ${safeQuery}`);
    
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK') {
      log(`Found ${response.data.results.length} ${type} places using text search`);
      return response.data.results.slice(0, 5); // Limit to first 5 results
    } else {
      log(`Text search for ${type} returned status: ${response.data.status}`);
      return [];
    }
  } catch (error) {
    log(`Error in text search for ${type}: ${error.message}`);
    return [];
  }
}

// Function to get nearby places using text search
async function getNearbyPlaces(latitude, longitude, type, radius = 500, address = null, city = null, state = null) {
  try {
    // Using text search with location information is much more reliable
    let searchQuery;
    
    if (address && city && state) {
      // We have a full address - use it
      const fullAddress = `${address}, ${city}, ${state}`;
      searchQuery = `${type.replace(/_/g, ' ')} near ${fullAddress}`;
      log(`Searching near address "${fullAddress}" for ${type}`);
    } else if (city && state) {
      // We have city and state - use that
      const locationDesc = `${city}, ${state}`;
      searchQuery = `${type.replace(/_/g, ' ')} near ${locationDesc}`;
      log(`Searching near "${locationDesc}" for ${type}`);
    } else {
      // Fall back to coordinates
      const locationString = `${latitude},${longitude}`;
      searchQuery = `${type.replace(/_/g, ' ')} near ${locationString}`;
      log(`Searching near coordinates "${locationString}" for ${type}`);
    }
    
    // Perform the search
    return await findPlacesWithTextSearch(searchQuery, type);
    
  } catch (error) {
    log(`API Error getting nearby ${type} places: ${error.message}`);
    return [];
  }
}

// Function to enhance a single laundromat with Google Places data
async function enhanceLaundromat(laundromat, client) {
  try {
    const { id, latitude, longitude, city, state, address } = laundromat;
    
    if ((!latitude || !longitude || latitude === '0' || longitude === '0') && !city) {
      log(`Skipping laundromat ID ${id} - insufficient location data`);
      return false;
    }
    
    log(`Enhancing laundromat ID ${id} at ${latitude},${longitude} in ${city || 'Unknown City'}, ${state || 'Unknown State'}`);
    
    // Structure for nearby places with our updated categories
    const nearby = {
      food: [],
      activities: [],
      shopping: [],
      transit: [],
      community: []
    };
    
    // Get nearby restaurants and cafes plus other food options
    const foodPlaces = await getNearbyPlaces(latitude, longitude, 'restaurant', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Get nearby cafes as separate category
    const cafePlaces = await getNearbyPlaces(latitude, longitude, 'cafe', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Get nearby bars 
    const barPlaces = await getNearbyPlaces(latitude, longitude, 'bar', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Add parks and recreation areas
    const parkPlaces = await getNearbyPlaces(latitude, longitude, 'park', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add playgrounds specifically 
    const playgroundPlaces = await getNearbyPlaces(latitude, longitude, 'playground', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add shopping malls
    const mallPlaces = await getNearbyPlaces(latitude, longitude, 'shopping_mall', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add convenience stores
    const convenienceStores = await getNearbyPlaces(latitude, longitude, 'convenience_store', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add transit stops
    const transitStops = await getNearbyPlaces(latitude, longitude, 'bus_station', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add dollar stores specifically
    const dollarStores = await getNearbyPlaces(latitude, longitude, 'dollar store', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add libraries for community information
    const libraries = await getNearbyPlaces(latitude, longitude, 'library', 500, address, city, state);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Process all the data into our categories
    
    // Food category - combine restaurants, cafes and bars
    foodPlaces.forEach(place => {
      nearby.food.push(processPlaceData(place));
    });
    
    cafePlaces.forEach(place => {
      nearby.food.push(processPlaceData(place));
    });
    
    barPlaces.forEach(place => {
      nearby.food.push(processPlaceData(place));
    });
    
    // Activities category - combine parks and playgrounds
    parkPlaces.forEach(place => {
      nearby.activities.push(processPlaceData(place));
    });
    
    playgroundPlaces.forEach(place => {
      nearby.activities.push(processPlaceData(place));
    });
    
    // Shopping category - combine malls, convenience stores and dollar stores
    mallPlaces.forEach(place => {
      nearby.shopping.push(processPlaceData(place));
    });
    
    convenienceStores.forEach(place => {
      nearby.shopping.push(processPlaceData(place));
    });
    
    dollarStores.forEach(place => {
      nearby.shopping.push(processPlaceData(place));
    });
    
    // Transit category
    transitStops.forEach(place => {
      nearby.transit.push(processPlaceData(place));
    });
    
    // Community category
    libraries.forEach(place => {
      nearby.community.push(processPlaceData(place));
    });
    
    // Update the database with all the nearby places data
    const updateQuery = `
      UPDATE laundromats
      SET nearby_places = $1
      WHERE id = $2
      RETURNING id
    `;
    
    try {
      const result = await client.query(updateQuery, [JSON.stringify(nearby), id]);
      if (result.rowCount === 0) {
        log(`Failed to update laundromat ID ${id} with nearby places`);
        return false;
      }
      
      log(`Successfully enhanced laundromat ID ${id} with nearby places`);
      return true;
    } catch (error) {
      log(`Error updating laundromat ID ${id}: ${error.message}`);
      return false;
    }
  } catch (error) {
    log(`Error enhancing laundromat ID ${id}: ${error.message}`);
    return false;
  }
}

// Function to process a batch of laundromats
async function processBatch(laundromats, progress, client) {
  log(`Processing batch of ${laundromats.length} laundromats`);
  
  for (const laundromat of laundromats) {
    const success = await enhanceLaundromat(laundromat, client);
    
    if (success) {
      progress.processedCount++;
      progress.lastProcessedId = laundromat.id;
      saveProgress(progress);
    }
    
    // Delay between laundromats to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_LAUNDROMATS));
  }
}

// Function to process multiple batches in one run
async function processBatches() {
  log('Starting batch processing run');
  
  const client = await pool.connect();
  let progress = loadProgress();
  
  try {
    // Get total laundromats count if needed
    if (!progress.total) {
      const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
      progress.total = parseInt(countResult.rows[0].count);
      progress.totalLaundromats = progress.total;
      saveProgress(progress);
    }
    
    log(`Starting batch process. Total laundromats: ${progress.total}, Already processed: ${progress.processedCount}`);
    
    // Get laundromats to process in this run
    const getLaundromatsQuery = `
      SELECT id, name, address, city, state, latitude, longitude
      FROM laundromats
      WHERE id > $1 AND (nearby_places IS NULL OR nearby_places::text = '{}')
      ORDER BY id ASC
      LIMIT $2
    `;
    
    const result = await client.query(getLaundromatsQuery, [progress.lastProcessedId, LAUNDROMATS_PER_RUN]);
    
    log(`Found ${result.rows.length} laundromats to process in this run`);
    
    if (result.rows.length === 0) {
      log('No more laundromats to process! Enhancement complete.');
      return;
    }
    
    // Process in smaller batches to avoid overwhelming the Google Places API
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      await processBatch(batch, progress, client);
      
      // Only add delay if there are more batches
      if (i + BATCH_SIZE < result.rows.length) {
        log(`Waiting ${DELAY_BETWEEN_BATCHES/1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    log(`Completed processing ${result.rows.length} laundromats. Total processed: ${progress.processedCount}/${progress.total}`);
    
  } catch (error) {
    log(`Error in batch processing: ${error.message}`);
  } finally {
    client.release();
  }
}

// Run the batch processing
processBatches()
  .then(() => {
    log('Batch place enhancement completed');
    process.exit(0);
  })
  .catch(error => {
    log(`Error in main process: ${error.message}`);
    process.exit(1);
  });