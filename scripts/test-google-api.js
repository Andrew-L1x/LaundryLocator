/**
 * Test Google Places API Connection
 * 
 * This script tests if your Google Places API key is working properly
 * and if it can successfully retrieve nearby places data.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Google Maps API key from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable is required');
  process.exit(1);
}

// Test coordinates (Denver, CO)
const latitude = 39.7392;
const longitude = -104.9903;

/**
 * Test a Places API request with specific parameters
 */
async function testPlacesAPI(type, radius) {
  console.log(`\nTesting Places API for type '${type}' with radius ${radius}m...`);
  
  try {
    const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const url = `${baseUrl}?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log(`Making request to: ${url.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await axios.get(url);
    
    console.log(`Response status: ${response.status}`);
    console.log(`API status: ${response.data.status}`);
    
    if (response.data.error_message) {
      console.error(`API Error: ${response.data.error_message}`);
    }
    
    if (response.data.results) {
      console.log(`Found ${response.data.results.length} results`);
      
      if (response.data.results.length > 0) {
        console.log('Sample result:');
        const sample = response.data.results[0];
        console.log(`- Name: ${sample.name}`);
        console.log(`- Address: ${sample.vicinity}`);
        console.log(`- Types: ${sample.types.join(', ')}`);
      }
    }
    
    return response.data.results || [];
  } catch (error) {
    console.error(`Error testing Places API: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    return [];
  }
}

/**
 * Run a series of tests on the Places API
 */
async function runTests() {
  console.log('=== Google Places API Test ===');
  console.log(`Using API Key: ${GOOGLE_MAPS_API_KEY.substring(0, 5)}...${GOOGLE_MAPS_API_KEY.slice(-4)}`);
  
  // Test with a common place type that should definitely return results
  const restaurants = await testPlacesAPI('restaurant', 1000);
  
  // Test with different radii
  if (restaurants.length === 0) {
    console.log('\nTrying with larger radius...');
    await testPlacesAPI('restaurant', 5000);
  }
  
  // Test with different place types
  console.log('\nTesting additional place types:');
  await testPlacesAPI('park', 2000);
  await testPlacesAPI('gas_station', 2000);
  
  // Test text search as a fallback
  console.log('\nTesting text search API:');
  try {
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+near+denver&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log(`Making request to: ${textSearchUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    const response = await axios.get(textSearchUrl);
    console.log(`Response status: ${response.status}`);
    console.log(`API status: ${response.data.status}`);
    
    if (response.data.results) {
      console.log(`Found ${response.data.results.length} results with text search`);
    }
  } catch (error) {
    console.error(`Error testing Text Search API: ${error.message}`);
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the tests
runTests();