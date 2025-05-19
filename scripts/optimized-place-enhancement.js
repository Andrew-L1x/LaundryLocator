/**
 * Optimized Batch Google Places Enhancement for Laundromats
 * 
 * This script processes laundromats in parallel batches with optimized API calls
 * to significantly speed up the enhancement process while staying within Google API limits.
 */

import pg from 'pg';
import fs from 'fs';
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
const BATCH_SIZE = 50; // Process 50 laundromats at a time (doubled from original 25)
const LAUNDROMATS_PER_RUN = 200; // Process 200 laundromats in one execution (doubled from original 100)
const DELAY_BETWEEN_LAUNDROMATS = 1500; // 1.5 seconds between laundromats (halved from original 3)
const DELAY_BETWEEN_BATCHES = 8000; // 8 seconds between batches (reduced from original 15)
const PROGRESS_FILE = 'place-enhancement-progress.json';

// Function to log operations
function log(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync('optimized-place-enhancement.log', logMessage + '\n');
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
    total: 0,
    totalLaundromats: 0
  };
}

// Save progress to file
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    log(`Error saving progress: ${err.message}`);
  }
}

// Process place data into a standardized format
function processPlaceData(place) {
  if (!place) return null;
  
  // Extract place details
  const { name, types, rating, place_id, vicinity, price_level, photos } = place;
  
  // Determine category based on types
  let category = 'Point of Interest';
  
  if (types) {
    if (types.includes('restaurant') || types.includes('meal_takeaway') || types.includes('bakery')) {
      category = 'Restaurant';
    } else if (types.includes('cafe')) {
      category = 'Café';
    } else if (types.includes('bar')) {
      category = 'Bar';
    } else if (types.includes('park')) {
      category = 'Park';
    } else if (types.includes('shopping_mall') || types.includes('department_store')) {
      category = 'Shopping';
    } else if (types.includes('convenience_store') || types.includes('grocery_or_supermarket')) {
      category = 'Convenience Store';
    } else if (types.includes('bus_station') || types.includes('transit_station')) {
      category = 'Point of Interest';
    } else if (types.includes('library')) {
      category = 'Library';
    }
  }
  
  // Get photo URL if available
  let photoUrl = null;
  if (photos && photos.length > 0 && photos[0].photo_reference) {
    photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
  }
  
  // Estimate walking distance based on proximity
  const walkingDistance = "5-10 min walk"; // Simplified for this version
  
  return {
    name,
    types: types || [],
    rating: rating || null,
    placeId: place_id,
    category,
    photoUrl,
    vicinity,
    priceLevel: price_level ? '$'.repeat(price_level) : '',
    walkingDistance
  };
}

// Perform a text search for places
async function findPlacesWithTextSearch(searchQuery, type) {
  try {
    // Encode the search query
    const encodedQuery = encodeURIComponent(searchQuery);
    
    // Build the API URL
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}`;
    
    // Log the request (hiding the API key)
    log(`Making text search request: ${url.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    // Make the request
    const response = await axios.get(url);
    
    // Check if the request was successful
    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      const places = response.data.results || [];
      log(`Found ${places.length} ${type} places near "${searchQuery}" using text search`);
      return places;
    } else {
      log(`Error searching for ${type} places: ${response.data.status}`);
      return [];
    }
  } catch (error) {
    log(`Exception searching for ${type} places: ${error.message}`);
    return [];
  }
}

// Enhanced function to get nearby places with optimized search strategy
async function getNearbyPlaces(latitude, longitude, type, radius = 300, address = null, city = null, state = null) {
  try {
    let searchQuery;
    
    // Prioritize using the full address when available
    if (address && address.trim() !== '' && address.toLowerCase() !== 'unknown') {
      searchQuery = `${type} near ${address}`;
      
      // If city and state are available, add them for better results
      if (city && state) {
        searchQuery = `${type} near ${address}, ${city}, ${state}`;
      }
    } 
    // If address isn't available or useful, try city+state 
    else if (city && state) {
      searchQuery = `${type} near ${city}, ${state}`;
    }
    // Last resort: use coordinates
    else {
      searchQuery = `${type} near ${latitude},${longitude}`;
    }
    
    log(`Searching near address "${searchQuery}" for ${type}`);
    return await findPlacesWithTextSearch(searchQuery, type);
  } catch (error) {
    log(`Error getting nearby ${type} places: ${error.message}`);
    return [];
  }
}

