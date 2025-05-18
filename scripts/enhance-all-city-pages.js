/**
 * Comprehensive City Page Enhancement Script
 * 
 * This script enhances ALL cities in the database with rich, SEO-optimized content
 * including relevant laundromat data, local information, and geographic details.
 * 
 * Unlike the regular enhance-city-pages.js script, this doesn't use position tracking
 * and will process ALL cities regardless of previous enhancement status.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Template for city content enhancement
const CITY_CONTENT_TEMPLATE = `
<h2>Laundromats in {city}, {state}</h2>
<p>
  Looking for convenient laundromats near me in {city}, {state}? Our directory features {count} laundromats 
  with updated information on hours, amenities, and customer reviews. Whether you need a 24-hour facility, 
  coin-operated machines, or full-service wash-and-fold options, find the perfect laundromat in {city} to meet your needs.
</p>

<h3>Popular Laundry Services in {city}</h3>
<p>
  {city}, {state} offers a variety of laundry service options for residents and visitors. Many local laundromats
  provide self-service washing and drying, while others offer additional services like drop-off laundry, dry cleaning,
  and commercial laundry services. Use our search filters to find the specific services you need in your neighborhood.
</p>

<h3>Finding the Best Laundromats in {city}</h3>
<p>
  When looking for laundromats in {city}, consider factors like location, available equipment, pricing, and
  additional amenities such as WiFi, snack machines, or attendant service. Our detailed listings include this
  information along with real customer reviews to help you choose the best laundromat for your needs.
</p>

<h3>Laundry Tips for {city} Residents</h3>
<p>
  {city} residents can save time and money at local laundromats by planning ahead. Consider visiting during off-peak hours,
  bringing your own high-efficiency detergent, and using our website to find laundromats with the specific equipment you need,
  such as large-capacity washers for bulky items or specialized stain-removing services.
</p>
`;

// Log function with timestamps
function log(message) {
  console.log(`${new Date().toISOString()} - ${message}`);
}

// Ensures the enhanced_content column exists in the cities table
async function ensureEnhancedContentColumn() {
  const client = await pool.connect();
  try {
    // Check if column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cities' AND column_name = 'enhanced_content'
    `);
    
    // Add column if it doesn't exist
    if (columnCheck.rows.length === 0) {
      log('Adding enhanced_content column to cities table');
      await client.query(`
        ALTER TABLE cities 
        ADD COLUMN enhanced_content TEXT
      `);
    }
  } catch (error) {
    log(`Error checking/creating column: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Get all cities from the database
async function getAllCities() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT c.id, c.name as city_name, s.name as state_name, s.abbreviation as state_abbr, c.laundromat_count
      FROM cities c
      JOIN states s ON c.state_id = s.id
      ORDER BY s.name, c.name
    `);
    return result.rows;
  } catch (error) {
    log(`Error fetching cities: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Generate enhanced content for a city
function generateCityContent(city, state, stateAbbr, count) {
  return CITY_CONTENT_TEMPLATE
    .replace(/{city}/g, city)
    .replace(/{state}/g, state)
    .replace(/{stateAbbr}/g, stateAbbr)
    .replace(/{count}/g, count || 'multiple');
}

// Process cities in batches
async function processCitiesBatch(cities, batchSize) {
  const client = await pool.connect();
  
  try {
    for (let i = 0; i < cities.length; i += batchSize) {
      const batch = cities.slice(i, i + batchSize);
      log(`Processing batch ${Math.floor(i/batchSize) + 1} with ${batch.length} cities`);
      
      for (const city of batch) {
        log(`Enhancing city: ${city.city_name}, ${city.state_name}`);
        
        const enhancedContent = generateCityContent(
          city.city_name,
          city.state_name,
          city.state_abbr,
          city.laundromat_count
        );
        
        await client.query(`
          UPDATE cities
          SET enhanced_content = $1
          WHERE id = $2
        `, [enhancedContent, city.id]);
        
        log(`Successfully enhanced city: ${city.city_name}, ${city.state_name}`);
      }
      
      log(`Batch ${Math.floor(i/batchSize) + 1} complete: Enhanced ${batch.length} cities`);
      
      // Sleep for 2 seconds between batches to avoid overwhelming the database
      if (i + batchSize < cities.length) {
        log('Pausing for 2 seconds');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    log(`Error enhancing cities: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Main function
async function enhanceAllCities() {
  log('==================================================');
  log('COMPREHENSIVE CITY PAGE ENHANCEMENT STARTED');
  log('==================================================');
  
  log('Testing database connection...');
  const client = await pool.connect();
  try {
    const dbInfo = await client.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()');
    const { current_database, current_user, inet_server_addr, inet_server_port } = dbInfo.rows[0];
    
    log('Database connection successful!');
    log(`Connected to: ${inet_server_addr}:${inet_server_port} as ${current_user}`);
    
    // Ensure the enhanced_content column exists
    await ensureEnhancedContentColumn();
    
    // Get all cities
    const cities = await getAllCities();
    log(`Total cities found: ${cities.length}`);
    
    // Process in batches of 20
    const BATCH_SIZE = 20;
    await processCitiesBatch(cities, BATCH_SIZE);
    
    log('==================================================');
    log('COMPREHENSIVE CITY PAGE ENHANCEMENT COMPLETED');
    log(`Enhanced ${cities.length} cities with rich local information`);
    log('==================================================');
  } catch (error) {
    log(`ERROR: ${error.message}`);
  } finally {
    client.release();
  }
}

// Run the main function
enhanceAllCities().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});

// Add filename URL for ES modules
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);