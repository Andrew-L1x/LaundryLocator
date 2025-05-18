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
const BATCH_SIZE = 10; // Process 10 laundromats at a time
const LAUNDROMATS_PER_RUN = 50; // Process 50 laundromats in one execution
const DELAY_BETWEEN_LAUNDROMATS = 5000; // 5 seconds between laundromats
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds between batches
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
    else if (place.types.includes('grocery_or_supermarket')) category = 'Grocery Store';
    else if (place.types.includes('convenience_store')) category = 'Convenience Store';
    else if (place.types.includes('park')) category = 'Park';
    else if (place.types.includes('library')) category = 'Library';
    else if (place.types.includes('shopping_mall')) category = 'Shopping';
    else if (place.types.includes('store')) category = 'Store';
    else if (place.types.includes('church')) category = 'Church';
    else if (place.types.includes('bus_station')) category = 'Bus Stop';
    else if (place.types.includes('train_station')) category = 'Train Station';
    else if (place.types.includes('subway_station')) category = 'Subway';
    else if (place.types.includes('gas_station')) category = 'Gas Station';
    else if (place.types.includes('post_office')) category = 'Post Office';
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
    
    // Handle rate limiting
    if (response.data.status === 'OVER_QUERY_LIMIT') {
      log(`API quota exceeded for ${type} places. Adding longer delay.`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10-second wait
      return [];
    }
    
    log(`Error getting nearby ${type} places: ${response.data.status}`);
    return [];
  } catch (error) {
    log(`API Error getting nearby ${type} places: ${error.message}`);
    return [];
  }
}

// Function to enhance a single laundromat with Google Places data
async function enhanceLaundromat(laundromat, client) {
  try {
    const { id, latitude, longitude, city, state } = laundromat;
    
    if (!latitude || !longitude || latitude === '0' || longitude === '0') {
      log(`Skipping laundromat ID ${id} - invalid coordinates: ${latitude},${longitude}`);
      return false;
    }
    
    log(`Enhancing laundromat ID ${id} at ${latitude},${longitude} in ${city || 'Unknown City'}, ${state || 'Unknown State'}`);
    
    // Structure for nearby places
    const nearby = {
      restaurants: [],
      activities: [],
      transit: []
    };
    
    // Get nearby restaurants and cafes plus other food options
    const foodPlaces = await getNearbyPlaces(latitude, longitude, 'restaurant');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // Specifically look for fast food places and discount stores
    const fastFoodKeywords = ['McDonald', 'Burger King', 'Wendy', 'Taco Bell', 'KFC', 'Subway', 
                             'Dairy Queen', 'Dunkin', 'Chick-fil-A', 'Pizza Hut', 'Domino', 
                             'Little Caesars', 'Arby', 'Sonic', 'Hardee', 'Carl', 'Jack in the Box',
                             'Popeyes', 'Chipotle', 'Five Guys', 'In-N-Out', 'White Castle',
                             'Whataburger', 'Culver', 'Starbucks', 'Dollar Tree', 'Dollar General',
                             'Family Dollar', 'Chinese', 'Mexican', 'Thai', 'Deli', 'Grill', 'Cafe',
                             'Diner', 'BBQ', 'Barbecue', 'Fried', 'Chicken', 'Burger', 'Taco',
                             '99 Cent'];
    
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
    
    // Get nearby activities - expanded for rural areas
    const parks = await getNearbyPlaces(latitude, longitude, 'park');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    const libraries = await getNearbyPlaces(latitude, longitude, 'library');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    let shopping = await getNearbyPlaces(latitude, longitude, 'shopping_mall');
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
    
    // If we don't have enough activities, look for more rural-friendly options
    if ([...parks, ...libraries, ...shopping].length < 2) {
      const churchesAndPlaces = await getNearbyPlaces(latitude, longitude, 'church');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
      
      const localStores = await getNearbyPlaces(latitude, longitude, 'store');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
      
      const postOffices = await getNearbyPlaces(latitude, longitude, 'post_office');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
      
      // Add these to shopping since they're often places people visit while doing laundry
      shopping = [...shopping, ...localStores, ...churchesAndPlaces, ...postOffices];
    }
    
    // Combine and limit to 3 total
    const combinedActivities = [...parks, ...libraries, ...shopping].slice(0, 3);
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
    
    // In rural areas, also look for gas stations as they're important landmarks
    let gasStations = [];
    if ([...busStops, ...trainStations, ...subwayStations].length < 1) {
      gasStations = await getNearbyPlaces(latitude, longitude, 'gas_station');
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between API calls
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