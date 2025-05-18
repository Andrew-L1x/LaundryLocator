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
    rejectUnauthorized: false // Use this only if needed
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
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    log(`Error reading progress file: ${err.message}. Starting fresh.`);
  }

  return {
    lastProcessedId: 0,
    processedCount: 0,
    totalLaundromats: 0,
    completedBatches: 0,
    errors: []
  };
}

// Save progress
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    log(`Error saving progress: ${err.message}`);
  }
}

// Process place data into a standardized format
function processPlaceData(place) {
  // Calculate approximate walking time based on distance
  // Average walking speed is about 5 km/h or 1.4 m/s
  const walkingSpeedMetersPerMinute = 83; // 5km/h converted to m/min
  const walkingTimeMinutes = place.distance ? Math.round(place.distance / walkingSpeedMetersPerMinute) : null;
  
  let walkingDistance;
  if (walkingTimeMinutes !== null) {
    if (walkingTimeMinutes < 1) {
      walkingDistance = 'Less than 1 min walk';
    } else if (walkingTimeMinutes === 1) {
      walkingDistance = '1 min walk';
    } else if (walkingTimeMinutes > 30) {
      // Convert to driving time (roughly 1/5 of walking time)
      const drivingMinutes = Math.round(walkingTimeMinutes / 5);
      walkingDistance = `${drivingMinutes} min drive`;
    } else {
      walkingDistance = `${walkingTimeMinutes} min walk`;
    }
  } else {
    walkingDistance = 'Nearby';
  }
  
  // Map place types to more user-friendly categories
  let category = 'Point of Interest';
  if (place.types) {
    if (place.types.includes('restaurant')) category = 'Restaurant';
    else if (place.types.includes('cafe')) category = 'Café';
    else if (place.types.includes('bakery')) category = 'Bakery';
    else if (place.types.includes('bar')) category = 'Bar';
    else if (place.types.includes('night_club')) category = 'Bar';
    else if (place.types.includes('grocery_or_supermarket')) category = 'Grocery Store';
    else if (place.types.includes('convenience_store')) category = 'Convenience Store';
    else if (place.types.includes('park')) category = 'Park';
    else if (place.types.includes('playground')) category = 'Playground';
    else if (place.types.includes('library')) category = 'Library';
    else if (place.types.includes('shopping_mall')) category = 'Shopping';
    else if (place.types.includes('store')) category = 'Store';
    else if (place.types.includes('church')) category = 'Church';
    else if (place.types.includes('school')) category = 'School';
    else if (place.types.includes('fire_station')) category = 'Fire Station';
    else if (place.types.includes('police')) category = 'Police Station';
    else if (place.types.includes('local_government_office')) category = 'Community Center';
    else if (place.types.includes('bus_station')) category = 'Bus Stop';
    else if (place.types.includes('train_station')) category = 'Train Station';
    else if (place.types.includes('subway_station')) category = 'Subway';
    else if (place.types.includes('gas_station')) category = 'Gas Station';
    else if (place.types.includes('post_office')) category = 'Post Office';
  }
  
  // Check for dollar stores by name
  if (place.name) {
    const name = place.name.toLowerCase();
    if (name.includes('dollar tree') || 
        name.includes('dollar general') || 
        name.includes('family dollar') ||
        name.includes('99 cent')) {
      category = 'Dollar Store';
    }
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
  
  return {
    name: place.name,
    vicinity: place.vicinity,
    category,
    priceLevel,
    rating: place.rating,
    walkingDistance
  };
}

// Helper function to find places using text search
async function findPlacesWithTextSearch(searchQuery, type) {
  try {
    // API key is hidden in logs
    log(`Making text search request: ${searchQuery.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.status === 'OK') {
      log(`Found ${response.data.results.length} ${type} places near "${searchQuery}" using text search`);
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

// Function to get nearby places from Google Places API
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
                             'Diner', 'BBQ', 'Barbecue', 'Fried', 'Chicken', 'Burger', 'Taco', 'Bar',
                             'Tavern', 'Pub', 'Lounge', 'Saloon', 'Brewery', 'Taproom', '99 Cent'];
    
    // Filter out fast food chains from regular restaurants for sorting
    const fastFoodPlaces = foodPlaces.filter(place => 
      fastFoodKeywords.some(keyword => 
        place.name && place.name.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    // If we found specific fast food chains, prioritize them
    const prioritizedFoodPlaces = [...fastFoodPlaces, ...foodPlaces.filter(place => 
      !fastFoodKeywords.some(keyword => 
        place.name && place.name.toLowerCase().includes(keyword.toLowerCase())
      )
    )];
    
    const cafes = await getNearbyPlaces(latitude, longitude, 'cafe');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // In rural areas, try convenience stores and grocery stores too
    let bakeries = [];
    let groceries = [];
    let convenienceStores = [];
    
    // If we didn't find enough food places, add other options
    if ([...prioritizedFoodPlaces, ...cafes].length < 2) {
      bakeries = await getNearbyPlaces(latitude, longitude, 'bakery');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
      
      groceries = await getNearbyPlaces(latitude, longitude, 'grocery_or_supermarket');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
      
      convenienceStores = await getNearbyPlaces(latitude, longitude, 'convenience_store');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    }
    
    // Combine and limit to 3 total
    const combinedFood = [...foodPlaces, ...cafes, ...bakeries, ...groceries, ...convenienceStores].slice(0, 3);
    nearby.restaurants = combinedFood.map(place => processPlaceData(place));
    
    // Add a delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get nearby activities - prioritize parks and playgrounds
    const parks = await getNearbyPlaces(latitude, longitude, 'park');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Look specifically for playgrounds
    const playgrounds = await getNearbyPlaces(latitude, longitude, 'playground');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const libraries = await getNearbyPlaces(latitude, longitude, 'library');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    let shopping = await getNearbyPlaces(latitude, longitude, 'shopping_mall');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Get bars - many laundromats are near bars
    const bars = await getNearbyPlaces(latitude, longitude, 'bar');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Always check for community and institutional places
    const churchesAndPlaces = await getNearbyPlaces(latitude, longitude, 'church');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const schools = await getNearbyPlaces(latitude, longitude, 'school');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const fireStations = await getNearbyPlaces(latitude, longitude, 'fire_station');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const policeStations = await getNearbyPlaces(latitude, longitude, 'police');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Community centers often show up as "local_government_office" in Google Places
    const communityCenters = await getNearbyPlaces(latitude, longitude, 'local_government_office');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // For rural areas, also check for local stores and post offices
    const localStores = await getNearbyPlaces(latitude, longitude, 'store');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const postOffices = await getNearbyPlaces(latitude, longitude, 'post_office');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Add these to shopping since they're often places people visit while doing laundry
    shopping = [...shopping, ...localStores, ...postOffices];
    
    // Create a new category for community institutions
    const communityInstitutions = [...churchesAndPlaces, ...schools, ...fireStations, 
                                   ...policeStations, ...communityCenters].slice(0, 3);
    nearby.community = communityInstitutions.map(place => processPlaceData(place));
    
    // Combine and limit to 3 total - include all the new place types we added
    const combinedActivities = [...parks, ...playgrounds, ...bars, ...libraries, ...shopping].slice(0, 3);
    nearby.activities = combinedActivities.map(place => processPlaceData(place));
    
    // Add a delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get nearby transit options - expanded for rural areas
    const busStops = await getNearbyPlaces(latitude, longitude, 'bus_station');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const trainStations = await getNearbyPlaces(latitude, longitude, 'train_station');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const subwayStations = await getNearbyPlaces(latitude, longitude, 'subway_station');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Always look for gas stations as they're important landmarks for laundromats
    const gasStations = await getNearbyPlaces(latitude, longitude, 'gas_station');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Combine and limit to 2 total
    const combinedTransit = [...busStops, ...trainStations, ...subwayStations, ...gasStations].slice(0, 2);
    nearby.transit = combinedTransit.map(place => processPlaceData(place));
    
    // Update the database with the new information
    const updateQuery = `
      UPDATE laundromats
      SET nearby_places = $1
      WHERE id = $2
    `;
    
    await client.query(updateQuery, [JSON.stringify(nearby), id]);
    
    // Also update the Google data for accurate open/closed status
    if (foodPlaces.length > 0) {
      const googleData = {
        opening_hours: foodPlaces[0].opening_hours || null,
        formatted_address: foodPlaces[0].vicinity || null,
        business_status: foodPlaces[0].business_status || 'OPERATIONAL'
      };
      
      const googleDataQuery = `
        UPDATE laundromats
        SET google_data = $1
        WHERE id = $2
      `;
      
      await client.query(googleDataQuery, [JSON.stringify(googleData), id]);
    }
    
    log(`Successfully updated laundromat ID ${id} with nearby places and Google data`);
    return true;
  } catch (error) {
    log(`Error processing laundromat ID ${laundromat.id}: ${error.message}`);
    return false;
  }
}

// Process laundromats in batches
async function processBatch(laundromats, progress, client) {
  log(`Processing batch of ${laundromats.length} laundromats`);
  
  for (const laundromat of laundromats) {
    const success = await enhanceLaundromat(laundromat, client);
    
    if (success) {
      progress.processedCount++;
    } else {
      progress.errors.push({
        id: laundromat.id,
        timestamp: new Date().toISOString()
      });
    }
    
    progress.lastProcessedId = laundromat.id;
    saveProgress(progress);
    
    // Add delay between laundromats to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_LAUNDROMATS));
  }
  
  log(`Batch completed. Progress: ${progress.processedCount}/${progress.totalLaundromats} (${Math.round(progress.processedCount/progress.totalLaundromats*100)}%)`);
  progress.completedBatches++;
  saveProgress(progress);
}

// Main function to process batches of laundromats
async function processBatches() {
  const client = await pool.connect();
  
  try {
    let progress = loadProgress();
    
    // Get total count if not already known
    if (!progress.totalLaundromats) {
      const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
      progress.totalLaundromats = parseInt(countResult.rows[0].count);
      saveProgress(progress);
    }
    
    log(`Starting batch process. Total laundromats: ${progress.totalLaundromats}, Already processed: ${progress.processedCount}`);
    
    // Get the next batch of laundromats
    const query = `
      SELECT id, name, latitude, longitude, city, state
      FROM laundromats
      WHERE id > $1
      ORDER BY id
      LIMIT $2
    `;
    
    const result = await client.query(query, [progress.lastProcessedId, LAUNDROMATS_PER_RUN]);
    
    if (result.rows.length === 0) {
      log('No more laundromats to process or reached the end.');
      return true;
    }
    
    log(`Found ${result.rows.length} laundromats to process in this run`);
    
    // Process in smaller batches
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      await processBatch(batch, progress, client);
      
      // Add delay between batches to respect API rate limits
      if (i + BATCH_SIZE < result.rows.length) {
        log(`Pausing between batches for ${DELAY_BETWEEN_BATCHES/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Print statistics
    const percentComplete = (progress.processedCount / progress.totalLaundromats * 100).toFixed(2);
    log(`Batch run completed. Overall progress: ${progress.processedCount}/${progress.totalLaundromats} (${percentComplete}%)`);
    log(`Total errors encountered: ${progress.errors.length}`);
    
    return true;
  } catch (error) {
    log(`Fatal error in batch process: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Execute the main function
/**
 * Main function that runs continuously with pauses
 */
async function runContinuously() {
  try {
    log('Starting batch processing run');
    
    // Run the batch process
    const success = await processBatches();
    
    if (success) {
      log('Batch run completed successfully');
    } else {
      log('Batch run completed with errors');
    }
    
    // Pause between runs
    log('Pausing for 5 seconds before next batch...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Restart the process
    log('Restarting batch process...');
    runContinuously();
    
  } catch (error) {
    log(`Unhandled error: ${error.message}`);
    
    // Even on error, try to restart after a delay
    log('Error encountered. Pausing for 10 seconds before retry...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    log('Restarting batch process after error...');
    runContinuously();
  }
}

// Start the continuous process
runContinuously();