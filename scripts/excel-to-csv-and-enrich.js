/**
 * Converts Excel file to CSV and enriches data
 * 
 * Usage: 
 * node scripts/excel-to-csv-and-enrich.js
 */

import fs from 'fs';
import path from 'path';
import { readFile, utils } from 'xlsx';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const EXCEL_FILE = path.join(__dirname, '../attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');
const OUTPUT_CSV = path.join(__dirname, '../data/laundromat_data.csv');
const ENRICHED_CSV = path.join(__dirname, '../data/enriched_laundromat_data.csv');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'));
}

/**
 * Convert Excel to CSV
 */
function convertExcelToCSV() {
  console.log('Converting Excel file to CSV...');
  try {
    // Read the Excel file
    const workbook = readFile(EXCEL_FILE);
    const sheet_name = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheet_name];
    
    // Convert to CSV
    const csv = utils.sheet_to_csv(worksheet);
    
    // Write to file
    fs.writeFileSync(OUTPUT_CSV, csv);
    
    console.log(`Excel file converted to CSV successfully at ${OUTPUT_CSV}`);
    return true;
  } catch (error) {
    console.error('Error converting Excel to CSV:', error);
    return false;
  }
}

/**
 * Normalize address for deduplication
 */
function normalizeAddress(address, city, state, zip) {
  if (!address) return '';
  return `${address} ${city || ''} ${state || ''} ${zip || ''}`.toLowerCase().trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Generate a slug for the laundromat
 */
function generateSlug(name, city, state) {
  if (!name) return '';
  
  let slug = `${name}-${city || ''}-${state || ''}`.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace consecutive hyphens with single hyphen
  
  // Add a random suffix to ensure uniqueness
  const randomSuffix = Math.floor(Math.random() * 1000);
  return `${slug}-${randomSuffix}`;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const name = record.name || '';
  const city = record.city || '';
  const state = record.state || '';
  
  const tags = [
    'laundromat',
    'laundry service',
    'coin laundry',
    'wash and fold',
    'self-service laundry'
  ];
  
  if (name) tags.push(name.toLowerCase());
  if (city) {
    tags.push(`laundromat in ${city}`);
    tags.push(`laundry service in ${city}`);
    tags.push(`${city} laundromat`);
  }
  
  if (city && state) {
    tags.push(`laundromat near me ${city} ${state}`);
    tags.push(`${city} ${state} laundromat`);
    tags.push(`laundry service in ${city} ${state}`);
  }
  
  return tags.join(',');
}

/**
 * Generate a short SEO summary
 */
function generateSeoSummary(record) {
  const name = record.name || 'Local laundromat';
  const city = record.city || '';
  const state = record.state || '';
  const address = record.address || '';
  const services = record.service_options || '';
  
  let location = '';
  if (city && state) {
    location = `in ${city}, ${state}`;
  } else if (city) {
    location = `in ${city}`;
  } else if (state) {
    location = `in ${state}`;
  }
  
  let serviceText = '';
  if (services) {
    serviceText = ` offering ${services}`;
  }
  
  return `${name} is a convenient laundromat ${location}${serviceText}. Located at ${address}, this laundry facility provides quality services for all your washing needs.`;
}

/**
 * Generate a full SEO description
 */
function generateSeoDescription(record) {
  const name = record.name || 'Our laundromat';
  const city = record.city || '';
  const state = record.state || '';
  const address = record.address || '';
  const hours = record.work_hours || 'flexible hours';
  const services = record.service_options || '';
  const phone = record.phone || '';
  
  let location = '';
  if (city && state) {
    location = `in ${city}, ${state}`;
  } else if (city) {
    location = `in ${city}`;
  } else if (state) {
    location = `in ${state}`;
  }
  
  let serviceText = '';
  if (services) {
    serviceText = ` We offer ${services}.`;
  }
  
  let contactText = '';
  if (phone) {
    contactText = ` Contact us at ${phone} for more information.`;
  }
  
  const keywords = [
    'laundromat near me',
    'coin laundry',
    'washing machines',
    'dryers',
    'clean laundry',
    'self-service laundry',
    'affordable laundry service',
    'quick wash',
    '24-hour laundry'
  ];
  
  const randomKeywords = keywords.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  return `${name} is a modern, fully-equipped laundromat ${location}, offering convenient and efficient laundry services. We are located at ${address} and open during ${hours}.${serviceText} Our facility provides clean, well-maintained machines for all your laundry needs. Visit us for ${randomKeywords.join(', ')} and experience the difference of a quality laundromat.${contactText}`;
}

/**
 * Calculate a premium score
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Basic factors
  if (record.rating && parseFloat(record.rating) >= 4.0) score += 20;
  if (record.reviews_count && parseInt(record.reviews_count) > 10) score += 15;
  if (record.website) score += 15;
  if (record.phone) score += 10;
  if (record.photos_count && parseInt(record.photos_count) > 0) score += 10;
  
  // Service options
  const serviceOptions = record.service_options || '';
  if (serviceOptions.includes('Wash & Fold')) score += 10;
  if (serviceOptions.includes('Drop Off')) score += 10;
  if (serviceOptions.includes('Pickup')) score += 10;
  if (serviceOptions.includes('Delivery')) score += 10;
  if (serviceOptions.includes('Dry Cleaning')) score += 10;
  
  // Opening hours
  const workHours = record.work_hours || '';
  if (workHours.includes('24 hours')) score += 20;
  
  return Math.min(100, score); // Cap at 100
}

/**
 * Enrich a laundromat record
 */
function enrichLaundryRecord(record) {
  // Ensure we have an object with expected fields
  if (!record || typeof record !== 'object') {
    return null;
  }
  
  // Basic validation
  if (!record.name || !record.address) {
    return null;
  }
  
  // Extract state from full address if not present
  if (!record.state && record.address) {
    const stateMatch = record.address.match(/[A-Z]{2}(?=\s+\d{5}(?:-\d{4})?$)/);
    if (stateMatch) {
      record.state = stateMatch[0];
    }
  }
  
  // Extract zip from full address if not present
  if (!record.zip && record.address) {
    const zipMatch = record.address.match(/\d{5}(?:-\d{4})?$/);
    if (zipMatch) {
      record.zip = zipMatch[0];
    }
  }
  
  // Normalize and enhance the record
  const enriched = {
    name: record.name,
    address: record.address,
    city: record.city || '',
    state: record.state || '',
    zip: record.zip || '',
    latitude: record.latitude || '',
    longitude: record.longitude || '',
    phone: record.phone || '',
    website: record.website || '',
    rating: record.rating || '',
    reviews_count: record.reviews_count || '0',
    photos_count: record.photos_count || '0',
    
    // Work hours
    hours: record.work_hours || 'Monday-Sunday: 8:00AM-8:00PM',
    
    // Services
    services: record.service_options || 'Self-service laundry',
    
    // Enhanced SEO fields
    slug: generateSlug(record.name, record.city, record.state),
    normalized_address: normalizeAddress(record.address, record.city, record.state, record.zip),
    seo_tags: generateSeoTags(record),
    seo_summary: generateSeoSummary(record),
    seo_description: generateSeoDescription(record),
    
    // Premium features
    premium_score: calculatePremiumScore(record),
    is_premium: false,
    is_featured: false,
    
    // Default image if available
    image_url: record.photos && record.photos.length > 0 ? record.photos[0] : '',
    
    // Additional useful fields
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Set premium and featured flags based on score
  enriched.is_premium = enriched.premium_score >= 60;
  enriched.is_featured = enriched.premium_score >= 80;
  
  return enriched;
}

/**
 * Process and enrich the laundromat data
 */
function processAndEnrichData() {
  console.log('Processing and enriching laundromat data...');
  try {
    // Read the CSV file
    const csvData = fs.readFileSync(OUTPUT_CSV, 'utf8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    
    console.log(`Found ${records.length} records in the CSV file.`);
    
    // Process each record
    const enrichedRecords = [];
    let processed = 0;
    let skipped = 0;
    
    for (const record of records) {
      const enriched = enrichLaundryRecord(record);
      if (enriched) {
        enrichedRecords.push(enriched);
        processed++;
      } else {
        skipped++;
      }
      
      // Progress logging for large datasets
      if (processed > 0 && processed % 1000 === 0) {
        console.log(`Processed ${processed} records...`);
      }
    }
    
    console.log(`Enrichment complete. Processed: ${processed}, Skipped: ${skipped}`);
    
    // Write enriched data to CSV
    const enrichedCsv = stringify(enrichedRecords, { header: true });
    fs.writeFileSync(ENRICHED_CSV, enrichedCsv);
    
    console.log(`Enriched data saved to ${ENRICHED_CSV}`);
    return enrichedRecords;
  } catch (error) {
    console.error('Error processing and enriching data:', error);
    return [];
  }
}

/**
 * Main function to run the process
 */
async function main() {
  // Step 1: Convert Excel to CSV
  const conversionSuccess = convertExcelToCSV();
  if (!conversionSuccess) {
    console.error('Excel to CSV conversion failed. Exiting.');
    return;
  }
  
  // Step 2: Process and enrich data
  const enrichedRecords = processAndEnrichData();
  console.log(`Enrichment process completed with ${enrichedRecords.length} records.`);
  
  // Step 3: Success message with next steps
  console.log('\nData enrichment complete! Next steps:');
  console.log('1. Use the Admin interface to import the enriched data');
  console.log('2. Go to /admin in your browser and log in as an admin');
  console.log('3. Use the "Import Data" feature to load the enriched CSV file');
}

// Run the main function
main().catch(console.error);

// Export functions for use in other scripts
export {
  enrichLaundryRecord,
  generateSlug,
  generateSeoTags,
  generateSeoSummary,
  generateSeoDescription
};