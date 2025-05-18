/**
 * Test Google Places Details Enhancement
 * 
 * This script tests the enhancement process for a single laundromat
 * to verify that the detailed data retrieval works as expected.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('GOOGLE_MAPS_API_KEY environment variable not set!');
  process.exit(1);
}

// Test a specific laundromat ID (pass as command line argument)
const laundryId = process.argv[2] || 273; // Default to ID 273 (Stanford Laundromat)

// Find Google Place ID for a laundromat
async function findPlaceId(laundromat) {
  try {
    const { name, address, city, state, zip, latitude, longitude } = laundromat;
    
    console.log(`Searching for place ID for: ${name} in ${city}, ${state}`);
    
    // Try to find the place by name and location
    const searchQuery = encodeURIComponent(`${name} laundromat ${address || ''} ${city} ${state}`);
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: searchQuery,
        key: GOOGLE_MAPS_API_KEY,
        location: `${latitude},${longitude}`,
        radius: 5000
      }
    });
    
    if (response.data.results && response.data.results.length > 0) {
      // Match the first result that seems to be a laundromat
      const possibleMatches = response.data.results.filter(place => 
        place.name.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(place.name.toLowerCase()) ||
        place.types.some(type => 
          ['laundry', 'laundromat', 'establishment'].includes(type.toLowerCase())
        )
      );
      
      if (possibleMatches.length > 0) {
        console.log(`Found place ID: ${possibleMatches[0].place_id}`);
        return possibleMatches[0].place_id;
      }
    }
    
    console.log(`No place ID found for laundromat: ${name} in ${city}, ${state}`);
    return null;
  } catch (error) {
    console.error(`Error finding place ID: ${error.message}`);
    return null;
  }
}

// Get detailed place information from Google Places API
async function getPlaceDetails(placeId) {
  try {
    console.log(`Getting place details for place ID: ${placeId}`);
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,formatted_phone_number,website,opening_hours,price_level,rating,reviews,photos,address_components,types,business_status',
        key: GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.result) {
      console.log('Successfully retrieved place details');
      return response.data.result;
    }
    
    console.log(`No details found for place ID: ${placeId}`);
    return null;
  } catch (error) {
    console.error(`Error getting place details: ${error.message}`);
    return null;
  }
}

// Process detailed place information
function processPlaceDetails(details) {
  if (!details) return null;
  
  // Extract business hours
  let businessHours = null;
  if (details.opening_hours && details.opening_hours.periods) {
    businessHours = details.opening_hours.periods.map(period => ({
      open: {
        day: period.open.day,
        time: period.open.time,
      },
      close: period.close ? {
        day: period.close.day,
        time: period.close.time
      } : null
    }));
  }

  // Extract up to 5 reviews
  const reviews = details.reviews 
    ? details.reviews.slice(0, 5).map(review => ({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time
      }))
    : [];
  
  // Extract up to 3 photo references
  const photoRefs = details.photos 
    ? details.photos.slice(0, 3).map(photo => photo.photo_reference)
    : [];
    
  // Check if it's 24 hours
  const is24Hours = businessHours && businessHours.some(period => 
    !period.close || 
    (period.open.time === "0000" && period.close.time === "2359") ||
    (period.open.time === "0000" && period.close.time === "0000")
  );
  
  // Determine common amenities based on reviews
  const amenities = {
    hasWifi: checkAmenityFromReviews(reviews, ['wifi', 'internet', 'wireless']),
    hasCoinOp: checkAmenityFromReviews(reviews, ['coin', 'quarters', 'coins']),
    hasCardPayment: checkAmenityFromReviews(reviews, ['card', 'credit', 'debit', 'pay with card']),
    hasAttendant: checkAmenityFromReviews(reviews, ['attendant', 'staff', 'employee']),
    hasLargeLoads: checkAmenityFromReviews(reviews, ['large', 'big', 'industrial', 'commercial']),
    hasDryClean: checkAmenityFromReviews(reviews, ['dry clean', 'dry cleaning', 'drycleaning']),
    hasVendingMachine: checkAmenityFromReviews(reviews, ['vending', 'food', 'snack', 'drink']),
  };
  
  return {
    placeId: details.place_id,
    formattedAddress: details.formatted_address,
    formattedPhone: details.formatted_phone_number,
    website: details.website,
    rating: details.rating,
    businessHours,
    is24Hours,
    reviews,
    photoRefs,
    amenities,
    types: details.types,
    businessStatus: details.business_status
  };
}

// Check if reviews mention certain amenities
function checkAmenityFromReviews(reviews, keywords) {
  if (!reviews || reviews.length === 0) return null;
  
  const reviewText = reviews.map(r => r.text || '').join(' ').toLowerCase();
  return keywords.some(keyword => reviewText.includes(keyword)) ? true : null;
}

// Get photo URL
function getPhotoUrl(photoRef) {
  if (!photoRef) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
}

// Main test function
async function testEnhancement() {
  const client = await pool.connect();
  
  try {
    // Get the laundromat to test
    const result = await client.query('SELECT * FROM laundromats WHERE id = $1', [laundryId]);
    
    if (result.rows.length === 0) {
      console.error(`No laundromat found with ID ${laundryId}`);
      return;
    }
    
    const laundromat = result.rows[0];
    console.log(`Testing enhancement for: ${laundromat.name} in ${laundromat.city}, ${laundromat.state}`);
    
    // Get Place ID
    const placeId = await findPlaceId(laundromat);
    if (!placeId) {
      console.error('No place ID found, enhancement failed');
      return;
    }
    
    // Get Place Details
    const placeDetails = await getPlaceDetails(placeId);
    if (!placeDetails) {
      console.error('No place details found, enhancement failed');
      return;
    }
    
    // Process Place Details
    const enhancedDetails = processPlaceDetails(placeDetails);
    if (!enhancedDetails) {
      console.error('Failed to process place details, enhancement failed');
      return;
    }
    
    console.log('\nEnhanced Details:');
    console.log('-----------------');
    console.log(`Place ID: ${enhancedDetails.placeId}`);
    console.log(`Formatted Address: ${enhancedDetails.formattedAddress}`);
    console.log(`Phone: ${enhancedDetails.formattedPhone}`);
    console.log(`Website: ${enhancedDetails.website}`);
    console.log(`Rating: ${enhancedDetails.rating}`);
    console.log(`Business Status: ${enhancedDetails.businessStatus}`);
    console.log(`24 Hours: ${enhancedDetails.is24Hours ? 'Yes' : 'No'}`);
    
    if (enhancedDetails.businessHours && enhancedDetails.businessHours.length > 0) {
      console.log('\nBusiness Hours:');
      enhancedDetails.businessHours.forEach(period => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const openDay = days[period.open.day];
        const openTime = `${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}`;
        
        if (period.close) {
          const closeDay = days[period.close.day];
          const closeTime = `${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}`;
          console.log(`${openDay} ${openTime} - ${closeDay === openDay ? '' : closeDay + ' '}${closeTime}`);
        } else {
          console.log(`${openDay} ${openTime} - 24 hours`);
        }
      });
    }
    
    if (enhancedDetails.reviews && enhancedDetails.reviews.length > 0) {
      console.log('\nReviews:');
      enhancedDetails.reviews.forEach((review, index) => {
        console.log(`Review #${index + 1} by ${review.author} (${review.rating}★): ${review.text.slice(0, 100)}...`);
      });
    }
    
    if (enhancedDetails.photoRefs && enhancedDetails.photoRefs.length > 0) {
      console.log('\nPhoto URLs:');
      enhancedDetails.photoRefs.forEach((ref, index) => {
        console.log(`Photo #${index + 1}: ${getPhotoUrl(ref)}`);
      });
    }
    
    console.log('\nDetected Amenities:');
    Object.entries(enhancedDetails.amenities).forEach(([key, value]) => {
      if (value !== null) {
        console.log(`- ${key.replace(/^has/, '')}: ${value ? 'Yes' : 'No'}`);
      }
    });
    
    // Ask if we should update the database
    console.log('\nTest complete. Would you like to update this laundromat in the database? (Run with --update flag)');
    
    // Update if --update flag is provided
    if (process.argv.includes('--update')) {
      await client.query(
        `UPDATE laundromats 
         SET 
           google_place_id = $1,
           google_details = $2,
           business_hours = $3,
           is_24_hours = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [
          placeId,
          JSON.stringify(enhancedDetails),
          JSON.stringify(enhancedDetails.businessHours),
          enhancedDetails.is24Hours,
          laundryId
        ]
      );
      console.log(`Database updated for laundromat ID ${laundryId}`);
    }
    
  } catch (error) {
    console.error(`Error in test enhancement: ${error.message}`);
  } finally {
    client.release();
  }
}

// Run the test
testEnhancement()
  .then(() => pool.end())
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });