/**
 * City Page Enhancement Script
 * 
 * This script adds valuable neighborhood information, nearby food options,
 * and things to do while waiting for laundry to each city in the database.
 * 
 * The data helps create rich city pages with high SEO value.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Batch sizes
  batchSize: 20, // Number of cities to enhance per batch
  
  // File paths
  logFile: 'data/city-enhancement-log.txt',
  progressFile: 'data/city-enhancement-progress.json',
  
  // Automation settings
  maxBatches: 1000,      // Maximum number of batches to run
  delayBetweenBatches: 2000, // 2 seconds between batches
};

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// Database connection using individual parameters
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false // For Neon database
  }
});

// Helper function for logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}`;
  console.log(logEntry);
  
  fs.appendFileSync(CONFIG.logFile, logEntry + '\n');
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test database connection
async function testConnection() {
  try {
    log('Testing database connection...');
    const client = await pool.connect();
    log('Database connection successful!');
    
    // Log connection details (without password)
    log(`Connected to: ${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE} as ${process.env.PGUSER}`);
    
    const result = await client.query('SELECT COUNT(*) FROM cities');
    log(`Current city count: ${result.rows[0].count}`);
    
    client.release();
    return true;
  } catch (error) {
    log(`Database connection error: ${error.message}`);
    log('Check your .env file and make sure the connection parameters are correct');
    return false;
  }
}

// Load or create progress tracking
function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      const data = fs.readFileSync(CONFIG.progressFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading progress file: ${error.message}`);
  }
  
  return { 
    position: 0, 
    totalEnhanced: 0,
    batches: 0,
    startTime: new Date().toISOString(),
    lastRunTime: null
  };
}

// Save progress
function saveProgress(progress) {
  progress.lastRunTime = new Date().toISOString();
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
}

// Get cities that need enhancement
async function getCitiesToEnhance(limit, offset) {
  try {
    // Check if city_info column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='cities' AND column_name='city_info'
    `);
    
    if (checkColumn.rows.length === 0) {
      // Add city_info column if it doesn't exist
      log('Adding city_info column to cities table');
      await pool.query(`
        ALTER TABLE cities 
        ADD COLUMN IF NOT EXISTS city_info JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS neighborhood_info JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS food_options JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS activities JSONB DEFAULT NULL
      `);
      log('Added city_info and related columns to cities table');
    }
    
    // Get cities without enhancement data
    const query = `
      SELECT c.id, c.name, c.slug, s.name as state_name, s.abbr as state_abbr
      FROM cities c
      JOIN states s ON c.state_id = s.id
      WHERE c.city_info IS NULL OR c.seo_description IS NULL
      ORDER BY c.id
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  } catch (error) {
    log(`Error getting cities to enhance: ${error.message}`);
    return [];
  }
}

// Generate neighborhood information based on city
function generateNeighborhoodInfo(cityName, stateName) {
  // Default neighborhoods for every city
  const defaultNeighborhoods = [
    {
      name: `Downtown ${cityName}`,
      description: `Downtown ${cityName} offers urban living with easy access to shops, restaurants, and entertainment venues. The laundromats in this area are typically modern with many amenities.`
    },
    {
      name: `${cityName} Historic District`,
      description: `The Historic District in ${cityName} features charming architecture and a strong sense of community. Laundromats here often have character and may be family-owned establishments.`
    }
  ];
  
  // City-specific neighborhoods for major cities
  const citySpecificNeighborhoods = {
    'New York': [
      { name: 'Manhattan - Upper East Side', description: 'Upscale neighborhood with luxury apartments and high-end laundry services.' },
      { name: 'Brooklyn - Williamsburg', description: 'Hip area with modern laundromats featuring coffee shops and free Wi-Fi.' },
      { name: 'Queens - Astoria', description: 'Diverse neighborhood with affordable and family-friendly laundry options.' }
    ],
    'Los Angeles': [
      { name: 'Downtown LA', description: 'Urban center with 24-hour laundromats serving apartment dwellers.' },
      { name: 'Santa Monica', description: 'Beachside community with eco-friendly laundry options.' },
      { name: 'Silverlake', description: 'Trendy neighborhood with artsy laundromats that often include coffee shops.' }
    ],
    'Chicago': [
      { name: 'Loop', description: 'Downtown area with quick-service laundromats for busy professionals.' },
      { name: 'Wicker Park', description: 'Hip neighborhood with vintage laundromats and modern amenities.' },
      { name: 'Lincoln Park', description: 'Family-friendly area with spacious, well-maintained laundry facilities.' }
    ],
    'Houston': [
      { name: 'Montrose', description: 'Eclectic neighborhood with 24-hour laundry services and vibrant atmosphere.' },
      { name: 'The Heights', description: 'Historic district with charming, locally-owned laundromats.' },
      { name: 'Midtown', description: 'Urban area with modern laundry facilities near apartments and condos.' }
    ],
    'Dallas': [
      { name: 'Uptown', description: 'Trendy area with luxury laundromats offering pickup and delivery.' },
      { name: 'Oak Lawn', description: 'Diverse neighborhood with laundromats ranging from budget to high-end.' },
      { name: 'Deep Ellum', description: 'Artistic district with unique laundromats that often feature local art.' }
    ],
    'Austin': [
      { name: 'South Congress (SoCo)', description: 'Hip area with eco-friendly laundromats and coffee shops.' },
      { name: 'East Austin', description: 'Artistic neighborhood with locally-owned laundry facilities.' },
      { name: 'Downtown', description: 'Urban center with modern laundromats serving apartment residents.' }
    ]
  };
  
  // Check if we have specific neighborhoods for this city
  if (citySpecificNeighborhoods[cityName]) {
    return citySpecificNeighborhoods[cityName];
  }
  
  // For other cities, generate some basic neighborhood info
  return defaultNeighborhoods;
}

// Generate nearby food options
function generateFoodOptions(cityName, stateName) {
  // Common food options near laundromats
  const commonFoodOptions = [
    {
      name: `${cityName} Café`,
      description: `Grab a coffee and a quick bite at this local café while waiting for your laundry. They offer free WiFi and comfortable seating.`,
      type: 'Café'
    },
    {
      name: 'Pizza Express',
      description: 'Order a slice or a whole pizza to enjoy while you wait. Affordable and quick service makes this a laundry day favorite.',
      type: 'Pizza'
    },
    {
      name: 'Quick Bites Deli',
      description: 'Made-to-order sandwiches and salads, perfect for a healthy meal during laundry time.',
      type: 'Deli'
    }
  ];
  
  // City-specific food options
  const citySpecificFood = {
    'New York': [
      { name: 'NY Bagel Shop', description: 'Authentic New York bagels with various cream cheese options, perfect for breakfast while doing laundry.', type: 'Bagels' },
      { name: 'Halal Cart', description: 'Famous street food offering gyros, chicken over rice, and falafel within walking distance of many laundromats.', type: 'Middle Eastern' }
    ],
    'Los Angeles': [
      { name: 'Taco Truck', description: 'Authentic street tacos that you can grab quickly between wash and dry cycles.', type: 'Mexican' },
      { name: 'Healthy Bowl', description: 'Nutritious grain bowls, smoothies, and juices for the health-conscious laundromat visitor.', type: 'Health Food' }
    ],
    'Chicago': [
      { name: 'Chicago Deep Dish', description: 'Try the famous Chicago-style pizza while waiting for your laundry. Call ahead as it takes 45 minutes to bake - perfect timing for a wash cycle!', type: 'Pizza' },
      { name: 'Hot Dog Stand', description: 'Classic Chicago hot dogs (no ketchup!) that you can grab quickly during your laundry break.', type: 'Fast Food' }
    ],
    'Austin': [
      { name: 'Taco Joint', description: 'Austin-style breakfast tacos and Tex-Mex favorites, perfect for any time of day.', type: 'Tex-Mex' },
      { name: 'BBQ Shack', description: 'Texas barbecue with all the fixings, ideal for a hearty meal while waiting for laundry.', type: 'Barbecue' }
    ]
  };
  
  // Add region-specific recommendations
  const regionalFoods = {
    'TX': [
      { name: 'Texas BBQ Pit', description: 'Authentic Texas barbecue with brisket, ribs, and all the classic sides.', type: 'Barbecue' },
      { name: 'Tex-Mex Cantina', description: 'Local favorite for quick tacos, enchiladas, and refreshing margaritas.', type: 'Tex-Mex' }
    ],
    'CA': [
      { name: 'Fresh Fusion', description: 'California-inspired healthy bowls, salads, and smoothies using local ingredients.', type: 'Healthy' },
      { name: 'Taqueria', description: 'Authentic street-style tacos and burritos, a California staple.', type: 'Mexican' }
    ],
    'NY': [
      { name: 'Corner Deli', description: 'Classic New York deli sandwiches piled high with premium meats and cheeses.', type: 'Deli' },
      { name: 'Slice Shop', description: 'New York-style pizza available by the slice, perfect for a quick bite.', type: 'Pizza' }
    ],
    'FL': [
      { name: 'Cuban Café', description: 'Authentic Cuban sandwiches, coffee, and pastries for a quick Florida-style snack.', type: 'Cuban' },
      { name: 'Seafood Shack', description: 'Fresh local seafood in a casual setting, from fish sandwiches to shrimp baskets.', type: 'Seafood' }
    ]
  };
  
  let foodOptions = [...commonFoodOptions];
  
  // Add city-specific options if available
  if (citySpecificFood[cityName]) {
    foodOptions = [...foodOptions, ...citySpecificFood[cityName]];
  }
  
  // Add state/regional options if available
  if (regionalFoods[stateName]) {
    foodOptions = [...foodOptions, ...regionalFoods[stateName]];
  }
  
  // Ensure we return at least 3 options, but no more than 5
  return foodOptions.slice(0, 5);
}

// Generate things to do while waiting
function generateActivities(cityName, stateName) {
  // Common activities near laundromats
  const commonActivities = [
    {
      name: 'Local Library Visit',
      description: `The ${cityName} Public Library is often located near laundromats and offers a quiet space to read or work while waiting for your laundry.`,
      duration: '1-2 hours'
    },
    {
      name: 'Corner Coffee Shop',
      description: 'Most laundromats are within walking distance of a coffee shop where you can enjoy a drink and use free WiFi.',
      duration: '30-60 minutes'
    },
    {
      name: 'Neighborhood Park',
      description: `Take a stroll through a nearby park to get some fresh air between cycles.`,
      duration: '15-45 minutes'
    }
  ];
  
  // City-specific activities
  const citySpecificActivities = {
    'New York': [
      { name: 'Corner Bodega Shopping', description: 'Browse the aisles of a classic New York bodega for snacks and essentials while your clothes wash.', duration: '15-30 minutes' },
      { name: 'Street Vendor Shopping', description: 'Check out nearby street vendors selling everything from books to accessories.', duration: '20-40 minutes' }
    ],
    'Los Angeles': [
      { name: 'Sidewalk Celeb Spotting', description: 'Take a walk down the Hollywood Walk of Fame between wash and dry cycles.', duration: '30-60 minutes' },
      { name: 'Beach Visit', description: 'Many LA laundromats are within walking distance of a beach, perfect for a quick visit while waiting.', duration: '1-2 hours' }
    ],
    'Chicago': [
      { name: 'Lakefront Walk', description: 'Take a quick stroll along the lakefront pathway while waiting for your laundry.', duration: '30-60 minutes' },
      { name: 'Local Mural Tour', description: 'Chicago neighborhoods are known for street art - take a self-guided tour near the laundromat.', duration: '20-40 minutes' }
    ],
    'Miami': [
      { name: 'Beach Break', description: 'Many Miami laundromats are just blocks from the beach - perfect for a quick dip while waiting.', duration: '1-2 hours' },
      { name: 'Art Deco Walking Tour', description: 'Explore the iconic architecture in the area between wash and dry cycles.', duration: '30-60 minutes' }
    ]
  };
  
  // Add seasonal activities
  const seasonalActivities = [
    { name: 'Local Farmers Market', description: 'Many neighborhoods host weekly farmers markets where you can shop for fresh produce while waiting for laundry.', duration: '30-60 minutes' },
    { name: 'Community Events', description: `${cityName} often has free community events on weekends - check local listings for activities near your laundromat.`, duration: 'Varies' }
  ];
  
  let activities = [...commonActivities];
  
  // Add city-specific activities if available
  if (citySpecificActivities[cityName]) {
    activities = [...activities, ...citySpecificActivities[cityName]];
  }
  
  // Add seasonal activities
  activities = [...activities, ...seasonalActivities];
  
  // Ensure we return at least 3 options, but no more than 5
  return activities.slice(0, 5);
}

// Generate city SEO description
function generateCityDescription(cityName, stateName, neighborhoodInfo) {
  const neighborhoodNames = neighborhoodInfo.map(n => n.name).join(', ');
  
  const descriptions = [
    `Find the best laundromats in ${cityName}, ${stateName} with our comprehensive directory. From ${neighborhoodNames} and beyond, we help you locate convenient laundry services with detailed information on amenities, hours, and customer reviews.`,
    
    `Searching for 'laundromat near me' in ${cityName}? Our directory covers all ${cityName} neighborhoods including ${neighborhoodNames}, helping you find the perfect place to do your laundry with filters for 24-hour service, card-operated machines, and other convenient features.`,
    
    `Discover ${cityName}'s best laundromats across neighborhoods like ${neighborhoodNames}. Our local guide includes information on hours, services, and amenities to make your laundry day easier. Find coin or card-operated machines, drop-off services, and more.`
  ];
  
  // Randomly select one of the description templates
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

// Generate city info summary
function generateCityInfo(cityName, stateName, neighborhoodCount, laundryCount) {
  return {
    overview: `${cityName}, ${stateName} has approximately ${laundryCount} laundromats spread across ${neighborhoodCount} neighborhoods. From self-service coin-operated machines to full-service options with drop-off, the city offers a range of laundry solutions for residents and visitors.`,
    best_times: `Weekday mornings and early afternoons are typically the least busy times for laundromats in ${cityName}. Avoid weekends and weekday evenings when possible, as these tend to be peak hours with longer wait times for machines.`,
    typical_prices: {
      wash: '$2.00 - $4.50 per load',
      dry: '$0.25 - $0.50 per 10 minutes',
      drop_off: '$1.00 - $1.75 per pound'
    },
    common_amenities: [
      'Free WiFi',
      'Vending machines',
      'Folding tables',
      'Seating areas',
      'TV screens'
    ]
  };
}

// Enhance a single city with additional information
async function enhanceCity(client, city) {
  try {
    // Get laundromat count for this city
    const countQuery = 'SELECT COUNT(*) FROM laundromats WHERE city_id = $1';
    const countResult = await client.query(countQuery, [city.id]);
    const laundryCount = parseInt(countResult.rows[0].count, 10);
    
    // Generate neighborhood information
    const neighborhoodInfo = generateNeighborhoodInfo(city.name, city.state_name);
    
    // Generate food options
    const foodOptions = generateFoodOptions(city.name, city.state_abbr);
    
    // Generate activities
    const activities = generateActivities(city.name, city.state_name);
    
    // Generate SEO description
    const seoDescription = generateCityDescription(city.name, city.state_name, neighborhoodInfo);
    
    // Generate general city info
    const cityInfo = generateCityInfo(city.name, city.state_name, neighborhoodInfo.length, laundryCount);
    
    // Update the city record
    const updateQuery = `
      UPDATE cities
      SET 
        neighborhood_info = $1,
        food_options = $2,
        activities = $3,
        seo_description = $4,
        city_info = $5
      WHERE id = $6
    `;
    
    await client.query(updateQuery, [
      JSON.stringify(neighborhoodInfo),
      JSON.stringify(foodOptions),
      JSON.stringify(activities),
      seoDescription,
      JSON.stringify(cityInfo),
      city.id
    ]);
    
    return true;
  } catch (error) {
    log(`Error enhancing city ${city.name}: ${error.message}`);
    throw error;
  }
}

// Process a batch of cities for enhancement
async function processBatch(cities) {
  const client = await pool.connect();
  let enhancedCount = 0;
  
  try {
    await client.query('BEGIN');
    
    log(`Processing batch of ${cities.length} cities`);
    
    for (const city of cities) {
      try {
        log(`Enhancing city: ${city.name}, ${city.state_name}`);
        await enhanceCity(client, city);
        enhancedCount++;
        log(`Successfully enhanced city: ${city.name}, ${city.state_name}`);
      } catch (error) {
        log(`Error processing city ${city.name}, ${city.state_name}: ${error.message}`);
      }
    }
    
    await client.query('COMMIT');
    return enhancedCount;
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Batch processing error: ${error.message}`);
    return 0;
  } finally {
    client.release();
  }
}

// Main function to enhance city pages
async function main() {
  log('='.repeat(50));
  log('CITY PAGE ENHANCEMENT STARTED');
  log('='.repeat(50));
  
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      log('Database connection failed - cannot proceed');
      return;
    }
    
    // Load progress
    const progress = loadProgress();
    log(`Resuming from position ${progress.position} (${progress.totalEnhanced} cities enhanced so far)`);
    
    // Main loop for batch processing
    let batchCount = 0;
    while (batchCount < CONFIG.maxBatches) {
      // Get cities that need enhancement
      const cities = await getCitiesToEnhance(CONFIG.batchSize, progress.position);
      
      if (cities.length === 0) {
        log('No more cities to enhance - task completed!');
        break;
      }
      
      log(`Starting batch ${progress.batches + 1} with ${cities.length} cities`);
      
      // Process batch
      const enhancedCount = await processBatch(cities);
      
      // Update progress
      progress.position += cities.length;
      progress.totalEnhanced += enhancedCount;
      progress.batches++;
      
      // Save progress
      saveProgress(progress);
      
      log(`Batch ${progress.batches} complete: Enhanced ${enhancedCount} cities`);
      log(`Total progress: ${progress.totalEnhanced} cities enhanced`);
      
      // Pause between batches
      if (cities.length === CONFIG.batchSize) {
        log(`Pausing for ${CONFIG.delayBetweenBatches / 1000} seconds`);
        await sleep(CONFIG.delayBetweenBatches);
      }
      
      batchCount++;
    }
    
    log('='.repeat(50));
    log('CITY PAGE ENHANCEMENT COMPLETED');
    log(`Enhanced ${progress.totalEnhanced} cities with rich local information`);
    log('='.repeat(50));
  } catch (error) {
    log(`Fatal error: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});