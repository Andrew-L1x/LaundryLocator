/**
 * Google Places API Test Script
 * 
 * This script tests different approaches for the Google Places API
 * to help diagnose and fix issues with finding nearby places.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables - support for .env-for-wsl file
if (fs.existsSync('.env-for-wsl')) {
  dotenv.config({ path: '.env-for-wsl' });
} else {
  dotenv.config();
}

// Google Maps API key from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Function to log operations with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Test the Nearby Search API with a known good location
async function testNearbySearch() {
  try {
    // Example: Searching for restaurants near Empire State Building
    const lat = 40.748817;
    const lng = -73.985428;
    const radius = 1000; // 1km
    const type = 'restaurant';
    
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
    log(`Testing Nearby Search API: ${url.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await axios.get(url);
    
    if (response.data.status === 'OK') {
      log(`SUCCESS: Found ${response.data.results.length} places`);
      log(`First result: ${response.data.results[0].name}`);
    } else {
      log(`ERROR: API returned status ${response.data.status}`);
      if (response.data.error_message) {
        log(`Error message: ${response.data.error_message}`);
      }
    }
  } catch (error) {
    log(`Exception during Nearby Search test: ${error.message}`);
  }
}

// Test the Text Search API with a search query
async function testTextSearch() {
  try {
    // Example: Searching for restaurants near Empire State Building
    const query = 'restaurants near Empire State Building';
    
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
    log(`Testing Text Search API: ${url.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await axios.get(url);
    
    if (response.data.status === 'OK') {
      log(`SUCCESS: Found ${response.data.results.length} places`);
      log(`First result: ${response.data.results[0].name}`);
    } else {
      log(`ERROR: API returned status ${response.data.status}`);
      if (response.data.error_message) {
        log(`Error message: ${response.data.error_message}`);
      }
    }
  } catch (error) {
    log(`Exception during Text Search test: ${error.message}`);
  }
}

// Test with Houston coordinates (from your example)
async function testHoustonLocation() {
  try {
    // Houston coordinates from your example
    const lat = 29.8460977;
    const lng = -95.3707689;
    const radius = 1000; // Start with 1km
    const type = 'restaurant'; // Start with restaurants (most common)
    
    log(`Testing with Houston coordinates: ${lat}, ${lng}`);
    
    // Try Nearby Search first
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
    log(`Testing Nearby Search API: ${nearbyUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const nearbyResponse = await axios.get(nearbyUrl);
    
    if (nearbyResponse.data.status === 'OK') {
      log(`SUCCESS: Found ${nearbyResponse.data.results.length} places with Nearby Search`);
      if (nearbyResponse.data.results.length > 0) {
        log(`First result: ${nearbyResponse.data.results[0].name}`);
      }
    } else {
      log(`Nearby Search API returned status ${nearbyResponse.data.status}`);
      if (nearbyResponse.data.error_message) {
        log(`Error message: ${nearbyResponse.data.error_message}`);
      }
    }
    
    // Now try Text Search
    const textQuery = `${type} near ${lat},${lng}`;
    const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    log(`Testing Text Search API: ${textUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const textResponse = await axios.get(textUrl);
    
    if (textResponse.data.status === 'OK') {
      log(`SUCCESS: Found ${textResponse.data.results.length} places with Text Search`);
      if (textResponse.data.results.length > 0) {
        log(`First result: ${textResponse.data.results[0].name}`);
      }
    } else {
      log(`Text Search API returned status ${textResponse.data.status}`);
      if (textResponse.data.error_message) {
        log(`Error message: ${textResponse.data.error_message}`);
      }
    }
  } catch (error) {
    log(`Exception during Houston location test: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  log('Starting Google Places API tests...');
  
  await testNearbySearch();
  log('----------------');
  
  await testTextSearch();
  log('----------------');
  
  await testHoustonLocation();
  log('----------------');
  
  log('All tests completed');
}

// Execute tests
runTests();