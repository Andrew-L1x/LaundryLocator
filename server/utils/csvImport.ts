import { parse } from 'csv-parse';
import fs from 'fs-extra';
import { db } from '../db';
import { laundromats } from '@shared/schema';
import { storage } from '../storage';
import { createSlug } from './helpers';

interface CsvLaundromat {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  latitude: string;
  longitude: string;
  hours?: string;
  services?: string;
  description?: string;
  amenities?: string;
  dryers?: string;
  washers?: string;
  acceptsCards?: string;
  hasAttendant?: string;
  hasWifi?: string;
  priceRange?: string;
  email?: string;
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  duplicates: number;
  errors: string[];
  message?: string;
}

/**
 * Process a CSV file and import laundromat data
 */
export async function processCsvFile(filePath: string): Promise<ImportResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        total: 0,
        imported: 0,
        duplicates: 0,
        errors: [`File not found: ${filePath}`],
        message: 'File not found'
      };
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const records: CsvLaundromat[] = await new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        skip_records_with_error: true
      }, (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records);
        }
      });
    });

    const result: ImportResult = {
      success: true,
      total: records.length,
      imported: 0,
      duplicates: 0,
      errors: []
    };

    for (const record of records) {
      try {
        // Validate required fields
        if (!record.name || !record.address || !record.city || !record.state || !record.zip) {
          result.errors.push(`Missing required fields for record: ${JSON.stringify(record)}`);
          continue;
        }

        const slug = createSlug(record.name + '-' + record.address + '-' + record.city);
        
        // Check if laundromat already exists
        const existingLaundromat = await storage.getLaundryBySlug(slug);
        if (existingLaundromat) {
          result.duplicates++;
          continue;
        }

        // Parse services from comma-separated string
        const services = record.services ? record.services.split(',').map(s => s.trim()) : [];
        
        // Parse amenities
        const amenities = record.amenities ? record.amenities.split(',').map(a => a.trim()) : [];
        
        // Create boolean fields from string values
        const acceptsCards = record.acceptsCards?.toLowerCase() === 'yes' || record.acceptsCards === '1';
        const hasAttendant = record.hasAttendant?.toLowerCase() === 'yes' || record.hasAttendant === '1';
        const hasWifi = record.hasWifi?.toLowerCase() === 'yes' || record.hasWifi === '1';
        
        // Create laundromat record
        await storage.createLaundromat({
          name: record.name,
          slug,
          address: record.address,
          city: record.city,
          state: record.state,
          zip: record.zip,
          phone: record.phone,
          website: record.website || null,
          latitude: record.latitude,
          longitude: record.longitude,
          hours: record.hours || 'Not specified',
          services,
          amenities,
          description: record.description || null,
          acceptsCards,
          hasAttendant,
          hasWifi,
          rating: null,
          priceRange: record.priceRange || 'Medium',
          dryers: parseInt(record.dryers || '0') || 0,
          washers: parseInt(record.washers || '0') || 0,
          reviewCount: 0,
          featuredRank: null,
          isPremium: false,
          premiumExpiry: null,
          ownerId: null,
          isVerified: false,
          email: record.email || null,
          imageUrl: null,
          promotions: []
        });

        result.imported++;
      } catch (error) {
        result.errors.push(`Error importing record: ${error.message}`);
      }
    }

    result.message = `Processed ${result.total} records: ${result.imported} imported, ${result.duplicates} duplicates, ${result.errors.length} errors`;
    return result;
  } catch (error) {
    return {
      success: false,
      total: 0, 
      imported: 0,
      duplicates: 0,
      errors: [error.message],
      message: `Error processing CSV file: ${error.message}`
    };
  }
}

/**
 * Get a list of all uploaded CSV files
 */
export async function getUploadedCsvFiles(directory: string): Promise<string[]> {
  try {
    await fs.ensureDir(directory);
    const files = await fs.readdir(directory);
    return files.filter(file => file.endsWith('.csv'));
  } catch (error) {
    console.error('Error listing CSV files:', error);
    return [];
  }
}