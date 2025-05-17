import * as fs from 'fs-extra';
import path from 'path';
import { parse as csvParse } from 'csv-parse';
import { stringify as csvStringify } from 'csv-stringify';
import { log } from '../vite';

/**
 * Represents the structure of the laundromat data from the CSV
 */
interface LaundryRecord {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  website?: string;
  latitude?: string;
  longitude?: string;
  description?: string;
  hours?: string;
  services?: string;
  features?: string;
  rating?: string;
  reviewCount?: string;
  photos?: string;
  seoDescription?: string;
  seoSummary?: string;
  seoTags?: string;
  premiumScore?: string;
  slug?: string;
  [key: string]: any; // Allow for additional fields
}

/**
 * Represents the statistics from processing the laundromat data
 */
interface EnrichmentStats {
  totalRecords: number;
  enrichedRecords: number;
  duplicatesRemoved: number;
  errors: string[];
}

/**
 * Enriches the laundromat data with SEO content, tags, and scores
 * 
 * @param inputPath Path to the input CSV file
 * @param outputPath Path to save the enriched CSV file
 * @returns Statistics about the enrichment process
 */
export async function enrichLaundryData(
  inputPath: string,
  outputPath: string
): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    totalRecords: 0,
    enrichedRecords: 0,
    duplicatesRemoved: 0,
    errors: []
  };
  
  try {
    // Read the CSV file
    const fileContent = await fs.readFile(inputPath, 'utf8');
    
    // Parse CSV data
    const records: LaundryRecord[] = await new Promise((resolve, reject) => {
      csvParse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    
    stats.totalRecords = records.length;
    log(`Processing ${records.length} records`, 'enrichLaundryData');
    
    // Track addresses to remove duplicates
    const addressSet = new Set<string>();
    
    // Enrich each record
    const enrichedRecords: LaundryRecord[] = [];
    
    for (const record of records) {
      try {
        // Normalize the address for deduplication
        const normalizedAddress = normalizeAddress(record.address, record.city, record.state, record.zip);
        
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
      } catch (error) {
        stats.errors.push(`Error processing record: ${record.name || 'Unknown'} - ${error.message}`);
      }
    }
    
    // Write the enriched data to a new CSV file
    await writeEnrichedCsv(enrichedRecords, outputPath);
    
    return stats;
  } catch (error) {
    log(`Error enriching laundry data: ${error.message}`, 'enrichLaundryData');
    throw error;
  }
}

/**
 * Process a batch of laundromat data
 * 
 * @param inputPath Path to the input CSV file
 * @param outputPath Path to save the enriched CSV file
 * @param job Batch job object to update progress
 * @returns Statistics about the enrichment process
 */
export async function processBatch(
  inputPath: string,
  outputPath: string,
  job: any
): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    totalRecords: 0,
    enrichedRecords: 0,
    duplicatesRemoved: 0,
    errors: []
  };
  
  try {
    job.status = 'processing';
    
    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));
    
    // Create read stream for the CSV file
    const fileStream = fs.createReadStream(inputPath);
    const outputStream = fs.createWriteStream(outputPath);
    
    // Create CSV parser
    const parser = csvParse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Create CSV stringifier
    const stringifier = csvStringify({
      header: true
    });
    
    // Pipe the output to the file
    stringifier.pipe(outputStream);
    
    // Track addresses to remove duplicates
    const addressSet = new Set<string>();
    
    // Process the CSV file in chunks
    let processedRecords = 0;
    let totalRecords = 0;
    
    // Count total records first for progress tracking
    const recordCount = await countRecords(inputPath);
    totalRecords = recordCount;
    stats.totalRecords = totalRecords;
    
    job.progress = 5; // Starting progress
    
    // Process records
    parser.on('readable', () => {
      let record: LaundryRecord;
      while ((record = parser.read()) !== null) {
        try {
          // Normalize the address for deduplication
          const normalizedAddress = normalizeAddress(record.address, record.city, record.state, record.zip);
          
          // Skip duplicate addresses
          if (addressSet.has(normalizedAddress)) {
            stats.duplicatesRemoved++;
            continue;
          }
          
          addressSet.add(normalizedAddress);
          
          // Enrich the record
          const enriched = enrichLaundryRecord(record);
          
          // Write the enriched record to the output file
          stringifier.write(enriched);
          
          stats.enrichedRecords++;
        } catch (error) {
          stats.errors.push(`Error processing record: ${record.name || 'Unknown'} - ${error.message}`);
        }
        
        // Update progress
        processedRecords++;
        if (processedRecords % 100 === 0) {
          const progress = Math.min(Math.round((processedRecords / totalRecords) * 95) + 5, 95);
          job.progress = progress;
        }
      }
    });
    
    // Handle errors
    parser.on('error', (err) => {
      log(`Error parsing CSV: ${err.message}`, 'processBatch');
      throw err;
    });
    
    // Wait for parsing to complete
    await new Promise<void>((resolve, reject) => {
      parser.on('end', () => {
        stringifier.end();
        resolve();
      });
      
      parser.on('error', (error) => {
        reject(error);
      });
      
      fileStream.pipe(parser);
    });
    
    job.progress = 99;
    return stats;
  } catch (error) {
    log(`Error processing batch: ${error.message}`, 'processBatch');
    throw error;
  }
}

/**
 * Count the number of records in a CSV file
 * 
 * @param filePath Path to the CSV file
 * @returns The number of records in the file
 */
async function countRecords(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const parser = csvParse({
      columns: true,
      skip_empty_lines: true
    });
    
    parser.on('readable', () => {
      while (parser.read() !== null) {
        count++;
      }
    });
    
    parser.on('error', (error) => {
      reject(error);
    });
    
    parser.on('end', () => {
      resolve(count);
    });
    
    fs.createReadStream(filePath).pipe(parser);
  });
}

/**
 * Write enriched records to a CSV file
 * 
 * @param records The enriched laundromat records
 * @param outputPath Path to save the CSV file
 */
async function writeEnrichedCsv(records: LaundryRecord[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    fs.ensureDir(path.dirname(outputPath))
      .then(() => {
        // Stringify the records to CSV
        csvStringify(records, { header: true }, (err, output) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Write the CSV to a file
          fs.writeFile(outputPath, output, 'utf8')
            .then(() => resolve())
            .catch(reject);
        });
      })
      .catch(reject);
  });
}

/**
 * Normalize an address for deduplication
 * 
 * @param address Street address
 * @param city City
 * @param state State
 * @param zip Zip code
 * @returns Normalized address string
 */
function normalizeAddress(address: string, city: string, state: string, zip: string): string {
  // Remove spaces, convert to lowercase, and standardize
  return `${address} ${city} ${state} ${zip}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enrich a single laundromat record with SEO content, tags, and scores
 * 
 * @param record The laundromat record to enrich
 * @returns The enriched record
 */
function enrichLaundryRecord(record: LaundryRecord): LaundryRecord {
  // Create a copy of the record to avoid modifying the original
  const enriched: LaundryRecord = { ...record };
  
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

/**
 * Generate a URL slug for a laundromat
 * 
 * @param name Business name
 * @param city City
 * @param state State
 * @returns SEO-friendly slug
 */
function generateSlug(name: string, city: string, state: string): string {
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
 * 
 * @param record The laundromat record
 * @returns Comma-separated list of relevant tags
 */
function generateSeoTags(record: LaundryRecord): string {
  const tags: string[] = ['laundromat'];
  
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
  
  // Check name, description, services, and features for keywords
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
  
  return tags.join(', ');
}

/**
 * Generate a short SEO-friendly summary for search results
 * 
 * @param record The laundromat record
 * @returns Short summary (100-150 characters)
 */
function generateSeoSummary(record: LaundryRecord): string {
  const name = record.name || 'Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  
  // Extract key features
  const features: string[] = [];
  
  if (record.services) {
    const services = record.services.toLowerCase();
    if (services.includes('24')) features.push('24-hour');
    if (services.includes('drop')) features.push('drop-off');
    if (services.includes('fold')) features.push('wash & fold');
    if (services.includes('dry')) features.push('dry cleaning');
  }
  
  if (record.hours && record.hours.toLowerCase().includes('24')) {
    if (!features.includes('24-hour')) features.push('24-hour');
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
 * Generate a full SEO description for laundromats without one
 * 
 * @param record The laundromat record
 * @returns Detailed description (300-400 characters)
 */
function generateSeoDescription(record: LaundryRecord): string {
  const name = record.name || 'Laundromat';
  const city = record.city || '';
  const state = record.state || '';
  const address = record.address || '';
  
  let description = `${name} is a well-maintained laundromat located at ${address}, ${city}, ${state}. `;
  
  // Add information about services
  if (record.services) {
    const services = record.services.toLowerCase();
    if (services.includes('self') || services.includes('coin')) {
      description += 'We provide self-service machines for your convenience, allowing you to do laundry on your schedule. ';
    }
    
    if (services.includes('drop') || services.includes('fold')) {
      description += 'Our professional wash and fold service saves you time while ensuring your clothes are perfectly cleaned and neatly folded. ';
    }
    
    if (services.includes('dry')) {
      description += 'We also offer dry cleaning services for your delicate garments that require special care. ';
    }
  } else {
    description += 'We offer a range of machines to handle loads of all sizes, from regular laundry to bulky items like comforters and blankets. ';
  }
  
  // Add information about hours
  if (record.hours && record.hours.toLowerCase().includes('24')) {
    description += 'Open 24 hours a day, 7 days a week for your convenience. ';
  } else {
    description += 'Visit us for a clean, efficient laundry experience with well-maintained machines and a comfortable environment. ';
  }
  
  // Add SEO-friendly conclusion focused on location
  description += `Looking for a "laundromat near me" in ${city}? ${name} is your local solution for quality laundry services.`;
  
  return description;
}

/**
 * Calculate a premium score based on available data
 * 
 * @param record The laundromat record
 * @returns Score between 0-100
 */
function calculatePremiumScore(record: LaundryRecord): number {
  let score = 50; // Start with a base score
  
  // Factors that increase score
  
  // Has a website
  if (record.website && record.website.trim().length > 0) {
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
  
  // Has photos
  if (record.photos) {
    const photoCount = record.photos.split(',').length;
    score += Math.min(10, photoCount * 2);
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
  if (record.reviewCount) {
    const reviewCount = parseInt(record.reviewCount);
    if (!isNaN(reviewCount)) {
      // More reviews = higher score, up to 10 points
      score += Math.min(10, Math.floor(reviewCount / 10));
    }
  }
  
  // Has multiple services
  if (record.services) {
    const serviceCount = record.services.split(',').length;
    score += Math.min(5, serviceCount);
  }
  
  // Cap at 100
  return Math.min(100, Math.max(0, score));
}