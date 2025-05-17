import { parse } from 'csv-parse';
import fs from 'fs-extra';
import { createReadStream, createWriteStream } from 'fs';
import { stringify } from 'csv-stringify';
import path from 'path';

// Define the structure of a laundromat record
interface LaundryRecord {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  hours?: string;
  rating?: string;
  review_count?: string;
  categories?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  photos?: string;
  logo?: string;
  // Enriched fields
  seo_tags?: string;
  short_summary?: string;
  default_description?: string;
  premium_score?: number;
  slugified_name?: string;
  premium_potential?: string;
  [key: string]: any; // Allow for other fields
}

/**
 * Slugify a string for URL use
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .replace(/&/g, '-and-')      // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')    // Remove non-word characters
    .replace(/\-\-+/g, '-')      // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '')          // Trim hyphens from start
    .replace(/-+$/, '');         // Trim hyphens from end
}

/**
 * Normalize business name
 */
function normalizeBusinessName(name: string): string {
  // Remove all-caps
  if (name === name.toUpperCase()) {
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  
  // Remove trailing state indicators
  name = name.replace(/\s+-\s+[A-Z]{2}$/, '');
  
  // Fix common formatting issues
  name = name.replace(/\s{2,}/g, ' ').trim();
  
  return name;
}

/**
 * Generate SEO tags based on business data
 */
function generateSeoTags(record: LaundryRecord): string {
  const tags: Set<string> = new Set<string>();
  const nameAndCategories = (record.name + ' ' + (record.categories || '')).toLowerCase();
  const description = (record.description || '').toLowerCase();
  const hours = (record.hours || '').toLowerCase();
  
  // Check for 24-hour operation
  if (hours.includes('open 24 hours') || hours.includes('24 hours') || hours.includes('24/7')) {
    tags.add('24 hour');
  }
  
  // Check for coin laundry
  if (nameAndCategories.includes('coin') || 
      description.includes('coin') || 
      nameAndCategories.includes('self-service') ||
      description.includes('self-service')) {
    tags.add('coin laundry');
    tags.add('self-service');
  }
  
  // Check for drop-off service
  if (nameAndCategories.includes('drop') || 
      description.includes('drop') || 
      nameAndCategories.includes('service') ||
      description.includes('drop-off')) {
    tags.add('drop-off');
  }
  
  // Check for pickup/delivery
  if (description.includes('pickup') || nameAndCategories.includes('pickup')) {
    tags.add('pickup');
  }
  
  if (description.includes('delivery') || nameAndCategories.includes('delivery')) {
    tags.add('delivery');
  }
  
  // Check for eco-friendly
  if (description.includes('eco') || 
      description.includes('environment') || 
      nameAndCategories.includes('eco') || 
      nameAndCategories.includes('green')) {
    tags.add('eco-friendly');
  }
  
  // Check for open late
  if (hours) {
    const hourParts = hours.split(';');
    for (const part of hourParts) {
      if (part.includes('pm')) {
        const closingTime = part.split('–').pop()?.trim();
        if (closingTime) {
          const timeMatch = closingTime.match(/(\d+)(?::(\d+))?\s*(pm|am)/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            if (timeMatch[3].toLowerCase() === 'pm' && hour < 12) {
              hour += 12;
            }
            if (hour >= 21) { // 9 PM or later
              tags.add('open late');
              break;
            }
          }
        }
      }
    }
  }
  
  return Array.from(tags).join(', ');
}

/**
 * Generate a short summary for the laundromat
 */
function generateShortSummary(record: LaundryRecord): string {
  let summary = '';
  const tags = record.seo_tags || '';
  
  // Start with the type of laundromat
  if (tags.includes('coin laundry')) {
    summary = 'Convenient coin-operated laundromat';
  } else if (tags.includes('drop-off')) {
    summary = 'Professional laundry service with drop-off options';
  } else {
    summary = 'Local laundromat offering washing and drying services';
  }
  
  // Add rating if available
  if (record.rating && parseFloat(record.rating) >= 4.0) {
    summary += ` with ${record.rating}-star rating`;
  }
  
  // Add services
  if (tags.includes('pickup') && tags.includes('delivery')) {
    summary += '. Pickup and delivery available';
  } else if (tags.includes('pickup')) {
    summary += '. Pickup service available';
  } else if (tags.includes('delivery')) {
    summary += '. Delivery service available';
  }
  
  // Add hours if 24-hour or open late
  if (tags.includes('24 hour')) {
    summary += '. Open 24 hours';
  } else if (tags.includes('open late')) {
    summary += '. Open late for convenience';
  }
  
  // Add eco-friendly if applicable
  if (tags.includes('eco-friendly')) {
    summary += '. Eco-friendly practices';
  }
  
  // Ensure we stay under 150 characters
  if (summary.length > 145) {
    summary = summary.substring(0, 145) + '...';
  }
  
  return summary;
}

/**
 * Generate a longer description for the laundromat
 */
function generateDefaultDescription(record: LaundryRecord): string {
  if (record.description && record.description.length > 50) {
    return record.description; // Use existing description if substantial
  }
  
  let description = `${record.name} is a `;
  const tags = record.seo_tags || '';
  
  // Type of laundromat
  if (tags.includes('coin laundry') && tags.includes('self-service')) {
    description += 'self-service coin laundromat ';
  } else if (tags.includes('drop-off')) {
    description += 'full-service laundry establishment ';
  } else {
    description += 'laundromat ';
  }
  
  // Location
  description += `located in ${record.address.split(',').slice(-2)[0].trim()}. `;
  
  // Services
  const services = [];
  if (tags.includes('drop-off')) services.push('drop-off service');
  if (tags.includes('pickup')) services.push('pickup service');
  if (tags.includes('delivery')) services.push('delivery options');
  
  if (services.length > 0) {
    description += `They offer ${services.join(', ')} `;
    if (services.length === 1) {
      description += 'to save you time. ';
    } else {
      description += 'to make your laundry experience convenient. ';
    }
  }
  
  // Hours
  if (tags.includes('24 hour')) {
    description += 'Open 24 hours a day for your convenience. ';
  } else if (tags.includes('open late')) {
    description += 'Extended hours to accommodate your busy schedule. ';
  }
  
  // Rating
  if (record.rating && record.review_count) {
    const rating = parseFloat(record.rating);
    const reviewCount = parseInt(record.review_count, 10);
    
    if (rating >= 4.5 && reviewCount > 20) {
      description += `Highly rated with ${rating} stars from ${reviewCount} satisfied customers. `;
    } else if (rating >= 4.0) {
      description += `Well-reviewed with a ${rating}-star rating. `;
    }
  }
  
  // Amenities hint
  description += 'Visit today for a clean, efficient laundry experience.';
  
  // Trim to desired length
  if (description.length > 395) {
    description = description.substring(0, 395) + '...';
  }
  
  return description;
}

/**
 * Calculate a premium score for sorting and featuring
 */
function calculatePremiumScore(record: LaundryRecord): number {
  let score = 0;
  
  // Photos available
  if (record.photos && record.photos.trim() !== '') {
    score += 30;
  }
  
  // Logo available
  if (record.logo && record.logo.trim() !== '') {
    score += 10;
  }
  
  // Website present
  if (record.website && record.website.trim() !== '') {
    score += 10;
  }
  
  // Rating 4.5 or higher
  if (record.rating && parseFloat(record.rating) >= 4.5) {
    score += 20;
  } else if (record.rating && parseFloat(record.rating) >= 4.0) {
    score += 10;
  }
  
  // Over 200 reviews
  if (record.review_count && parseInt(record.review_count, 10) > 200) {
    score += 10;
  } else if (record.review_count && parseInt(record.review_count, 10) > 50) {
    score += 5;
  }
  
  // Has rich tags
  if (record.seo_tags && record.seo_tags.split(',').length >= 3) {
    score += 10;
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Determine if a business has premium listing potential
 */
function assessPremiumPotential(record: LaundryRecord): string {
  // Businesses with good ratings, photos, and websites are good candidates
  if (record.premium_score && record.premium_score >= 60) {
    return 'High';
  } else if (record.premium_score && record.premium_score >= 35) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

/**
 * Process and enrich a single laundromat record
 */
function enrichLaundryRecord(record: LaundryRecord): LaundryRecord {
  // Normalize business name
  record.name = normalizeBusinessName(record.name);
  
  // Generate SEO tags
  record.seo_tags = generateSeoTags(record);
  
  // Generate slugified name for URLs
  record.slugified_name = slugify(record.name);
  
  // Calculate premium score
  record.premium_score = calculatePremiumScore(record);
  
  // Generate short summary
  record.short_summary = generateShortSummary(record);
  
  // Generate default description if missing
  if (!record.description || record.description.trim() === '') {
    record.default_description = generateDefaultDescription(record);
  }
  
  // Assess premium potential
  record.premium_potential = assessPremiumPotential(record);
  
  return record;
}

/**
 * Identify duplicate records based on address
 */
function findDuplicates(records: LaundryRecord[]): Set<number> {
  const addressMap = new Map<string, number>();
  const duplicates = new Set<number>();
  
  records.forEach((record, index) => {
    if (record.address) {
      // Normalize address for comparison
      const normalizedAddress = record.address.toLowerCase().trim();
      
      if (addressMap.has(normalizedAddress)) {
        // Mark the duplicate
        duplicates.add(index);
      } else {
        // Record this address
        addressMap.set(normalizedAddress, index);
      }
    }
  });
  
  return duplicates;
}

/**
 * Main function to enrich a CSV file of laundromat data
 */
export async function enrichLaundryData(inputPath: string): Promise<{ 
  success: boolean, 
  message: string, 
  enrichedPath?: string,
  stats?: {
    totalRecords: number,
    enrichedRecords: number,
    duplicatesRemoved: number,
    errors: string[]
  }
}> {
  const stats = {
    totalRecords: 0,
    enrichedRecords: 0,
    duplicatesRemoved: 0,
    errors: [] as string[]
  };

  try {
    // Create output file path
    const outputDir = path.dirname(inputPath);
    const fileNameNoExt = path.basename(inputPath, '.csv');
    const outputPath = path.join(outputDir, `${fileNameNoExt}_enriched.csv`);
    
    // Process records in chunks for memory efficiency
    const records: LaundryRecord[] = [];
    
    // Parse CSV file
    await new Promise<void>((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      createReadStream(inputPath)
        .pipe(parser)
        .on('data', (record: LaundryRecord) => {
          records.push(record);
          stats.totalRecords++;
        })
        .on('error', (err) => reject(err))
        .on('end', () => resolve());
    });
    
    // Find duplicates
    const duplicates = findDuplicates(records);
    stats.duplicatesRemoved = duplicates.size;
    
    // Enrich non-duplicate records
    const enrichedRecords = records.filter((_, index) => !duplicates.has(index))
      .map(record => {
        try {
          const enriched = enrichLaundryRecord(record);
          stats.enrichedRecords++;
          return enriched;
        } catch (err) {
          stats.errors.push(`Error enriching record ${record.name || 'unknown'}: ${err.message}`);
          return record; // Return original if enrichment fails
        }
      });
    
    // Write enriched data to CSV file
    await new Promise<void>((resolve, reject) => {
      const stringifier = stringify({
        header: true,
        columns: Object.keys(enrichedRecords[0] || {})
      });
      
      const writeStream = createWriteStream(outputPath);
      
      stringifier.on('error', (err) => reject(err));
      writeStream.on('error', (err) => reject(err));
      writeStream.on('finish', () => resolve());
      
      stringifier.pipe(writeStream);
      
      enrichedRecords.forEach(record => {
        stringifier.write(record);
      });
      
      stringifier.end();
    });
    
    return {
      success: true,
      message: `Successfully enriched ${stats.enrichedRecords} records, removed ${stats.duplicatesRemoved} duplicates.`,
      enrichedPath: outputPath,
      stats
    };
  } catch (error) {
    return {
      success: false,
      message: `Error enriching data: ${error.message}`,
      stats
    };
  }
}

// Export helper functions for testing
export {
  generateSeoTags,
  generateShortSummary,
  generateDefaultDescription,
  calculatePremiumScore,
  normalizeBusinessName,
  slugify
};