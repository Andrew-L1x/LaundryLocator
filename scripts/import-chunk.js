/**
 * Import a chunk of laundromat records in a single run
 * 
 * This script processes a specified number of records from a specific state
 * and can be run multiple times to gradually import all data.
 */

import { Pool } from 'pg';
import xlsx from 'xlsx';
import dotenv from 'dotenv';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

// Settings - adjust these to control the import
const CHUNK_SIZE = 200; // Number of records to process per run
const STATE_TO_PROCESS = process.argv[2] || 'TX'; // Default to Texas if not specified
const RESUME_OFFSET = parseInt(process.argv[3] || '0'); // Starting offset
const EXCEL_FILE = './attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx';

// Track progress to file
const getOffsetFile = (state) => `./${state.toLowerCase()}-offset.txt`;

// State mapping for full names
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

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function getStateNameFromAbbr(abbr) {
  return STATE_MAPPING[abbr] || abbr;
}

function generateSlug(name, city, state) {
  if (!name) return '';
  
  const base = (name + '-' + city + '-' + state)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return base;
}

function generateSeoTags(record) {
  const tags = [];
  
  // Location-based tags
  tags.push(`laundromat in ${record.city}`);
  tags.push(`laundromat in ${record.city} ${record.state}`);
  tags.push(`${record.city} laundry services`);
  tags.push(`${record.city} laundromat`);
  tags.push(`laundromat near me ${record.city}`);
  tags.push(`coin laundry ${record.city}`);
  
  // Service-based tags
  if (record.services && record.services.length > 0) {
    record.services.forEach(service => {
      tags.push(`${service} in ${record.city}`);
    });
  }
  
  // Feature-based tags
  if (record.open24Hours) tags.push('24 hour laundromat');
  if (record.attendant) tags.push('attended laundromat');
  if (record.wifi) tags.push('laundromat with wifi');
  if (record.dropOffService) tags.push('drop-off laundry service');
  
  return tags.filter(Boolean).join(',');
}

function generateSeoDescription(record) {
  let description = `${record.name} is a laundromat located in ${record.city}, ${record.state_full || record.state}`;
  
  if (record.address) {
    description += ` at ${record.address}`;
  }
  
  if (record.rating && record.ratingCount) {
    description += `. Rated ${record.rating}/5 based on ${record.ratingCount} reviews`;
  }
  
  // Add hours if available
  if (record.hours) {
    if (record.open24Hours) {
      description += `. Open 24 hours a day for your convenience`;
    } else {
      description += `. ${record.hours}`;
    }
  }
  
  // Add services
  if (record.services && record.services.length > 0) {
    description += `. Services include: ${record.services.join(', ')}`;
  }
  
  // Add features
  const features = [];
  if (record.wifi) features.push('free WiFi');
  if (record.attendant) features.push('attended service');
  if (record.dropOffService) features.push('drop-off laundry');
  
  if (features.length > 0) {
    description += `. Features: ${features.join(', ')}`;
  }
  
  description += `. Call ${record.phone} for more information.`;
  
  return description;
}

function generateSeoTitle(record) {
  let title = `${record.name} - Laundromat in ${record.city}, ${record.state}`;
  
  // Add a key feature if available
  if (record.open24Hours) {
    title = `${record.name} - 24 Hour Laundromat in ${record.city}, ${record.state}`;
  } else if (record.dropOffService) {
    title = `${record.name} - Drop-off Laundry Service in ${record.city}, ${record.state}`;
  }
  
  return title;
}

