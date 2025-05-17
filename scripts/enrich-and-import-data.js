import fs from 'fs-extra';
import path from 'path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// File paths
const INPUT_FILE = 'data/csv_uploads/laundromat_data.csv';
const OUTPUT_FILE = 'data/enriched/enriched_laundromat_data.csv';

// Ensure the output directory exists
fs.ensureDirSync(path.dirname(OUTPUT_FILE));

// Keywords for SEO optimization
const SEO_KEYWORDS = [
  'laundry service near me',
  'laundry mat near me',
  'coin laundry near me',
  'laundry detergent near me',
  'laundry jobs near me',
  '24 hour laundry near me',
  'laundry mats near me',
  'laundry services near me',
  'drop off laundry near me',
  'laundry near me open now',
  'wash and fold laundry service near me',
  'pick up laundry service near me',
  'laundry pick up and delivery near me',
  '24 hr laundry near me',
  'laundry matt near me',
  'drop off laundry service near me',
  'wash and fold laundry',
  '24 hour laundromat near me',
  'laundromat for sale near me',
  'laundromat near me within 5 mi',
  'best laundromat near me',
  'laundromat near me open now',
  'cheapest laundromat near me',
  'laundromat near me within 1 mi',
  'cheap laundromat near me',
  'laundromat open near me',
  'coin laundromat near me',
  'self service laundromat near me',
  '24-hour laundromat near me',
  'closest laundromat near me',
  '24hr laundromat near me',
  'laundromat near me for sale'
];

/**
 * Normalize address for deduplication
 */
