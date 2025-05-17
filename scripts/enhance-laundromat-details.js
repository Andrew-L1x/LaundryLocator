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

// Generate machine count data
function generateMachineCount() {
  return {
    washers: Math.floor(Math.random() * 15) + 5, // 5-20 washers
    dryers: Math.floor(Math.random() * 12) + 5,  // 5-16 dryers
  };
}

// Generate payment options
function generatePaymentOptions() {
  const allOptions = ['Cash', 'Credit Card', 'Debit Card', 'Mobile App', 'Coin', 'Card Operated', 'Dollar Bill'];
  const selectedCount = Math.floor(Math.random() * 3) + 2; // 2-4 payment options
  const selectedOptions = [];
  
  // Always include Cash
  selectedOptions.push('Cash');
  
  // Add Credit/Debit card with 80% probability
  if (Math.random() < 0.8) {
    selectedOptions.push('Credit Card');
    selectedOptions.push('Debit Card');
  }
  
  // Add remaining options randomly
  while (selectedOptions.length < selectedCount) {
    const option = allOptions[Math.floor(Math.random() * allOptions.length)];
    if (!selectedOptions.includes(option)) {
      selectedOptions.push(option);
    }
  }
  
  return selectedOptions;
}

// Generate amenities
function generateAmenities() {
  const allAmenities = [
    'WiFi', 'Seating Area', 'Air Conditioning', 'Heating', 'Restrooms', 
    'TV', 'Vending Machines', 'Handicap Accessible', 'Folding Tables',
    'Change Machine', 'Attendant on Duty', 'Security Cameras'
  ];
  
  const selectedCount = Math.floor(Math.random() * 6) + 5; // 5-10 amenities
  const selectedAmenities = [];
  
  // Always include these core amenities
  const coreAmenities = ['WiFi', 'Seating Area', 'Air Conditioning', 'Heating', 'Folding Tables'];
  selectedAmenities.push(...coreAmenities);
  
  // Add remaining amenities randomly
  while (selectedAmenities.length < selectedCount) {
    const amenity = allAmenities[Math.floor(Math.random() * allAmenities.length)];
    if (!selectedAmenities.includes(amenity)) {
      selectedAmenities.push(amenity);
    }
  }
  
  return selectedAmenities;
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