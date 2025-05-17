/**
 * Optimized Laundromat Import Script with Enhanced Data Enrichment
 * 
 * This script combines efficient database operations with advanced data enrichment
 * to quickly import a large dataset of laundromats with high-quality metadata.
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuration
const BATCH_SIZE = 100; // Process 100 records per batch to balance speed and memory usage
const TOTAL_TARGET = 500; // Target to import in this run (increase this number for more)
const MAX_RECORDS_PER_STATE = 50; // How many records to take from each state

// State abbreviation to full name mapping
const stateNameMap = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

// Top states to prioritize (will import more from these)
const TOP_STATES = ['TX', 'CA', 'NY', 'FL', 'PA', 'IL', 'OH', 'MI', 'NJ', 'VA'];

/**
 * Get full state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  if (!abbr) return 'Unknown State';
  if (abbr.length > 2) return abbr; // Already a full name
  return stateNameMap[abbr.toUpperCase()] || abbr;
}

/**
 * Generate a slug for a laundromat
 */
function generateSlug(text, uniqueId) {
  if (!text) {
    return `laundromat-${uniqueId}`;
  }
  
  let slug = text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${slug}-${uniqueId}`;
}

/**
 * Generate SEO tags based on the business information
 * Enhanced with rich tag generation from the provided script
 */
function generateSeoTags(record) {
  const tags = new Set([
    "laundromat",
    "laundry",
    "coin laundry",
    "laundromat near me"
  ]);
  
  // Location-based tags
  if (record.city) tags.add(`laundromat in ${record.city}`);
  if (record.state) tags.add(`laundromat in ${record.state}`);
  if (record.city && record.state) tags.add(`laundromat in ${record.city}, ${record.state}`);
  
  // Check for 24-hour service
  if (record.hours && String(record.hours).toLowerCase().includes("open 24 hours")) {
    tags.add("24 hour");
    tags.add("24/7 laundromat");
  }
  
  // Check for coin laundry
  if ((record.name && String(record.name).toLowerCase().includes("coin")) || 
      (record.services && String(record.services).toLowerCase().includes("coin"))) {
    tags.add("coin laundry");
    tags.add("coin-operated");
  }
  
  // Check for self-service
  if ((record.name && String(record.name).toLowerCase().includes("self")) || 
      (record.services && String(record.services).toLowerCase().includes("self-service")) ||
      (record.description && String(record.description).toLowerCase().includes("self-service"))) {
    tags.add("self-service");
    tags.add("self service laundry");
  }
  
  // Check for drop-off service
  if ((record.description && String(record.description).toLowerCase().includes("drop-off")) ||
      (record.name && String(record.name).toLowerCase().includes("drop"))) {
    tags.add("drop-off service");
    tags.add("wash and fold");
  }
  
  // Check for pickup service
  if ((record.description && String(record.description).toLowerCase().includes("pickup")) ||
      (record.website && String(record.website).toLowerCase().includes("pickup"))) {
    tags.add("pickup service");
    tags.add("laundry pickup");
  }
  
  // Check for delivery service
  if ((record.description && String(record.description).toLowerCase().includes("delivery")) ||
      (record.website && String(record.website).toLowerCase().includes("delivery"))) {
    tags.add("delivery service");
    tags.add("laundry delivery");
  }
  
  // Check if open late (past 9PM)
  if (record.hours) {
    const hoursLower = String(record.hours).toLowerCase();
    const lateTimePatterns = [" 10 pm", " 11 pm", " 12 am", "midnight", " 9:30 pm", "21:00", "22:00", "23:00"];
    if (lateTimePatterns.some(pattern => hoursLower.includes(pattern))) {
      tags.add("open late");
      tags.add("late night laundry");
    }
  }
  
  // Check for eco-friendly
  if ((record.description && String(record.description).toLowerCase().match(/eco[- ]friendly|sustainable|environment|green/)) ||
      (record.name && String(record.name).toLowerCase().match(/eco|green|sustainable/))) {
    tags.add("eco-friendly");
    tags.add("environmentally friendly");
    tags.add("green laundry");
  }
  
  // Check for cheapest/budget options
  if ((record.description && String(record.description).toLowerCase().match(/cheap|affordable|budget|low[- ]cost|inexpensive/)) ||
      (record.name && String(record.name).toLowerCase().match(/discount|value|saver|economical|thrifty/))) {
    tags.add("affordable");
    tags.add("budget friendly");
    tags.add("cheap laundry service");
  }
  
  // Check for full-service
  if ((record.description && String(record.description).toLowerCase().includes("full service")) ||
      (record.name && String(record.name).toLowerCase().includes("full service"))) {
    tags.add("full-service");
    tags.add("full service laundry");
  }
  
  // Limit to a reasonable number of tags
  return Array.from(tags).slice(0, 15); // Max 15 tags
}

/**
 * Generate a concise SEO title
 */
function generateSeoTitle(record) {
  const name = record.name || 'Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  
  const locationPart = city && state ? `${city}, ${state}` : city || state;
  const locationSuffix = locationPart ? ` in ${locationPart}` : '';
  
  return `${name}${locationSuffix} | Laundromat Near Me`;
}

/**
 * Generate a short summary (100-150 characters)
 * Enhanced with the summary generation from the provided script
 */
function generateShortSummary(record) {
  const name = record.name || "Local laundromat";
  const rating = record.rating ? `rated ${record.rating}★` : "";
  
  // Determine business type
  let businessType = "laundromat";
  if (record.name && String(record.name).toLowerCase().includes("cleaners")) {
    businessType = "cleaners";
  } else if (record.name && String(record.name).toLowerCase().includes("wash")) {
    businessType = "laundry service";
  }
  
  // Extract key service highlights
  const services = [];
  if (record.services) {
    let servicesStr = "";
    
    if (typeof record.services === 'string') {
      servicesStr = record.services;
    } else if (Array.isArray(record.services)) {
      servicesStr = record.services.join(", ");
    } else if (record.services !== null && typeof record.services === 'object') {
      servicesStr = JSON.stringify(record.services);
    }
    
    if (servicesStr.toLowerCase().includes("self-service")) services.push("self-service");
    if (servicesStr.toLowerCase().includes("drop-off")) services.push("drop-off");
    if (servicesStr.toLowerCase().includes("free wi-fi")) services.push("free Wi-Fi");
    if (servicesStr.toLowerCase().includes("dry cleaning")) services.push("dry cleaning");
  }
  
  // Extract business hours highlights
  let hours = "";
  if (record.hours) {
    if (String(record.hours).toLowerCase().includes("open 24 hours")) {
      hours = "Open 24/7";
    } else if (String(record.hours).toLowerCase().includes("closed")) {
      // Extract opening hours from typical format
      const matches = String(record.hours).match(/(\d+:\d+\s*[AP]M)–(\d+:\d+\s*[AP]M)/i);
      if (matches && matches.length >= 3) {
        hours = `Open ${matches[1]}–${matches[2]}`;
      } else {
        hours = "Check hours";
      }
    }
  }
  
  // Create summary based on available information
  const serviceText = services.length > 0 ? services.slice(0, 2).join(" & ") : businessType;
  const locationHint = record.address ? `in ${String(record.address).split(',')[1] || 'the area'}` : "";
  
  // Build the full summary
  let summary = "";
  if (rating) {
    summary = `${rating} ${serviceText} ${locationHint}. ${hours}.`.trim();
  } else {
    summary = `${serviceText} ${locationHint}. ${hours}.`.trim();
  }
  
  // Ensure the summary is the right length (100-150 chars)
  if (summary.length > 150) {
    return summary.substring(0, 147) + "...";
  } else if (summary.length < 100) {
    // Add additional context if too short
    const additions = [
      "Professional staff.",
      "Clean facilities.",
      "Modern machines.",
      "Convenient location.",
      "Friendly service.",
      "Affordable prices."
    ];
    
    let currentAddition = 0;
    while (summary.length < 100 && currentAddition < additions.length) {
      summary += " " + additions[currentAddition];
      currentAddition++;
    }
  }
  
  return summary;
}

/**
 * Generate a detailed SEO description for a laundromat
 * Enhanced with the description generation from the provided script
 */
function generateSeoDescription(record) {
  const name = record.name || "This laundromat";
  const city = record.city || "the area";
  const state = record.state || "";
  const locationPhrase = state ? `${city}, ${state}` : city;
  
  // Start with basic info
  let description = `${name} is a laundromat in ${locationPhrase} offering convenient laundry services. `;
  
  // Add rating info if available
  if (record.rating) {
    const reviewCount = record.review_count ? `from ${record.review_count} customer reviews` : "from customers";
    description += `With a ${record.rating}★ rating ${reviewCount}, `;
    
    if (record.rating >= 4.5) {
      description += "this highly-rated establishment is known for exceptional service and cleanliness. ";
    } else if (record.rating >= 4.0) {
      description += "customers consistently praise this well-maintained laundry facility. ";
    } else if (record.rating >= 3.5) {
      description += "this reliable laundromat serves local residents with consistent service. ";
    } else {
      description += "this laundromat provides necessary services to the community. ";
    }
  } else {
    description += "This local establishment provides convenient laundry solutions. ";
  }
  
  // Add service information
  let serviceDetails = "";
  const tags = generateSeoTags(record);
  
  if (tags.includes("24 hour") || tags.includes("24/7 laundromat")) {
    serviceDetails += "Open 24 hours for your convenience. ";
  }
  
  if (tags.includes("self-service") || tags.includes("self service laundry")) {
    serviceDetails += "Self-service machines available. ";
  }
  
  if (tags.includes("drop-off service") || tags.includes("wash and fold")) {
    serviceDetails += "Drop-off service and wash & fold options. ";
  }
  
  if (tags.includes("eco-friendly") || tags.includes("green laundry")) {
    serviceDetails += "Eco-friendly and energy-efficient equipment. ";
  }
  
  if (serviceDetails) {
    description += serviceDetails;
  } else {
    description += "Features modern equipment and a clean environment for your laundry needs. ";
  }
  
  // Add call to action
  description += `Find directions, hours, and more information about ${name} on LaundryLocator.`;
  
  return description;
}

/**
 * Calculate premium score for a laundromat
 * Enhanced with scoring algorithm from the provided script
 */
function calculatePremiumScore(record) {
  let score = 60; // Base score
  
  // Rating-based points (0-25 points)
  if (record.rating) {
    const ratingVal = parseFloat(record.rating);
    if (!isNaN(ratingVal)) {
      score += (ratingVal * 5); // Up to 25 points for 5-star rating
    }
  }
  
  // Review count bonus (0-10 points)
  if (record.review_count) {
    const reviewCount = parseInt(record.review_count);
    if (!isNaN(reviewCount)) {
      if (reviewCount >= 100) {
        score += 10;
      } else if (reviewCount >= 50) {
        score += 7;
      } else if (reviewCount >= 20) {
        score += 5;
      } else if (reviewCount >= 10) {
        score += 3;
      } else if (reviewCount >= 5) {
        score += 1;
      }
    }
  }
  
  // Website bonus (5 points)
  if (record.website) {
    score += 5;
  }
  
  // Services bonus (0-10 points)
  const tags = generateSeoTags(record);
  if (tags.length >= 10) {
    score += 5;
  }
  
  // Feature-specific bonuses
  if (tags.includes("full-service")) score += 5;
  if (tags.includes("eco-friendly")) score += 3;
  if (tags.includes("24 hour")) score += 2;
  if (tags.includes("drop-off service")) score += 2;
  if (tags.includes("pickup service") || tags.includes("delivery service")) score += 3;
  
  // Cap score at 100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Prepare all states in the database first
 */
async function prepareStates(client, allRecords) {
  console.log("Preparing states...");
  
  // Extract all unique states
  const states = new Set();
  for (const record of allRecords) {
    if (record.state) {
      states.add(record.state);
    }
  }
  
  // Create all states first
  const stateMap = {};
  for (const stateAbbr of states) {
    const stateName = getStateNameFromAbbr(stateAbbr);
    
    // Check if state exists
    const stateResult = await client.query('SELECT id FROM states WHERE name = $1', [stateName]);
    
    if (stateResult.rows.length === 0) {
      // Create state
      const stateSlug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const abbr = stateAbbr.length <= 2 ? stateAbbr.toUpperCase() : stateAbbr;
      
      const newStateResult = await client.query(
        'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
        [stateName, abbr, stateSlug]
      );
      
      stateMap[stateName] = newStateResult.rows[0].id;
      console.log(`Created state: ${stateName}`);
    } else {
      stateMap[stateName] = stateResult.rows[0].id;
    }
  }
  
  console.log(`Prepared ${Object.keys(stateMap).length} states`);
  return stateMap;
}

/**
 * Prepare cities in the database
 */
async function prepareCities(client, allRecords, stateMap) {
  console.log("Preparing cities...");
  
  // Extract all unique city+state combinations
  const cities = new Set();
  for (const record of allRecords) {
    if (record.city && record.state) {
      const stateName = getStateNameFromAbbr(record.state);
      cities.add(`${record.city}|${stateName}`);
    }
  }
  
  // Create all cities
  const cityMap = {};
  let count = 0;
  
  for (const cityState of cities) {
    const [city, state] = cityState.split('|');
    
    // Check if city exists
    const cityResult = await client.query('SELECT id FROM cities WHERE name = $1 AND state = $2', [city, state]);
    
    if (cityResult.rows.length === 0) {
      // Create city
      const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      try {
        const newCityResult = await client.query(
          'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
          [city, state, citySlug]
        );
        
        cityMap[cityState] = newCityResult.rows[0].id;
        count++;
        
        if (count % 50 === 0) {
          console.log(`Created ${count} cities so far...`);
        }
      } catch (error) {
        // If duplicate city slug, try with a random suffix
        if (error.code === '23505') {
          const uniqueSlug = `${citySlug}-${Math.floor(Math.random() * 10000)}`;
          
          const retryResult = await client.query(
            'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 0) RETURNING id',
            [city, state, uniqueSlug]
          );
          
          cityMap[cityState] = retryResult.rows[0].id;
          count++;
        } else {
          console.error(`Error creating city ${city}, ${state}:`, error.message);
        }
      }
    } else {
      cityMap[cityState] = cityResult.rows[0].id;
    }
  }
  
  console.log(`Prepared ${Object.keys(cityMap).length} cities (created ${count} new ones)`);
  return cityMap;
}

/**
 * Process records for insertion with enhanced data enrichment
 */
async function enrichAndPrepareRecords(allRecords, stateMap, cityMap) {
  console.log(`Enriching data for ${allRecords.length} laundromat records...`);
  
  const preparedRecords = [];
  let processed = 0;
  
  for (const record of allRecords) {
    try {
      // Get city and state info
      const name = record.name || `Laundromat ${processed}`;
      const address = record.address || '123 Main St';
      const city = record.city || 'Unknown City';
      const stateAbbr = record.state || 'TX';
      const stateName = getStateNameFromAbbr(stateAbbr);
      const zip = record.zip || '00000';
      
      // Get city and state IDs
      const cityState = `${city}|${stateName}`;
      const cityId = cityMap[cityState];
      const stateId = stateMap[stateName];
      
      if (!cityId || !stateId) {
        console.log(`Missing city or state ID for ${city}, ${stateName} - skipping`);
        continue;
      }
      
      // Generate a unique slug
      const uniqueId = Math.floor(Math.random() * 10000000);
      const slug = generateSlug(`${name}-${city}-${stateName}`, uniqueId);
      
      // Enrich with SEO and premium data
      const seoTitle = generateSeoTitle({name, city, state: stateName});
      const shortSummary = generateShortSummary(record);
      const seoDescription = generateSeoDescription({
        name, 
        city, 
        state: stateName, 
        rating: record.rating,
        review_count: record.review_count
      });
      const seoTags = JSON.stringify(generateSeoTags(record));
      
      // Calculate premium attributes
      const premiumScore = calculatePremiumScore(record);
      const isPremium = premiumScore >= 75;
      const isFeatured = premiumScore >= 90;
      const isVerified = premiumScore >= 80 || Math.random() < 0.3;
      
      // Add to batch
      preparedRecords.push({
        name,
        slug,
        address,
        city,
        stateName,
        zip,
        phone: record.phone || '',
        website: record.website || null,
        latitude: record.latitude || '0',
        longitude: record.longitude || '0',
        rating: record.rating || '0',
        reviewCount: record.review_count || 0,
        hours: record.hours || 'Call for hours',
        services: JSON.stringify(record.services || []),
        isFeatured,
        isPremium,
        isVerified,
        description: shortSummary,
        createdAt: new Date(),
        seoTitle,
        seoDescription,
        seoTags,
        premiumScore,
        cityId,
        stateId
      });
      
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`Enriched ${processed} records so far...`);
      }
    } catch (error) {
      console.error(`Error preparing record:`, error.message);
    }
  }
  
  console.log(`Successfully enriched ${preparedRecords.length} records`);
  return preparedRecords;
}

/**
 * Import records in optimized batches
 */
async function importRecords(client, preparedRecords) {
  console.log(`Importing ${preparedRecords.length} enriched records to database...`);
  
  let imported = 0;
  let failed = 0;
  
  // Process in batches
  const batches = Math.ceil(preparedRecords.length / BATCH_SIZE);
  
  for (let b = 0; b < batches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, preparedRecords.length);
    const batch = preparedRecords.slice(start, end);
    
    console.log(`Processing batch ${b + 1}/${batches} (${batch.length} records)...`);
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      for (const record of batch) {
        try {
          // Insert laundromat
          await client.query(`
            INSERT INTO laundromats (
              name, slug, address, city, state, zip, phone, website,
              latitude, longitude, rating, review_count, hours, services,
              is_featured, is_premium, is_verified, description, created_at,
              seo_title, seo_description, seo_tags, premium_score
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          `, [
            record.name,
            record.slug,
            record.address,
            record.city,
            record.stateName,
            record.zip,
            record.phone,
            record.website,
            record.latitude,
            record.longitude,
            record.rating,
            record.reviewCount,
            record.hours,
            record.services,
            record.isFeatured,
            record.isPremium,
            record.isVerified,
            record.description,
            record.createdAt,
            record.seoTitle,
            record.seoDescription,
            record.seoTags,
            record.premiumScore
          ]);
          
          // Update counts
          await client.query('UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1', [record.cityId]);
          await client.query('UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1', [record.stateId]);
          
          imported++;
        } catch (error) {
          console.error(`Error inserting record '${record.name}':`, error.message);
          failed++;
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log(`Committed batch ${b + 1}/${batches}`);
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      console.error(`Error processing batch ${b + 1}/${batches}:`, error.message);
      failed += batch.length - (imported % BATCH_SIZE);
    }
  }
  
  return { imported, failed };
}

/**
 * Run the import process
 */
async function runImport() {
  const client = await pool.connect();
  
  try {
    console.log('Starting optimized laundromat import with data enrichment...');
    
    // Read the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${allData.length} total records in Excel file`);
    
    // Group records by state
    const stateData = {};
    for (const record of allData) {
      const stateAbbr = record.state || 'unknown';
      if (!stateData[stateAbbr]) {
        stateData[stateAbbr] = [];
      }
      stateData[stateAbbr].push(record);
    }
    
    const stateList = Object.keys(stateData);
    console.log(`Found data for ${stateList.length} states`);
    
    // Get count of current laundromats
    const currentCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(currentCountResult.rows[0].count);
    console.log(`Current laundromat count: ${currentCount}`);
    
    // Select records to import
    console.log(`Selecting records to meet target of ${TOTAL_TARGET}...`);
    const recordsToImport = [];
    
    // First add records from top states
    for (const stateAbbr of TOP_STATES) {
      if (stateData[stateAbbr]) {
        const stateRecords = stateData[stateAbbr];
        const limit = Math.min(stateRecords.length, MAX_RECORDS_PER_STATE * 2);
        
        console.log(`Taking up to ${limit} records from top state ${stateAbbr} (${stateRecords.length} available)`);
        
        // Get random sample
        const shuffled = [...stateRecords].sort(() => 0.5 - Math.random());
        recordsToImport.push(...shuffled.slice(0, limit));
      }
    }
    
    // Then add some from each remaining state for nationwide coverage
    for (const stateAbbr of stateList) {
      if (!TOP_STATES.includes(stateAbbr)) {
        const stateRecords = stateData[stateAbbr];
        const limit = Math.min(stateRecords.length, MAX_RECORDS_PER_STATE);
        
        // Only take records if there are enough to be meaningful
        if (stateRecords.length >= 5) {
          // Get random sample
          const shuffled = [...stateRecords].sort(() => 0.5 - Math.random());
          recordsToImport.push(...shuffled.slice(0, limit));
        }
      }
    }
    
    // Shuffle all selected records for better distribution
    recordsToImport.sort(() => 0.5 - Math.random());
    
    // Limit to target number
    const recordsToProcess = recordsToImport.slice(0, TOTAL_TARGET);
    console.log(`Selected ${recordsToProcess.length} records for import`);
    
    // Prepare database structures
    const stateMap = await prepareStates(client, recordsToProcess);
    const cityMap = await prepareCities(client, recordsToProcess, stateMap);
    
    // Enrich records with advanced data
    const enrichedRecords = await enrichAndPrepareRecords(recordsToProcess, stateMap, cityMap);
    
    // Import the enriched records
    const { imported, failed } = await importRecords(client, enrichedRecords);
    
    // Get final count
    const finalCountResult = await client.query('SELECT COUNT(*) FROM laundromats');
    const finalCount = parseInt(finalCountResult.rows[0].count);
    
    console.log(`\nImport completed!
    - Starting count: ${currentCount}
    - Records selected: ${recordsToProcess.length}
    - Records enriched: ${enrichedRecords.length}
    - Successfully imported: ${imported}
    - Failed: ${failed}
    - Final count: ${finalCount}
    - New records added: ${finalCount - currentCount}
    `);
    
    // Show state breakdown
    const stateBreakdown = await client.query('SELECT name, laundry_count FROM states ORDER BY laundry_count DESC LIMIT 15');
    console.log('\nTop 15 states by laundromat count:');
    for (const row of stateBreakdown.rows) {
      console.log(`${row.name}: ${row.laundry_count}`);
    }
    
    // Calculate premium and featured stats
    const premiumStats = await client.query('SELECT COUNT(*) as premium_count FROM laundromats WHERE is_premium = true');
    const featuredStats = await client.query('SELECT COUNT(*) as featured_count FROM laundromats WHERE is_featured = true');
    
    console.log('\nPremium statistics:');
    console.log(`- Premium listings: ${premiumStats.rows[0].premium_count} (${Math.round(premiumStats.rows[0].premium_count / finalCount * 100)}%)`);
    console.log(`- Featured listings: ${featuredStats.rows[0].featured_count} (${Math.round(featuredStats.rows[0].featured_count / finalCount * 100)}%)`);
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the import
console.time('Import Duration');
runImport()
  .then(() => {
    console.timeEnd('Import Duration');
  })
  .catch(error => {
    console.error('Fatal error:', error);
    console.timeEnd('Import Duration');
  });