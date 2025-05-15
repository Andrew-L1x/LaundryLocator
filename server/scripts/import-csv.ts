import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { db } from '../db';
import { laundromats, cities, states } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/&/g, '-and-')    // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')  // Remove all non-word chars
    .replace(/\-\-+/g, '-');   // Replace multiple - with single -
};

interface RawLaundromat {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  latitude: string;
  longitude: string;
  hours: string;
  services: string;
  isFeatured?: string;
  isPremium?: string;
  imageUrl?: string;
  description?: string;
}

async function importFromCsv(filePath: string) {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Parse the CSV file
  parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }, async (err, records: RawLaundromat[]) => {
    if (err) {
      console.error('Error parsing CSV:', err);
      return;
    }
    
    console.log(`Found ${records.length} records in CSV file`);
    
    try {
      // Process each record
      for (const record of records) {
        // First, ensure state exists
        let state = await db.select().from(states).where(eq(states.abbr, record.state)).execute();
        
        if (state.length === 0) {
          // Create state if it doesn't exist
          const stateName = getStateNameFromAbbreviation(record.state);
          const stateSlug = slugify(stateName);
          
          await db.insert(states).values({
            name: stateName,
            abbr: record.state,
            slug: stateSlug,
            laundryCount: 0
          }).execute();
          
          console.log(`Created new state: ${stateName} (${record.state})`);
          
          state = await db.select().from(states).where(eq(states.abbr, record.state)).execute();
        }
        
        // Next, ensure city exists
        const citySlug = `${slugify(record.city)}-${record.state.toLowerCase()}`;
        let city = await db.select().from(cities).where(
          and(
            eq(cities.name, record.city),
            eq(cities.state, record.state)
          )
        ).execute();
        
        if (city.length === 0) {
          // Create city if it doesn't exist
          await db.insert(cities).values({
            name: record.city,
            state: record.state,
            slug: citySlug,
            laundryCount: 0
          }).execute();
          
          console.log(`Created new city: ${record.city}, ${record.state}`);
          
          city = await db.select().from(cities).where(
            and(
              eq(cities.name, record.city),
              eq(cities.state, record.state)
            )
          ).execute();
        }
        
        // Generate a slug for the laundromat
        const slug = slugify(`${record.name}-${record.city}-${record.state}`);
        
        // Parse services string into array
        let servicesArray = [];
        if (record.services) {
          servicesArray = record.services.split(',').map(s => s.trim());
        }
        
        // Check if laundromat with this slug already exists
        const existingLaundromat = await db.select().from(laundromats).where(eq(laundromats.slug, slug)).execute();
        
        if (existingLaundromat.length === 0) {
          // Create laundromat
          await db.insert(laundromats).values({
            name: record.name,
            slug,
            address: record.address,
            city: record.city,
            state: record.state,
            zip: record.zip,
            phone: record.phone,
            website: record.website || null,
            latitude: record.latitude,
            longitude: record.longitude,
            rating: '0', // Initialize with 0 rating
            reviewCount: 0,
            hours: record.hours,
            services: servicesArray,
            isFeatured: record.isFeatured === 'true' || record.isFeatured === '1',
            isPremium: record.isPremium === 'true' || record.isPremium === '1',
            imageUrl: record.imageUrl || null,
            description: record.description || null
          }).execute();
          
          console.log(`Created laundromat: ${record.name} in ${record.city}, ${record.state}`);
          
          // Update city and state laundry counts
          await db.execute(sql`
            UPDATE cities
            SET laundry_count = laundry_count + 1
            WHERE name = ${record.city} AND state = ${record.state}
          `);
          
          await db.execute(sql`
            UPDATE states
            SET laundry_count = laundry_count + 1
            WHERE abbr = ${record.state}
          `);
        } else {
          console.log(`Skipping duplicate laundromat: ${record.name}`);
        }
      }
      
      console.log('CSV import completed successfully');
    } catch (error) {
      console.error('Error importing data:', error);
    }
  });
}

// Helper function to convert state abbreviation to full name
function getStateNameFromAbbreviation(abbr: string): string {
  const states: {[key: string]: string} = {
    'AL': 'Alabama',
    'AK': 'Alaska',
    'AZ': 'Arizona',
    'AR': 'Arkansas',
    'CA': 'California',
    'CO': 'Colorado',
    'CT': 'Connecticut',
    'DE': 'Delaware',
    'FL': 'Florida',
    'GA': 'Georgia',
    'HI': 'Hawaii',
    'ID': 'Idaho',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'KY': 'Kentucky',
    'LA': 'Louisiana',
    'ME': 'Maine',
    'MD': 'Maryland',
    'MA': 'Massachusetts',
    'MI': 'Michigan',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'NE': 'Nebraska',
    'NV': 'Nevada',
    'NH': 'New Hampshire',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NY': 'New York',
    'NC': 'North Carolina',
    'ND': 'North Dakota',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'PA': 'Pennsylvania',
    'RI': 'Rhode Island',
    'SC': 'South Carolina',
    'SD': 'South Dakota',
    'TN': 'Tennessee',
    'TX': 'Texas',
    'UT': 'Utah',
    'VT': 'Vermont',
    'VA': 'Virginia',
    'WA': 'Washington',
    'WV': 'West Virginia',
    'WI': 'Wisconsin',
    'WY': 'Wyoming',
    'DC': 'District of Columbia'
  };
  
  return states[abbr] || abbr;
}

// Check if file path is provided as command line argument
if (process.argv.length < 3) {
  console.error('Please provide the path to the CSV file as an argument');
  console.error('Example: ts-node import-csv.ts ../data/laundromats.csv');
  process.exit(1);
}

const filePath = process.argv[2];
importFromCsv(filePath);