/**
 * Enhance Laundromat Details Script
 * 
 * This script adds rich detail information to all laundromats including:
 * - Machine counts and details
 * - Payment options
 * - Amenities
 * - Busy times information
 */

import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to log operations
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  fs.appendFileSync('laundromat-enhancement.log', `${new Date().toISOString()} - ${message}\n`);
}

// Generate machine count data based on city population/size
function generateMachineCount(city, state) {
  // Define major cities that typically have larger laundromats
  const largeCities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 
                      'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
                      'San Francisco', 'Charlotte', 'Seattle', 'Denver', 'Boston', 'Atlanta'];
  
  // Define medium-sized cities
  const mediumCities = ['Portland', 'Nashville', 'Baltimore', 'Las Vegas', 'Milwaukee', 'Albuquerque',
                       'Tucson', 'Fresno', 'Sacramento', 'Kansas City', 'Miami', 'Oakland', 
                       'Minneapolis', 'Tampa', 'Arlington', 'Aurora', 'Cleveland', 'Pittsburgh'];
  
  let size = 'small'; // Default to small city/town
  
  // Check if this is a large city
  if (largeCities.some(c => city.includes(c))) {
    size = 'large';
  } 
  // Check if this is a medium city
  else if (mediumCities.some(c => city.includes(c))) {
    size = 'medium';
  }
  
  // Adjust for states with generally larger laundromats
  if (['NY', 'CA', 'IL', 'TX'].includes(state) && size === 'small') {
    size = 'medium';
  }
  
  // Generate machine counts based on size
  let washers, dryers;
  
  switch (size) {
    case 'large':
      washers = Math.floor(Math.random() * 25) + 15; // 15-40 washers
      dryers = Math.floor(Math.random() * 20) + 12;  // 12-32 dryers
      break;
    case 'medium':
      washers = Math.floor(Math.random() * 15) + 8;  // 8-23 washers
      dryers = Math.floor(Math.random() * 12) + 6;   // 6-18 dryers
      break;
    default: // small
      washers = Math.floor(Math.random() * 8) + 4;   // 4-12 washers
      dryers = Math.floor(Math.random() * 6) + 3;    // 3-9 dryers
  }
  
  return { washers, dryers };
}

// Generate payment options based on location
function generatePaymentOptions(state, city) {
  const allOptions = ['Cash', 'Credit Card', 'Debit Card', 'Mobile App', 'Coin', 'Card Operated', 'Dollar Bill'];
  const selectedOptions = [];
  
  // Regional payment preferences
  const techSavvyStates = ['CA', 'WA', 'NY', 'MA', 'TX', 'CO', 'IL'];
  const techSavvyCities = ['San Francisco', 'Seattle', 'New York', 'Boston', 'Austin', 'Denver', 'Chicago', 'Portland'];
  
  const ruralStates = ['WY', 'MT', 'ND', 'SD', 'ID', 'NE', 'KS', 'OK', 'AR', 'MS', 'WV'];
  
  // Always include Cash
  selectedOptions.push('Cash');
  
  // Tech-savvy areas have more digital payment options
  if (techSavvyStates.includes(state) || techSavvyCities.some(c => city.includes(c))) {
    selectedOptions.push('Credit Card');
    selectedOptions.push('Debit Card');
    
    // Higher chance of mobile app payments in tech hubs
    if (city.includes('San Francisco') || city.includes('Seattle') || city.includes('Austin')) {
      selectedOptions.push('Mobile App');
    } else if (Math.random() < 0.6) {
      selectedOptions.push('Mobile App');
    }
  } 
  // Rural areas more likely to be coin/cash only
  else if (ruralStates.includes(state)) {
    if (Math.random() < 0.4) {
      selectedOptions.push('Credit Card');
    }
    selectedOptions.push('Coin');
    
    if (Math.random() < 0.3) {
      selectedOptions.push('Dollar Bill');
    }
  }
  // Other places have a mix
  else {
    if (Math.random() < 0.7) {
      selectedOptions.push('Credit Card');
      selectedOptions.push('Debit Card');
    }
    
    if (Math.random() < 0.5) {
      selectedOptions.push('Coin');
    }
    
    if (Math.random() < 0.3) {
      selectedOptions.push('Dollar Bill');
    }
  }
  
  // Remove duplicates
  return [...new Set(selectedOptions)];
}

