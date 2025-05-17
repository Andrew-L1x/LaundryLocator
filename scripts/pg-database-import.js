/**
 * PostgreSQL Database Import Script
 * 
 * This script takes the enriched laundromat data and imports it directly into the database
 * using direct PostgreSQL connections
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import data file path
const IMPORT_DATA_PATH = path.join(__dirname, '..', 'data', 'import_ready_laundromats.json');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get state name from abbreviation
function getStateNameFromAbbr(abbr) {
  const stateMap = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
  };
  
  return stateMap[abbr.toUpperCase()] || abbr;
}

// Import laundromat data from the enriched file
async function importData() {
  console.log('Starting database import...');
  
  // Read the enriched data
  let laundromats;
  try {
    const data = fs.readFileSync(IMPORT_DATA_PATH, 'utf8');
    laundromats = JSON.parse(data);
    console.log(`Read ${laundromats.length} records from ${IMPORT_DATA_PATH}`);
  } catch (error) {
    console.error(`Error reading data file: ${error.message}`);
    return { success: false, error: error.message };
  }
  
  // Connect to the database
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database');
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Import stats
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 100
    const batchSize = 100;
    
    // Process data in batches
    for (let i = 0; i < laundromats.length; i += batchSize) {
      const batch = laundromats.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(laundromats.length / batchSize)}...`);
      
      // Process each record in the batch
      for (const laundromat of batch) {
        try {
          // Convert fields to match our schema
          const rating = parseFloat(laundromat.rating) || 0;
          const reviewCount = parseInt(laundromat.reviewCount || laundromat.reviews_count || 0);
          const premiumScore = parseInt(laundromat.premiumScore || laundromat.premium_score || 0) || 30;
          
          // Determine listing type based on premium score
          let listingType = 'basic';
          const isPremium = premiumScore >= 60;
          const isFeatured = premiumScore >= 80;
          
          if (isFeatured) {
            listingType = 'featured';
          } else if (isPremium) {
            listingType = 'premium';
          }
          
          // Create services array
          const services = ['Self-service laundry', 'Coin-operated washing machines', 'High-capacity dryers'];
          if (premiumScore > 70) {
            services.push('Wash and fold service');
          }
          if (premiumScore > 80) {
            services.push('24-hour service');
            services.push('Drop-off laundry');
          }
          
          // Create amenities based on premium score
          const amenities = ['Vending machines', 'Change machine'];
          if (premiumScore > 60) {
            amenities.push('Wi-Fi');
            amenities.push('Air conditioning');
          }
          if (premiumScore > 75) {
            amenities.push('Attendant on duty');
            amenities.push('Security cameras');
          }
          if (premiumScore > 85) {
            amenities.push('Comfortable seating area');
            amenities.push('Folding stations');
          }
          
          // Create machine count
          const machineCount = {
            washers: Math.floor(Math.random() * 20) + 10,
            dryers: Math.floor(Math.random() * 15) + 8
          };
          
          // Normalize state
          let stateAbbr = laundromat.state;
          if (stateAbbr && stateAbbr.length === 2) {
            stateAbbr = stateAbbr.toUpperCase();
          }
          
          // Prepare the query
          const insertQuery = `
            INSERT INTO "laundromats" (
              "name", "address", "city", "state", "zip", "phone", "website", 
              "latitude", "longitude", "rating", "review_count", "image_url", 
              "hours", "description", "slug", "services", "amenities", 
              "machine_count", "listing_type", "is_featured", "verified",
              "created_at", "is_premium"
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
          `;
          
          // Insert into database
          const result = await client.query(insertQuery, [
            laundromat.name,
            laundromat.address,
            laundromat.city,
            stateAbbr,
            laundromat.zip,
            laundromat.phone,
            laundromat.website,
            laundromat.latitude,
            laundromat.longitude,
            rating.toString(),
            reviewCount,
            laundromat.imageUrl || laundromat.image_url,
            laundromat.hours || "Monday-Sunday: 8:00AM-8:00PM",
            laundromat.description || laundromat.seoDescription || laundromat.seo_description || "",
            laundromat.slug,
            JSON.stringify(services),
            JSON.stringify(amenities),
            JSON.stringify(machineCount),
            listingType,
            isFeatured,
            true,
            new Date(),
            isPremium
          ]);
          
          if (result.rowCount > 0) {
            imported++;
            
            // Process city and state
            try {
              // Normalize state
              if (stateAbbr && stateAbbr.length === 2) {
                const stateName = getStateNameFromAbbr(stateAbbr);
                const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
                
                // Check if state exists
                const stateResult = await client.query(
                  'SELECT id FROM states WHERE abbr = $1',
                  [stateAbbr]
                );
                
                let stateId;
                
                if (stateResult.rows.length === 0) {
                  // Create state if it doesn't exist
                  const newStateResult = await client.query(
                    'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 1) RETURNING id',
                    [stateName, stateAbbr, stateSlug]
                  );
                  stateId = newStateResult.rows[0].id;
                } else {
                  stateId = stateResult.rows[0].id;
                  // Update laundry count
                  await client.query(
                    'UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1',
                    [stateId]
                  );
                }
                
                // Process city
                if (laundromat.city) {
                  const cityName = laundromat.city;
                  const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;
                  
                  // Check if city exists
                  const cityResult = await client.query(
                    'SELECT id FROM cities WHERE slug = $1',
                    [citySlug]
                  );
                  
                  if (cityResult.rows.length === 0) {
                    // Create city if it doesn't exist
                    await client.query(
                      'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 1)',
                      [cityName, stateAbbr, citySlug]
                    );
                  } else {
                    // Update laundry count
                    await client.query(
                      'UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1',
                      [cityResult.rows[0].id]
                    );
                  }
                }
              }
            } catch (cityStateError) {
              console.error(`Error processing city/state: ${cityStateError.message}`);
            }
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`Error importing record: ${error.message}`);
          errors++;
        }
      }
      
      // Log progress
      console.log(`Processed ${i + batch.length} / ${laundromats.length} records (Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors})`);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`
Import complete!
Imported: ${imported}
Skipped: ${skipped}
Errors: ${errors}
Total processed: ${imported + skipped + errors}
    `);
    
    return {
      success: true,
      imported,
      skipped,
      errors,
      total: laundromats.length
    };
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(`Database error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the import
importData()
  .then(result => {
    if (result.success) {
      console.log('Database import successful!');
    } else {
      console.error(`Database import failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });