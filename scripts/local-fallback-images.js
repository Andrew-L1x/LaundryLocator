/**
 * Local Fallback Images Script
 * 
 * This script creates simplified map and street view images that can be
 * used immediately without requiring API access.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

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

// Existing stock images that should work reliably
const workingImages = {
  // Map fallbacks - consistent sizes
  maps: [
    'https://images.pexels.com/photos/1028600/pexels-photo-1028600.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1308940/pexels-photo-1308940.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1707820/pexels-photo-1707820.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1563256/pexels-photo-1563256.jpeg?auto=compress&cs=tinysrgb&w=600&h=350'
  ],
  
  // Street view fallbacks - consistent sizes
  streetView: [
    'https://images.pexels.com/photos/2389349/pexels-photo-2389349.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/2603464/pexels-photo-2603464.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/3751007/pexels-photo-3751007.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/2526128/pexels-photo-2526128.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/2119713/pexels-photo-2119713.jpeg?auto=compress&cs=tinysrgb&w=600&h=400'
  ]
};

// Function to format coordinate for filename
function formatCoordinateForPath(coord) {
  return String(coord).replace(/\./g, '_');
}

// Get random image from array
function getRandomImage(images) {
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

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

// Sleep function
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Create fallback map for location
async function createFallbackMap(lat, lng, zoom, width, height) {
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
    console.log(`Creating fallback map for (${lat}, ${lng}) zoom ${zoom}`);
    const imageUrl = getRandomImage(workingImages.maps);
    
    await downloadImage(imageUrl, filepath);
    console.log(`✓ Successfully created fallback map: ${filename}`);
    return { filepath, cached: true };
  } catch (error) {
    console.error(`Error creating fallback map for (${lat}, ${lng}): ${error.message}`);
    return { filepath, cached: false, error: error.message };
  }
}

// Create fallback street view for location
async function createFallbackStreetView(lat, lng, heading, width, height) {
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
    console.log(`Creating fallback street view for (${lat}, ${lng}) heading ${heading}`);
    const imageUrl = getRandomImage(workingImages.streetView);
    
    await downloadImage(imageUrl, filepath);
    console.log(`✓ Successfully created fallback street view: ${filename}`);
    return { filepath, cached: true };
  } catch (error) {
    console.error(`Error creating fallback street view for (${lat}, ${lng}): ${error.message}`);
    return { filepath, cached: false, error: error.message };
  }
}

// Popular locations to create placeholders for
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
  
  // Known laundromat locations from assets
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

// Main function
async function createFallbackImages() {
  console.log('Starting fallback image creation...');
  
  let stats = {
    maps: {
      created: 0,
      skipped: 0,
      errors: 0
    },
    streetViews: {
      created: 0,
      skipped: 0,
      errors: 0
    }
  };
  
  // Create fallback maps
  console.log('\n=== Creating Fallback Maps ===');
  for (const location of popularLocations) {
    console.log(`\nProcessing maps for ${location.name} (${location.lat}, ${location.lng})`);
    
    for (const zoom of zoomLevels) {
      for (const size of mapSizes) {
        await sleep(100); // Small delay to prevent rate limiting from image hosts
        const result = await createFallbackMap(
          location.lat,
          location.lng,
          zoom,
          size.width,
          size.height
        );
        
        if (!result.cached) {
          stats.maps.skipped++;
        } else if (result.error) {
          stats.maps.errors++;
        } else {
          stats.maps.created++;
        }
      }
    }
  }
  
  // Create fallback street views
  console.log('\n=== Creating Fallback Street Views ===');
  for (const location of popularLocations) {
    console.log(`\nProcessing street views for ${location.name} (${location.lat}, ${location.lng})`);
    
    for (const heading of headings) {
      for (const size of streetViewSizes) {
        await sleep(100); // Small delay to prevent rate limiting from image hosts
        const result = await createFallbackStreetView(
          location.lat,
          location.lng,
          heading,
          size.width,
          size.height
        );
        
        if (!result.cached) {
          stats.streetViews.skipped++;
        } else if (result.error) {
          stats.streetViews.errors++;
        } else {
          stats.streetViews.created++;
        }
      }
    }
  }
  
  // Print summary
  console.log('\n=== Fallback Image Creation Summary ===');
  console.log('Static Maps:');
  console.log(`  Created: ${stats.maps.created}`);
  console.log(`  Skipped (Already exist): ${stats.maps.skipped}`);
  console.log(`  Errors: ${stats.maps.errors}`);
  
  console.log('\nStreet Views:');
  console.log(`  Created: ${stats.streetViews.created}`);
  console.log(`  Skipped (Already exist): ${stats.streetViews.skipped}`);
  console.log(`  Errors: ${stats.streetViews.errors}`);
  
  console.log('\nFallback image creation complete!');
}

// Run the creation process
createFallbackImages().catch(error => {
  console.error('Error in image creation process:', error);
});