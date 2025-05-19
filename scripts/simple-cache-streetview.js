/**
 * Simple Cache Street View Images Script
 * 
 * This script caches Google Street View images for popular locations
 * to reduce API costs. It works independently from the database.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Calculate directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Google Maps API key from environment or .env file
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

// Ensure we have an API key
if (!GOOGLE_MAPS_API_KEY) {
  console.error('Error: Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY in your environment.');
  process.exit(1);
}

// Cache directory
const CACHE_DIR = path.join(__dirname, '..', 'public', 'streetview');

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  console.log(`Creating cache directory: ${CACHE_DIR}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Function to format a coordinate for a file path
function formatCoordinateForPath(coord) {
  return coord.toFixed(6).replace(/\./g, '_');
}

// Function to create a cache file path for a location
function getCacheFilePath(lat, lng, heading, size) {
  const formattedLat = formatCoordinateForPath(lat);
  const formattedLng = formatCoordinateForPath(lng);
  return path.join(CACHE_DIR, `sv_${formattedLat}_${formattedLng}_${heading}_${size}.jpg`);
}

// Function to download a Street View image and save it to the cache
function cacheStreetViewImage(lat, lng, heading = 0, size = '600x400', fov = 90) {
  return new Promise((resolve, reject) => {
    const cachePath = getCacheFilePath(lat, lng, heading, size);
    
    // Skip if already cached
    if (fs.existsSync(cachePath)) {
      console.log(`Street View already cached: ${cachePath}`);
      resolve({ cached: true, path: cachePath });
      return;
    }
    
    // Build Google Street View API URL
    const url = `https://maps.googleapis.com/maps/api/streetview?location=${lat},${lng}&size=${size}&heading=${heading}&fov=${fov}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log(`Downloading Street View for (${lat}, ${lng}) heading ${heading}°`);
    
    // Download the image
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download Street View: HTTP ${response.statusCode}`));
        return;
      }
      
      // Create write stream to save the image
      const file = fs.createWriteStream(cachePath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Street View cached successfully: ${cachePath}`);
        resolve({ cached: false, path: cachePath });
      });
      
      file.on('error', (err) => {
        fs.unlink(cachePath, () => {}); // Delete the file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Popular locations to cache
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
  { name: 'San Jose', lat: 37.3382, lng: -121.8863 },
  
  // State capitals
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  
  // Known laundromat locations
  { name: "Jessica's Laundromat", lat: 29.7830, lng: -95.3738 },
  { name: "Stanford Laundromat", lat: 29.7069, lng: -95.4128 },
  { name: "The Cleaner's Laundry", lat: 29.8167, lng: -95.4270 },
];

// Headings to cache (compass directions)
const headings = [0, 90, 180, 270]; // North, East, South, West

// Image sizes to cache
const imageSizes = ['600x400', '400x300'];

// Main function to cache Street View images for all popular locations
async function cachePopularStreetViews() {
  console.log('Starting to cache Street View images for popular locations...');
  
  let totalSuccess = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  
  for (const location of popularLocations) {
    for (const heading of headings) {
      for (const size of imageSizes) {
        try {
          const result = await cacheStreetViewImage(location.lat, location.lng, heading, size);
          
          if (result.cached) {
            totalSkipped++;
          } else {
            totalSuccess++;
          }
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error caching Street View for ${location.name}:`, error.message);
          totalErrors++;
        }
      }
    }
  }
  
  console.log('\nCaching summary:');
  console.log(`Total Street View images cached: ${totalSuccess}`);
  console.log(`Total images skipped (already cached): ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
}

// Run the caching process
cachePopularStreetViews().then(() => {
  console.log('Street View cache process complete!');
}).catch(error => {
  console.error('Error in caching process:', error);
});