async function processChunk() {
  console.log(`Processing ${CHUNK_SIZE} records for state ${STATE_TO_PROCESS} starting at offset ${RESUME_OFFSET}`);
  
  try {
    // Load Excel workbook
    console.log('Loading Excel file...');
    const workbook = xlsx.readFile(EXCEL_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    
    // Filter records for current state
    const stateAbbr = STATE_TO_PROCESS;
    const stateName = getStateNameFromAbbr(stateAbbr);
    console.log(`Filtering for state ${stateAbbr} (${stateName})...`);
    
    const stateRecords = jsonData.filter(record => 
      record.state === stateAbbr || 
      record.state === stateName
    );
    
    console.log(`Found ${stateRecords.length} records for ${stateAbbr}`);
    
    if (stateRecords.length === 0) {
      console.log('No records found for this state');
      return;
    }
    
    // Get chunk of records
    const endIndex = Math.min(RESUME_OFFSET + CHUNK_SIZE, stateRecords.length);
    const chunk = stateRecords.slice(RESUME_OFFSET, endIndex);
    
    console.log(`Processing ${chunk.length} records from index ${RESUME_OFFSET} to ${endIndex - 1}`);
    
    if (chunk.length === 0) {
      console.log('No more records to process for this state');
      return;
    }
    
    // Process records
    const client = await pool.connect();
    let importedCount = 0;
    
    try {
      await client.query('BEGIN');
      
      // Get or create state
      const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
      
      const stateResult = await client.query(
        'INSERT INTO states (name, slug, abbr) VALUES ($1, $2, $3) ON CONFLICT (abbr) DO UPDATE SET name = $1, slug = $2 RETURNING id',
        [stateName, stateSlug, stateAbbr]
      );
      
      const stateId = stateResult.rows[0].id;
      
      // Create a map to track cities
      const cityMap = new Map();
      
      // Process each record
      for (const record of chunk) {
        try {
          // Get or create city
          let cityId;
          const cityName = record.city ? record.city.trim() : 'Unknown';
          
          if (cityMap.has(cityName)) {
            cityId = cityMap.get(cityName);
          } else {
            const citySlug = cityName.toLowerCase().replace(/\s+/g, '-');
            
            const cityResult = await client.query(
              'INSERT INTO cities (name, slug, state_id) VALUES ($1, $2, $3) ON CONFLICT (name, state_id) DO UPDATE SET slug = $2 RETURNING id',
              [cityName, citySlug, stateId]
            );
            
            cityId = cityResult.rows[0].id;
            cityMap.set(cityName, cityId);
          }
          
          // Generate slug
          const slug = generateSlug(record.title, cityName, stateName);
          
          // Parse services
          let services = [];
          if (record.services && typeof record.services === 'string') {
            services = record.services.split(',').map(s => s.trim()).filter(Boolean);
          }
          
          // Prepare additional fields
          const open24Hours = (record.hours && record.hours.toLowerCase().includes('24 hour')) || 
                              (record.title && record.title.toLowerCase().includes('24 hour'));
          
          const dropOffService = services.some(s => 
            s.toLowerCase().includes('drop') && s.toLowerCase().includes('off')
          );
          
          const pickup = services.some(s => 
            s.toLowerCase().includes('pickup') || s.toLowerCase().includes('pick up')
          );
          
          const delivery = services.some(s => 
            s.toLowerCase().includes('delivery')
          );
          
          const dryClean = services.some(s => 
            s.toLowerCase().includes('dry clean')
          );
          
          const wifi = services.some(s => 
            s.toLowerCase().includes('wifi') || s.toLowerCase().includes('wi-fi')
          );
          
          const attendant = services.some(s => 
            s.toLowerCase().includes('attendant') || s.toLowerCase().includes('attended')
          );
          
          // Generate SEO data
          const seoTitle = generateSeoTitle({
            ...record,
            name: record.title,
            city: cityName,
            state: stateAbbr,
            state_full: stateName,
            services,
            open24Hours,
            dropOffService
          });
          
          const seoDescription = generateSeoDescription({
            ...record,
            name: record.title,
            city: cityName,
            state: stateAbbr,
            state_full: stateName,
            services,
            open24Hours,
            wifi,
            attendant,
            dropOffService
          });
          
          const seoTags = generateSeoTags({
            ...record,
            name: record.title,
            city: cityName,
            state: stateAbbr,
            state_full: stateName,
            services,
            open24Hours,
            wifi,
            attendant,
            dropOffService
          });
          
          // Calculate premium score
          let premiumScore = 0;
          
          if (record.rating) {
            premiumScore += parseFloat(record.rating) * 10;
          }
          
          if (record.ratingCount) {
            premiumScore += Math.min(parseInt(record.ratingCount) / 10, 20);
          }
          
          if (services && services.length > 0) {
            premiumScore += services.length * 5;
          }
          
          if (open24Hours) premiumScore += 15;
          if (dropOffService) premiumScore += 10;
          if (pickup) premiumScore += 10;
          if (delivery) premiumScore += 10;
          if (dryClean) premiumScore += 5;
          if (wifi) premiumScore += 5;
          if (attendant) premiumScore += 5;
          
          premiumScore = Math.min(Math.round(premiumScore), 100);
          
          // Insert laundromat record
          await client.query(
            `INSERT INTO laundromats (
              name, slug, address, city, state, zip, phone, website, 
              latitude, longitude, hours, rating, rating_count, premium_score,
              description, seo_title, seo_description, seo_tags, services,
              open_24_hours, drop_off_service, pickup, delivery, dry_clean, 
              wifi, attendant, city_id, state_id, is_premium
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 
              $9, $10, $11, $12, $13, $14,
              $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24,
              $25, $26, $27, $28, $29
            ) ON CONFLICT (slug) DO NOTHING`,
            [
              record.title, slug, record.address, cityName, stateName, record.zipcode, 
              record.phone, record.website || null, record.latitude, record.longitude,
              record.hours || null, record.rating || null, record.ratingCount || null, premiumScore,
              record.description || seoDescription, seoTitle, seoDescription, seoTags, services,
              open24Hours, dropOffService, pickup, delivery, dryClean,
              wifi, attendant, cityId, stateId, false
            ]
          );
          
          importedCount++;
        } catch (error) {
          console.error(`Error processing record: ${error.message}`);
        }
      }
      
      // Update city and state laundry counts
      await client.query(
        'UPDATE cities c SET laundry_count = (SELECT COUNT(*) FROM laundromats l WHERE l.city_id = c.id)'
      );
      
      await client.query(
        'UPDATE states s SET laundry_count = (SELECT COUNT(*) FROM laundromats l WHERE l.state_id = s.id)'
      );
      
      await client.query('COMMIT');
      
      // Save next offset to file
      const nextOffset = RESUME_OFFSET + chunk.length;
      await fs.writeFile(getOffsetFile(STATE_TO_PROCESS), nextOffset.toString());
      
      console.log(`Successfully imported ${importedCount} records`);
      console.log(`Next offset for ${STATE_TO_PROCESS}: ${nextOffset}`);
      
      const percentComplete = (nextOffset / stateRecords.length * 100).toFixed(2);
      console.log(`Progress for ${STATE_TO_PROCESS}: ${percentComplete}% (${nextOffset} of ${stateRecords.length})`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Transaction error: ${error.message}`);
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Run the import
processChunk().catch(console.error);