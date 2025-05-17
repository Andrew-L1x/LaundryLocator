/**
 * Generate Missing Cities Script
 * 
 * This script identifies cities that have laundromats but are missing from
 * the cities table, and creates entries for them to fix state page displays.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, or, and, sql } from 'drizzle-orm';
import fs from 'fs';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to generate a slug from a city name
function generateSlug(cityName, stateName) {
  return `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stateName.toLowerCase()}`;
}

// Function to log operations for debugging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  
  // Also append to a log file
  fs.appendFileSync('city-generation.log', `${new Date().toISOString()} - ${message}\n`);
}

// Main function to generate missing cities
async function generateMissingCities() {
  const client = await pool.connect();
  
  try {
    log('Starting missing cities generation');
    
    // Get all states
    const statesResult = await client.query('SELECT id, name, abbr FROM states WHERE name != \'Unknown\' ORDER BY name');
    const states = statesResult.rows;
    
    log(`Found ${states.length} states to process`);
    
    let totalCitiesCreated = 0;
    
    // Process each state
    for (const state of states) {
      log(`Processing state: ${state.name} (${state.abbr})`);
      
      // Find all unique cities in this state from laundromats table
      const citiesQuery = `
        SELECT DISTINCT city 
        FROM laundromats 
        WHERE (state = $1 OR state = $2) 
          AND city IS NOT NULL 
          AND city != ''
        ORDER BY city
      `;
      
      const citiesResult = await client.query(citiesQuery, [state.abbr, state.name]);
      const uniqueCities = citiesResult.rows;
      
      log(`Found ${uniqueCities.length} unique cities in ${state.name}`);
      
      // For each city, check if it exists in cities table
      for (const cityData of uniqueCities) {
        const cityName = cityData.city;
        
        // Skip empty city names
        if (!cityName || cityName.trim() === '') continue;
        
        // Check if city already exists
        const existingCityQuery = `
          SELECT id FROM cities 
          WHERE name = $1 AND (state = $2 OR state = $3)
        `;
        
        const existingCityResult = await client.query(existingCityQuery, [cityName, state.abbr, state.name]);
        
        if (existingCityResult.rowCount === 0) {
          // City doesn't exist, create it
          log(`Creating city: ${cityName}, ${state.name}`);
          
          // Count laundromats in this city
          const laundryCountQuery = `
            SELECT COUNT(*) as count 
            FROM laundromats 
            WHERE city = $1 AND (state = $2 OR state = $3)
          `;
          
          const laundryCountResult = await client.query(laundryCountQuery, [cityName, state.abbr, state.name]);
          const laundryCount = parseInt(laundryCountResult.rows[0].count);
          
          // Generate a slug for the city
          const slug = generateSlug(cityName, state.abbr);
          
          // Generate SEO description
          const seoDescription = `Find ${laundryCount} laundromats in ${cityName}, ${state.name}. Browse coin-operated, 24-hour, and self-service laundry facilities.`;
          
          // Insert the new city
          const insertCityQuery = `
            INSERT INTO cities (name, state, state_id, slug, laundry_count, seo_description) 
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          
          await client.query(insertCityQuery, [
            cityName,
            state.abbr,
            state.id,
            slug,
            laundryCount,
            seoDescription
          ]);
          
          totalCitiesCreated++;
          log(`Created city ${cityName}, ${state.name} with ${laundryCount} laundromats`);
        } else {
          // City exists, update its laundry count
          const cityId = existingCityResult.rows[0].id;
          
          // Count laundromats in this city
          const laundryCountQuery = `
            SELECT COUNT(*) as count 
            FROM laundromats 
            WHERE city = $1 AND (state = $2 OR state = $3)
          `;
          
          const laundryCountResult = await client.query(laundryCountQuery, [cityName, state.abbr, state.name]);
          const laundryCount = parseInt(laundryCountResult.rows[0].count);
          
          // Update the city's laundry count
          await client.query(
            'UPDATE cities SET laundry_count = $1 WHERE id = $2',
            [laundryCount, cityId]
          );
          
          log(`Updated city ${cityName}, ${state.name} with ${laundryCount} laundromats`);
        }
      }
    }
    
    log(`Completed! Created ${totalCitiesCreated} missing cities.`);
    console.log(`Created ${totalCitiesCreated} missing cities. Check city-generation.log for details.`);
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error('Error generating missing cities:', error);
  } finally {
    client.release();
  }
}

// Run the main function
generateMissingCities().catch(console.error);