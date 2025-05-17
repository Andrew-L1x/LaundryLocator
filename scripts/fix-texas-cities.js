/**
 * Fix Texas Cities Relationship Script
 * 
 * This focused script fixes only the Texas cities 
 * where multiple variations of the state name are causing fragmentation.
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
  fs.appendFileSync('texas-fix.log', `${new Date().toISOString()} - ${message}\n`);
}

// Function to generate a slug from a city name
function generateSlug(cityName, stateAbbr) {
  return `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stateAbbr.toLowerCase()}`;
}

async function fixTexasCities() {
  const client = await pool.connect();
  
  try {
    log('Starting Texas cities fix');
    
    // Get the canonical Texas state record
    const [texas] = (await client.query(
      'SELECT id, name, abbr FROM states WHERE abbr = $1',
      ['TX']
    )).rows;
    
    if (!texas) {
      log('Error: Could not find Texas state record');
      return;
    }
    
    log(`Found Texas state record: ID=${texas.id}, name=${texas.name}, abbr=${texas.abbr}`);
    
    // Find all variations of Texas in the database
    const texasVariations = (await client.query(
      "SELECT DISTINCT state FROM laundromats WHERE state ILIKE '%texas%' OR state = 'TX' OR state = 'TEXAS' ORDER BY state"
    )).rows.map(row => row.state);
    
    log(`Found ${texasVariations.length} variations of Texas: ${texasVariations.join(', ')}`);
    
    // Process each variation
    for (const variation of texasVariations) {
      // Skip the canonical abbreviation
      if (variation === texas.abbr) continue;
      
      // Find cities using this variation
      const cities = (await client.query(
        'SELECT id, name, state, state_id, laundry_count FROM cities WHERE state = $1',
        [variation]
      )).rows;
      
      log(`Found ${cities.length} cities with state='${variation}'`);
      
      // Update each city
      for (const city of cities) {
        log(`Processing city: ${city.name}, ${variation}`);
        
        // Check if this city already exists with TX abbreviation
        const existingCities = (await client.query(
          'SELECT id, laundry_count FROM cities WHERE name = $1 AND state = $2',
          [city.name, texas.abbr]
        )).rows;
        
        if (existingCities.length > 0) {
          // City exists with TX, merge them
          const existingCity = existingCities[0];
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
          
          log(`Updated city ${city.name}, ${texas.abbr} with count: ${newLaundryCount}`);
        } else {
          // Update city to use TX
          const slug = generateSlug(city.name, texas.abbr);
          
          await client.query(
            'UPDATE cities SET state = $1, state_id = $2, slug = $3 WHERE id = $4',
            [texas.abbr, texas.id, slug, city.id]
          );
          
          log(`Updated city ${city.name} from ${variation} to ${texas.abbr}`);
        }
      }
      
      // Update all laundromats with this variation to use TX
      const laundryCount = parseInt((await client.query(
        'SELECT COUNT(*) as count FROM laundromats WHERE state = $1',
        [variation]
      )).rows[0].count);
      
      if (laundryCount > 0) {
        log(`Updating ${laundryCount} laundromats with state='${variation}' to 'TX'`);
        
        await client.query(
          'UPDATE laundromats SET state = $1 WHERE state = $2',
          [texas.abbr, variation]
        );
        
        log(`Updated ${laundryCount} laundromats to use TX`);
      }
    }
    
    // Update Texas laundry count
    const totalLaundryCount = parseInt((await client.query(
      'SELECT COUNT(*) as count FROM laundromats WHERE state = $1',
      [texas.abbr]
    )).rows[0].count);
    
    await client.query(
      'UPDATE states SET laundry_count = $1 WHERE id = $2',
      [totalLaundryCount, texas.id]
    );
    
    log(`Updated Texas laundry count to ${totalLaundryCount}`);
    log('Texas cities fix completed successfully');
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error('Error fixing Texas cities:', error);
  } finally {
    client.release();
  }
}

// Run the fix
fixTexasCities().catch(console.error);