/**
 * Fix City-State Relationship Script for WSL
 * 
 * This script ensures all cities are properly linked to their canonical state
 * by standardizing state names and updating city-state relationships.
 * 
 * Make sure to set DATABASE_URL environment variable before running:
 * export DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
 */

const { Pool } = require('pg');
const fs = require('fs');

// Initialize database connection - uses DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to log operations for debugging
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  
  // Also append to a log file
  fs.appendFileSync('city-state-fix.log', `${new Date().toISOString()} - ${message}\n`);
}

// Function to generate a slug from a city name
function generateSlug(cityName, stateName) {
  return `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stateName.toLowerCase()}`;
}

// Main function to fix city-state relationships
async function fixCityStateRelationships() {
  const client = await pool.connect();
  
  try {
    log('Starting city-state relationship fix');
    
    // Get all canonical states (the official state records)
    const statesResult = await client.query(`
      SELECT id, name, abbr 
      FROM states 
      WHERE name != 'Unknown' AND abbr != '' 
      ORDER BY name
    `);
    
    const states = statesResult.rows;
    log(`Found ${states.length} canonical states to process`);
    
    // Process each state
    for (const state of states) {
      log(`Processing state: ${state.name} (${state.abbr})`);
      
      // Find all variations of state name/abbreviation in laundromats table
      const stateVariationsQuery = `
        SELECT DISTINCT state 
        FROM laundromats 
        WHERE state ILIKE $1 OR state ILIKE $2
        ORDER BY state
      `;
      
      const stateVariationsResult = await client.query(stateVariationsQuery, [
        state.name,
        state.abbr
      ]);
      
      const stateVariations = stateVariationsResult.rows.map(row => row.state);
      log(`Found ${stateVariations.length} variations for ${state.name}: ${stateVariations.join(', ')}`);
      
      // Skip if no variations found
      if (stateVariations.length === 0) continue;
      
      // Find existing cities using these state variations
      for (const stateVariation of stateVariations) {
        // Skip if this is already the canonical abbr
        if (stateVariation === state.abbr) continue;
        
        // Find cities with this state variation
        const citiesQuery = `
          SELECT id, name, state, state_id, laundry_count
          FROM cities
          WHERE state = $1
        `;
        
        const citiesResult = await client.query(citiesQuery, [stateVariation]);
        const cities = citiesResult.rows;
        
        log(`Found ${cities.length} cities with state='${stateVariation}'`);
        
        // Update each city to use the canonical state
        for (const city of cities) {
          log(`Updating city: ${city.name}, ${stateVariation} to use canonical state: ${state.abbr}`);
          
          // Check if this city already exists with the canonical state
          const existingCityQuery = `
            SELECT id, laundry_count 
            FROM cities 
            WHERE name = $1 AND state = $2
          `;
          
          const existingCityResult = await client.query(existingCityQuery, [city.name, state.abbr]);
          
          if (existingCityResult.rowCount > 0) {
            // City already exists with canonical state, merge laundry counts
            const existingCity = existingCityResult.rows[0];
            
            log(`Merging city ${city.name} (${stateVariation}) into existing city ID ${existingCity.id}`);
            
            // Update laundry count
            const newLaundryCount = (existingCity.laundry_count || 0) + (city.laundry_count || 0);
            
            // Update the existing city
            await client.query(
              'UPDATE cities SET laundry_count = $1 WHERE id = $2',
              [newLaundryCount, existingCity.id]
            );
            
            // Delete the duplicate city
            await client.query(
              'DELETE FROM cities WHERE id = $1',
              [city.id]
            );
            
            log(`Updated existing city ${city.name}, ${state.abbr} with combined laundry count: ${newLaundryCount}`);
          } else {
            // Update city to use canonical state
            const slug = generateSlug(city.name, state.abbr);
            
            await client.query(
              'UPDATE cities SET state = $1, state_id = $2, slug = $3 WHERE id = $4',
              [state.abbr, state.id, slug, city.id]
            );
            
            log(`Updated city ${city.name} from state ${stateVariation} to ${state.abbr}`);
          }
        }
        
        // Count laundromats that need to be updated
        const laundryCountQuery = `
          SELECT COUNT(*) as count 
          FROM laundromats 
          WHERE state = $1
        `;
        
        const laundryCountResult = await client.query(laundryCountQuery, [stateVariation]);
        const laundryCount = parseInt(laundryCountResult.rows[0].count);
        
        log(`Updating ${laundryCount} laundromats with state='${stateVariation}' to use '${state.abbr}'`);
        
        // Update all laundromats with this state variation to use canonical state
        if (laundryCount > 0) {
          await client.query(
            'UPDATE laundromats SET state = $1 WHERE state = $2',
            [state.abbr, stateVariation]
          );
          
          log(`Updated ${laundryCount} laundromats from state ${stateVariation} to ${state.abbr}`);
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
    }
    
    log('Completed city-state relationship fixes');
    console.log('City-state relationships have been fixed. Check city-state-fix.log for details.');
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error('Error fixing city-state relationships:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the main function
fixCityStateRelationships().catch(console.error);