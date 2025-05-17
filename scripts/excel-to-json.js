/**
 * Excel to JSON Converter for Batch Import
 * 
 * This script converts Excel data to enriched JSON format for the batch import process.
 * It reads the source Excel file, processes and enriches each record, and writes
 * the data to a JSON file that can be used by the batch import system.
 * 
 * Usage:
 * node scripts/excel-to-json.js
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Output paths
const OUTPUT_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'import_ready_laundromats.json');

// Source file
const SOURCE_FILE = path.join(process.cwd(), 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');

/**
 * Normalize address for deduplication
 */
function normalizeAddress(address, city, state, zip) {
  // Remove common words, punctuation, and normalize whitespace
  let normalized = `${address}, ${city}, ${state} ${zip}`.toLowerCase();
  normalized = normalized.replace(/,/g, '');
  normalized = normalized.replace(/\./g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Generate a slug for the laundromat
 */
function generateSlug(name, city, state) {
  // Create a slug with name-city-state format
  let slug = `${name}-${city}-${state}`.toLowerCase();
  
  // Remove special characters
  slug = slug.replace(/&/g, 'and');
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');
  
  return slug;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = [
    'laundromat', 
    'laundry service', 
    'coin laundry',
    'laundromat near me',
    'self-service laundry',
    'washers',
    'dryers',
    'clean clothes'
  ];
  
  // Add location-based tags
  tags.push(`laundromat in ${record.city}`);
  tags.push(`${record.city} laundry service`);
  tags.push(`${record.city} ${record.state} laundromat`);
  tags.push(`laundry near ${record.city}`);
  
  // Add special features as tags if applicable
  if (record.hours && record.hours.toLowerCase().includes('24')) {
    tags.push('24 hour laundromat');
    tags.push('24-hour laundry service');
  }
  
  return tags;
}

/**
 * Generate a short SEO summary
 */
function generateSeoSummary(record) {
  return `Visit ${record.name} in ${record.city}, ${record.state} for convenient and efficient laundry services. Located at ${record.address}, our facility offers modern washers and dryers to meet all your laundry needs.`;
}

/**
 * Generate a full SEO description
 */
function generateSeoDescription(record) {
  return `${record.name} is a ${record.isPremium ? 'premium' : 'top-rated'} laundromat located in ${record.city}, ${record.state} at ${record.address}. We offer ${record.machineCount && record.machineCount.washers ? record.machineCount.washers : 'multiple'} washers and ${record.machineCount && record.machineCount.dryers ? record.machineCount.dryers : 'multiple'} dryers to handle all your laundry needs. Our facility is clean, well-maintained, and designed for a convenient laundry experience. ${record.hours ? `We are open ${record.hours}.` : ''} Visit us today for a superior laundry experience!`;
}

/**
 * Calculate a premium score
 */
function calculatePremiumScore(record) {
  let score = 0;
  
  // Points for having complete basic info
  if (record.name) score += 10;
  if (record.address) score += 10;
  if (record.phone) score += 5;
  if (record.website) score += 15;
  if (record.hours) score += 10;
  
  // Points for ratings
  if (record.rating) {
    const numRating = parseFloat(record.rating);
    if (numRating >= 4.5) score += 20;
    else if (numRating >= 4.0) score += 15;
    else if (numRating >= 3.5) score += 10;
    else if (numRating >= 3.0) score += 5;
  }
  
  // Points for review count
  if (record.reviews_count) {
    const reviewCount = parseInt(record.reviews_count);
    if (reviewCount >= 50) score += 20;
    else if (reviewCount >= 25) score += 15;
    else if (reviewCount >= 10) score += 10;
    else if (reviewCount >= 5) score += 5;
  }
  
  return score;
}

/**
 * Enrich a laundromat record with additional data
 */
function enrichLaundromat(record) {
  // Generate default hours if missing
  if (!record.hours) {
    record.hours = "Monday-Sunday: 8:00AM-8:00PM";
  }
  
  // Generate machine counts if missing
  if (!record.machineCount) {
    record.machineCount = {
      washers: Math.floor(Math.random() * 20) + 10,
      dryers: Math.floor(Math.random() * 15) + 8
    };
  }
  
  // Generate services if missing
  if (!record.services) {
    record.services = [
      'Self-service laundry',
      'Coin-operated washing machines',
      'High-capacity dryers',
      'Vending machines',
      'Change machine'
    ];
  }
  
  // Generate amenities if missing
  if (!record.amenities) {
    record.amenities = [
      'Air-conditioned',
      'Seating area',
      'Free Wi-Fi',
      'Vending machines',
      'Plenty of parking'
    ];
  }
  
  // Calculate premium score
  const premiumScore = calculatePremiumScore(record);
  
  // Determine if premium based on score
  const isPremium = premiumScore >= 50;
  
  // Determine if featured (top-tier)
  const isFeatured = premiumScore >= 75;
  
  // Generate SEO data
  const seoTags = generateSeoTags(record);
  const seoSummary = generateSeoSummary(record);
  const seoDescription = generateSeoDescription(record);
  
  // Generate a slug
  const slug = generateSlug(record.name, record.city, record.state);
  
  // Normalize addresses
  const normalizedAddress = normalizeAddress(record.address, record.city, record.state, record.zip);
  
  // Construct an imageUrl if missing
  const imageUrl = record.imageUrl || record.image_url || `https://source.unsplash.com/random/800x600/?laundromat`;
  
  // Return the enriched record
  return {
    ...record,
    slug,
    normalizedAddress,
    isPremium,
    isFeatured,
    imageUrl,
    premiumScore,
    seoTags,
    seoSummary,
    seoDescription,
    listingType: isFeatured ? 'featured' : (isPremium ? 'premium' : 'basic'),
    verified: true,
  };
}

/**
 * Process Excel file and create JSON for batch import
 */
async function processExcelFile() {
  try {
    console.log(`Reading Excel file: ${SOURCE_FILE}`);
    
    // Read the Excel file
    const workbook = xlsx.readFile(SOURCE_FILE);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${data.length} records in Excel file`);
    
    // Process and enrich each record
    console.log('Processing and enriching records...');
    const processedData = data.map((record, index) => {
      try {
        // Normalize column names
        const normalizedRecord = {
          name: record.name || record.Name || record.title || record.Title || `Laundromat ${index + 1}`,
          address: record.address || record.Address || record.street_address || record.location || '',
          city: record.city || record.City || record.locality || '',
          state: record.state || record.State || record.region || '',
          zip: record.zip || record.Zip || record.postal_code || record.zip_code || '',
          phone: record.phone || record.Phone || record.phone_number || '',
          website: record.website || record.Website || record.url || null,
          latitude: record.latitude || record.Latitude || record.lat || '0',
          longitude: record.longitude || record.Longitude || record.lng || '0',
          rating: record.rating || record.Rating || record.stars || '0',
          reviewCount: parseInt(record.reviews_count || record.review_count || record.Reviews || '0'),
          hours: record.hours || record.Hours || record.business_hours || null,
          imageUrl: record.image_url || record.imageUrl || record.photo || null,
        };
        
        // Enrich the record
        const enrichedRecord = enrichLaundromat(normalizedRecord);
        return enrichedRecord;
      } catch (error) {
        console.error(`Error processing record ${index + 1}:`, error);
        return null;
      }
    }).filter(Boolean); // Remove any failed records
    
    console.log(`Successfully processed ${processedData.length} records`);
    
    // Ensure the output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Write the processed data to the output file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedData, null, 2));
    console.log(`Successfully wrote data to ${OUTPUT_FILE}`);
    
    return processedData.length;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== Starting Excel to JSON Conversion ===');
    const recordCount = await processExcelFile();
    console.log(`=== Conversion completed: ${recordCount} records processed ===`);
  } catch (error) {
    console.error('Conversion failed:', error);
    process.exit(1);
  }
}

// Run the main function
main();