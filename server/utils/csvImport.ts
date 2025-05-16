import path from 'path';
import fs from 'fs-extra';
import { parse } from 'csv-parse';
import { storage } from '../storage';
import { InsertLaundromat } from '@shared/schema';
import { log } from '../vite';

/**
 * Clean and format business name
 */
function cleanName(name: string): string {
  return name
    .replace(/[^\w\s&'-]/g, '') // Remove special chars except those that might be in business names
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
}

/**
 * Extract street address from full address
 */
function extractStreet(address: string): string {
  // Simple extraction - first line before city/state/zip
  const parts = address.split(',');
  return parts[0]?.trim() || '';
}

/**
 * Extract city from full address
 */
function extractCity(address: string): string {
  const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/);
  return cityMatch ? cityMatch[1].trim() : '';
}

/**
 * Extract state from full address
 */
function extractState(address: string): string {
  const stateMatch = address.match(/,\s*[^,]+,\s*([A-Z]{2})\s*\d{5}/);
  return stateMatch ? stateMatch[1].trim() : '';
}

/**
 * Extract ZIP code from full address
 */
function extractZip(address: string): string {
  const zipMatch = address.match(/(\d{5}(-\d{4})?)/);
  return zipMatch ? zipMatch[1].trim() : '';
}

/**
 * Format phone number to consistent format
 */
function formatPhone(phone: string | null): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  }
  
  return phone.trim();
}

/**
 * Clean and validate URL
 */
function cleanUrl(url: string | null): string | null {
  if (!url) return null;
  
  url = url.trim().toLowerCase();
  
  // Add https:// if missing protocol
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  try {
    new URL(url);
    return url;
  } catch (e) {
    return null;
  }
}

/**
 * Parse hours string into structured format
 */
function parseHours(hoursString: string | null): string {
  if (!hoursString) return 'Call for hours';
  
  // Just return the original string for now
  // Could be enhanced to parse complex hours formats
  return hoursString.trim();
}

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(name: string, city: string): string {
  const baseSlug = `${name}-${city}`
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
    
  return baseSlug;
}

/**
 * Basic validation for laundromat data
 */
function isValidLaundromat(data: any): boolean {
  return (
    data.name &&
    data.address &&
    data.address.city && 
    data.address.state
  );
}

/**
 * Deduplicate laundromats based on name and address
 */
function deduplicateLaundromats(laundromats: any[]): any[] {
  const seen = new Set();
  return laundromats.filter(item => {
    const key = `${item.name}|${item.address.full}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Import laundromat data from CSV file
 */
export async function importLaundromatData(csvFilePath: string): Promise<{ 
  total: number; 
  imported: number; 
  duplicates: number;
  errors: string[]
}> {
  try {
    const results: any[] = [];
    const errors: string[] = [];
    
    // Check if file exists
    if (!await fs.pathExists(csvFilePath)) {
      throw new Error(`File not found: ${csvFilePath}`);
    }
    
    // Create read stream and parser
    const fileContent = await fs.readFile(csvFilePath, 'utf-8');
    
    // Parse CSV
    const records = await new Promise<any[]>((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    
    log(`Parsed ${records.length} records from CSV`, 'csvImport');
    
    // Process each row
    for (const row of records) {
      try {
        // Skip rows without essential data
        if (!row.name || !row.address) {
          errors.push(`Missing name or address for row: ${JSON.stringify(row)}`);
          continue;
        }
        
        // Prepare address components
        const address = row.address || '';
        const city = row.city || extractCity(address);
        const state = row.state || extractState(address);
        const zip = row.zip || extractZip(address);
        
        if (!city || !state) {
          errors.push(`Could not extract city or state from address: ${address}`);
          continue;
        }
        
        // Generate slug
        const slug = generateSlug(row.name, city);
        
        // Prepare laundromat entry
        const laundromat: Partial<InsertLaundromat> = {
          name: cleanName(row.name),
          slug,
          address: extractStreet(address),
          city,
          state,
          zip,
          phone: formatPhone(row.phone),
          website: cleanUrl(row.website) || null,
          email: row.email || null,
          description: row.description || null,
          hours: parseHours(row.hours),
          services: row.services ? row.services.split(',').map((s: string) => s.trim()) : [],
          latitude: row.latitude ? row.latitude.toString() : '',
          longitude: row.longitude ? row.longitude.toString() : '',
          rating: row.rating || null,
          featuredRank: null,
          premiumUntil: null,
          isClaimed: false,
          isPremium: false,
          isFeatured: false,
          reviewCount: row.reviewCount || 0,
          imageUrl: row.imageUrl || null,
          photoUrls: row.photoUrls ? row.photoUrls.split(',').map((url: string) => url.trim()) : [],
          ownerId: null
        };
        
        // Add to results
        results.push(laundromat);
      } catch (error) {
        errors.push(`Error processing row: ${JSON.stringify(row)} - ${error}`);
      }
    }
    
    log(`Processed ${results.length} valid laundromats`, 'csvImport');
    
    // Handle duplicates
    const dedupedResults = deduplicateLaundromats(results);
    log(`Found ${results.length - dedupedResults.length} duplicates`, 'csvImport');
    
    // Import to storage
    let importedCount = 0;
    for (const laundromat of dedupedResults) {
      try {
        await storage.createLaundromat(laundromat as InsertLaundromat);
        importedCount++;
      } catch (error) {
        errors.push(`Error importing laundromat ${laundromat.name}: ${error}`);
      }
    }
    
    return {
      total: results.length,
      imported: importedCount,
      duplicates: results.length - dedupedResults.length,
      errors
    };
  } catch (error) {
    console.error("CSV import error:", error);
    throw error;
  }
}