/**
 * Modified batch-place-enhancement.js for WSL environment
 * 
 * This script adds command line argument handling to the original script,
 * making it more suitable for automation in a WSL environment.
 * 
 * Usage:
 *   node scripts/batch-place-enhancement-wsl.js --start 100 --limit 5
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables - support for .env-for-wsl file
if (fs.existsSync('.env-for-wsl')) {
  dotenv.config({ path: '.env-for-wsl' });
} else {
  dotenv.config();
}

// Parse command line arguments
const args = process.argv.slice(2);
let startPosition = 0;
let batchSize = 5; // Default batch size

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--start' || args[i] === '--offset') && i + 1 < args.length) {
    startPosition = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--limit' && i + 1 < args.length) {
    batchSize = parseInt(args[i + 1], 10);
    i++;
  }
}

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
const DELAY_BETWEEN_LAUNDROMATS = 5000; // 5 seconds between laundromats
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

  // Default progress object
  return {
    processedCount: 0,
    totalLaundromats: 0,
    lastProcessedId: startPosition > 0 ? startPosition - 1 : 0,
    errors: [],
    completedBatches: 0,
    startTime: new Date().toISOString()
  };
}

// Save progress to file
function saveProgress(progress) {
  try {
    progress.lastUpdated = new Date().toISOString();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    log(`Error saving progress: ${err.message}`);
  }
}

// Fetch nearby places from Google Places API using address-based search with progressive radius expansion
async function getNearbyPlaces(latitude, longitude, type, radius = 500, address = null, city = null, state = null) {
  try {
    // Make sure latitude and longitude are numbers (as fallback)
    const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
    const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    
    // If we don't have a complete address, build it from city and state
    let fullAddress = address;
    if (!fullAddress && city && state) {
      // If we only have city/state, it's too broad - we'll rely more on coordinates
      fullAddress = `${city}, ${state}`;
      
      // Make a note if we're using broad location
      log(`Warning: Only using city/state level address "${fullAddress}" which is very broad`);
    }
    
    // Log what we're searching for
    if (fullAddress) {
      log(`Searching near address "${fullAddress}" for ${type}`);
    } else {
      log(`No valid address, using coordinates ${lat}, ${lng} for type ${type}`);
    }
    
    // Base URLs for different API endpoints
    const nearbySearchUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const textSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    
    // Use smaller initial radius to ensure we get truly nearby places
    const radii = [300, 500, 1000, 5000];
    let results = [];
    
    // Only use Text Search API if we have a specific street address
    // (If we only have city/state, use coordinates instead for more precise results)
    const hasSpecificAddress = fullAddress && address && address.trim() !== '' && 
                             address.trim().toLowerCase() !== city.toLowerCase();
    
    if (hasSpecificAddress) {
      const query = `${type.replace(/_/g, ' ')} near ${fullAddress}`;
      const textSearchFullUrl = `${textSearchUrl}?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
      log(`Making text search request: ${textSearchFullUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
      
      const textResponse = await axios.get(textSearchFullUrl);
      
      if (textResponse.data.results && textResponse.data.results.length > 0) {
        results = textResponse.data.results;
        log(`Found ${results.length} ${type} places near "${fullAddress}" using text search`);
        return results;
      } else {
        log(`No results found for ${type} near "${fullAddress}" using text search`);
      }
    } else {
      log(`Using coordinate-based search for broader locations - starting with small radius`);
    }
    
    // Fall back to coordinate-based Nearby Search if text search fails or we don't have an address
    for (const r of radii) {
      if (results.length > 0) break; // Stop if we already have results
      
      // Use parsed coordinates as fallback
      const url = `${nearbySearchUrl}?location=${lat},${lng}&radius=${r}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
      log(`Falling back to coordinate search: ${url.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
      const response = await axios.get(url);
      
      // Check for errors
      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        log(`Google Places API error for type ${type}: ${response.data.status}`);
        if (response.data.error_message) {
          log(`Error message: ${response.data.error_message}`);
        }
        break;
      }
      
      results = response.data.results || [];
      
      if (results.length === 0 && r !== 20000) {
        log(`No ${type} found at ${r}m, trying larger radius...`);
      } else if (results.length > 0) {
        log(`Found ${results.length} ${type} places at ${r}m radius`);
      }
    }
    
    // Try alternative approach for rural places if we still have no results
    if (results.length === 0) {
      // Try with keyword search instead of type
      const keywordUrl = `${nearbySearchUrl}?location=${lat},${lng}&radius=30000&keyword=${type.replace(/_/g, ' ')}&key=${GOOGLE_MAPS_API_KEY}`;
      log(`Trying keyword search: ${keywordUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
      const keywordResponse = await axios.get(keywordUrl);
      
      if (keywordResponse.data.results && keywordResponse.data.results.length > 0) {
        results = keywordResponse.data.results;
        log(`Found ${results.length} ${type} places using keyword search at 30km radius`);
      } else {
        // Last attempt: try with similar types (for common substitutions in rural areas)
        const typeFallbacks = {
          'restaurant': ['food', 'cafe', 'meal_takeaway', 'bakery'],
          'grocery_or_supermarket': ['store', 'convenience_store', 'supermarket'],
          'shopping_mall': ['store', 'clothing_store', 'department_store'],
          'park': ['natural_feature', 'point_of_interest'],
          'school': ['university', 'primary_school', 'secondary_school'],
          'library': ['book_store', 'local_government_office'],
          'bus_station': ['transit_station', 'taxi_stand'],
          'fire_station': ['local_government_office', 'police'],
          'police': ['local_government_office', 'fire_station']
        };
        
        if (typeFallbacks[type]) {
          for (const fallbackType of typeFallbacks[type]) {
            if (results.length > 0) break; // Stop if we have results
            
            const fallbackUrl = `${nearbySearchUrl}?location=${lat},${lng}&radius=25000&type=${fallbackType}&key=${GOOGLE_MAPS_API_KEY}`;
            log(`Trying fallback type ${fallbackType}: ${fallbackUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
            const fallbackResponse = await axios.get(fallbackUrl);
            
            if (fallbackResponse.data.results && fallbackResponse.data.results.length > 0) {
              results = fallbackResponse.data.results;
              log(`Found ${results.length} fallback places of type ${fallbackType} for ${type} at 25km radius`);
            }
          }
        }
      }
    }
    
    if (results.length === 0) {
      log(`No ${type} places found with any method in rural area`);
    }
    
    return results;
  } catch (error) {
    log(`Error fetching nearby places of type ${type}: ${error.message}`);
    return [];
  }
}

// Process place data into a standardized format
function processPlaceData(place) {
  if (!place) return null;
  
  // Calculate approximate walking time if distance is available
  let walkingDistance = '';
  if (place.geometry && place.geometry.location) {
    // Placeholder - this would ideally use actual walking distance
    walkingDistance = 'Nearby';
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
  
  // Build standardized place data
  return {
    name: place.name,
    category,
    address: place.vicinity,
    distance: walkingDistance,
    rating: place.rating,
    priceLevel,
    photoUrl: place.photos && place.photos.length > 0 
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
      : null,
    placeId: place.place_id,
    types: place.types
  };
}

// Enhance a laundromat with nearby places
async function enhanceLaundromat(laundromat, client) {
  const { id, latitude, longitude, address, city, state, name } = laundromat;
  
  // Check if both coordinates are available as fallback
  if (!latitude || !longitude) {
    log(`Skipping laundromat ID ${id} - Missing coordinates`);
    return false;
  }
  
  // Construct full address for address-based search
  let fullAddress = null;
  if (address && address.trim()) {
    fullAddress = `${address.trim()}, ${city}, ${state}`;
  } else if (city && state) {
    fullAddress = `${city}, ${state}`;
  }
  
  log(`Processing laundromat ID ${id}: ${name || 'Unknown'}`);
  if (fullAddress) {
    log(`Using address: "${fullAddress}"`);
  } else {
    log(`No valid address, using coordinates: ${latitude}, ${longitude}`);
  }
  
  try {
    // Structure to hold all nearby places
    const nearby = {
      food: [],
      fastFood: [],
      shopping: [],
      activities: [],
      transit: [],
      community: []
    };
    
    // Helper function to add delay between API calls with randomization to avoid rate limit patterns
    const addApiDelay = async () => {
      const baseDelay = 800; // 800ms base delay
      const jitter = Math.floor(Math.random() * 500); // Add 0-500ms of random jitter
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    };
    
    // Get nearby restaurants and cafes plus other food options
    log(`Fetching restaurant data for laundromat ID ${id}`);
    const foodPlaces = await getNearbyPlaces(latitude, longitude, 'restaurant', 500, fullAddress, city, state);
    await addApiDelay(); // Delay between API calls
    
    // Specifically look for fast food places, discount stores, bars, etc.
    const fastFoodKeywords = ['McDonald', 'Burger King', 'Wendy', 'Taco Bell', 'KFC', 'Subway', 
                             'Dairy Queen', 'Dunkin', 'Chick-fil-A', 'Pizza Hut', 'Domino', 
                             'Little Caesars', 'Arby', 'Sonic', 'Hardee', 'Carl', 'Jack in the Box',
                             'Popeyes', 'Chipotle', 'Five Guys', 'In-N-Out', 'White Castle',
                             'Whataburger', 'Culver', 'Starbucks', 'Dollar Tree', 'Dollar General',
                             'Family Dollar', 'Chinese', 'Mexican', 'Thai', 'Deli', 'Grill', 'Cafe',
                             'Diner', 'BBQ', 'Barbecue', 'Fried', 'Chicken', 'Burger', 'Taco', 'Bar',
                             'Tavern', 'Pub', 'Lounge', 'Saloon', 'Brewery', 'Taproom', '99 Cent'];
    
    // Filter out fast food chains from regular restaurants for sorting
    const fastFoodPlaces = foodPlaces.filter(place => 
      fastFoodKeywords.some(keyword => 
        place.name && place.name.includes(keyword)
      )
    );
    
    // Remove fast food places from general food to avoid duplication
    const generalFoodPlaces = foodPlaces.filter(place => 
      !fastFoodKeywords.some(keyword => 
        place.name && place.name.includes(keyword)
      )
    );
    
    // Limit to top 3 general food places
    nearby.food = generalFoodPlaces.slice(0, 3).map(place => processPlaceData(place));
    
    // Limit to top 2 fast food places
    nearby.fastFood = fastFoodPlaces.slice(0, 2).map(place => processPlaceData(place));
    
    // Add a slightly longer delay before activities search
    await addApiDelay();
    await addApiDelay();
    
    // Get nearby activities - prioritize parks and playgrounds
    log(`Fetching park data for laundromat ID ${id}`);
    const parks = await getNearbyPlaces(latitude, longitude, 'park', 500, fullAddress, city, state);
    await addApiDelay();
    
    // Look specifically for playgrounds
    log(`Fetching playground data for laundromat ID ${id}`);
    const playgrounds = await getNearbyPlaces(latitude, longitude, 'playground', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching library data for laundromat ID ${id}`);
    const libraries = await getNearbyPlaces(latitude, longitude, 'library', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching shopping mall data for laundromat ID ${id}`);
    let shopping = await getNearbyPlaces(latitude, longitude, 'shopping_mall', 500, fullAddress, city, state);
    await addApiDelay();
    
    // Get bars - many laundromats are near bars
    log(`Fetching bar data for laundromat ID ${id}`);
    const bars = await getNearbyPlaces(latitude, longitude, 'bar', 500, fullAddress, city, state);
    await addApiDelay();
    
    // Always check for community and institutional places
    log(`Fetching church data for laundromat ID ${id}`);
    const churchesAndPlaces = await getNearbyPlaces(latitude, longitude, 'church', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching school data for laundromat ID ${id}`);
    const schools = await getNearbyPlaces(latitude, longitude, 'school', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching fire station data for laundromat ID ${id}`);
    const fireStations = await getNearbyPlaces(latitude, longitude, 'fire_station', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching police station data for laundromat ID ${id}`);
    const policeStations = await getNearbyPlaces(latitude, longitude, 'police', 500, fullAddress, city, state);
    await addApiDelay();
    
    // Community centers often show up as "local_government_office" in Google Places
    log(`Fetching community center data for laundromat ID ${id}`);
    const communityCenters = await getNearbyPlaces(latitude, longitude, 'local_government_office', 500, fullAddress, city, state);
    await addApiDelay();
    
    // For rural areas, also check for local stores and post offices
    log(`Fetching local store data for laundromat ID ${id}`);
    const localStores = await getNearbyPlaces(latitude, longitude, 'store', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching post office data for laundromat ID ${id}`);
    const postOffices = await getNearbyPlaces(latitude, longitude, 'post_office', 500, fullAddress, city, state);
    await addApiDelay();
    
    // Add these to shopping since they're often places people visit while doing laundry
    shopping = [...shopping, ...localStores, ...postOffices];
    
    // Create a new category for community institutions
    const communityInstitutions = [...churchesAndPlaces, ...schools, ...fireStations, 
                                   ...policeStations, ...communityCenters].slice(0, 3);
    nearby.community = communityInstitutions.map(place => processPlaceData(place));
    
    // Combine and limit to 3 total - include all the new place types we added
    const combinedActivities = [...parks, ...playgrounds, ...bars, ...libraries, ...shopping].slice(0, 3);
    nearby.activities = combinedActivities.map(place => processPlaceData(place));
    
    // Add a slightly longer delay before transit searches
    await addApiDelay();
    await addApiDelay();
    
    // Get nearby transit options - expanded for rural areas
    log(`Fetching bus stop data for laundromat ID ${id}`);
    const busStops = await getNearbyPlaces(latitude, longitude, 'bus_station', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching train station data for laundromat ID ${id}`);
    const trainStations = await getNearbyPlaces(latitude, longitude, 'train_station', 500, fullAddress, city, state);
    await addApiDelay();
    
    log(`Fetching subway station data for laundromat ID ${id}`);
    const subwayStations = await getNearbyPlaces(latitude, longitude, 'subway_station', 500, fullAddress, city, state);
    await addApiDelay();
    
    // Always look for gas stations as they're important landmarks for laundromats
    log(`Fetching gas station data for laundromat ID ${id}`);
    const gasStations = await getNearbyPlaces(latitude, longitude, 'gas_station', 500, fullAddress, city, state);
    await addApiDelay();
    
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
  
  let processedCount = 0;
  
  for (const laundromat of laundromats) {
    const success = await enhanceLaundromat(laundromat, client);
    
    if (success) {
      progress.processedCount++;
      processedCount++;
    } else {
      progress.errors.push({
        id: laundromat.id,
        timestamp: new Date().toISOString()
      });
    }
    
    progress.lastProcessedId = laundromat.id;
    saveProgress(progress);
    
    // Add a longer delay between laundromats to respect API rate limits
    log(`Completed processing laundromat ID ${laundromat.id}, pausing before next laundromat...`);
    
    // We use a longer delay between laundromats to ensure we don't hit rate limits
    const baseDelay = DELAY_BETWEEN_LAUNDROMATS; // Base delay from config
    const jitter = Math.floor(Math.random() * 2000); // Add 0-2s of random jitter
    await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
  }
  
  log(`Batch completed. Processed ${processedCount} laundromats in this batch.`);
  log(`Progress: ${progress.processedCount}/${progress.totalLaundromats} (${Math.round(progress.processedCount/progress.totalLaundromats*100)}%)`);
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
    
    const result = await client.query(query, [progress.lastProcessedId, batchSize]);
    
    if (result.rows.length === 0) {
      log('No more laundromats to process or reached the end.');
      return true;
    }
    
    log(`Found ${result.rows.length} laundromats to process in this run`);
    await processBatch(result.rows, progress, client);
    
    log(`Batch run completed. Processed ${result.rows.length} laundromats.`);
    log(`Overall progress: ${progress.processedCount}/${progress.totalLaundromats} (${(progress.processedCount/progress.totalLaundromats*100).toFixed(2)}%)`);
    log(`Total errors encountered: ${progress.errors.length}`);
    
    return true;
  } catch (error) {
    log(`Fatal error in batch process: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Start a single batch process with the specified parameters
processBatches().then(() => {
  log('Process completed');
  process.exit(0);
}).catch(error => {
  log(`Unhandled error: ${error.message}`);
  process.exit(1);
});