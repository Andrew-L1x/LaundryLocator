/**
 * Merge State Duplicates Script
 * 
 * This script merges duplicate state records where the same state appears
 * with both its full name and abbreviation.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mapping of state abbreviations to full names
const STATE_MAPPING = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

// Pairs to merge (abbreviation, full name)
const STATE_PAIRS_TO_MERGE = Object.entries(STATE_MAPPING).map(([abbr, fullName]) => {
  return { abbr, fullName };
});

async function mergeStateDuplicates() {
  console.log('Starting state duplicate merging process...');
  const client = await pool.connect();
  
  try {
    // Get current state of the database
    const stateCountsBefore = await client.query(
      'SELECT state, COUNT(*) FROM laundromats GROUP BY state ORDER BY COUNT(*) DESC'
    );
    console.log('Current state distribution:');
    for (const row of stateCountsBefore.rows) {
      console.log(`${row.state}: ${row.count} laundromats`);
    }
    
    // Process each state pair
    for (const { abbr, fullName } of STATE_PAIRS_TO_MERGE) {
      await client.query('BEGIN');
      
      try {
        // Check if both versions exist
        const checkResult = await client.query(
          'SELECT state, COUNT(*) FROM laundromats WHERE state = $1 OR state = $2 GROUP BY state',
          [abbr, fullName]
        );
        
        if (checkResult.rows.length > 1) {
          console.log(`Found duplicate states for ${fullName} (${abbr})`);
          
          // Get the count of laundromats for each version
          const abbrCount = checkResult.rows.find(row => row.state === abbr)?.count || 0;
          const fullNameCount = checkResult.rows.find(row => row.state === fullName)?.count || 0;
          console.log(`- ${abbr}: ${abbrCount} laundromats`);
          console.log(`- ${fullName}: ${fullNameCount} laundromats`);
          
          // Update all laundromats with abbreviation to use full name
          const updateResult = await client.query(
            'UPDATE laundromats SET state = $1 WHERE state = $2',
            [fullName, abbr]
          );
          console.log(`- Updated ${updateResult.rowCount} laundromats from ${abbr} to ${fullName}`);
          
          // Check if state record with abbreviation exists
          const stateCheck = await client.query(
            'SELECT id, laundry_count FROM states WHERE abbr = $1 OR name = $2',
            [abbr, fullName]
          );
          
          if (stateCheck.rows.length > 1) {
            const abbrStateId = stateCheck.rows.find(row => row.abbr === abbr)?.id;
            const fullNameStateId = stateCheck.rows.find(row => row.name === fullName)?.id;
            
            // Combine laundry counts and update the full name state record
            const totalLaundryCount = abbrCount + fullNameCount;
            await client.query(
              'UPDATE states SET laundry_count = $1 WHERE name = $2',
              [totalLaundryCount, fullName]
            );
            console.log(`- Updated laundry count for ${fullName} to ${totalLaundryCount}`);
            
            // Delete the abbreviation state record if it exists separately
            if (abbrStateId) {
              await client.query('DELETE FROM states WHERE id = $1', [abbrStateId]);
              console.log(`- Deleted duplicate state record for ${abbr}`);
            }
          }
        }
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error processing ${fullName} (${abbr}): ${error.message}`);
      }
    }
    
    // Get final state of the database
    const stateCountsAfter = await client.query(
      'SELECT state, COUNT(*) FROM laundromats GROUP BY state ORDER BY COUNT(*) DESC'
    );
    console.log('\nFinal state distribution:');
    for (const row of stateCountsAfter.rows) {
      console.log(`${row.state}: ${row.count} laundromats`);
    }
    
    // Update all state counts to match actual laundromat counts
    await client.query('BEGIN');
    console.log('\nUpdating all state laundry counts...');
    const stateUpdateResult = await client.query(`
      UPDATE states s
      SET laundry_count = counts.count
      FROM (
        SELECT state, COUNT(*) as count
        FROM laundromats
        GROUP BY state
      ) counts
      WHERE s.name = counts.state
    `);
    await client.query('COMMIT');
    console.log(`Updated ${stateUpdateResult.rowCount} state records with correct laundry counts`);
    
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the merge process
mergeStateDuplicates().then(() => {
  console.log('State duplicate merging completed successfully.');
}).catch(error => {
  console.error(`Unhandled error: ${error.stack}`);
  process.exit(1);
});