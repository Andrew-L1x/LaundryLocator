/**
 * Standardize All States Relationship Script
 * 
 * This script ensures all states have consistent relationships with their cities
 * and laundromats, using the same pattern as successfully applied to Texas.
 */

import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to log operations
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  fs.appendFileSync('states-standardization.log', `${new Date().toISOString()} - ${message}\n`);
}

// Function to generate a slug from a city name
function generateSlug(cityName, stateAbbr) {
  return `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stateAbbr.toLowerCase()}`;
}

// Process a single state to standardize city-laundromat relationships
async function standardizeState(state, client) {
  try {
    log(`Processing state: ${state.name} (${state.abbr})`);
    
    // Find all variations of the state name/abbr in laundromats table
    const stateVariationsQuery = `
      SELECT DISTINCT state 
      FROM laundromats 
      WHERE state ILIKE $1 OR state ILIKE $2 OR state ILIKE $3
      ORDER BY state
    `;
    
    const stateVariationsResult = await client.query(stateVariationsQuery, [
      state.name,
      state.abbr,
      `%${state.name}%` // Also catch partial matches
    ]);
    
    const stateVariations = stateVariationsResult.rows.map(row => row.state);
    log(`Found ${stateVariations.length} variations for ${state.name}: ${stateVariations.join(', ')}`);
    
    // Skip if no variations found
    if (stateVariations.length === 0) return;
    
    // Process each variation (except the canonical abbreviation)
    for (const variation of stateVariations) {
      // Skip if this is already the canonical abbreviation
      if (variation === state.abbr) continue;
      
      // Update cities using this variation to use the canonical abbreviation
      const citiesQuery = `
        SELECT id, name, state, state_id, laundry_count
        FROM cities
        WHERE state = $1
      `;
      
      const citiesResult = await client.query(citiesQuery, [variation]);
      const cities = citiesResult.rows;
      
      log(`Found ${cities.length} cities with state='${variation}'`);
      
      // Update each city to use the canonical state
      for (const city of cities) {
        log(`Processing city: ${city.name}, ${variation}`);
        
        // Check if this city already exists with the canonical abbreviation
        const existingCityQuery = `
          SELECT id, laundry_count 
          FROM cities 
          WHERE name = $1 AND state = $2
        `;
        
        const existingCityResult = await client.query(existingCityQuery, [city.name, state.abbr]);
        
        if (existingCityResult.rows.length > 0) {
          // City exists with canonical abbreviation, merge them
          const existingCity = existingCityResult.rows[0];
          log(`Merging city ${city.name} (${variation}) into existing city ID ${existingCity.id}`);
          
          // Update laundry count
          const newLaundryCount = (existingCity.laundry_count || 0) + (city.laundry_count || 0);
          
          await client.query(
            'UPDATE cities SET laundry_count = $1 WHERE id = $2',
            [newLaundryCount, existingCity.id]
          );
          
          // Delete the duplicate
          await client.query(
            'DELETE FROM cities WHERE id = $1',
            [city.id]
          );
          
          log(`Updated city ${city.name}, ${state.abbr} with combined count: ${newLaundryCount}`);
        } else {
          // Update city to use canonical abbreviation
          const slug = generateSlug(city.name, state.abbr);
          
          await client.query(
            'UPDATE cities SET state = $1, state_id = $2, slug = $3 WHERE id = $4',
            [state.abbr, state.id, slug, city.id]
          );
          
          log(`Updated city ${city.name} from ${variation} to ${state.abbr}`);
        }
      }
      
      // Update all laundromats with this variation to use canonical abbreviation
      const laundryCountQuery = `
        SELECT COUNT(*) as count 
        FROM laundromats 
        WHERE state = $1
      `;
      
      const laundryCountResult = await client.query(laundryCountQuery, [variation]);
      const laundryCount = parseInt(laundryCountResult.rows[0].count);
      
      if (laundryCount > 0) {
        log(`Updating ${laundryCount} laundromats with state='${variation}' to '${state.abbr}'`);
        
        await client.query(
          'UPDATE laundromats SET state = $1 WHERE state = $2',
          [state.abbr, variation]
        );
        
        log(`Updated ${laundryCount} laundromats to use ${state.abbr}`);
      }
    }
    
    // Generate missing cities for laundromats that don't have cities in the cities table
    log(`Checking for missing cities in ${state.name}...`);
    
    // Find cities in laundromats that don't exist in cities table
    const missingCitiesQuery = `
      SELECT DISTINCT l.city, COUNT(*) as laundromat_count
      FROM laundromats l
      LEFT JOIN cities c ON l.city = c.name AND l.state = c.state
      WHERE l.state = $1 AND c.id IS NULL AND l.city IS NOT NULL AND l.city != ''
      GROUP BY l.city
      ORDER BY laundromat_count DESC
    `;
    
    const missingCitiesResult = await client.query(missingCitiesQuery, [state.abbr]);
    const missingCities = missingCitiesResult.rows;
    
    log(`Found ${missingCities.length} missing cities for ${state.name}`);
    
    // Create each missing city
    for (const city of missingCities) {
      const cityName = city.city;
      const laundryCount = parseInt(city.laundromat_count);
      
      log(`Creating missing city: ${cityName}, ${state.name} with ${laundryCount} laundromats`);
      
      const slug = generateSlug(cityName, state.abbr);
      const seoDescription = `Find ${laundryCount} laundromats in ${cityName}, ${state.name}. Browse coin-operated, 24-hour, and self-service laundry facilities.`;
      
      try {
        await client.query(
          'INSERT INTO cities (name, state, state_id, slug, laundry_count, seo_description) VALUES ($1, $2, $3, $4, $5, $6)',
          [cityName, state.abbr, state.id, slug, laundryCount, seoDescription]
        );
        
        log(`Created missing city: ${cityName}, ${state.name}`);
      } catch (cityError) {
        log(`Error creating city ${cityName}: ${cityError.message}`);
      }
    }
    
    // Update the state's laundry count with the new total
    const totalLaundryCountQuery = `
      SELECT COUNT(*) as count 
      FROM laundromats 
      WHERE state = $1
    `;
    
    const totalLaundryCountResult = await client.query(totalLaundryCountQuery, [state.abbr]);
    const totalLaundryCount = parseInt(totalLaundryCountResult.rows[0].count);
    
    await client.query(
      'UPDATE states SET laundry_count = $1 WHERE id = $2',
      [totalLaundryCount, state.id]
    );
    
    log(`Updated state ${state.name} laundry count to ${totalLaundryCount}`);
    
    return true;
  } catch (error) {
    log(`ERROR processing ${state.name}: ${error.message}`);
    return false;
  }
}

// Main function to standardize all states
async function standardizeAllStates() {
  const client = await pool.connect();
  
  try {
    log('Starting standardization of all states');
    
    // Get all states
    const statesResult = await client.query(`
      SELECT id, name, abbr
      FROM states
      WHERE name != 'Unknown' AND abbr != ''
      ORDER BY name
    `);
    
    const states = statesResult.rows;
    log(`Found ${states.length} states to process`);
    
    // Create a counter for successful states
    let successCount = 0;
    
    // Process each state
    for (const state of states) {
      const success = await standardizeState(state, client);
      if (success) successCount++;
    }
    
    log(`Completed standardization of ${successCount}/${states.length} states`);
    console.log(`Standardized ${successCount}/${states.length} states. Check states-standardization.log for details.`);
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error('Error standardizing states:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the main function
standardizeAllStates().catch(console.error);