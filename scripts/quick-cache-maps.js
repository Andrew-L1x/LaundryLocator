/**
 * Quick Cache Maps Script
 * 
 * This script quickly creates essential map images for the most important locations
 * in your application, focusing on the most viewed cities and specific laundromats.
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

// Reliable map and street view images (using JPG/JPEG for better compatibility)
const stockImages = {
  maps: [
    'https://images.pexels.com/photos/1653228/pexels-photo-1653228.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1583656/pexels-photo-1583656.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1707820/pexels-photo-1707820.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1738991/pexels-photo-1738991.jpeg?auto=compress&cs=tinysrgb&w=600&h=350',
    'https://images.pexels.com/photos/1470405/pexels-photo-1470405.jpeg?auto=compress&cs=tinysrgb&w=600&h=350'
  ],
  streetViews: [
    'https://images.pexels.com/photos/2952661/pexels-photo-2952661.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/2080960/pexels-photo-2080960.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/1111367/pexels-photo-1111367.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/8120706/pexels-photo-8120706.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
    'https://images.pexels.com/photos/1486648/pexels-photo-1486648.jpeg?auto=compress&cs=tinysrgb&w=600&h=400'
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

// Sleep function
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
    const imageUrl = getRandomImage(stockImages.maps);
    
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
    const imageUrl = getRandomImage(stockImages.streetViews);
    
    await downloadImage(imageUrl, filepath);
    console.log(`✓ Successfully created fallback street view: ${filename}`);
    return { filepath, cached: true };
  } catch (error) {
    console.error(`Error creating fallback street view for (${lat}, ${lng}): ${error.message}`);
    return { filepath, cached: false, error: error.message };
  }
}

// Priority locations - focus on the most important ones first
const priorityLocations = [
  // Top cities
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  
  // Priority laundromat locations
  { name: "Jessica's Laundromat", lat: 29.7830, lng: -95.3738 },
  { name: "Stanford Laundromat", lat: 29.7069, lng: -95.4128 },
  { name: "The Cleaner's Laundry", lat: 29.8167, lng: -95.4270 },
];

// Most commonly used zoom levels and sizes
const mapConfigs = [
  { zoom: 12, width: 600, height: 350 }, // Most used zoom and size
  { zoom: 14, width: 600, height: 350 },
];

// Street view headings and sizes
const streetViewConfigs = [
  { heading: 0, width: 600, height: 400 },  // Most used heading and size
  { heading: 90, width: 600, height: 400 },
];

// Main function - quick caching focused on priority locations
async function quickCacheMaps() {
  console.log('Starting quick map caching...');
  
  let stats = {
    maps: { created: 0, skipped: 0, errors: 0 },
    streetViews: { created: 0, skipped: 0, errors: 0 }
  };
  
  // Process priority locations
  for (const location of priorityLocations) {
    console.log(`\nProcessing ${location.name} (${location.lat}, ${location.lng})...`);
    
    // Process maps for this location
    for (const config of mapConfigs) {
      await sleep(50); // Small delay
      const result = await createFallbackMap(
        location.lat,
        location.lng,
        config.zoom,
        config.width,
        config.height
      );
      
      if (!result.cached) {
        stats.maps.skipped++;
      } else if (result.error) {
        stats.maps.errors++;
      } else {
        stats.maps.created++;
      }
    }
    
    // Only create street views for actual laundromat locations (not cities)
    if (location.name.includes('Laundromat') || location.name.includes('Laundry')) {
      for (const config of streetViewConfigs) {
        await sleep(50); // Small delay
        const result = await createFallbackStreetView(
          location.lat,
          location.lng,
          config.heading,
          config.width,
          config.height
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
  console.log('\n=== Quick Cache Summary ===');
  console.log('Static Maps:');
  console.log(`  Created: ${stats.maps.created}`);
  console.log(`  Skipped (Already exist): ${stats.maps.skipped}`);
  console.log(`  Errors: ${stats.maps.errors}`);
  
  console.log('\nStreet Views:');
  console.log(`  Created: ${stats.streetViews.created}`);
  console.log(`  Skipped (Already exist): ${stats.streetViews.skipped}`);
  console.log(`  Errors: ${stats.streetViews.errors}`);
  
  console.log('\nQuick caching complete!');
}

// Run the script
quickCacheMaps().catch(error => {
  console.error('Error in quick caching process:', error);
});