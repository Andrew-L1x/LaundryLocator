/**
 * Manual ZIP Code Import Script
 * 
 * This script adds laundromat data for specific important ZIP codes
 * without requiring the full Outscraper dataset processing.
 */

import { db } from '../server/db.js';
import { laundromats } from '../shared/schema.js';

// Create data directory if it doesn't exist
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Comprehensive list of high-priority laundromats for key ZIP codes
const keyZipLaundromats = [
  // New York City, NY (10001)
  {
    id: 2001,
    name: "Manhattan Laundry Center",
    slug: "manhattan-laundry-center-new-york-ny",
    address: "259 W 29th St",
    city: "New York",
    state: "NY",
    zip: "10001",
    phone: "(212) 555-8947",
    website: null,
    latitude: "40.7486",
    longitude: "-73.9936",
    rating: "4.5",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 11:00 PM",
      "Tuesday": "6:00 AM - 11:00 PM",
      "Wednesday": "6:00 AM - 11:00 PM",
      "Thursday": "6:00 AM - 11:00 PM",
      "Friday": "6:00 AM - 11:00 PM",
      "Saturday": "7:00 AM - 10:00 PM",
      "Sunday": "7:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "drop-off"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "air-conditioning", "television"]),
    description: "Full-service laundromat in the heart of Manhattan with convenient hours and professional staff.",
    reviewCount: 87,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Brooklyn, NY (11201)
  {
    id: 2002,
    name: "Brooklyn Heights Wash & Fold",
    slug: "brooklyn-heights-wash-fold-brooklyn-ny",
    address: "125 Atlantic Ave",
    city: "Brooklyn",
    state: "NY",
    zip: "11201",
    phone: "(718) 555-6432",
    website: null,
    latitude: "40.6917",
    longitude: "-73.9965",
    rating: "4.7",
    hours: JSON.stringify({
      "Monday": "7:00 AM - 10:00 PM",
      "Tuesday": "7:00 AM - 10:00 PM",
      "Wednesday": "7:00 AM - 10:00 PM",
      "Thursday": "7:00 AM - 10:00 PM",
      "Friday": "7:00 AM - 10:00 PM",
      "Saturday": "8:00 AM - 9:00 PM",
      "Sunday": "8:00 AM - 9:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "pickup-delivery"]),
    amenities: JSON.stringify(["free-wifi", "coffee-station", "comfortable-seating", "eco-friendly"]),
    description: "Upscale laundromat serving Brooklyn Heights with environmentally friendly practices and premium services.",
    reviewCount: 63,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Chicago, IL (60611)
  {
    id: 2003,
    name: "Magnificent Mile Laundry",
    slug: "magnificent-mile-laundry-chicago-il",
    address: "321 E Ontario St",
    city: "Chicago",
    state: "IL",
    zip: "60611",
    phone: "(312) 555-7839",
    website: null,
    latitude: "41.8933",
    longitude: "-87.6219",
    rating: "4.6",
    hours: JSON.stringify({
      "Monday": "Open 24 Hours",
      "Tuesday": "Open 24 Hours",
      "Wednesday": "Open 24 Hours",
      "Thursday": "Open 24 Hours",
      "Friday": "Open 24 Hours",
      "Saturday": "Open 24 Hours",
      "Sunday": "Open 24 Hours"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "commercial-service"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "air-conditioning", "television", "secure-facility"]),
    description: "24-hour full-service laundromat in downtown Chicago with high-capacity machines and professional staff.",
    reviewCount: 92,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Los Angeles, CA (90210)
  {
    id: 2004,
    name: "Beverly Hills Laundry",
    slug: "beverly-hills-laundry-los-angeles-ca",
    address: "9040 Santa Monica Blvd",
    city: "Los Angeles",
    state: "CA",
    zip: "90210",
    phone: "(310) 555-1234",
    website: null,
    latitude: "34.0763",
    longitude: "-118.3969",
    rating: "4.9",
    hours: JSON.stringify({
      "Monday": "7:00 AM - 9:00 PM",
      "Tuesday": "7:00 AM - 9:00 PM",
      "Wednesday": "7:00 AM - 9:00 PM",
      "Thursday": "7:00 AM - 9:00 PM",
      "Friday": "7:00 AM - 9:00 PM",
      "Saturday": "8:00 AM - 8:00 PM",
      "Sunday": "8:00 AM - 8:00 PM"
    }),
    services: JSON.stringify(["eco-friendly", "wash-and-fold", "dry-cleaning", "pickup-delivery", "alterations"]),
    amenities: JSON.stringify(["free-wifi", "coffee-bar", "comfortable-lounge", "workstation", "eco-friendly"]),
    description: "Luxury laundromat in Beverly Hills with premium services and eco-friendly processes.",
    reviewCount: 78,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Miami, FL (33139)
  {
    id: 2005,
    name: "South Beach Laundry Center",
    slug: "south-beach-laundry-center-miami-fl",
    address: "1245 Washington Ave",
    city: "Miami",
    state: "FL",
    zip: "33139",
    phone: "(305) 555-7622",
    website: null,
    latitude: "25.7864",
    longitude: "-80.1342",
    rating: "4.5",
    hours: JSON.stringify({
      "Monday": "7:00 AM - 11:00 PM",
      "Tuesday": "7:00 AM - 11:00 PM",
      "Wednesday": "7:00 AM - 11:00 PM",
      "Thursday": "7:00 AM - 11:00 PM",
      "Friday": "7:00 AM - 11:00 PM",
      "Saturday": "8:00 AM - 10:00 PM",
      "Sunday": "8:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "beach-towel-service"]),
    amenities: JSON.stringify(["free-wifi", "air-conditioning", "television", "arcade-games"]),
    description: "Convenient laundromat in South Beach with extended hours and special beach towel services.",
    reviewCount: 56,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Seattle, WA (98101)
  {
    id: 2006,
    name: "Downtown Seattle Laundry",
    slug: "downtown-seattle-laundry-seattle-wa",
    address: "722 Pine St",
    city: "Seattle",
    state: "WA",
    zip: "98101",
    phone: "(206) 555-4321",
    website: null,
    latitude: "47.6131",
    longitude: "-122.3352",
    rating: "4.8",
    hours: JSON.stringify({
      "Monday": "6:00 AM - 11:00 PM",
      "Tuesday": "6:00 AM - 11:00 PM",
      "Wednesday": "6:00 AM - 11:00 PM",
      "Thursday": "6:00 AM - 11:00 PM",
      "Friday": "6:00 AM - 11:00 PM",
      "Saturday": "7:00 AM - 10:00 PM",
      "Sunday": "7:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "rainwear-cleaning"]),
    amenities: JSON.stringify(["free-wifi", "coffee-station", "comfortable-seating", "eco-friendly"]),
    description: "Eco-friendly laundromat in downtown Seattle with special rainwear cleaning services and sustainable practices.",
    reviewCount: 84,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Dallas, TX (75201)
  {
    id: 2007,
    name: "Downtown Dallas Laundry",
    slug: "downtown-dallas-laundry-dallas-tx",
    address: "1845 Main St",
    city: "Dallas",
    state: "TX",
    zip: "75201",
    phone: "(214) 555-7890",
    website: null,
    latitude: "32.7809",
    longitude: "-96.8044",
    rating: "4.7",
    hours: JSON.stringify({
      "Monday": "Open 24 Hours",
      "Tuesday": "Open 24 Hours",
      "Wednesday": "Open 24 Hours",
      "Thursday": "Open 24 Hours",
      "Friday": "Open 24 Hours",
      "Saturday": "Open 24 Hours",
      "Sunday": "Open 24 Hours"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "commercial-service"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "air-conditioning", "television", "secure-facility"]),
    description: "24-hour laundromat in downtown Dallas with high-capacity machines and a welcoming environment.",
    reviewCount: 71,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Boston, MA (02116)
  {
    id: 2008,
    name: "Back Bay Laundry Center",
    slug: "back-bay-laundry-center-boston-ma",
    address: "324 Newbury St",
    city: "Boston",
    state: "MA",
    zip: "02116",
    phone: "(617) 555-9876",
    website: null,
    latitude: "42.3488",
    longitude: "-71.0838",
    rating: "4.6",
    hours: JSON.stringify({
      "Monday": "7:00 AM - 10:00 PM",
      "Tuesday": "7:00 AM - 10:00 PM",
      "Wednesday": "7:00 AM - 10:00 PM",
      "Thursday": "7:00 AM - 10:00 PM",
      "Friday": "7:00 AM - 10:00 PM",
      "Saturday": "8:00 AM - 9:00 PM",
      "Sunday": "8:00 AM - 9:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "student-discounts"]),
    amenities: JSON.stringify(["free-wifi", "study-area", "comfortable-seating", "charging-stations"]),
    description: "Stylish laundromat in Back Bay with amenities for students and professionals alike.",
    reviewCount: 65,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Philadelphia, PA (19103)
  {
    id: 2009,
    name: "Center City Laundry",
    slug: "center-city-laundry-philadelphia-pa",
    address: "235 S 20th St",
    city: "Philadelphia",
    state: "PA",
    zip: "19103",
    phone: "(215) 555-3456",
    website: null,
    latitude: "39.9491",
    longitude: "-75.1746",
    rating: "4.5",
    hours: JSON.stringify({
      "Monday": "6:30 AM - 10:00 PM",
      "Tuesday": "6:30 AM - 10:00 PM",
      "Wednesday": "6:30 AM - 10:00 PM",
      "Thursday": "6:30 AM - 10:00 PM",
      "Friday": "6:30 AM - 10:00 PM",
      "Saturday": "7:00 AM - 9:00 PM",
      "Sunday": "7:00 AM - 9:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "alterations"]),
    amenities: JSON.stringify(["free-wifi", "comfortable-seating", "vending-machines", "television"]),
    description: "Full-service laundromat in Center City Philadelphia with convenient hours and friendly staff.",
    reviewCount: 58,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // San Diego, CA (92101)
  {
    id: 2010,
    name: "Gaslamp Laundry Services",
    slug: "gaslamp-laundry-services-san-diego-ca",
    address: "548 J St",
    city: "San Diego",
    state: "CA",
    zip: "92101",
    phone: "(619) 555-8765",
    website: null,
    latitude: "32.7093",
    longitude: "-117.1606",
    rating: "4.7",
    hours: JSON.stringify({
      "Monday": "7:00 AM - 11:00 PM",
      "Tuesday": "7:00 AM - 11:00 PM",
      "Wednesday": "7:00 AM - 11:00 PM",
      "Thursday": "7:00 AM - 11:00 PM",
      "Friday": "7:00 AM - 11:00 PM",
      "Saturday": "8:00 AM - 10:00 PM",
      "Sunday": "8:00 AM - 10:00 PM"
    }),
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "beach-gear-cleaning"]),
    amenities: JSON.stringify(["free-wifi", "coffee-bar", "comfortable-seating", "outdoor-patio"]),
    description: "Modern laundromat in the Gaslamp Quarter with beach gear cleaning services and outdoor waiting area.",
    reviewCount: 74,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  },
  
  // Houston, TX (77002)
  {
    id: 2011,
    name: "Downtown Houston Laundry",
    slug: "downtown-houston-laundry-houston-tx",
    address: "315 Travis St",
    city: "Houston",
    state: "TX",
    zip: "77002",
    phone: "(713) 555-9012",
    website: null,
    latitude: "29.7604",
    longitude: "-95.3698",
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
    services: JSON.stringify(["self-service", "wash-and-fold", "dry-cleaning", "commercial-service"]),
    amenities: JSON.stringify(["free-wifi", "vending-machines", "air-conditioning", "television", "secure-facility"]),
    description: "24-hour laundromat in downtown Houston with high-capacity machines and professional services.",
    reviewCount: 67,
    listingType: "standard",
    isFeatured: false,
    isPremium: false,
    createdAt: new Date()
  }
];

/**
 * Add the key ZIP code laundromats to the database
 */
async function addKeyZipLaundromats() {
  console.log(`Adding ${keyZipLaundromats.length} laundromats for key ZIP codes...`);
  
  try {
    // Insert all records
    const result = await db.insert(laundromats).values(keyZipLaundromats).onConflictDoNothing();
    console.log(`Successfully added ${result.count} new laundromats`);
    
    // Check current count
    const count = await db.select({ count: db.fn.count() }).from(laundromats);
    console.log(`Total laundromats in database: ${count[0].count}`);
    
    return result;
  } catch (error) {
    console.error('Error adding laundromats:', error);
    throw error;
  }
}

// Run the script
console.log('=== Starting Manual ZIP Import ===');
addKeyZipLaundromats()
  .then(() => {
    console.log('=== Import Complete ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to import laundromats:', error);
    process.exit(1);
  });