// Enhanced function to get laundromat data with nearby places
async function enhanceLaundromat(laundromat, client) {
  try {
    const { id, latitude, longitude, city, state, address } = laundromat;
    
    log(`Processing laundromat ID ${id}: ${laundromat.name}`);
    log(`Using address: "${address}"`);
    
    // Define the structure for nearby places
    const nearby = {
      food: [],
      activities: [],
      shopping: [],
      transit: [],
      community: []
    };
    
    // Define the priority place types in categories
    const placeCategories = [
      // Priority 1: Essential places people need while doing laundry
      { type: 'restaurant', category: 'food', priority: 1 },
      { type: 'convenience_store', category: 'shopping', priority: 1 },
      
      // Priority 2: Places to spend time while waiting
      { type: 'park', category: 'activities', priority: 2 },
      { type: 'bus_station', category: 'transit', priority: 2 },
      
      // Priority 3: Additional places if time permits
      { type: 'cafe', category: 'food', priority: 3 },
      { type: 'library', category: 'community', priority: 3 }
    ];
    
    // Process categories in priority order, but make parallel requests within same priority
    const priorities = [1, 2, 3]; // Process in this order
    
    for (const priority of priorities) {
      const priorityCategories = placeCategories.filter(c => c.priority === priority);
      
      // Make parallel API calls for categories with the same priority level
      const results = await Promise.all(
        priorityCategories.map(async ({ type, category }) => {
          try {
            const places = await getNearbyPlaces(latitude, longitude, type, 300, address, city, state);
            return { type, category, places };
          } catch (error) {
            log(`Error fetching ${type} places: ${error.message}`);
            return { type, category, places: [] };
          }
        })
      );
      
      // Add a delay after each priority group to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Process the results from this priority group
      for (const { type, category, places } of results) {
        if (places && places.length > 0) {
          const processedPlaces = places.map(p => processPlaceData(p)).filter(p => p !== null);
          
          // Add to the appropriate category
          if (category === 'food') nearby.food.push(...processedPlaces);
          else if (category === 'activities') nearby.activities.push(...processedPlaces);
          else if (category === 'shopping') nearby.shopping.push(...processedPlaces);
          else if (category === 'transit') nearby.transit.push(...processedPlaces);
          else if (category === 'community') nearby.community.push(...processedPlaces);
          
          log(`Added ${processedPlaces.length} ${type} places to ${category} category`);
        }
      }
    }
    
    // Update the laundromat record in the database
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

// Process a batch of laundromats
async function processBatch(laundromats, progress, client) {
  log(`Processing batch of ${laundromats.length} laundromats`);
  
  for (let i = 0; i < laundromats.length; i++) {
    const laundromat = laundromats[i];
    
    // Skip if latitude or longitude is missing
    if (!laundromat.latitude || !laundromat.longitude) {
      log(`Skipping laundromat ID ${laundromat.id}: Missing coordinates`);
      progress.processedCount++;
      continue;
    }
    
    // Process the laundromat
    const success = await enhanceLaundromat(laundromat, client);
    
    // Update progress
    progress.processedCount++;
    progress.lastProcessedId = laundromat.id;
    saveProgress(progress);
    
    // Add a delay between laundromats to avoid rate limiting
    if (i < laundromats.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_LAUNDROMATS));
    }
  }
}

// Main function to process batches
async function processBatches() {
  // Load progress from file
  const progress = loadProgress();
  
  // Connect to database
  const client = await pool.connect();
  
  try {
    // Get total count of laundromats if not already loaded
    if (!progress.total) {
      const countResult = await client.query('SELECT COUNT(*) FROM laundromats');
      progress.total = parseInt(countResult.rows[0].count);
      progress.totalLaundromats = progress.total;
      saveProgress(progress);
    }
    
    log(`Starting batch process. Total laundromats: ${progress.total}, Already processed: ${progress.processedCount}`);
    
    // Get laundromats to process
    const laundromatsQuery = `
      SELECT id, name, latitude, longitude, city, state, address
      FROM laundromats
      WHERE id > $1
      ORDER BY id
      LIMIT $2
    `;
    
    const laundromatsResult = await client.query(laundromatsQuery, [progress.lastProcessedId, LAUNDROMATS_PER_RUN]);
    const laundromats = laundromatsResult.rows;
    
    log(`Found ${laundromats.length} laundromats to process in this run`);
    
    // Process laundromats in batches
    for (let i = 0; i < laundromats.length; i += BATCH_SIZE) {
      const batch = laundromats.slice(i, i + BATCH_SIZE);
      await processBatch(batch, progress, client);
      
      // Add a delay between batches
      if (i + BATCH_SIZE < laundromats.length) {
        log(`Batch completed. Waiting ${DELAY_BETWEEN_BATCHES/1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    log(`Completed processing ${laundromats.length} laundromats. Total processed: ${progress.processedCount}/${progress.total}`);
  } finally {
    // Release database connection
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