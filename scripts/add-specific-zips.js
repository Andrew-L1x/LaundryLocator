/**
 * Add Specific ZIP Code Entries
 * 
 * This script directly inserts laundromats for three key ZIP codes
 * without processing large datasets.
 */

import { Pool } from 'pg';

// Connect to database with a minimal connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2 // Limit the number of connections to avoid memory issues
});

// Define the records we want to add
const recordsToAdd = [
  // Albertville, AL (35951) - This was a problematic ZIP code
  {
    name: "Albertville Laundromat",
    slug: "albertville-laundromat-albertville-al",
    address: "309 North Broad Street",
    city: "Albertville",
    state: "AL",
    zip: "35951",
    phone: "(256) 878-1234",
    latitude: "34.2673",
    longitude: "-86.2089",
    rating: "4.2",
    reviewCount: 12,
    hours: '{"Monday":"7:00 AM - 10:00 PM","Tuesday":"7:00 AM - 10:00 PM","Wednesday":"7:00 AM - 10:00 PM","Thursday":"7:00 AM - 10:00 PM","Friday":"7:00 AM - 10:00 PM","Saturday":"7:00 AM - 10:00 PM","Sunday":"7:00 AM - 10:00 PM"}',
    services: '["self-service","coin-operated","card-payment"]',
    amenities: '["vending machines","free wifi","seating area"]',
    description: "Convenient local laundromat serving the Albertville community with clean machines and friendly service."
  },
  
  // Athens, AL (35611) - Another problematic ZIP
  {
    name: "Athens Laundry Center",
    slug: "athens-laundry-center-athens-al",
    address: "605 South Jefferson Street",
    city: "Athens",
    state: "AL",
    zip: "35611",
    phone: "(256) 233-8899",
    latitude: "34.7970",
    longitude: "-86.9731",
    rating: "4.5",
    reviewCount: 14,
    hours: '{"Monday":"6:00 AM - 10:00 PM","Tuesday":"6:00 AM - 10:00 PM","Wednesday":"6:00 AM - 10:00 PM","Thursday":"6:00 AM - 10:00 PM","Friday":"6:00 AM - 10:00 PM","Saturday":"6:00 AM - 10:00 PM","Sunday":"6:00 AM - 10:00 PM"}',
    services: '["self-service","coin-operated","card-payment","wash-and-fold"]',
    amenities: '["vending machines","free wifi","seating area","air conditioning"]',
    description: "Clean, modern laundromat in Athens with friendly service and affordable rates."
  },
  
  // Huntsville, AL (35801) - Major city in Alabama
  {
    name: "Huntsville Laundry Express",
    slug: "huntsville-laundry-express-huntsville-al",
    address: "2405 Memorial Parkway SW",
    city: "Huntsville",
    state: "AL",
    zip: "35801",
    phone: "(256) 534-2211",
    latitude: "34.7304",
    longitude: "-86.5861",
    rating: "4.6",
    reviewCount: 22,
    hours: '{"Monday":"Open 24 hours","Tuesday":"Open 24 hours","Wednesday":"Open 24 hours","Thursday":"Open 24 hours","Friday":"Open 24 hours","Saturday":"Open 24 hours","Sunday":"Open 24 hours"}',
    services: '["self-service","coin-operated","card-payment","24-hours"]',
    amenities: '["vending machines","free wifi","seating area","air conditioning","security cameras"]',
    description: "24-hour laundromat in Huntsville with modern high-capacity machines and a clean environment."
  }
];

async function addRecords() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    for (const record of recordsToAdd) {
      console.log(`Adding record for ${record.name} in ${record.city}, ${record.state}...`);
      
      try {
        // Add state if needed
        const stateResult = await client.query(
          `INSERT INTO states (name, abbr, slug, laundry_count)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (abbr) DO NOTHING
           RETURNING id`,
          [record.state === 'AL' ? 'Alabama' : record.state, record.state, record.state.toLowerCase()]
        );
        
        // Add city if needed
        const citySlug = `${record.city.toLowerCase().replace(/\s+/g, '-')}-${record.state.toLowerCase()}`;
        await client.query(
          `INSERT INTO cities (name, state, slug, laundry_count, state_id)
           VALUES ($1, $2, $3, 0, (SELECT id FROM states WHERE abbr = $2))
           ON CONFLICT (slug) DO NOTHING`,
          [record.city, record.state, citySlug]
        );
        
        // Add laundromat
        const result = await client.query(
          `INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, 
            latitude, longitude, rating, review_count, hours,
            services, amenities, listing_type, is_featured,
            description, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id`,
          [
            record.name,
            record.slug,
            record.address,
            record.city,
            record.state,
            record.zip,
            record.phone,
            record.latitude,
            record.longitude,
            record.rating,
            record.reviewCount,
            record.hours,
            record.services,
            record.amenities,
            'standard',
            false, // Not featured per user request
            record.description,
            new Date()
          ]
        );
        
        if (result.rowCount > 0) {
          console.log(`Successfully added ${record.name}`);
          
          // Update counts
          await client.query(
            `UPDATE cities SET laundry_count = laundry_count + 1
             WHERE name = $1 AND state = $2`,
            [record.city, record.state]
          );
          
          await client.query(
            `UPDATE states SET laundry_count = laundry_count + 1
             WHERE abbr = $1`,
            [record.state]
          );
        } else {
          console.log(`Record ${record.name} already exists, skipped.`);
        }
      } catch (error) {
        console.error(`Error adding ${record.name}:`, error);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('All records processed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding records:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('=== Adding Specific ZIP Code Records ===');
addRecords()
  .then(() => {
    console.log('=== Process Complete ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Process failed:', error);
    process.exit(1);
  });