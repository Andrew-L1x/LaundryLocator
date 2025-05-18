/**
 * Fix Duplicate Nearby Places Script
 * 
 * This script removes duplicate places from the nearby_places field
 * to ensure users see a variety of options.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Initialize database connection with SSL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// Function to log operations
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync('duplicate-fix.log', `[${timestamp}] ${message}\n`);
}

async function fixDuplicatePlaces() {
  const client = await pool.connect();
  
  try {
    log('Starting duplicate places fix process');
    
    // Get laundromats with nearby places data
    const getQuery = `
      SELECT id, nearby_places 
      FROM laundromats 
      WHERE nearby_places IS NOT NULL 
      AND nearby_places != '{}'
      AND nearby_places != 'null'
    `;
    
    const result = await client.query(getQuery);
    log(`Found ${result.rows.length} laundromats with nearby places data`);
    
    let fixedCount = 0;
    
    // Process each laundromat
    for (const row of result.rows) {
      try {
        const { id, nearby_places } = row;
        let places;
        
        try {
          places = typeof nearby_places === 'string' 
            ? JSON.parse(nearby_places) 
            : nearby_places;
        } catch (e) {
          log(`Error parsing nearby places for laundromat ${id}: ${e.message}`);
          continue;
        }
        
        // Skip if no valid structure
        if (!places || typeof places !== 'object') {
          log(`Skipping laundromat ${id}: Invalid nearby places data structure`);
          continue;
        }
        
        let hadDuplicates = false;
        const deduplicatedPlaces = {};
        
        // Process each category of places
        for (const [category, placesList] of Object.entries(places)) {
          if (!Array.isArray(placesList)) {
            deduplicatedPlaces[category] = placesList;
            continue;
          }
          
          // Use a map to track places by name
          const uniquePlaces = new Map();
          
          // Keep track of the first occurrence of each place name
          for (const place of placesList) {
            if (!place || !place.name) continue;
            
            if (!uniquePlaces.has(place.name)) {
              uniquePlaces.set(place.name, place);
            } else {
              hadDuplicates = true;
            }
          }
          
          // Convert back to array
          deduplicatedPlaces[category] = Array.from(uniquePlaces.values());
        }
        
        // Update if we found and fixed duplicates
        if (hadDuplicates) {
          const updateQuery = `
            UPDATE laundromats 
            SET nearby_places = $1 
            WHERE id = $2
          `;
          
          await client.query(updateQuery, [JSON.stringify(deduplicatedPlaces), id]);
          fixedCount++;
          
          if (fixedCount % 100 === 0) {
            log(`Progress: Fixed ${fixedCount} laundromats`);
          }
        }
      } catch (error) {
        log(`Error processing laundromat ${row.id}: ${error.message}`);
      }
    }
    
    log(`Process complete. Fixed duplicates in ${fixedCount} laundromats.`);
    
  } catch (error) {
    log(`Error in fix process: ${error.message}`);
  } finally {
    client.release();
  }
}

// Run the fix process
fixDuplicatePlaces()
  .then(() => {
    log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    log(`Script failed: ${err.message}`);
    process.exit(1);
  });