/**
 * Create Placeholder Maps Script
 * 
 * This script creates simple placeholder map images that can be used
 * until proper Google Maps API access is granted.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createCanvas } from 'canvas';

// Calculate directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache directories
const MAPS_DIR = path.join(__dirname, '..', 'public', 'maps', 'static');
const STREETVIEW_DIR = path.join(__dirname, '..', 'public', 'streetview');

// Create directories if they don't exist
if (!fs.existsSync(MAPS_DIR)) {
  console.log(`Creating maps directory: ${MAPS_DIR}`);
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

if (!fs.existsSync(STREETVIEW_DIR)) {
  console.log(`Creating streetview directory: ${STREETVIEW_DIR}`);
  fs.mkdirSync(STREETVIEW_DIR, { recursive: true });
}

// Function to format a coordinate for a file path
function formatCoordinateForPath(coord) {
  return coord.toFixed(6).replace(/\./g, '_');
}

// Function to create a simple map placeholder
function createMapPlaceholder(lat, lng, zoom, width, height) {
  const formattedLat = formatCoordinateForPath(lat);
  const formattedLng = formatCoordinateForPath(lng);
  const filename = `map_${formattedLat}_${formattedLng}_${zoom}_${width}x${height}.jpg`;
  const filepath = path.join(MAPS_DIR, filename);
  
  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`Map placeholder already exists: ${filepath}`);
    return filepath;
  }
  
  console.log(`Creating map placeholder: ${filepath}`);
  
  // Create canvas with specified dimensions
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background with light color
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, width, height);
  
  // Draw grid lines
  ctx.strokeStyle = '#d4d4d4';
  ctx.lineWidth = 1;
  
  // Draw horizontal grid lines
  for (let y = 0; y < height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Draw vertical grid lines
  for (let x = 0; x < width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Draw marker in center
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Draw pin circle
  ctx.fillStyle = '#ff4757';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
  ctx.fill();
  
  // Add text
  ctx.fillStyle = '#333';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  
  // Coordinates text
  const coordsText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  ctx.fillText(coordsText, centerX, centerY + 30);
  
  // Zoom level text
  ctx.fillText(`Zoom: ${zoom}`, centerX, centerY + 50);
  
  // Write placeholder image to file
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(filepath, buffer);
  
  return filepath;
}

// Function to create a simple street view placeholder
function createStreetViewPlaceholder(lat, lng, heading, width, height) {
  const formattedLat = formatCoordinateForPath(lat);
  const formattedLng = formatCoordinateForPath(lng);
  const filename = `sv_${formattedLat}_${formattedLng}_${heading}_${width}x${height}.jpg`;
  const filepath = path.join(STREETVIEW_DIR, filename);
  
  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`Street View placeholder already exists: ${filepath}`);
    return filepath;
  }
  
  console.log(`Creating Street View placeholder: ${filepath}`);
  
  // Create canvas with specified dimensions
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill with gray background (sky)
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, width, height);
  
  // Draw "ground"
  ctx.fillStyle = '#7b8d64';
  ctx.fillRect(0, height / 2, width, height / 2);
  
  // Draw "road"
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, height * 0.7, width, height * 0.2);
  
  // Draw "road markings"
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 10]);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.8);
  ctx.lineTo(width, height * 0.8);
  ctx.stroke();
  
  // Add some buildings (depends on heading)
  ctx.fillStyle = '#888888';
  
  // Draw different buildings based on heading
  switch (Math.floor(heading / 90)) {
    case 0: // North (0 degrees)
      ctx.fillRect(width * 0.1, height * 0.3, width * 0.2, height * 0.2);
      ctx.fillRect(width * 0.7, height * 0.25, width * 0.15, height * 0.25);
      break;
    case 1: // East (90 degrees)
      ctx.fillRect(width * 0.2, height * 0.25, width * 0.3, height * 0.25);
      ctx.fillRect(width * 0.6, height * 0.3, width * 0.25, height * 0.2);
      break;
    case 2: // South (180 degrees)
      ctx.fillRect(width * 0.3, height * 0.2, width * 0.2, height * 0.3);
      ctx.fillRect(width * 0.65, height * 0.25, width * 0.2, height * 0.25);
      break;
    case 3: // West (270 degrees)
      ctx.fillRect(width * 0.15, height * 0.3, width * 0.25, height * 0.2);
      ctx.fillRect(width * 0.55, height * 0.2, width * 0.2, height * 0.3);
      break;
  }
  
  // Add text
  ctx.fillStyle = '#333';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  
  // Coordinates text
  const coordsText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  ctx.fillText(coordsText, width / 2, 30);
  
  // Heading text
  ctx.fillText(`Heading: ${heading}°`, width / 2, 50);
  
  // Write placeholder image to file
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(filepath, buffer);
  
  return filepath;
}

// Popular locations to create placeholders for
const popularLocations = [
  // Major US cities
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  
  // Known laundromat locations
  { name: "Jessica's Laundromat", lat: 29.7830, lng: -95.3738 },
  { name: "Stanford Laundromat", lat: 29.7069, lng: -95.4128 },
  { name: "The Cleaner's Laundry", lat: 29.8167, lng: -95.4270 },
];

// Zoom levels
const zoomLevels = [8, 10, 12, 14];

// Image sizes
const mapSizes = [
  { width: 600, height: 350 },
  { width: 600, height: 500 }
];

// Street View image sizes
const streetViewSizes = [
  { width: 600, height: 400 },
  { width: 400, height: 300 }
];

// Headings for street view (compass directions)
const headings = [0, 90, 180, 270]; // North, East, South, West

// Main function to create placeholder images
async function createPlaceholders() {
  console.log('Creating placeholder map images...');
  
  let mapsCreated = 0;
  let streetViewsCreated = 0;
  let mapsSkipped = 0;
  let streetViewsSkipped = 0;
  
  // Create map placeholders
  for (const location of popularLocations) {
    for (const zoom of zoomLevels) {
      for (const size of mapSizes) {
        try {
          const filepath = createMapPlaceholder(
            location.lat,
            location.lng,
            zoom,
            size.width,
            size.height
          );
          
          if (filepath.includes('already exists')) {
            mapsSkipped++;
          } else {
            mapsCreated++;
          }
        } catch (error) {
          console.error(`Error creating map placeholder for ${location.name}:`, error);
        }
      }
    }
  }
  
  // Create street view placeholders
  for (const location of popularLocations) {
    for (const heading of headings) {
      for (const size of streetViewSizes) {
        try {
          const filepath = createStreetViewPlaceholder(
            location.lat,
            location.lng,
            heading,
            size.width,
            size.height
          );
          
          if (filepath.includes('already exists')) {
            streetViewsSkipped++;
          } else {
            streetViewsCreated++;
          }
        } catch (error) {
          console.error(`Error creating street view placeholder for ${location.name}:`, error);
        }
      }
    }
  }
  
  console.log('\nPlaceholder creation summary:');
  console.log(`Maps created: ${mapsCreated}`);
  console.log(`Maps skipped (already exist): ${mapsSkipped}`);
  console.log(`Street Views created: ${streetViewsCreated}`);
  console.log(`Street Views skipped (already exist): ${streetViewsSkipped}`);
  console.log('\nDone creating placeholder images!');
}

// Run the placeholder creation process
createPlaceholders().catch(error => {
  console.error('Error in placeholder creation process:', error);
});