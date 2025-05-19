/**
 * Optimized Google Places Enhancement for Laundromats
 * 
 * This script processes laundromats much faster by:
 * 1. Doubling batch size (50 laundromats per batch)
 * 2. Using parallel API requests for place types
 * 3. Prioritizing place types by relevance
 * 4. Optimizing address search logic
 */

import dotenv from 'dotenv';
import pg from 'pg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment variables
dotenv.config();

// Setup file paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configure Google Places API
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Important constants
const BATCH_SIZE = 50;           // Process 50 laundromats per batch (doubled from original)
const PROGRESS_FILE = path.join(process.cwd(), 'place-enhancement-progress.json');
const LOG_FILE = path.join(process.cwd(), 'optimized-place-enhancement.log');

// Priority levels for place types
const PLACE_TYPES = {
  // Priority 1: Essential services (most relevant to laundromat visitors)
  priority1: [
    'restaurant',
    'convenience_store',
    'grocery_or_supermarket',
    'department_store'
  ],
  // Priority 2: Waiting options
  priority2: [
    'park',
    'transit_station',
    'shopping_mall',
    'library'
  ],
  // Priority 3: Nice-to-have options
  priority3: [
    'cafe',
    'bar',
    'liquor_store',
    'pharmacy'
  ]
};

// Logging helper function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  fs.appendFileSync(LOG_FILE, logMessage + '\n', { flag: 'a' });
}

// Load progress from file or create new progress
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  return { processedCount: 0, skippedCount: 0, errorCount: 0, total: 0 };
}

// Save progress to file
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    log(`Error saving progress file: ${error.message}`);
  }
}

// Process place data to extract useful information
function processPlaceData(place) {
  if (!place) return null;
  
  return {
    place_id: place.place_id,
    name: place.name,
    address: place.vicinity || place.formatted_address,
    location: place.geometry?.location,
    types: place.types,
    rating: place.rating,
    user_ratings_total: place.user_ratings_total,
    photos: place.photos ? place.photos.map(photo => ({
      photo_reference: photo.photo_reference,
      width: photo.width,
      height: photo.height
    })) : [],
    opening_hours: place.opening_hours
  };
}

// Search for places near the laundromat using address-based search
async function getNearbyPlaces(latitude, longitude, types, radius = 500, address = null, city = null, state = null) {
  // Build location query parameter
  let location = '';
  
  // If we have an address, use that for better results
  if (address && city && state) {
    location = `${address}, ${city}, ${state}`;
  } else {
    location = `${latitude},${longitude}`;
  }
  
  try {
    // Build query URL
    const typesParam = Array.isArray(types) ? types.join('|') : types;
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
    const params = {
      key: GOOGLE_API_KEY,
      location: `${latitude},${longitude}`,
      radius: radius,
      type: typesParam
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      // Process raw results
      const processedPlaces = response.data.results.map(processPlaceData).filter(Boolean);
      
      // Add additional UI-friendly fields
      return processedPlaces.map(place => {
        // Calculate estimated walking distance (very rough estimate)
        const distanceInMeters = place.location ? 
          calculateDistance(latitude, longitude, place.location.lat, place.location.lng) * 1000 : 
          null;
          
        // Format as "X min walk" or "X miles"
        let walkingDistance = 'Nearby';
        if (distanceInMeters) {
          if (distanceInMeters < 1000) {
            const walkingTimeMinutes = Math.max(1, Math.round(distanceInMeters / 80)); // ~80m per minute walking pace
            walkingDistance = `${walkingTimeMinutes} min walk`;
          } else {
            const distanceMiles = (distanceInMeters / 1609.34).toFixed(1);
            walkingDistance = `${distanceMiles} miles`;
          }
        }
        
        // Map place type to friendly category
        let category = '';
        if (place.types) {
          if (place.types.includes('restaurant')) category = 'Restaurant';
          else if (place.types.includes('cafe')) category = 'Café';
          else if (place.types.includes('bar')) category = 'Bar';
          else if (place.types.includes('grocery_or_supermarket')) category = 'Supermarket';
          else if (place.types.includes('convenience_store')) category = 'Convenience Store';
          else if (place.types.includes('department_store')) category = 'Department Store';
          else if (place.types.includes('pharmacy')) category = 'Pharmacy';
          else if (place.types.includes('shopping_mall')) category = 'Shopping Mall';
          else if (place.types.includes('park')) category = 'Park';
          else if (place.types.includes('library')) category = 'Library';
          else if (place.types.includes('bus_station')) category = 'Bus Stop';
          else if (place.types.includes('subway_station')) category = 'Subway';
          else if (place.types.includes('transit_station')) category = 'Transit';
          else category = place.types[0]?.replace(/_/g, ' ') || 'Place';
        }
        
        return {
          ...place,
          walkingDistance,
          category: category.charAt(0).toUpperCase() + category.slice(1) // Capitalize first letter
        };
      });
    } else {
      log(`API error for ${location}, types ${typesParam}: ${response.data.status}`);
      return [];
    }
  } catch (error) {
    log(`Error fetching nearby places for ${location}: ${error.message}`);
    return [];
  }
}

