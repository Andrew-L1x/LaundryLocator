/**
 * Fix All Cities Script
 * 
 * This script updates all cities in the database with consistent, SEO-optimized content
 * regardless of their previous enhancement status.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

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

async function updateAllCities() {
  log('==================================================');
  log('CITY CONTENT UPDATE STARTED');
  log('==================================================');
  
  const client = await pool.connect();
  
  try {
    // Check if enhanced_content column exists
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
    
    // Get all cities with their states
    log('Fetching all cities...');
    const citiesResult = await client.query(`
      SELECT c.id, c.name, c.state, c.laundry_count
      FROM cities c
      ORDER BY c.state, c.name
    `);
    
    const cities = citiesResult.rows;
    log(`Found ${cities.length} cities to update`);
    
    // Process in larger batches for faster completion
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < cities.length; i += BATCH_SIZE) {
      const batch = cities.slice(i, i + BATCH_SIZE);
      log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} with ${batch.length} cities`);
      
      for (const city of batch) {
        try {
          log(`Updating city: ${city.name}, ${city.state}`);
          
          const enhancedContent = CITY_CONTENT_TEMPLATE
            .replace(/{city}/g, city.name)
            .replace(/{state}/g, city.state)
            .replace(/{count}/g, city.laundry_count || 'multiple');
          
          await client.query(`
            UPDATE cities
            SET enhanced_content = $1
            WHERE id = $2
          `, [enhancedContent, city.id]);
          
          log(`Successfully updated city: ${city.city_name}, ${city.state_name}`);
        } catch (error) {
          log(`Error updating city ${city.city_name}: ${error.message}`);
        }
      }
      
      log(`Batch ${Math.floor(i/BATCH_SIZE) + 1} complete: Updated ${batch.length} cities`);
      
      // Sleep between batches
      if (i + BATCH_SIZE < cities.length) {
        log('Pausing for 5 seconds');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    log('==================================================');
    log('CITY CONTENT UPDATE COMPLETED');
    log(`Updated ${cities.length} cities with enhanced content`);
    log('==================================================');
  } catch (error) {
    log(`ERROR: ${error.message}`);
  } finally {
    client.release();
  }
}

// Run the main function
updateAllCities().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});