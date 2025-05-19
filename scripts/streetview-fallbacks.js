/**
 * Street View Fallback Images Script
 * 
 * This script creates only the street view fallback images,
 * which are needed for the laundromat detail pages.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Street view cache directory
const STREETVIEW_DIR = path.join(process.cwd(), 'public', 'streetview');

// Create directory if it doesn't exist
if (!fs.existsSync(STREETVIEW_DIR)) {
  console.log(`Creating streetview directory: ${STREETVIEW_DIR}`);
  fs.mkdirSync(STREETVIEW_DIR, { recursive: true });
}

// Reliable street view fallback images
const streetViewImages = [
  'https://images.pexels.com/photos/2389349/pexels-photo-2389349.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
  'https://images.pexels.com/photos/2603464/pexels-photo-2603464.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
  'https://images.pexels.com/photos/3751007/pexels-photo-3751007.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
  'https://images.pexels.com/photos/2526128/pexels-photo-2526128.jpeg?auto=compress&cs=tinysrgb&w=600&h=400',
  'https://images.pexels.com/photos/2119713/pexels-photo-2119713.jpeg?auto=compress&cs=tinysrgb&w=600&h=400'
];

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
    const imageUrl = getRandomImage(streetViewImages);
    
    await downloadImage(imageUrl, filepath);
    console.log(`✓ Successfully created fallback street view: ${filename}`);
    return { filepath, cached: true };
  } catch (error) {
    console.error(`Error creating fallback street view for (${lat}, ${lng}): ${error.message}`);
    return { filepath, cached: false, error: error.message };
  }
}

// Popular locations to create placeholders for - focusing on important places
const locations = [
  // Major US cities
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  
  // Known laundromat locations in project
  { name: "Jessica's Laundromat", lat: 29.7830, lng: -95.3738 },
  { name: "Stanford Laundromat", lat: 29.7069, lng: -95.4128 },
  { name: "The Cleaner's Laundry", lat: 29.8167, lng: -95.4270 },
];

// Street view headings (compass directions)
const headings = [0, 90, 180, 270];

// Street view sizes
const streetViewSizes = [
  { width: 600, height: 400 },
  { width: 400, height: 300 },
];

// Main function - focused on just creating street view images
async function createStreetViewFallbacks() {
  console.log('Starting street view fallback image creation...');
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  // Create fallback street views
  for (const location of locations) {
    console.log(`\nProcessing street views for ${location.name} (${location.lat}, ${location.lng})`);
    
    for (const heading of headings) {
      for (const size of streetViewSizes) {
        await sleep(100); // Small delay to prevent rate limiting
        const result = await createFallbackStreetView(
          location.lat,
          location.lng,
          heading,
          size.width,
          size.height
        );
        
        if (!result.cached) {
          skipped++;
        } else if (result.error) {
          errors++;
        } else {
          created++;
        }
      }
    }
  }
  
  // Print summary
  console.log('\n=== Street View Fallback Creation Summary ===');
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (Already exist): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  console.log('\nStreet view image creation complete!');
}

// Run the creation process
createStreetViewFallbacks().catch(error => {
  console.error('Error in street view creation process:', error);
});