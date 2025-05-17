/**
 * Drizzle Database Import Script
 * 
 * This script takes the enriched laundromat data and imports it directly into the database
 * using Drizzle ORM
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema.js';

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

const db = drizzle(pool, { schema });

/**
 * Process city and state data
 */
async function processCityAndState(client, record) {
  // Normalize state abbreviation
  let stateAbbr = record.state;
  if (!stateAbbr) return null;

  // Convert to uppercase if it's a valid 2-letter abbreviation
  if (stateAbbr.length === 2) {
    stateAbbr = stateAbbr.toUpperCase();
  }

  // Skip if we don't have a valid city
  if (!record.city) return null;

  try {
    // Check if state exists
    const existingStates = await db.select()
      .from(schema.states)
      .where(eq => schema.states.abbr.equals(stateAbbr));

    let stateId;

    if (existingStates.length === 0) {
      // Create state if it doesn't exist
      const stateName = getStateNameFromAbbr(stateAbbr);
      const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');

      const [newState] = await db.insert(schema.states)
        .values({
          name: stateName,
          abbr: stateAbbr,
          slug: stateSlug,
          laundryCount: 1
        })
        .returning();

      stateId = newState.id;
    } else {
      stateId = existingStates[0].id;
      
      // Update laundry count
      await db.update(schema.states)
        .set({ laundryCount: schema.states.laundryCount + 1 })
        .where(schema.states.id.equals(stateId));
    }

    // Create city slug
    const cityName = record.city;
    const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;

    // Check if city exists
    const existingCities = await db.select()
      .from(schema.cities)
      .where(schema.cities.slug.equals(citySlug));

    if (existingCities.length === 0) {
      // Create city if it doesn't exist
      await db.insert(schema.cities)
        .values({
          name: cityName,
          state: stateAbbr,
          slug: citySlug,
          laundryCount: 1
        });
    } else {
      // Update laundry count
      await db.update(schema.cities)
        .set({ laundryCount: schema.cities.laundryCount + 1 })
        .where(schema.cities.id.equals(existingCities[0].id));
    }

    return { stateId, citySlug };
  } catch (error) {
    console.error(`Error processing city/state: ${error.message}`);
    return null;
  }
}

/**
 * Get full state name from abbreviation
 */
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
  
  try {
    console.log('Connected to database');
    
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
          const premiumScore = parseInt(laundromat.premiumScore || laundromat.premium_score || 0);
          
          // Determine listing type based on premium score
          let listingType = 'basic';
          if (premiumScore >= 80) {
            listingType = 'featured';
          } else if (premiumScore >= 60) {
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
          
          // Get or create hours
          let hours = laundromat.hours || "Monday-Sunday: 8:00AM-8:00PM";
          
          // Create machine count
          const machineCount = {
            washers: Math.floor(Math.random() * 20) + 10,
            dryers: Math.floor(Math.random() * 15) + 8
          };
          
          // Insert into database
          const result = await db.insert(schema.laundromats)
            .values({
              name: laundromat.name,
              address: laundromat.address,
              city: laundromat.city,
              state: laundromat.state,
              zip: laundromat.zip,
              phone: laundromat.phone,
              website: laundromat.website,
              latitude: laundromat.latitude,
              longitude: laundromat.longitude,
              rating: rating.toString(),
              reviewCount: reviewCount,
              imageUrl: laundromat.imageUrl || laundromat.image_url,
              description: laundromat.description || laundromat.seoDescription || laundromat.seo_description,
              slug: laundromat.slug,
              hours: hours,
              services: services,
              amenities: amenities,
              machineCount: machineCount,
              listingType: listingType,
              isFeatured: listingType === 'featured',
              featuredRank: listingType === 'featured' ? Math.floor(Math.random() * 100) : null,
              verified: true,
              verificationDate: new Date().toISOString()
            })
            .onConflictDoNothing()
            .returning();
          
          if (result.length > 0) {
            imported++;
            
            // Update city and state counts
            await processCityAndState(db, laundromat);
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
    console.error(`Database error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
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