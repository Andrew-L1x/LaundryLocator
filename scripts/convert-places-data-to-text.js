/**
 * Script to Convert Google Places API Data to Plain Text
 * 
 * This script fetches all laundromats from the database, extracts the Google Places
 * data that has already been fetched, converts it to plain text format, and updates
 * the database records to include this text-based information.
 * 
 * This significantly reduces ongoing API costs by storing the information statically.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(
    path.join(process.cwd(), 'places-to-text-conversion.log'),
    `[${timestamp}] ${message}\n`
  );
}

// Convert Google Places API data to plain text
function convertPlacesDataToText(laundromat) {
  // Safely handle potential JSON parsing for various fields
  const googlePlacesData = typeof laundromat.google_places_data === 'string' 
    ? JSON.parse(laundromat.google_places_data || '{}') 
    : (laundromat.google_places_data || {});
  
  const nearbyPlaces = typeof laundromat.nearby_places === 'string'
    ? JSON.parse(laundromat.nearby_places || '[]')
    : (laundromat.nearby_places || []);
  
  const reviews = typeof laundromat.google_reviews === 'string'
    ? JSON.parse(laundromat.google_reviews || '[]')
    : (laundromat.google_reviews || []);
  
  const photos = typeof laundromat.photos === 'string'
    ? JSON.parse(laundromat.photos || '[]')
    : (laundromat.photos || []);

  // Create textual data object
  const textData = {
    // Basic information from Google Places
    formattedAddress: googlePlacesData.formatted_address || laundromat.address,
    formattedPhoneNumber: googlePlacesData.formatted_phone_number || laundromat.phone,
    weekdayText: googlePlacesData.opening_hours?.weekday_text || [],
    website: googlePlacesData.website || laundromat.website,
    rating: googlePlacesData.rating || laundromat.rating,
    userRatingsTotal: googlePlacesData.user_ratings_total || 0,
    
    // Nearby places as text descriptions
    nearbyPlacesText: nearbyPlaces.map(place => ({
      name: place.name,
      type: place.types?.join(', ') || '',
      distance: place.distance ? `${place.distance.toFixed(2)} miles` : 'Nearby',
      address: place.vicinity || '',
      rating: place.rating || 'Not rated'
    })),
    
    // Reviews as text
    reviewsText: reviews.map(review => ({
      authorName: review.author_name || 'Anonymous',
      rating: review.rating || 0,
      text: review.text || '',
      timeDescription: review.relative_time_description || '',
      language: review.language || 'en'
    })),
    
    // Photo references as simple text data instead of API references
    photoInfo: photos.map(photo => ({
      width: photo.width || 0,
      height: photo.height || 0,
      attribution: photo.html_attributions?.[0] || '',
      url: photo.url || '' // Store static URL if available instead of reference
    }))
  };
  
  return JSON.stringify(textData);
}

// Update the laundromat record with text-based Places data
async function updateLaundromatWithTextData(id, textData) {
  try {
    const query = `
      UPDATE laundromats
      SET places_text_data = $1
      WHERE id = $2
    `;
    await pool.query(query, [textData, id]);
    return true;
  } catch (error) {
    log(`Error updating laundromat ${id}: ${error.message}`);
    return false;
  }
}

// Process all laundromats
async function processAllLaundromats() {
  try {
    // Check if places_text_data column exists, create if not
    log('Checking if places_text_data column exists...');
    try {
      await pool.query(`
        ALTER TABLE laundromats
        ADD COLUMN IF NOT EXISTS places_text_data JSONB
      `);
      log('Ensured places_text_data column exists.');
    } catch (error) {
      log(`Error ensuring column exists: ${error.message}`);
      return;
    }
    
    // Get all laundromats with Google Places data
    log('Fetching laundromats with Google Places data...');
    const result = await pool.query(`
      SELECT *
      FROM laundromats
      WHERE google_places_data IS NOT NULL
      AND (places_text_data IS NULL OR places_text_data = '{}')
    `);
    
    const totalLaundromats = result.rows.length;
    log(`Found ${totalLaundromats} laundromats to process.`);
    
    // Process each laundromat
    let successCount = 0;
    for (let i = 0; i < totalLaundromats; i++) {
      const laundromat = result.rows[i];
      try {
        const textData = convertPlacesDataToText(laundromat);
        const success = await updateLaundromatWithTextData(laundromat.id, textData);
        
        if (success) {
          successCount++;
        }
        
        // Log progress
        if (i % 100 === 0 || i === totalLaundromats - 1) {
          log(`Processed ${i+1}/${totalLaundromats} (${successCount} successful)`);
        }
      } catch (error) {
        log(`Error processing laundromat ${laundromat.id}: ${error.message}`);
      }
    }
    
    log(`Conversion completed: ${successCount}/${totalLaundromats} laundromats converted successfully.`);
  } catch (error) {
    log(`Error in processing: ${error.message}`);
  } finally {
    pool.end();
  }
}

// Run the script
log('Starting conversion of Google Places data to text...');
processAllLaundromats().then(() => {
  log('Script execution completed.');
}).catch(error => {
  log(`Fatal error: ${error.message}`);
  pool.end();
});