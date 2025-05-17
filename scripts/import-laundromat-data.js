import { parse } from 'csv-parse';
import fs from 'fs-extra';
import { db } from '../server/db.ts';
import { laundromats, states, cities } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Path to the enriched CSV file
const ENRICHED_CSV_PATH = 'data/enriched/enriched_laundromat_data.csv';

// Function to normalize state names
function normalizeState(stateName) {
  const stateMap = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  if (stateMap[stateName]) {
    return stateMap[stateName];
  }
  
  // Check if it's already an abbreviation (2 letters)
  if (stateName.length === 2 && stateName === stateName.toUpperCase()) {
    return stateName;
  }
  
  return stateName;
}

async function importData() {
  try {
    console.log('Starting data import process...');
    
    // Read the CSV file
    const fileContent = await fs.readFile(ENRICHED_CSV_PATH, 'utf8');
    
    // Parse CSV data
    const records = await new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    
    console.log(`Found ${records.length} records to import`);
    
    // Extract unique states and cities for pre-import
    const uniqueStates = new Set();
    const uniqueCities = new Map(); // city -> state abbr
    
    records.forEach(record => {
      const state = record.state;
      const stateAbbr = normalizeState(state);
      uniqueStates.add({ name: state, abbreviation: stateAbbr, slug: state.toLowerCase().replace(/\\s+/g, '-') });
      
      // Store city with its state
      uniqueCities.set(record.city, stateAbbr);
    });
    
    // Import states first
    console.log(`Importing ${uniqueStates.size} states...`);
    for (const state of uniqueStates) {
      // Check if state exists
      const existingState = await db.select().from(states).where(eq(states.abbreviation, state.abbreviation)).limit(1);
      
      if (existingState.length === 0) {
        await db.insert(states).values({
          name: state.name,
          abbreviation: state.abbreviation,
          slug: state.slug
        });
      }
    }
    
    // Import cities second
    console.log(`Importing ${uniqueCities.size} cities...`);
    for (const [cityName, stateAbbr] of uniqueCities.entries()) {
      // Get state id
      const stateResult = await db.select().from(states).where(eq(states.abbreviation, stateAbbr)).limit(1);
      
      if (stateResult.length > 0) {
        const stateId = stateResult[0].id;
        
        // Check if city exists
        const citySlug = cityName.toLowerCase().replace(/\\s+/g, '-');
        const existingCity = await db.select().from(cities)
          .where(eq(cities.name, cityName))
          .where(eq(cities.stateId, stateId))
          .limit(1);
        
        if (existingCity.length === 0) {
          await db.insert(cities).values({
            name: cityName,
            stateId: stateId,
            slug: citySlug,
            count: 0 // Will update later
          });
        }
      }
    }
    
    // Now import laundromats
    console.log('Importing laundromats...');
    let importedCount = 0;
    
    for (const record of records) {
      try {
        // Get state id and city id
        const stateAbbr = normalizeState(record.state);
        const stateResult = await db.select().from(states).where(eq(states.abbreviation, stateAbbr)).limit(1);
        
        if (stateResult.length === 0) {
          console.log(`State not found: ${record.state} (${stateAbbr})`);
          continue;
        }
        
        const stateId = stateResult[0].id;
        
        // Find the city
        const cityResult = await db.select().from(cities)
          .where(eq(cities.name, record.city))
          .where(eq(cities.stateId, stateId))
          .limit(1);
        
        if (cityResult.length === 0) {
          console.log(`City not found: ${record.city}, ${record.state}`);
          continue;
        }
        
        const cityId = cityResult[0].id;
        
        // Prepare the laundromat data
        const laundryData = {
          name: record.name,
          slug: record.slug,
          address: record.full_address,
          city: record.city,
          state: record.state,
          stateId: stateId,
          cityId: cityId,
          zip: record.postal_code,
          phone: record.phone,
          website: record.site,
          latitude: parseFloat(record.latitude) || null,
          longitude: parseFloat(record.longitude) || null,
          description: record.seoDescription,
          shortDescription: record.seoSummary,
          hours: record.working_hours,
          imageUrl: record.photo,
          logoUrl: record.logo,
          rating: parseFloat(record.rating) || null,
          reviewCount: parseInt(record.reviews) || 0,
          seoTags: record.seoTags,
          premiumScore: parseInt(record.premiumScore) || 50,
          featured: parseInt(record.premiumScore) >= 95, // Feature the highest-rated laundromats
          premium: parseInt(record.premiumScore) >= 90, // Make high-quality listings premium
          ownerId: null // No owner yet
        };
        
        // Check if laundromat already exists
        const existingLaundromat = await db.select().from(laundromats).where(eq(laundromats.slug, record.slug)).limit(1);
        
        if (existingLaundromat.length === 0) {
          // Insert new laundromat
          await db.insert(laundromats).values(laundryData);
          importedCount++;
          
          if (importedCount % 100 === 0) {
            console.log(`Imported ${importedCount} laundromats...`);
          }
          
          // Update city count
          await db.update(cities)
            .set({ count: cityResult[0].count + 1 })
            .where(eq(cities.id, cityId));
        }
      } catch (error) {
        console.error(`Error importing record ${record.name}:`, error);
      }
    }
    
    console.log(`\nImport completed! ${importedCount} laundromats imported.`);
    
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the import
importData();