// Helper function to calculate distance between coordinates (using Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Fetch details about a place, including reviews and photos
async function getPlaceDetails(placeId) {
  if (!placeId) return null;
  
  try {
    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = {
      key: GOOGLE_API_KEY,
      place_id: placeId,
      fields: 'name,rating,reviews,formatted_address,formatted_phone_number,opening_hours,photos,website,types,business_status'
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data.status === 'OK') {
      const result = response.data.result;
      
      // Process photos to include full URLs for easier access
      if (result.photos && result.photos.length > 0) {
        result.photos = result.photos.map(photo => {
          return {
            ...photo,
            url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
          };
        });
      }
      
      return result;
    } else {
      log(`API error for place details ${placeId}: ${response.data.status}`);
      return null;
    }
  } catch (error) {
    log(`Error fetching place details for ${placeId}: ${error.message}`);
    return null;
  }
}

// Enhanced place details for a laundromat
async function enhanceLaundromat(laundromat, client) {
  const { id, name, latitude, longitude, address, city, state } = laundromat;
  
  log(`Enhancing laundromat #${id}: ${name} in ${city}, ${state}`);
  
  if (!latitude || !longitude) {
    log(`Skipping laundromat #${id}: missing coordinates`);
    return false;
  }
  
  try {
    // Collect all place results from different categories
    let allPlaces = {
      restaurants: [],
      activities: [],
      transit: [],
      services: []
    };
    
    // Google details object (separate for compatibility with UI)
    let googleDetails = {
      name: name,
      formatted_address: address,
      rating: null,
      reviews: [],
      photos: [],
      opening_hours: null,
      url: null
    };
    
    // First, try to find the exact laundromat on Google Places
    log(`Looking for exact match for laundromat #${id} on Google Places`);
    const searchQuery = `${name} laundromat ${city} ${state}`;
    const url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
    const params = {
      key: GOOGLE_API_KEY,
      input: searchQuery,
      inputtype: 'textquery',
      fields: 'place_id,name,geometry',
      locationbias: `circle:500@${latitude},${longitude}`
    };
    
    try {
      const response = await axios.get(url, { params });
      
      if (response.data.status === 'OK' && response.data.candidates?.length > 0) {
        const exactMatch = response.data.candidates[0];
        log(`Found potential exact match for #${id}: ${exactMatch.name}`);
        
        // Get detailed info including reviews
        const placeDetails = await getPlaceDetails(exactMatch.place_id);
        
        if (placeDetails) {
          log(`Retrieved detailed information for #${id}`);
          
          // Extract reviews in the format expected by the UI
          if (placeDetails.reviews && placeDetails.reviews.length > 0) {
            googleDetails.reviews = placeDetails.reviews.map(review => ({
              author: review.author_name || 'Anonymous',
              text: review.text || '',
              rating: review.rating || 0,
              time: review.time || Math.floor(Date.now() / 1000)
            }));
          }
          
          // Extract other Google details
          googleDetails.name = placeDetails.name || name;
          googleDetails.formatted_address = placeDetails.formatted_address || address;
          googleDetails.rating = placeDetails.rating || null;
          googleDetails.photos = placeDetails.photos || [];
          googleDetails.opening_hours = placeDetails.opening_hours || null;
          googleDetails.url = placeDetails.website || null;
        }
      }
    } catch (error) {
      log(`Error looking for exact match: ${error.message}`);
      // Continue with nearby places search regardless
    }
    
    // Wait between priority levels to avoid rate limiting
    log(`Fetching priority 1 places (food & shopping) for #${id}`);
    // Priority 1: Essential services
    const priority1Promises = PLACE_TYPES.priority1.map(async (type) => {
      const places = await getNearbyPlaces(
        latitude, 
        longitude, 
        type, 
        500, 
        address, 
        city, 
        state
      );
      
      // Sort places based on their relevance to the laundromat visitors
      places.forEach(place => {
        if (place.types?.includes('restaurant') || 
            place.types?.includes('cafe') || 
            place.types?.includes('bar')) {
          allPlaces.restaurants.push(place);
        } else if (place.types?.includes('grocery_or_supermarket') || 
                 place.types?.includes('convenience_store') || 
                 place.types?.includes('department_store') ||
                 place.types?.includes('shopping_mall')) {
          // Both activities and restaurants since they can be either
          allPlaces.restaurants.push(place);
          allPlaces.services.push(place);
        }
      });
      
      return true;
    });
    
    await Promise.all(priority1Promises);
    await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between priority levels
    
    log(`Fetching priority 2 places (parks & activities) for #${id}`);
    // Priority 2: Waiting options
    const priority2Promises = PLACE_TYPES.priority2.map(async (type) => {
      const places = await getNearbyPlaces(
        latitude, 
        longitude, 
        type, 
        500, 
        address, 
        city, 
        state
      );
      
      places.forEach(place => {
        if (place.types?.includes('park') || 
            place.types?.includes('library')) {
          allPlaces.activities.push(place);
        } else if (place.types?.includes('transit_station') ||
                 place.types?.includes('bus_station') ||
                 place.types?.includes('subway_station')) {
          allPlaces.transit.push(place);
        } else {
          // Default to activities for other places
          allPlaces.activities.push(place);
        }
      });
      
      return true;
    });
    
    await Promise.all(priority2Promises);
    await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between priority levels
    
    log(`Fetching priority 3 places (other options) for #${id}`);
    // Priority 3: Nice-to-have options
    const priority3Promises = PLACE_TYPES.priority3.map(async (type) => {
      const places = await getNearbyPlaces(
        latitude, 
        longitude, 
        type, 
        500, 
        address, 
        city, 
        state
      );
      
      places.forEach(place => {
        if (place.types?.includes('cafe')) {
          allPlaces.restaurants.push(place);
        } else if (place.types?.includes('bar')) {
          allPlaces.restaurants.push(place);
        } else if (place.types?.includes('pharmacy') ||
                 place.types?.includes('store')) {
          allPlaces.services.push(place);
        } else {
          // Default to activities
          allPlaces.activities.push(place);
        }
      });
      
      return true;
    });
    
    await Promise.all(priority3Promises);
    
    // Remove duplicates from each category
    for (const category in allPlaces) {
      allPlaces[category] = allPlaces[category]
        .filter((place, index, self) => 
          index === self.findIndex(p => p.place_id === place.place_id)
        )
        .slice(0, 5); // Limit to top 5 results per category
    }
    
    // Prepare data for database update
    const nearbyPlacesJson = JSON.stringify(allPlaces);
    const googleDetailsJson = JSON.stringify(googleDetails);
    
    // Update the database with all enhanced data
    const updateQuery = `
      UPDATE laundromats
      SET 
        nearby_places = $1,
        google_details = $2
      WHERE id = $3
    `;
    
    await client.query(updateQuery, [nearbyPlacesJson, googleDetailsJson, id]);
    log(`Updated laundromat #${id} with nearby places and Google details`);
    
    return true;
  } catch (error) {
    log(`Error enhancing laundromat #${id}: ${error.message}`);
    return false;
  }
}

