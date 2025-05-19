/**
 * Simple Cache Static Maps Script
 * 
 * This script caches static maps for popular locations to reduce API costs.
 * It works independently from the database, so it's easier to run locally.
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
const CACHE_DIR = path.join(__dirname, '..', 'public', 'maps', 'static');

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
function getCacheFilePath(lat, lng, zoom, size) {
  const formattedLat = formatCoordinateForPath(lat);
  const formattedLng = formatCoordinateForPath(lng);
  return path.join(CACHE_DIR, `map_${formattedLat}_${formattedLng}_${zoom}_${size}.jpg`);
}

// Function to download a map image and save it to the cache
function cacheMapImage(lat, lng, zoom, size, markers = []) {
  return new Promise((resolve, reject) => {
    const cachePath = getCacheFilePath(lat, lng, zoom, size);
    
    // Skip if already cached
    if (fs.existsSync(cachePath)) {
      console.log(`Map already cached: ${cachePath}`);
      resolve({ cached: true, path: cachePath });
      return;
    }
    
    // Build markers string for URL
    let markerParams = '';
    if (markers.length > 0) {
      markers.forEach(marker => {
        markerParams += `&markers=color:${marker.color || 'red'}|${marker.lat},${marker.lng}`;
      });
    } else {
      // If no markers provided, add center marker
      markerParams = `&markers=color:red|${lat},${lng}`;
    }
    
    // Build Google Static Maps API URL
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2${markerParams}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log(`Downloading map for (${lat}, ${lng}) zoom ${zoom}`);
    
    // Download the image
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download map: HTTP ${response.statusCode}`));
        return;
      }
      
      // Create write stream to save the image
      const file = fs.createWriteStream(cachePath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Map cached successfully: ${cachePath}`);
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
];

// Zoom levels to cache
const zoomLevels = [8, 10, 12, 14];

// Image sizes to cache
const imageSizes = ['600x350', '600x500'];

// Main function to cache maps for all popular locations
async function cachePopularMaps() {
  console.log('Starting to cache maps for popular locations...');
  
  let totalSuccess = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  
  for (const location of popularLocations) {
    for (const zoom of zoomLevels) {
      for (const size of imageSizes) {
        try {
          const result = await cacheMapImage(location.lat, location.lng, zoom, size);
          
          if (result.cached) {
            totalSkipped++;
          } else {
            totalSuccess++;
          }
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error caching map for ${location.name}:`, error.message);
          totalErrors++;
        }
      }
    }
  }
  
  console.log('\nCaching summary:');
  console.log(`Total maps cached: ${totalSuccess}`);
  console.log(`Total maps skipped (already cached): ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
}

// Run the caching process
cachePopularMaps().then(() => {
  console.log('Cache process complete!');
}).catch(error => {
  console.error('Error in caching process:', error);
});