// Generate amenities based on location
function generateAmenities(city, state) {
  const allAmenities = [
    'WiFi', 'Seating Area', 'Air Conditioning', 'Heating', 'Restrooms', 
    'TV', 'Vending Machines', 'Handicap Accessible', 'Folding Tables',
    'Change Machine', 'Attendant on Duty', 'Security Cameras', 
    'Play Area', 'Wash and Fold Service', 'Self-Service', 'Dry Cleaning',
    'Drop-Off Service', 'Charging Stations', 'Coffee Machine', 'Study Area'
  ];
  
  // Different types of areas have different amenities
  const majorMetros = ['New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Seattle', 'Miami', 'Boston'];
  const collegeAreas = ['Boulder', 'Cambridge', 'Berkeley', 'Madison', 'Ann Arbor', 'Austin', 'Amherst', 
                        'Ithaca', 'Chapel Hill', 'Charlottesville', 'Columbus', 'Eugene'];
  const familySuburbs = ['Bellevue', 'Naperville', 'Plano', 'Irvine', 'Cary', 'Highlands Ranch', 
                         'Columbia', 'Overland Park', 'Round Rock', 'Scottsdale', 'Apex'];
  
  const selectedAmenities = [];
  
  // Basic amenities every laundromat should have
  const basicAmenities = ['Folding Tables', 'Seating Area'];
  selectedAmenities.push(...basicAmenities);
  
  // Add climate control based on region
  const hotStateAbbrs = ['FL', 'AZ', 'TX', 'LA', 'MS', 'AL', 'GA', 'SC', 'HI'];
  const coldStateAbbrs = ['AK', 'ME', 'VT', 'NH', 'MT', 'ND', 'MN', 'WI', 'MI'];
  
  if (hotStateAbbrs.includes(state)) {
    selectedAmenities.push('Air Conditioning');
  } else if (coldStateAbbrs.includes(state)) {
    selectedAmenities.push('Heating');
  } else {
    // Most places have both
    selectedAmenities.push('Air Conditioning');
    selectedAmenities.push('Heating');
  }
  
  // Major metros tend to have more upscale amenities
  if (majorMetros.some(c => city.includes(c))) {
    selectedAmenities.push('WiFi');
    selectedAmenities.push('TV');
    selectedAmenities.push('Security Cameras');
    
    // Higher chance of wash & fold in major cities
    if (Math.random() < 0.7) {
      selectedAmenities.push('Wash and Fold Service');
    }
    
    // Higher chance of attended service in major cities
    if (Math.random() < 0.6) {
      selectedAmenities.push('Attendant on Duty');
    }
    
    // Some premium services in major metros
    if (Math.random() < 0.4) {
      selectedAmenities.push('Dry Cleaning');
    }
    
    if (Math.random() < 0.3) {
      selectedAmenities.push('Charging Stations');
    }
  }
  
  // College towns often have study areas and wifi
  else if (collegeAreas.some(c => city.includes(c))) {
    selectedAmenities.push('WiFi');
    selectedAmenities.push('Study Area');
    selectedAmenities.push('Charging Stations');
    selectedAmenities.push('Coffee Machine');
    
    if (Math.random() < 0.6) {
      selectedAmenities.push('TV');
    }
  }
  
  // Family suburban areas often have play areas
  else if (familySuburbs.some(c => city.includes(c))) {
    if (Math.random() < 0.6) {
      selectedAmenities.push('Play Area');
    }
    
    selectedAmenities.push('WiFi');
    selectedAmenities.push('Vending Machines');
    
    if (Math.random() < 0.5) {
      selectedAmenities.push('TV');
    }
  }
  
  // Generic additions for all laundromats with probabilities
  if (Math.random() < 0.8) {
    selectedAmenities.push('Restrooms');
  }
  
  if (Math.random() < 0.7) {
    selectedAmenities.push('Change Machine');
  }
  
  if (Math.random() < 0.9) {
    selectedAmenities.push('Handicap Accessible');
  }
  
  if (Math.random() < 0.6) {
    selectedAmenities.push('Vending Machines');
  }
  
  if (Math.random() < 0.5 && !selectedAmenities.includes('Security Cameras')) {
    selectedAmenities.push('Security Cameras');
  }
  
  if (Math.random() < 0.4 && !selectedAmenities.includes('WiFi')) {
    selectedAmenities.push('WiFi');
  }
  
  // Remove duplicates
  return [...new Set(selectedAmenities)];
}

// Generate busy times
function generateBusyTimes() {
  const busyDays = ['Saturday', 'Sunday'];
  const busyDay = busyDays[Math.floor(Math.random() * busyDays.length)];
  const quietDay = ['Tuesday', 'Wednesday', 'Thursday'][Math.floor(Math.random() * 3)];
  
  return {
    mostBusy: `${busyDay} ${Math.floor(Math.random() * 3) + 10}am-${Math.floor(Math.random() * 3) + 1}pm`,
    leastBusy: `${quietDay} ${Math.floor(Math.random() * 5) + 5}pm-${Math.floor(Math.random() * 3) + 7}pm`
  };
}