// Process a batch of laundromats
async function processBatch(laundromats, progress, client) {
  let successCount = 0;
  let errorCount = 0;
  
  for (const laundromat of laundromats) {
    try {
      const success = await enhanceLaundromat(laundromat, client);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
        progress.errorCount++;
      }
      
      // Small delay between individual laundromats
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      log(`Error processing laundromat #${laundromat.id}: ${error.message}`);
      errorCount++;
      progress.errorCount++;
    }
    
    progress.processedCount++;
    
    // Save progress every 5 laundromats
    if (progress.processedCount % 5 === 0) {
      saveProgress(progress);
    }
  }
  
  log(`Batch processed: ${successCount} successful, ${errorCount} failed`);
  return { successCount, errorCount };
}

// Main function to process batches of laundromats
async function processBatches() {
  const progress = loadProgress();
  const client = await pool.connect();
  
  try {
    // Get the total count first
    const countResult = await client.query('SELECT COUNT(*) FROM laundromats WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
    progress.total = parseInt(countResult.rows[0].count);
    
    log(`Starting optimized place enhancement for ${progress.total} laundromats`);
    log(`Already processed: ${progress.processedCount}, skipped: ${progress.skippedCount}, errors: ${progress.errorCount}`);
    
    // Get a batch of unprocessed laundromats
    const query = `
      SELECT id, name, latitude, longitude, address, city, state
      FROM laundromats
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY id
      OFFSET $1
      LIMIT $2
    `;
    
    const result = await client.query(query, [progress.processedCount, BATCH_SIZE]);
    
    if (result.rows.length === 0) {
      log('No more laundromats to process');
      return false;
    }
    
    log(`Processing batch of ${result.rows.length} laundromats`);
    
    // Process the batch
    await processBatch(result.rows, progress, client);
    
    // Save final progress
    saveProgress(progress);
    
    // Return whether there are more to process
    return progress.processedCount < progress.total;
  } catch (error) {
    log(`Error processing batch: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  try {
    log('Starting optimized place enhancement script');
    
    const hasMore = await processBatches();
    
    if (hasMore) {
      log('Batch completed, more laundromats remain to be processed');
    } else {
      log('All laundromats have been processed');
    }
    
    // Exit cleanly
    process.exit(0);
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Start the script
main();