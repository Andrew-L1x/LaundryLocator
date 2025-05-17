/**
 * Add Enriched Laundromats
 * 
 * This script adds a focused set of high-quality laundromat entries
 * to enhance coverage in major cities and regions.
 */

import { db } from '../server/db.ts';
import { laundromats, cities, states } from '../shared/schema.ts';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// Create data directory if it doesn't exist
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Rich laundromat entries for various regions
const enrichedLaundromats = [
  // Phoenix, AZ (85004)
  {
    id: 2101,
    name: "Downtown Phoenix Laundry",
    slug: "downtown-phoenix-laundry-phoenix-az",
    address: "420 E Roosevelt St",
    city: "Phoenix",
    state: "AZ",
    zip: "85004",
    phone: "(602) 555-3490",
    website: null,
    latitude: "33.4588",
    longitude: "-112.0687",
    rating: "4.6",
    hours: JSON.stringify({
      "Monday": "5:00 AM - 11:00 PM",
      "Tuesday": "5:00 AM - 11:00 PM",
      "Wednesday": "5:00 AM - 11:00 PM",
      "Thursday": "5:00 AM - 11:00 PM",
      "Friday": "5:00 AM - 11:00 PM",
      "Saturday": "6:00 AM - 10:00 PM",
      "Sunday": "6:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "commercial-service"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "air-conditioning", "television", "charging-stations"]),
    description: "Modern laundromat in downtown Phoenix with high-efficiency machines and a cool, air-conditioned environment.",
    reviewCount: 72,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Portland, OR (97205)
  {
    id: 2102,
    name: "Pearl District Laundry",
    slug: "pearl-district-laundry-portland-or",
    address: "324 NW 11th Ave",
    city: "Portland",
    state: "OR",
    zip: "97205",
    phone: "(503) 555-7689",
    website: null,
    latitude: "45.5259",
    longitude: "-122.6828",
    rating: "4.8",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 10:00 PM",
      "Tuesday": "6:00 AM - 10:00 PM",
      "Wednesday": "6:00 AM - 10:00 PM",
      "Thursday": "6:00 AM - 10:00 PM",
      "Friday": "6:00 AM - 10:00 PM",
      "Saturday": "7:00 AM - 9:00 PM",
      "Sunday": "7:00 AM - 9:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "eco-friendly", "organic-detergent", "pickup-delivery"]),
    amenities: JSON.stringify(["free-wifi", "coffee-shop", "comfortable-seating", "bicycle-parking", "book-exchange"]),
    description: "Eco-friendly laundromat in Portland's Pearl District offering organic detergents and energy-efficient machines.",
    reviewCount: 93,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Las Vegas, NV (89109)
  {
    id: 2103,
    name: "Strip Laundry Center",
    slug: "strip-laundry-center-las-vegas-nv",
    address: "3750 Las Vegas Blvd S",
    city: "Las Vegas",
    state: "NV",
    zip: "89109",
    phone: "(702) 555-3214",
    website: null,
    latitude: "36.1139",
    longitude: "-115.1707",
    rating: "4.5",
    hours: JSON.stringify({
      "Monday": "Open 24 Hours",
      "Tuesday": "Open 24 Hours",
      "Wednesday": "Open 24 Hours",
      "Thursday": "Open 24 Hours",
      "Friday": "Open 24 Hours",
      "Saturday": "Open 24 Hours",
      "Sunday": "Open 24 Hours"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "tourist-special", "valet-service"]),
    amenities: JSON.stringify(["free-wifi", "slot-machines", "air-conditioning", "television", "lounge-area"]),
    description: "24-hour laundromat on the Las Vegas Strip with slot machines and special tourist packages.",
    reviewCount: 84,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Minneapolis, MN (55402)
  {
    id: 2104,
    name: "Downtown Minneapolis Laundry",
    slug: "downtown-minneapolis-laundry-minneapolis-mn",
    address: "45 S 7th St",
    city: "Minneapolis",
    state: "MN",
    zip: "55402",
    phone: "(612) 555-9087",
    website: null,
    latitude: "44.9772",
    longitude: "-93.2728",
    rating: "4.7",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 10:00 PM",
      "Tuesday": "6:00 AM - 10:00 PM",
      "Wednesday": "6:00 AM - 10:00 PM",
      "Thursday": "6:00 AM - 10:00 PM",
      "Friday": "6:00 AM - 10:00 PM",
      "Saturday": "7:00 AM - 9:00 PM",
      "Sunday": "7:00 AM - 9:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "winter-gear-cleaning"]),
    amenities: JSON.stringify(["free-wifi", "heated-waiting-area", "coffee-station", "magazines", "charging-stations"]),
    description: "Modern laundromat in downtown Minneapolis with specialized winter gear cleaning services and a cozy waiting area.",
    reviewCount: 78,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Denver, CO (80211) - Highlands
  {
    id: 2105,
    name: "Highlands Laundry Express",
    slug: "highlands-laundry-express-denver-co",
    address: "3245 W 32nd Ave",
    city: "Denver",
    state: "CO",
    zip: "80211",
    phone: "(303) 555-6723",
    website: null,
    latitude: "39.7621",
    longitude: "-105.0255",
    rating: "4.9",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 11:00 PM",
      "Tuesday": "6:00 AM - 11:00 PM",
      "Wednesday": "6:00 AM - 11:00 PM",
      "Thursday": "6:00 AM - 11:00 PM",
      "Friday": "6:00 AM - 11:00 PM",
      "Saturday": "7:00 AM - 10:00 PM",
      "Sunday": "7:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "eco-friendly", "outdoor-gear-cleaning"]),
    amenities: JSON.stringify(["free-wifi", "organic-coffee", "comfortable-seating", "bicycle-parking", "eco-friendly-products"]),
    description: "Eco-conscious laundromat in Denver's Highlands neighborhood with outdoor gear cleaning services and organic coffee.",
    reviewCount: 91,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Fort Collins, CO (80521)
  {
    id: 2106,
    name: "Old Town Laundry",
    slug: "old-town-laundry-fort-collins-co",
    address: "234 N College Ave",
    city: "Fort Collins",
    state: "CO",
    zip: "80521",
    phone: "(970) 555-4321",
    website: null,
    latitude: "40.5865",
    longitude: "-105.0782",
    rating: "4.7",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 11:00 PM",
      "Tuesday": "6:00 AM - 11:00 PM",
      "Wednesday": "6:00 AM - 11:00 PM",
      "Thursday": "6:00 AM - 11:00 PM",
      "Friday": "6:00 AM - 11:00 PM",
      "Saturday": "7:00 AM - 10:00 PM",
      "Sunday": "7:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "eco-friendly", "outdoor-gear-cleaning", "student-discounts"]),
    amenities: JSON.stringify(["free-wifi", "local-coffee", "study-tables", "bicycle-parking", "book-exchange"]),
    description: "College-friendly laundromat in Fort Collins' Old Town with student discounts and study areas.",
    reviewCount: 82,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Fort Collins, CO (80525)
  {
    id: 2107,
    name: "Front Range Laundry Center",
    slug: "front-range-laundry-center-fort-collins-co",
    address: "2117 S College Ave",
    city: "Fort Collins",
    state: "CO",
    zip: "80525",
    phone: "(970) 555-8765",
    website: null,
    latitude: "40.5542",
    longitude: "-105.0776",
    rating: "4.6",
    hours: JSON.stringify({
      "Monday": "5:30 AM - 11:00 PM",
      "Tuesday": "5:30 AM - 11:00 PM",
      "Wednesday": "5:30 AM - 11:00 PM",
      "Thursday": "5:30 AM - 11:00 PM",
      "Friday": "5:30 AM - 11:00 PM",
      "Saturday": "6:00 AM - 10:00 PM",
      "Sunday": "6:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "commercial-service", "student-discounts"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "study-area", "television", "charging-stations"]),
    description: "Large capacity laundromat near CSU with student discounts and plenty of study space.",
    reviewCount: 74,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Fort Collins, CO (80524)
  {
    id: 2108,
    name: "North College Laundromat",
    slug: "north-college-laundromat-fort-collins-co",
    address: "1451 N College Ave",
    city: "Fort Collins",
    state: "CO",
    zip: "80524",
    phone: "(970) 555-2109",
    website: null,
    latitude: "40.6012",
    longitude: "-105.0765",
    rating: "4.5",
    hours: JSON.stringify({
      "Monday": "Open 24 Hours",
      "Tuesday": "Open 24 Hours",
      "Wednesday": "Open 24 Hours",
      "Thursday": "Open 24 Hours",
      "Friday": "Open 24 Hours",
      "Saturday": "Open 24 Hours",
      "Sunday": "Open 24 Hours"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "24-hour-service", "large-capacity-machines"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "security-cameras", "well-lit", "ample-parking"]),
    description: "24-hour laundromat on North College Avenue with large-capacity machines and ample parking.",
    reviewCount: 63,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Atlanta, GA (30303)
  {
    id: 2109,
    name: "Downtown Atlanta Laundry",
    slug: "downtown-atlanta-laundry-atlanta-ga",
    address: "215 Peachtree St NE",
    city: "Atlanta",
    state: "GA",
    zip: "30303",
    phone: "(404) 555-7890",
    website: null,
    latitude: "33.7627",
    longitude: "-84.3873",
    rating: "4.7",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 11:00 PM",
      "Tuesday": "6:00 AM - 11:00 PM",
      "Wednesday": "6:00 AM - 11:00 PM",
      "Thursday": "6:00 AM - 11:00 PM",
      "Friday": "6:00 AM - 11:00 PM",
      "Saturday": "7:00 AM - 10:00 PM",
      "Sunday": "7:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "corporate-accounts"]),
    amenities: JSON.stringify(["free-wifi", "coffee-bar", "workspace", "comfortable-seating", "charging-stations"]),
    description: "Professional laundromat in downtown Atlanta with corporate accounts and workspace amenities.",
    reviewCount: 85,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Nashville, TN (37203)
  {
    id: 2110,
    name: "Music Row Laundry Center",
    slug: "music-row-laundry-center-nashville-tn",
    address: "1234 16th Ave S",
    city: "Nashville",
    state: "TN",
    zip: "37203",
    phone: "(615) 555-1234",
    website: null,
    latitude: "36.1447",
    longitude: "-86.7922",
    rating: "4.8",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 12:00 AM",
      "Tuesday": "6:00 AM - 12:00 AM",
      "Wednesday": "6:00 AM - 12:00 AM",
      "Thursday": "6:00 AM - 12:00 AM",
      "Friday": "6:00 AM - 12:00 AM",
      "Saturday": "7:00 AM - 12:00 AM",
      "Sunday": "7:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "stage-costume-cleaning", "tour-bus-services"]),
    amenities: JSON.stringify(["free-wifi", "live-music-stage", "comfortable-seating", "guitar-station", "local-coffee"]),
    description: "Musician-friendly laundromat on Music Row with stage costume cleaning and occasional live music.",
    reviewCount: 89,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  }
];

// Function to ensure a state exists in the database
async function ensureStateExists(stateCode, stateName) {
  try {
    // Check if state exists
    const existingState = await db.select().from(states).where(eq(states.code, stateCode));
    
    if (existingState.length === 0) {
      // Create the state if it doesn't exist
      console.log(`Creating state: ${stateName} (${stateCode})`);
      await db.insert(states).values({
        code: stateCode,
        name: stateName
      });
    }
    
    // Get state ID
    const [state] = await db.select().from(states).where(eq(states.code, stateCode));
    return state.id;
  } catch (error) {
    console.error(`Error ensuring state exists for ${stateCode}:`, error);
    throw error;
  }
}

// Function to ensure a city exists in the database
async function ensureCityExists(cityName, stateId) {
  try {
    // Check if city exists
    const existingCity = await db
      .select()
      .from(cities)
      .where(sql`${cities.name} ILIKE ${cityName} AND ${cities.stateId} = ${stateId}`);
    
    if (existingCity.length === 0) {
      // Create the city if it doesn't exist
      console.log(`Creating city: ${cityName}`);
      await db.insert(cities).values({
        name: cityName,
        stateId: stateId,
        slug: cityName.toLowerCase().replace(/\s+/g, '-'),
        laundryCount: 0
      });
    }
    
    // Get city ID
    const [city] = await db
      .select()
      .from(cities)
      .where(sql`${cities.name} ILIKE ${cityName} AND ${cities.stateId} = ${stateId}`);
    
    return city.id;
  } catch (error) {
    console.error(`Error ensuring city exists for ${cityName}:`, error);
    throw error;
  }
}

// Function to update laundry count for a city
async function updateLaundryCount(cityId) {
  try {
    const count = await db
      .select({ count: sql`COUNT(*)` })
      .from(laundromats)
      .where(eq(laundromats.cityId, cityId));
    
    await db
      .update(cities)
      .set({ laundryCount: Number(count[0].count) })
      .where(eq(cities.id, cityId));
    
    console.log(`Updated laundry count for city ID ${cityId} to ${count[0].count}`);
  } catch (error) {
    console.error(`Error updating laundry count for city ID ${cityId}:`, error);
  }
}

// Function to add a single laundromat
async function addLaundromat(laundromat) {
  try {
    // Get state name based on code
    const stateMap = {
      'AZ': 'Arizona',
      'CO': 'Colorado',
      'FL': 'Florida',
      'GA': 'Georgia',
      'IL': 'Illinois',
      'MN': 'Minnesota',
      'NV': 'Nevada',
      'NY': 'New York',
      'OR': 'Oregon',
      'TN': 'Tennessee',
      'TX': 'Texas',
      'WA': 'Washington'
    };
    
    const stateName = stateMap[laundromat.state] || laundromat.state;
    
    // Ensure state and city exist
    const stateId = await ensureStateExists(laundromat.state, stateName);
    const cityId = await ensureCityExists(laundromat.city, stateId);
    
    // Create the full laundromat record
    const laundryRecord = {
      ...laundromat,
      cityId,
      stateId
    };
    
    // Insert the laundromat
    await db.insert(laundromats).values(laundryRecord).onConflictDoNothing();
    console.log(`Added laundromat: ${laundromat.name} in ${laundromat.city}, ${laundromat.state}`);
    
    // Update the city's laundry count
    await updateLaundryCount(cityId);
    
    return true;
  } catch (error) {
    console.error(`Error adding laundromat ${laundromat.name}:`, error);
    return false;
  }
}

// Main function to add enriched laundromats
async function addEnrichedLaundromats() {
  console.log(`Adding ${enrichedLaundromats.length} enriched laundromats...`);
  
  // Track success and failures
  let successes = 0;
  let failures = 0;
  
  // Process each laundromat
  for (const laundromat of enrichedLaundromats) {
    try {
      const success = await addLaundromat(laundromat);
      if (success) {
        successes++;
      } else {
        failures++;
      }
    } catch (error) {
      console.error(`Failed to add laundromat ${laundromat.name}:`, error);
      failures++;
    }
  }
  
  // Log results
  console.log(`
Addition complete:
- Successfully added: ${successes}
- Failed to add: ${failures}
- Total processed: ${enrichedLaundromats.length}
  `);
  
  // Get total count
  const count = await db.select({ count: db.fn.count() }).from(laundromats);
  console.log(`Total laundromats in database: ${count[0].count}`);
}

// Run the script
console.log('=== Starting Enriched Laundromats Import ===');
addEnrichedLaundromats()
  .then(() => {
    console.log('=== Import Complete ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to import laundromats:', error);
    process.exit(1);
  });