/**
 * Generate Missing Cities for States
 * 
 * This script adds essential cities for states with no cities in the database
 */

import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log operations to file
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  fs.appendFileSync('missing-cities-generation.log', `${new Date().toISOString()} - ${message}\n`);
}

// Major cities by state
const stateCities = {
  'MT': [
    'Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 
    'Kalispell', 'Havre', 'Anaconda', 'Miles City', 'Belgrade', 'Livingston',
    'Laurel', 'Whitefish', 'Sidney', 'Columbia Falls', 'Polson', 'Lewistown',
    'Hamilton', 'Glendive', 'Dillon', 'Hardin', 'Red Lodge', 'Glasgow'
  ],
  'NE': [
    'Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont',
    'Hastings', 'Norfolk', 'Columbus', 'North Platte', 'Papillion', 'La Vista',
    'Scottsbluff', 'South Sioux City', 'Beatrice', 'Lexington', 'Alliance',
    'Gering', 'Blair', 'York', 'McCook', 'Seward', 'Crete', 'Sidney'
  ],
  'NV': [
    'Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City',
    'Elko', 'Fernley', 'Mesquite', 'Boulder City', 'Fallon', 'Winnemucca',
    'West Wendover', 'Ely', 'Yerington', 'Carlin', 'Lovelock', 'Wells'
  ],
  'NH': [
    'Manchester', 'Nashua', 'Concord', 'Derry', 'Dover', 'Rochester', 'Salem',
    'Merrimack', 'Londonderry', 'Hudson', 'Keene', 'Bedford', 'Portsmouth',
    'Goffstown', 'Laconia', 'Hampton', 'Milford', 'Exeter', 'Lebanon', 'Windham'
  ],
  'NJ': [
    'Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton', 'Clifton',
    'Camden', 'Passaic', 'Union City', 'East Orange', 'Vineland', 'Bayonne',
    'New Brunswick', 'Perth Amboy', 'Hoboken', 'Plainfield', 'Atlantic City',
    'Wayne', 'Irvington', 'Parsippany-Troy Hills', 'Howell', 'Brick', 'Edison'
  ],
  'NM': [
    'Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington',
    'Clovis', 'Hobbs', 'Alamogordo', 'Carlsbad', 'Gallup', 'Los Lunas', 'Deming',
    'Espanola', 'Taos', 'Grants', 'Silver City', 'Los Alamos', 'Socorro'
  ],
  'NY': [
    'New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany',
    'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'Binghamton',
    'Troy', 'Niagara Falls', 'Poughkeepsie', 'Ithaca', 'Jamestown', 'Elmira',
    'Saratoga Springs', 'Plattsburgh', 'Watertown', 'Glen Cove', 'Amsterdam'
  ],
  'NC': [
    'Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville',
    'Cary', 'Wilmington', 'High Point', 'Concord', 'Greenville', 'Asheville',
    'Gastonia', 'Jacksonville', 'Chapel Hill', 'Rocky Mount', 'Burlington',
    'Wilson', 'Kannapolis', 'Apex', 'Huntersville', 'Hickory', 'Goldsboro'
  ],
  'ND': [
    'Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston',
    'Dickinson', 'Mandan', 'Jamestown', 'Wahpeton', 'Devils Lake', 'Valley City',
    'Grafton', 'Rugby', 'Casselton', 'Beulah', 'Hazen', 'Watford City', 'Lincoln'
  ],
  // Add more states as needed
  'OH': [
    'Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton',
    'Parma', 'Canton', 'Youngstown', 'Lorain', 'Hamilton', 'Springfield',
    'Kettering', 'Elyria', 'Lakewood', 'Cuyahoga Falls', 'Middletown',
    'Euclid', 'Newark', 'Mansfield', 'Mentor', 'Beavercreek', 'Cleveland Heights'
  ]
};

// Generate a slug from city name and state
function generateCitySlug(cityName, stateAbbr) {
  return `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stateAbbr.toLowerCase()}`;
}

// Add a city to the database
async function addCity(client, cityName, stateAbbr) {
  try {
    // Generate a slug for the city
    const slug = generateCitySlug(cityName, stateAbbr);
    
    // Check if city already exists
    const checkQuery = 'SELECT id FROM cities WHERE name = $1 AND state = $2';
    const checkResult = await client.query(checkQuery, [cityName, stateAbbr]);
    
    if (checkResult.rows.length > 0) {
      log(`City ${cityName}, ${stateAbbr} already exists, skipping`);
      return checkResult.rows[0].id;
    }
    
    // Insert the new city
    const insertQuery = `
      INSERT INTO cities (name, state, slug, laundry_count) 
      VALUES ($1, $2, $3, 0) 
      RETURNING id
    `;
    const insertResult = await client.query(insertQuery, [cityName, stateAbbr, slug]);
    
    log(`Added city: ${cityName}, ${stateAbbr} with slug: ${slug}`);
    return insertResult.rows[0].id;
  } catch (error) {
    log(`Error adding city ${cityName}, ${stateAbbr}: ${error.message}`);
    return null;
  }
}

// Main function to add cities to states with no cities
async function addMissingStateCities() {
  const client = await pool.connect();
  
  try {
    // Get all states from the database
    const statesQuery = 'SELECT id, name, abbr FROM states ORDER BY name';
    const statesResult = await client.query(statesQuery);
    
    log(`Found ${statesResult.rows.length} states to process`);
    
    // Process each state
    for (const state of statesResult.rows) {
      // Check if state has cities
      const cityCountQuery = 'SELECT COUNT(*) FROM cities WHERE state = $1';
      const cityCountResult = await client.query(cityCountQuery, [state.abbr]);
      const cityCount = parseInt(cityCountResult.rows[0].count, 10);
      
      if (cityCount === 0 && stateCities[state.abbr]) {
        log(`No cities found for ${state.name} (${state.abbr}). Adding cities...`);
        
        // Add cities for this state
        const cities = stateCities[state.abbr];
        if (cities && cities.length > 0) {
          for (const cityName of cities) {
            await addCity(client, cityName, state.abbr);
          }
          log(`Added ${cities.length} cities to ${state.name}`);
        } else {
          log(`No city list defined for ${state.name} (${state.abbr})`);
        }
      } else {
        log(`${state.name} already has ${cityCount} cities. Skipping.`);
      }
    }
    
    log('City generation process complete');
  } catch (error) {
    log(`Error in city generation process: ${error.message}`);
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  try {
    await addMissingStateCities();
  } catch (error) {
    log(`Unexpected error in main function: ${error.message}`);
  } finally {
    await pool.end();
    log('Database connection closed');
  }
}

// Run the main function
main().catch(console.error);