function normalizeAddress(address, city, state, zip) {
  return `${address} ${city} ${state} ${zip}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a slug for the laundromat
 */
function generateSlug(name, city, state) {
  // Convert to lowercase, remove special characters, and replace spaces with hyphens
  const namePart = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
  
  const locationPart = `${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
  
  return `${namePart}-${locationPart}`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = ['laundromat'];
  
  // Common laundromat services and features
  const possibleTags = [
    { keyword: 'coin', tag: 'coin operated' },
    { keyword: 'self', tag: 'self-service' },
    { keyword: '24', tag: '24-hour' },
    { keyword: 'hour', tag: '24-hour' },
    { keyword: 'drop', tag: 'drop-off service' },
    { keyword: 'pick', tag: 'pickup service' },
    { keyword: 'delivery', tag: 'delivery service' },
    { keyword: 'fold', tag: 'wash and fold' },
    { keyword: 'dry clean', tag: 'dry cleaning' },
    { keyword: 'attendant', tag: 'attendant on duty' },
    { keyword: 'wifi', tag: 'free wifi' },
    { keyword: 'wi-fi', tag: 'free wifi' },
    { keyword: 'card', tag: 'card payment' },
    { keyword: 'large', tag: 'large capacity' },
    { keyword: 'commercial', tag: 'commercial service' },
    { keyword: 'eco', tag: 'eco-friendly' },
    { keyword: 'organic', tag: 'eco-friendly' },
    { keyword: 'stain', tag: 'stain removal' },
    { keyword: 'repair', tag: 'repairs' },
    { keyword: 'alteration', tag: 'alterations' },
    { keyword: 'snack', tag: 'snack machines' },
    { keyword: 'vending', tag: 'vending machines' },
    { keyword: 'soap', tag: 'soap dispenser' },
    { keyword: 'change', tag: 'change machine' },
    { keyword: 'parking', tag: 'parking available' },
    { keyword: 'new', tag: 'new machines' },
    { keyword: 'clean', tag: 'clean facility' },
    { keyword: 'air', tag: 'air-conditioned' }
  ];
  
  // Check name, description, services for keywords
  const textToSearch = [
    record.name || '',
    record.description || '',
    record.services || '',
    record.features || ''
  ].join(' ').toLowerCase();
  
  for (const { keyword, tag } of possibleTags) {
    if (textToSearch.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Add "near me" tag for SEO
  tags.push('near me');
  
  // Add location tags
  tags.push(`${record.city.toLowerCase()} laundromat`);
  tags.push(`laundromat in ${record.city.toLowerCase()}`);
  
  // Add random popular search keywords for better SEO
  const randomKeywords = SEO_KEYWORDS.sort(() => 0.5 - Math.random()).slice(0, 3);
  tags.push(...randomKeywords);
  
  return tags.join(', ');
}

/**
 * Generate a short SEO summary
 */
function generateSeoSummary(record) {
  const name = record.name || 'Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  
  // Extract key features
  const features = [];
  
  if (record.services) {
    const services = record.services.toLowerCase();
    if (services.includes('24')) features.push('24-hour');
    if (services.includes('drop')) features.push('drop-off');
    if (services.includes('fold')) features.push('wash & fold');
    if (services.includes('dry')) features.push('dry cleaning');
  }
  
  if (features.length === 0) {
    features.push('full-service');
  }
  
  const featuresText = features.length > 0 ? 
    `offering ${features.join(', ')}` : 
    'for all your laundry needs';
  
  const locationText = city && state ? `in ${city}, ${state}` : '';
  
  return `${name} is a conveniently located laundromat ${locationText} ${featuresText}. Clean facilities and modern equipment for a hassle-free laundry experience near you.`.trim();
}

/**
 * Generate a full SEO description
 */
function generateSeoDescription(record) {
  const name = record.name || 'Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  const address = record.full_address || '';
  
  let description = `${name} is a well-maintained laundromat located at ${address}. `;
  
  // Extract any available services based on name or description
  let serviceText = '';
  const nameLower = record.name.toLowerCase();
  
  if (nameLower.includes('coin') || nameLower.includes('self')) {
    serviceText += 'We provide self-service machines for your convenience, allowing you to do laundry on your schedule. ';
  }
  
  if (nameLower.includes('wash & fold') || nameLower.includes('wash and fold') || 
      nameLower.includes('drop') || nameLower.includes('service')) {
    serviceText += 'Our professional wash and fold service saves you time while ensuring your clothes are perfectly cleaned and neatly folded. ';
  }
  
  if (nameLower.includes('dry clean') || nameLower.includes('cleaning')) {
    serviceText += 'We also offer dry cleaning services for your delicate garments that require special care. ';
  }
  
  // If no specific services detected, use a generic description
  if (!serviceText) {
    serviceText = 'We offer a range of machines to handle loads of all sizes, from regular laundry to bulky items like comforters and blankets. ';
  }
  
  description += serviceText;
  
  // Add information about hours based on working_hours field
  if (record.working_hours) {
    try {
      const hours = JSON.parse(record.working_hours);
      const isOpen24Hours = Object.values(hours).some(time => time.includes('24H') || time.includes('24h'));
      
      if (isOpen24Hours) {
        description += 'Open 24 hours a day, 7 days a week for your convenience. ';
      } else {
        description += 'Visit us for a clean, efficient laundry experience with well-maintained machines and a comfortable environment. ';
      }
    } catch (e) {
      // If we can't parse the hours, use a generic statement
      description += 'Visit us for a clean, efficient laundry experience with well-maintained machines and a comfortable environment. ';
    }
  } else {
    description += 'Visit us for a clean, efficient laundry experience with well-maintained machines and a comfortable environment. ';
  }
  
  // Add SEO-friendly conclusion focused on location
  description += `Looking for a "laundromat near me" in ${city}? ${name} is your local solution for quality laundry services.`;
  
  return description;
}

/**
 * Calculate a premium score
 */
function calculatePremiumScore(record) {
  let score = 50; // Start with a base score
  
  // Factors that increase score
  
  // Has a website
  if (record.site && record.site.trim().length > 0) {
    score += 10;
  }
  
  // Has a phone number
  if (record.phone && record.phone.trim().length > 0) {
    score += 5;
  }
  
  // Has a description
  if (record.description && record.description.trim().length > 0) {
    // Longer descriptions are better
    score += Math.min(10, Math.floor(record.description.length / 50));
  }
  
  // Has good ratings
  if (record.rating) {
    const rating = parseFloat(record.rating);
    if (!isNaN(rating)) {
      // 5 star = +10, 4 star = +8, etc.
      score += Math.round((rating / 5) * 10);
    }
  }
  
  // Has many reviews
  if (record.reviews) {
    const reviewCount = parseInt(record.reviews);
    if (!isNaN(reviewCount)) {
      // More reviews = higher score, up to 10 points
      score += Math.min(10, Math.floor(reviewCount / 10));
    }
  }
  
  // Has photos
  if (record.photo || record.street_view) {
    score += 5;
  }
  
  // Has location coordinates
  if (record.latitude && record.longitude) {
    score += 5;
  }
  
  // Has working hours
  if (record.working_hours) {
    score += 5;
  }
  
  // Cap at 100
  return Math.min(100, Math.max(0, score));
}

/**
 * Enrich a laundromat record
 */
function enrichLaundryRecord(record) {
  const enriched = { ...record };
  
  // Generate a slug if not present
  if (!enriched.slug) {
    enriched.slug = generateSlug(record.name, record.city, record.state);
  }
  
  // Generate SEO tags based on name, description, and services
  if (!enriched.seoTags) {
    enriched.seoTags = generateSeoTags(record);
  }
  
  // Generate a short summary for search results
  if (!enriched.seoSummary) {
    enriched.seoSummary = generateSeoSummary(record);
  }
  
  // Generate a full description if not present
  if (!enriched.seoDescription && (!record.description || record.description.trim().length < 50)) {
    enriched.seoDescription = generateSeoDescription(record);
  }
  
  // Calculate a premium score based on available data
  if (!enriched.premiumScore) {
    enriched.premiumScore = calculatePremiumScore(record).toString();
  }
  
  return enriched;
}

async function processData() {
  console.log('Starting data enrichment process...');
  
  // Statistics
  const stats = {
    totalRecords: 0,
    enrichedRecords: 0,
    duplicatesRemoved: 0,
    errors: []
  };
  
  try {
    // Read the CSV file
    const fileContent = await fs.readFile(INPUT_FILE, 'utf8');
    
    // Parse CSV data
    const records = await new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    
    stats.totalRecords = records.length;
    console.log(`Processing ${records.length} records...`);
    
    // Track addresses to remove duplicates
    const addressSet = new Set();
    
    // Enrich each record
    const enrichedRecords = [];
    
    for (const record of records) {
      try {
        // Skip records without required fields
        if (!record.name || !record.full_address || !record.city || !record.state) {
          stats.errors.push(`Skipping record: Missing required fields`);
          continue;
        }
        
        // Normalize the address for deduplication
        const normalizedAddress = normalizeAddress(record.full_address, record.city, record.state, record.postal_code || '');
        
        // Skip duplicate addresses
        if (addressSet.has(normalizedAddress)) {
          stats.duplicatesRemoved++;
          continue;
        }
        
        addressSet.add(normalizedAddress);
        
        // Enrich the record
        const enriched = enrichLaundryRecord(record);
        enrichedRecords.push(enriched);
        stats.enrichedRecords++;
        
        // Show progress
        if (stats.enrichedRecords % 1000 === 0) {
          console.log(`Processed ${stats.enrichedRecords} records...`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Error processing record: ${record.name || 'Unknown'} - ${errorMessage}`);
      }
    }
    
    console.log('Writing enriched data to CSV...');
    
    // Write the enriched data to a new CSV file
    await new Promise((resolve, reject) => {
      stringify(enrichedRecords, { header: true }, (err, output) => {
        if (err) {
          reject(err);
          return;
        }
        
        fs.writeFile(OUTPUT_FILE, output, 'utf8')
          .then(() => resolve())
          .catch(reject);
      });
    });
    
    console.log('\nEnrichment completed!');
    console.log(`Total records: ${stats.totalRecords}`);
    console.log(`Enriched records: ${stats.enrichedRecords}`);
    console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
    console.log(`Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\nFirst 5 errors:');
      stats.errors.slice(0, 5).forEach(error => console.log(`- ${error}`));
    }
    
    console.log(`\nEnriched data saved to: ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('Error enriching data:', error);
  }
}

// Run the process
processData();