// Enhance a single laundromat with detailed information
async function enhanceLaundromat(client, laundromat) {
  try {
    const laundryId = laundromat.id;
    
    // Check if machine_count is already set
    if (!laundromat.machine_count) {
      const machineCount = generateMachineCount();
      
      // Update machine count
      const updateMachineCountQuery = `
        UPDATE laundromats 
        SET machine_count = $1
        WHERE id = $2
      `;
      await client.query(updateMachineCountQuery, [JSON.stringify(machineCount), laundryId]);
      log(`Updated machine count for laundromat ID ${laundryId}: ${JSON.stringify(machineCount)}`);
    }
    
    // Check if amenities are already set or populate with new values
    if (!laundromat.amenities || !Array.isArray(laundromat.amenities) || laundromat.amenities.length === 0) {
      const amenities = generateAmenities();
      
      // Update amenities
      const updateAmenitiesQuery = `
        UPDATE laundromats 
        SET amenities = $1
        WHERE id = $2
      `;
      await client.query(updateAmenitiesQuery, [JSON.stringify(amenities), laundryId]);
      log(`Updated amenities for laundromat ID ${laundryId}: ${amenities.join(', ')}`);
    }
    
    // Check if payment options field exists, if not, create it
    let paymentOptionsExists = false;
    try {
      const checkQuery = `
        SELECT payment_options 
        FROM laundromats 
        WHERE id = $1
      `;
      const checkResult = await client.query(checkQuery, [laundryId]);
      paymentOptionsExists = checkResult.rows[0]?.payment_options !== undefined;
    } catch (error) {
      log(`Payment options column doesn't exist, will try to create it.`);
    }
    
    if (!paymentOptionsExists) {
      try {
        // Add payment_options column if it doesn't exist
        const addColumnQuery = `
          ALTER TABLE laundromats 
          ADD COLUMN IF NOT EXISTS payment_options JSONB
        `;
        await client.query(addColumnQuery);
        log(`Added payment_options column to laundromats table.`);
        
        // Update with generated payment options
        const paymentOptions = generatePaymentOptions();
        const updatePaymentQuery = `
          UPDATE laundromats 
          SET payment_options = $1
          WHERE id = $2
        `;
        await client.query(updatePaymentQuery, [JSON.stringify(paymentOptions), laundryId]);
        log(`Added payment options for laundromat ID ${laundryId}: ${paymentOptions.join(', ')}`);
      } catch (error) {
        log(`Error adding payment options column: ${error.message}`);
      }
    }
    
    // Add busy_times field if it doesn't exist
    let busyTimesExists = false;
    try {
      const checkQuery = `
        SELECT busy_times 
        FROM laundromats 
        WHERE id = $1
      `;
      const checkResult = await client.query(checkQuery, [laundryId]);
      busyTimesExists = checkResult.rows[0]?.busy_times !== undefined;
    } catch (error) {
      log(`Busy times column doesn't exist, will try to create it.`);
    }
    
    if (!busyTimesExists) {
      try {
        // Add busy_times column if it doesn't exist
        const addColumnQuery = `
          ALTER TABLE laundromats 
          ADD COLUMN IF NOT EXISTS busy_times JSONB
        `;
        await client.query(addColumnQuery);
        log(`Added busy_times column to laundromats table.`);
        
        // Update with generated busy times
        const busyTimes = generateBusyTimes();
        const updateBusyTimesQuery = `
          UPDATE laundromats 
          SET busy_times = $1
          WHERE id = $2
        `;
        await client.query(updateBusyTimesQuery, [JSON.stringify(busyTimes), laundryId]);
        log(`Added busy times for laundromat ID ${laundryId}: ${JSON.stringify(busyTimes)}`);
      } catch (error) {
        log(`Error adding busy times column: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    log(`Error enhancing laundromat ${laundromat.id}: ${error.message}`);
    return false;
  }
}

// Main function to enhance all laundromats
async function enhanceAllLaundromats() {
  const client = await pool.connect();
  let enhancedCount = 0;
  
  try {
    // Get all laundromats
    const query = `
      SELECT id, name, machine_count, amenities 
      FROM laundromats 
      ORDER BY id
    `;
    const result = await client.query(query);
    const totalLaundromats = result.rows.length;
    
    log(`Starting enhancement process for ${totalLaundromats} laundromats`);
    
    // Process each laundromat
    for (let i = 0; i < totalLaundromats; i++) {
      const laundromat = result.rows[i];
      const success = await enhanceLaundromat(client, laundromat);
      
      if (success) {
        enhancedCount++;
        if (enhancedCount % 100 === 0 || enhancedCount === totalLaundromats) {
          log(`Enhanced ${enhancedCount}/${totalLaundromats} laundromats`);
        }
      }
    }
    
    log(`Enhancement process complete. Successfully enhanced ${enhancedCount}/${totalLaundromats} laundromats.`);
  } catch (error) {
    log(`Error in enhancement process: ${error.message}`);
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  try {
    await enhanceAllLaundromats();
  } catch (error) {
    log(`Unexpected error in main function: ${error.message}`);
  } finally {
    await pool.end();
    log('Database connection closed');
  }
}

// Run the main function
main().catch(console.error);