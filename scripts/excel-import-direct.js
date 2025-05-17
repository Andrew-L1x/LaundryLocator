/**
 * Excel Import and Enrichment Script
 * 
 * This script directly reads the Excel file, enriches the data, and writes it to a file
 * that can be imported into the database.
 */

import fs from 'fs';
import path from 'path';
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { stringify } from 'csv-stringify/sync';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const EXCEL_FILE = path.join(__dirname, '..', 'attached_assets', 'Outscraper-20250515181738xl3e_laundromat.xlsx');
const ENRICHED_OUTPUT_CSV = path.join(__dirname, '..', 'data', 'enriched_laundromat_data.csv');
const IMPORT_READY_JSON = path.join(__dirname, '..', 'data', 'import_ready_laundromats.json');

/**
 * Normalize address for deduplication
 */
function normalizeAddress(address, city, state, zip) {
  if (!address) return '';
  
  // Remove unit numbers, suite numbers, etc.
  const normalized = address.replace(/(?:Suite|Ste|Unit|Apt|#)\s*[\w-]+,?/gi, '')
    .replace(/,\s*$/, '') // Remove trailing commas
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();
  
  return `${normalized}, ${city ? city.toLowerCase() : ''}, ${state ? state.toLowerCase() : ''}, ${zip ? zip : ''}`.trim();
}

/**
 * Generate a slug for the laundromat
 */
function generateSlug(name, city, state) {
  if (!name) return '';
  
  // Convert to lowercase and replace spaces and special chars with hyphens
  let slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
    .trim();
  
  // Add location info if available
  if (city) {
    slug += `-${city.toLowerCase().replace(/[^a-z0-9]/g, '').trim()}`;
  }
  
  if (state) {
    slug += `-${state.toLowerCase().trim()}`;
  }
  
  return slug;
}

/**
 * Generate SEO tags for a laundromat
 */
function generateSeoTags(record) {
  const tags = ['laundromat', 'laundry'];
  
  // Add location-based tags
  if (record.city) {
    tags.push(`laundromat in ${record.city}`);
    tags.push(`laundry in ${record.city}`);
    tags.push(`${record.city} laundromat`);
  }
  
  if (record.state) {
    tags.push(`${record.state} laundromat`);
    tags.push(`laundromat in ${record.state}`);
  }
  
  if (record.city && record.state) {
    tags.push(`${record.city} ${record.state} laundromat`);
    tags.push(`laundromat near ${record.city} ${record.state}`);
  }
  
  // Add zip code tags
  if (record.zip) {
    tags.push(`laundromat ${record.zip}`);
    tags.push(`laundromat near ${record.zip}`);
    tags.push(`laundry service ${record.zip}`);
  }
  
  // Add "near me" tags which are important for SEO
  tags.push('laundromat near me');
  tags.push('24 hour laundromat near me');
  tags.push('coin laundry near me');
  tags.push('laundry service near me');
  tags.push('self service laundry near me');
  
  // Add service-based tags
  tags.push('coin operated laundry');
  tags.push('self service laundry');
  tags.push('wash and fold laundry');
  
  return tags.join(', ');
}

/**
 * Generate a short SEO summary
 */
function generateSeoSummary(record) {
  let summary = `${record.name} is a `;
  
  // Add services
  summary += 'full-service laundromat offering self-service washing machines, dryers, and wash & fold services';
  
  // Add location info
  if (record.address && record.city && record.state) {
    summary += ` located at ${record.address}, ${record.city}, ${record.state}`;
    if (record.zip) {
      summary += ` ${record.zip}`;
    }
  }
  
  // Add rating if available
  if (record.rating && parseFloat(record.rating) > 0) {
    summary += `. Rated ${record.rating} stars`;
    if (record.reviews && parseInt(record.reviews) > 0) {
      summary += ` with ${record.reviews} reviews`;
    }
  }
  
  summary += '. Find a clean and convenient laundromat near you.';
  
  return summary;
}

/**
 * Generate a full SEO description
 */
function generateSeoDescription(record) {
  let description = `${record.name} is a modern laundromat `;
  
  // Add location info
  if (record.city && record.state) {
    description += `in ${record.city}, ${record.state}`;
  }
  
  description += ', offering a range of laundry services including self-service washing and drying, drop-off wash and fold, and professional dry cleaning services. ';
  
  // Add facility info
  description += 'Our facility features high-capacity washers and dryers, allowing you to complete your laundry quickly and efficiently. ';
  
  // Add convenience factors
  description += 'We are conveniently located with ample parking, and our store is clean, well-lit, and monitored for your safety. ';
  
  // Add incentives
  description += 'Free WiFi is available while you wait, and we have comfortable seating areas. ';
  
  // Add business hours info based on working_hours if available
  let hoursInfo = 'We offer extended hours to accommodate your busy schedule. ';
  if (record.working_hours) {
    try {
      const hoursObj = JSON.parse(record.working_hours);
      if (hoursObj.Monday && hoursObj.Monday.includes('24H')) {
        hoursInfo = 'We are open 24 hours a day, 7 days a week for your convenience. ';
      } else {
        // Check if any day includes hours before 8AM or after 8PM
        const hasExtendedHours = Object.values(hoursObj).some(
          hours => hours.includes('7AM') || hours.includes('6AM') || 
                 hours.includes('9PM') || hours.includes('10PM')
        );
        
        if (hasExtendedHours) {
          hoursInfo = 'We offer extended hours including early mornings and late evenings to accommodate your busy schedule. ';
        }
      }
    } catch (e) {
      // Use default hours info if parsing fails
    }
  }
  description += hoursInfo;
  
  // Finalize with call to action
  description += 'Visit us today and experience the difference at your local laundromat. Looking for a "laundromat near me"? You\'ve found the best option in the area!';
  
  return description;
}

/**
 * Calculate a premium score
 */
function calculatePremiumScore(record) {
  // Base score
  let score = 30;
  
  // Add points for reviews
  if (record.rating && record.reviews) {
    const rating = parseFloat(record.rating) || 0;
    const reviewCount = parseInt(record.reviews) || 0;
    
    // Points for rating (0-20)
    score += rating * 4;
    
    // Points for review count (0-15)
    if (reviewCount >= 100) {
      score += 15;
    } else if (reviewCount >= 50) {
      score += 10;
    } else if (reviewCount >= 20) {
      score += 5;
    } else if (reviewCount > 0) {
      score += 2;
    }
  }
  
  // Points for having a website (0-10)
  if (record.site && record.site.trim() !== '') {
    score += 10;
  }
  
  // Points for having a phone number (0-5)
  if (record.phone && record.phone.trim() !== '') {
    score += 5;
  }
  
  // Points for having photos (0-10)
  if (record.photo && record.photo.trim() !== '') {
    score += 10;
  }
  
  // Points for having operating hours (0-10)
  if (record.working_hours && record.working_hours.length > 2) {
    score += 10;
  }
  
  return Math.min(100, score); // Cap at 100
}

/**
 * Enrich a laundromat record
 */
function enrichLaundromat(record) {
  // Skip invalid records
  if (!record || !record.name) {
    return null;
  }
  
  // Use full_address as address if available
  const address = record.full_address || '';
  
  // Use postal_code as zip if available
  const zip = record.postal_code || '';
  
  // Extract state abbreviation from state name if needed
  let stateAbbr = record.state;
  if (stateAbbr && stateAbbr.length > 2) {
    // Convert full state names to abbreviations
    const stateMap = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };
    stateAbbr = stateMap[stateAbbr.toLowerCase()] || stateAbbr;
  }
  
  // Parse working hours if available
  let parsedHours = 'Monday-Sunday: 8:00AM-8:00PM';
  if (record.working_hours) {
    try {
      const hoursObj = JSON.parse(record.working_hours);
      parsedHours = Object.entries(hoursObj)
        .map(([day, hours]) => `${day}: ${hours}`)
        .join(', ');
    } catch (e) {
      // Use default hours if parsing fails
    }
  }
  
  // Create an enriched record
  const enriched = {
    // Basic info
    name: record.name,
    address: address,
    city: record.city || '',
    state: stateAbbr || '',
    zip: zip,
    phone: record.phone || '',
    website: record.site || '',
    
    // Location data
    latitude: record.latitude || '0',
    longitude: record.longitude || '0',
    
    // Reviews and ratings
    rating: parseFloat(record.rating) || 0,
    reviewCount: parseInt(record.reviews) || 0,
    
    // Images
    imageUrl: record.photo || '',
    
    // Operating hours
    hours: parsedHours,
    
    // Enhanced SEO fields
    slug: generateSlug(record.name, record.city, stateAbbr),
    seoTags: generateSeoTags({...record, state: stateAbbr}),
    seoSummary: generateSeoSummary({...record, address, state: stateAbbr, zip}),
    description: generateSeoDescription({...record, state: stateAbbr}),
    
    // Premium features
    premiumScore: calculatePremiumScore(record),
    isPremium: false,
    isFeatured: false,
    
    // Status flags
    isApproved: true,
    ownerClaimed: false,
    
    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Set premium and featured flags based on score
  enriched.isPremium = enriched.premiumScore >= 60;
  enriched.isFeatured = enriched.premiumScore >= 80;
  
  return enriched;
}

/**
 * Process Excel file and create enriched data
 */
async function processExcelFile() {
  console.log('Reading Excel file...');
  try {
    // Read the Excel file
    const workbook = readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = utils.sheet_to_json(worksheet);
    console.log(`Found ${data.length} records in the Excel file.`);
    
    // Process each record
    const enrichedRecords = [];
    let processed = 0;
    let skipped = 0;
    
    for (const record of data) {
      // Skip records without a name
      if (!record.name) {
        skipped++;
        continue;
      }
      
      // Enrich the record
      const enriched = enrichLaundromat(record);
      
      if (enriched) {
        enrichedRecords.push(enriched);
        processed++;
        
        // Log progress occasionally
        if (processed % 1000 === 0) {
          console.log(`Processed ${processed} records...`);
        }
      } else {
        skipped++;
      }
    }
    
    // Create directory if it doesn't exist
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write the enriched data to a CSV file
    const enrichedCsv = stringify(enrichedRecords, { header: true });
    fs.writeFileSync(ENRICHED_OUTPUT_CSV, enrichedCsv);
    
    // Write the enriched data to a JSON file for easy import
    fs.writeFileSync(IMPORT_READY_JSON, JSON.stringify(enrichedRecords, null, 2));
    
    console.log(`Data enrichment complete!`);
    console.log(`Processed: ${processed}, Skipped: ${skipped}`);
    console.log(`Enriched data saved to ${ENRICHED_OUTPUT_CSV}`);
    console.log(`Import-ready data saved to ${IMPORT_READY_JSON}`);
    
    return { processed, skipped, path: IMPORT_READY_JSON };
  } catch (error) {
    console.error('Error processing Excel file:', error);
    return { error: error.message };
  }
}

// Main function
async function main() {
  console.log('Starting Excel import and enrichment process...');
  
  const result = await processExcelFile();
  
  if (result.error) {
    console.error(`Excel import failed: ${result.error}`);
    process.exit(1);
  } else {
    console.log(`
Excel import and enrichment complete!

Next steps:
1. Use the Admin interface to import the enriched data
2. Go to /admin/data-import in your browser and log in as an admin
3. Use the "Database Import" feature to load the enriched data file:
   ${result.path}
`);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});