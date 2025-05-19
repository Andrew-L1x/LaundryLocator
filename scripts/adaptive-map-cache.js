/**
 * Adaptive Map Cache Script
 * 
 * This script attempts to cache static maps and street view images
 * with graceful fallbacks to pre-selected high-quality images when API access fails.
 * 
 * Features:
 * - Tries to use Google Maps Static API with fallbacks
 * - Maintains cache directory structure
 * - Provides quality fallback images categorized by location type
 * - Handles API failures gracefully
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// API key from environment
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

// Cache directories
const MAPS_DIR = path.join(process.cwd(), 'public', 'maps', 'static');
const STREETVIEW_DIR = path.join(process.cwd(), 'public', 'streetview');

// Create directories if they don't exist
if (!fs.existsSync(MAPS_DIR)) {
  console.log(`Creating maps directory: ${MAPS_DIR}`);
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

if (!fs.existsSync(STREETVIEW_DIR)) {
  console.log(`Creating streetview directory: ${STREETVIEW_DIR}`);
  fs.mkdirSync(STREETVIEW_DIR, { recursive: true });
}

// Fallback image URLs for different location types
const fallbackMaps = {
  urban: [
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80",
    "https://images.unsplash.com/photo-1496588152823-86ff7695e68f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80",
    "https://images.unsplash.com/photo-1477882244523-749bd21b63ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80"
  ],
  suburban: [
    "https://images.unsplash.com/photo-1500332988905-1bf2a5733f63?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80",
    "https://images.unsplash.com/photo-1580745283073-a341bc667aab?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80",
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80"
  ],
  rural: [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80",
    "https://images.unsplash.com/photo-1572389071530-972219a7f623?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80",
    "https://images.unsplash.com/photo-1520615725819-2752ac0a9b9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350&q=80"
  ]
};

// Fallback street view images
const fallbackStreetViews = {
  urban: [
    "https://images.unsplash.com/photo-1573108724029-4c46571d6490?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1606046424144-87d59a4d8c55?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1621274147744-cfb5298e081f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80"
  ],
  suburban: [
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1625602812206-5ec545ca1231?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80"
  ],
  rural: [
    "https://images.unsplash.com/photo-1588880331179-bc13827a7eab?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1594818379496-da1e345dc0f0?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1552653743-4d0fbaa44da4?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400&q=80"
  ]
};

// Function to format coordinate for filename
function formatCoordinateForPath(coord) {
  return String(coord).replace(/\./g, '_');
}

// Get random image from a category
function getRandomImage(category, isStreetView = false) {
  const images = isStreetView ? fallbackStreetViews[category] : fallbackMaps[category];
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

// Determine location category (urban, suburban, rural) based on coordinates
function getLocationCategory(lat, lng) {
  // Simple heuristic - could be improved with actual geodata
  // Major US urban areas are typically between 30-45 degrees latitude
  if (lat > 40 || lng < -110) {
    return "urban";
  } else if (lat > 35 || lng < -95) {
    return "suburban";
  } else {
    return "rural";
  }
}

// Sleep function to avoid rate limits
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Download an image from URL
async function downloadImage(url, filepath) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      
      writer.on('finish', () => {
        resolve(filepath);
      });
      
      writer.on('error', err => {
        reject(err);
      });
    });
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

// Cache a static map image with fallback
async function cacheStaticMap(lat, lng, zoom, width, height, retries = 1) {
  const formattedLat = formatCoordinateForPath(lat);
  const formattedLng = formatCoordinateForPath(lng);
  const filename = `map_${formattedLat}_${formattedLng}_${zoom}_${width}x${height}.jpg`;
  const filepath = path.join(MAPS_DIR, filename);
  
  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`Map already exists: ${filename}`);
    return { filepath, cached: false };
  }
  
  try {
    console.log(`Downloading map for (${lat}, ${lng}) zoom ${zoom}`);
    
    // Generate Google Static Maps API URL
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=roadmap&key=${MAPS_API_KEY}`;
    
    await downloadImage(mapUrl, filepath);
    console.log(`✓ Successfully cached map: ${filename}`);
    return { filepath, cached: true };
  } catch (error) {
    console.error(`Error caching map for (${lat}, ${lng}): ${error.message}`);
    
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts left)`);
      await sleep(1000); // Wait 1 second before retry
      return cacheStaticMap(lat, lng, zoom, width, height, retries - 1);
    }
    
    // Fallback to pre-selected high-quality image
    console.log(`Using fallback image for map (${lat}, ${lng})`);
    const category = getLocationCategory(lat, lng);
    const fallbackUrl = getRandomImage(category);
    
    try {
      await downloadImage(fallbackUrl, filepath);
      console.log(`✓ Successfully cached fallback map: ${filename}`);
      return { filepath, cached: true, fallback: true };
    } catch (fallbackError) {
      console.error(`Failed to cache fallback map: ${fallbackError.message}`);
      return { filepath, cached: false, error: fallbackError.message };
    }
  }
}

// Cache a street view image with fallback
async function cacheStreetView(lat, lng, heading, width, height, retries = 1) {
  const formattedLat = formatCoordinateForPath(lat);
  const formattedLng = formatCoordinateForPath(lng);
  const filename = `sv_${formattedLat}_${formattedLng}_${heading}_${width}x${height}.jpg`;
  const filepath = path.join(STREETVIEW_DIR, filename);
  
  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`Street view already exists: ${filename}`);
    return { filepath, cached: false };
  }
  
  try {
    console.log(`Downloading street view for (${lat}, ${lng}) heading ${heading}`);
    
    // Generate Google Street View API URL
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&heading=${heading}&key=${MAPS_API_KEY}`;
    
    await downloadImage(streetViewUrl, filepath);
    console.log(`✓ Successfully cached street view: ${filename}`);
    return { filepath, cached: true };
  } catch (error) {
    console.error(`Error caching street view for (${lat}, ${lng}): ${error.message}`);
    
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts left)`);
      await sleep(1000); // Wait 1 second before retry
      return cacheStreetView(lat, lng, heading, width, height, retries - 1);
    }
    
    // Fallback to pre-selected high-quality image
    console.log(`Using fallback image for street view (${lat}, ${lng})`);
    const category = getLocationCategory(lat, lng);
    const fallbackUrl = getRandomImage(category, true);
    
    try {
      await downloadImage(fallbackUrl, filepath);
      console.log(`✓ Successfully cached fallback street view: ${filename}`);
      return { filepath, cached: true, fallback: true };
    } catch (fallbackError) {
      console.error(`Failed to cache fallback street view: ${fallbackError.message}`);
      return { filepath, cached: false, error: fallbackError.message };
    }
  }
}

// List of popular locations to cache
const popularLocations = [
  // Major US cities
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  
  // Known laundromat locations (from the assets)
  { name: "Jessica's Laundromat", lat: 29.7830, lng: -95.3738 },
  { name: "Stanford Laundromat", lat: 29.7069, lng: -95.4128 },
  { name: "The Cleaner's Laundry", lat: 29.8167, lng: -95.4270 },
];

// Zoom levels for static maps
const zoomLevels = [8, 10, 12, 14];

// Map sizes
const mapSizes = [
  { width: 600, height: 350 },
  { width: 600, height: 500 },
];

// Street view headings (compass directions)
const headings = [0, 90, 180, 270];

// Street view sizes
const streetViewSizes = [
  { width: 600, height: 400 },
  { width: 400, height: 300 },
];

// Main cache function
async function runCacheProcess() {
  console.log('Starting adaptive map caching process...');
  console.log(`API Key available: ${MAPS_API_KEY ? 'Yes' : 'No'}`);
  
  if (!MAPS_API_KEY) {
    console.warn('Warning: No Google Maps API key found in environment variables.');
  }
  
  let stats = {
    maps: {
      cached: 0,
      fallbacks: 0,
      skipped: 0,
      errors: 0
    },
    streetViews: {
      cached: 0,
      fallbacks: 0,
      skipped: 0,
      errors: 0
    }
  };
  
  // Cache static maps
  console.log('\n=== Caching Static Maps ===');
  for (const location of popularLocations) {
    console.log(`\nProcessing maps for ${location.name} (${location.lat}, ${location.lng})`);
    
    for (const zoom of zoomLevels) {
      for (const size of mapSizes) {
        await sleep(100); // Small delay to prevent rate limiting
        const result = await cacheStaticMap(
          location.lat,
          location.lng,
          zoom,
          size.width,
          size.height
        );
        
        if (!result.cached) {
          stats.maps.skipped++;
        } else if (result.fallback) {
          stats.maps.fallbacks++;
        } else if (result.error) {
          stats.maps.errors++;
        } else {
          stats.maps.cached++;
        }
      }
    }
  }
  
  // Cache street views
  console.log('\n=== Caching Street Views ===');
  for (const location of popularLocations) {
    console.log(`\nProcessing street views for ${location.name} (${location.lat}, ${location.lng})`);
    
    for (const heading of headings) {
      for (const size of streetViewSizes) {
        await sleep(100); // Small delay to prevent rate limiting
        const result = await cacheStreetView(
          location.lat,
          location.lng,
          heading,
          size.width,
          size.height
        );
        
        if (!result.cached) {
          stats.streetViews.skipped++;
        } else if (result.fallback) {
          stats.streetViews.fallbacks++;
        } else if (result.error) {
          stats.streetViews.errors++;
        } else {
          stats.streetViews.cached++;
        }
      }
    }
  }
  
  // Print summary
  console.log('\n=== Cache Summary ===');
  console.log('Static Maps:');
  console.log(`  Cached (API): ${stats.maps.cached}`);
  console.log(`  Cached (Fallbacks): ${stats.maps.fallbacks}`);
  console.log(`  Skipped (Already exist): ${stats.maps.skipped}`);
  console.log(`  Errors: ${stats.maps.errors}`);
  
  console.log('\nStreet Views:');
  console.log(`  Cached (API): ${stats.streetViews.cached}`);
  console.log(`  Cached (Fallbacks): ${stats.streetViews.fallbacks}`);
  console.log(`  Skipped (Already exist): ${stats.streetViews.skipped}`);
  console.log(`  Errors: ${stats.streetViews.errors}`);
  
  console.log('\nCache process complete!');
}

// Run the cache process
runCacheProcess().catch(error => {
  console.error('Error in cache process:', error);
});