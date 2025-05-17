/**
 * Updated Micro-Batch Import Script with Auto-Position Detection
 * 
 * This script imports laundromat data in smaller batches (25 records) 
 * to avoid timeouts, and automatically finds the next position to import.
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
// We'll use direct PostgreSQL connection without Drizzle ORM for this script
// to avoid module import issues
import { eq, and, inArray, sql } from 'drizzle-orm';

// Configure batch size for processing
const BATCH_SIZE = 25;
const INPUT_FILE = '/home/runner/workspace/data/import_ready_laundromats.json';
const PROGRESS_FILE = 'import-progress.json';

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Get state name from abbreviation
 */
function getStateNameFromAbbr(abbr) {
  const stateMap = {
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
  
  return stateMap[abbr] || '';
}

/**
 * Generate a slug from business name and location
 */
function generateSlug(name, city, state) {
  if (!name) return '';
  
  // Basic slug generation
  let slug = name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Add location to make it more unique
  if (city && state) {
    const citySlug = city.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    slug = `${slug}-${citySlug}-${state.toLowerCase()}`;
  }
  
  return slug;
}

/**
 * Generate a set of SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [];
  
  // Location-based tags
  if (record.city && record.state) {
    tags.push(`laundromat in ${record.city}`);
    tags.push(`laundromat in ${record.city}, ${record.state}`);
    tags.push(`${record.city} laundromat`);
    tags.push(`laundry service ${record.city}`);
    tags.push(`laundry near me ${record.city}`);
    tags.push(`laundromat near me ${record.city}`);
  }
  
  // Feature-based tags
  if (record.services && Array.isArray(record.services)) {
    const services = record.services;
    
    if (services.includes('coin_laundry') || services.includes('coin-op')) {
      tags.push('coin laundry');
      tags.push('coin-operated laundromat');
    }
    
    if (services.includes('wash_and_fold') || services.includes('wash_dry_fold')) {
      tags.push('wash and fold service');
      tags.push('laundry service');
    }
    
    if (services.includes('dry_cleaning')) {
      tags.push('dry cleaning service');
    }
    
    if (services.includes('self_service')) {
      tags.push('self-service laundry');
    }
    
    if (services.includes('delivery')) {
      tags.push('laundry delivery service');
      tags.push('laundry pickup and delivery');
    }
  }
  
  // Generic tags
  tags.push('laundromat');
  tags.push('laundry facility');
  tags.push('washing machines');
  tags.push('dryers');
  tags.push('laundry services');
  tags.push('laundromat near me');
  
  // Return unique tags
  return [...new Set(tags)].slice(0, 15);
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  if (!record.name) return '';
  
  let title = record.name;
  
  if (record.city && record.state) {
    title = `${title} - Laundromat in ${record.city}, ${record.state}`;
  }
  
  return title;
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  if (!record.name) return '';
  
  let description = `${record.name} is a laundromat`;
  
  if (record.city && record.state) {
    description += ` located in ${record.city}, ${record.state}`;
  }
  
  if (record.address) {
    description += ` at ${record.address}`;
  }
  
  description += '. ';
  
  // Add service details
  if (record.services && Array.isArray(record.services) && record.services.length > 0) {
    description += 'Services include ';
    
    const serviceMap = {
      'coin_laundry': 'coin-operated machines',
      'coin-op': 'coin-operated machines',
      'wash_and_fold': 'wash and fold service',
      'wash_dry_fold': 'wash, dry, and fold service',
      'dry_cleaning': 'dry cleaning',
      'self_service': 'self-service laundry',
      'delivery': 'pickup and delivery',
      'wifi': 'free WiFi',
      'attendant': 'attended service',
      'large_capacity': 'large capacity machines'
    };
    
    const servicePhrases = record.services
      .map(service => serviceMap[service] || service)
      .filter(Boolean);
    
    if (servicePhrases.length > 0) {
      description += servicePhrases.join(', ') + '. ';
    }
  }
  
  // Add hours if available
  if (record.hours) {
    description += `Business hours: ${record.hours}. `;
  }
  
  // Add contact info if available
  if (record.phone) {
    description += `Contact: ${record.phone}. `;
  }
  
  // Add rating if available
  if (record.rating && record.rating > 0) {
    description += `Rated ${record.rating}/5 based on customer reviews. `;
  }
  
  // Add SEO-friendly closing
  description += 'Looking for a laundromat near me? Visit us today for all your laundry needs.';
  
  return description;
}

/**
 * Calculate premium score for record prioritization
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Rating boost
  if (record.rating) {
    score += record.rating * 10; // Up to 50 points for 5-star rating
  }
  
  // Reviews boost
  if (record.reviews && record.reviews > 0) {
    score += Math.min(record.reviews, 100) / 2; // Up to 50 points for 100+ reviews
  }
  
  // Services boost
  if (record.services && Array.isArray(record.services)) {
    score += record.services.length * 5; // 5 points per service
  }
  
  // Hours boost
  if (record.hours && record.hours.length > 0) {
    score += 10; // 10 points for having hours listed
  }
  
  // Website boost
  if (record.website && record.website.length > 0) {
    score += 15; // 15 points for having a website
  }
  
  // Phone boost
  if (record.phone && record.phone.length > 0) {
    score += 10; // 10 points for having a phone
  }
  
  // Return score, capped at 100
  return Math.min(Math.round(score), 100);
}

/**
 * Save progress state to a file
 */
function saveProgress(position, totalRecords) {
  const progressData = {
    position,
    totalRecords,
    timestamp: new Date().toISOString(),
    recordsImported: position
  };
  
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
}

/**
 * Load progress state from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error.message);
  }
  
  return { position: 0, totalRecords: 0 };
}

/**
 * Process a batch of laundromat records
 */
async function processBatch(records, startPosition, batchSize) {
  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < batchSize && (startPosition + i) < records.length; i++) {
      const record = records[startPosition + i];
      
      try {
        // Validate record
        if (!record.name || !record.city || !record.state) {
          console.log(`Skipping record at position ${startPosition + i} - Missing required fields`);
          skipped++;
          continue;
        }
        
        // Get or create state
        const stateName = getStateNameFromAbbr(record.state) || record.state;
        let stateResult = await client.query(
          'SELECT id FROM states WHERE LOWER(name) = LOWER($1) OR LOWER(abbr) = LOWER($2)',
          [stateName, record.state]
        );
        
        let stateId;
        if (stateResult.rows.length === 0) {
          const stateInsert = await client.query(
            'INSERT INTO states (name, abbr, slug) VALUES ($1, $2, $3) ON CONFLICT (abbr) DO UPDATE SET name = $1 RETURNING id',
            [stateName, record.state, stateName.toLowerCase().replace(/\s+/g, '-')]
          );
          stateId = stateInsert.rows[0].id;
        } else {
          stateId = stateResult.rows[0].id;
        }
        
        // Get or create city
        let cityResult = await client.query(
          'SELECT id FROM cities WHERE LOWER(name) = LOWER($1) AND state_id = $2',
          [record.city, stateId]
        );
        
        let cityId;
        if (cityResult.rows.length === 0) {
          const cityInsert = await client.query(
            'INSERT INTO cities (name, state_id, slug) VALUES ($1, $2, $3) ON CONFLICT (name, state_id) DO UPDATE SET name = $1 RETURNING id',
            [record.city, stateId, record.city.toLowerCase().replace(/\s+/g, '-')]
          );
          cityId = cityInsert.rows[0].id;
        } else {
          cityId = cityResult.rows[0].id;
        }
        
        // Generate slug
        const slug = generateSlug(record.name, record.city, record.state);
        
        // Generate SEO data
        const seoTags = generateSeoTags(record);
        const seoTitle = generateSeoTitle(record);
        const seoDescription = generateSeoDescription(record);
        
        // Calculate premium score
        const premiumScore = calculatePremiumScore(record);
        
        // Normalize services
        let services = [];
        if (record.services && Array.isArray(record.services)) {
          services = record.services;
        } else if (record.services && typeof record.services === 'string') {
          try {
            services = JSON.parse(record.services);
          } catch (e) {
            services = record.services.split(',').map(s => s.trim());
          }
        }
        
        // Normalize is_verified field
        let isVerified = false;
        if (record.is_verified !== undefined) {
          isVerified = !!record.is_verified;
        } else if (record.verified !== undefined) {
          isVerified = !!record.verified;
        }
        
        // Insert laundromat
        await client.query(`
          INSERT INTO laundromats (
            name, slug, address, city, state, zip, phone, website, latitude, longitude,
            rating, reviews, hours, image_url, is_verified, is_premium, premium_score,
            services, city_id, state_id, seo_title, seo_description, seo_tags,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          ON CONFLICT (name, city, state) DO NOTHING
        `, [
          record.name,
          slug,
          record.address || '',
          record.city,
          record.state,
          record.zip || '',
          record.phone || '',
          record.website || '',
          record.latitude || null,
          record.longitude || null,
          record.rating || 0,
          record.reviews || 0,
          record.hours || '',
          record.image_url || '',
          isVerified,
          record.is_premium || false,
          premiumScore,
          JSON.stringify(services),
          cityId,
          stateId,
          seoTitle,
          seoDescription,
          JSON.stringify(seoTags),
          new Date(),
          new Date()
        ]);
        
        imported++;
      } catch (error) {
        console.error(`Error processing record at position ${startPosition + i}:`, error.message);
        errors++;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    return { processed: batchSize, imported, skipped, errors };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch processing error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main function to import a batch of laundromat data
 */
async function importData() {
  console.log('=== Starting Micro-Batch Import ===');
  
  try {
    // Check if data file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`Input file not found: ${INPUT_FILE}`);
      return;
    }
    
    // Read the data file
    console.log(`Reading data from: ${INPUT_FILE}`);
    const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    
    // Load progress
    let progress = loadProgress();
    const startPosition = progress.position || 0;
    
    console.log(`Starting import from position ${startPosition} of ${data.length} total records`);
    
    // Process batch
    console.log(`Processing batch from position ${startPosition} to ${startPosition + BATCH_SIZE - 1} (${BATCH_SIZE} records)...`);
    const result = await processBatch(data, startPosition, BATCH_SIZE);
    
    // Update progress
    const newPosition = startPosition + BATCH_SIZE;
    saveProgress(newPosition, data.length);
    
    // Log results
    console.log(`Batch results: processed ${result.processed}, imported ${result.imported}, skipped ${result.skipped}, errors ${result.errors}`);
    console.log(`Overall progress: ${newPosition}/${data.length} (${Math.round((newPosition / data.length) * 100)}%)`);
    console.log(`Run this script again to continue from position ${newPosition}`);
    
  } catch (error) {
    console.error('Import error:', error.message);
  } finally {
    // Close connection pool
    await pool.end();
    console.log('=== Micro-Batch Import Completed ===');
  }
}

// Run the import
importData().catch(console.error);