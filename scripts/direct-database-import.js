/**
 * Direct Database Import Script
 * 
 * This script takes the enriched laundromat data and imports it directly into the database
 * It bypasses the UI import process for more efficient bulk imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { db } from '../server/db.js';
import { laundromats } from '../shared/schema.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const ENRICHED_CSV = path.join(__dirname, '../data/enriched_laundromat_data.csv');

/**
 * Import laundromat data from the enriched CSV file
 */
async function importEnrichedData() {
  try {
    console.log('Starting database import of enriched laundromat data...');
    
    // Check if the enriched CSV file exists
    if (!fs.existsSync(ENRICHED_CSV)) {
      console.error(`File not found: ${ENRICHED_CSV}`);
      console.log('Please run the enrichment script first: node scripts/excel-to-csv-and-enrich.js');
      return;
    }
    
    // Read and parse the CSV file
    const csvData = fs.readFileSync(ENRICHED_CSV, 'utf8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    
    console.log(`Found ${records.length} records to import.`);
    
    // Import in batches for better performance
    const BATCH_SIZE = 100;
    let imported = 0;
    let skipped = 0;
    let batches = 0;
    
    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      batches++;
      
      // Convert records to database format
      const importBatch = batch.map(record => {
        try {
          // Format data for database insertion
          return {
            name: record.name,
            slug: record.slug,
            address: record.address,
            city: record.city || '',
            state: record.state || '',
            zip: record.zip || '',
            phone: record.phone || '',
            website: record.website || null,
            latitude: record.latitude || '0',
            longitude: record.longitude || '0',
            rating: parseFloat(record.rating) || 0,
            reviewCount: parseInt(record.reviews_count) || 0,
            hours: record.hours || 'Monday-Sunday: 8:00AM-8:00PM',
            services: record.services ? record.services.split(',') : ['Self-service laundry'],
            description: record.seo_description || null,
            seoSummary: record.seo_summary || null,
            seoTags: record.seo_tags || null,
            imageUrl: record.image_url || null,
            isPremium: record.is_premium === 'true' || false,
            isFeatured: record.is_featured === 'true' || false,
            featuredRank: record.is_featured === 'true' ? parseInt(imported) + 1 : null,
            premiumUntil: record.is_premium === 'true' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)) : null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } catch (error) {
          console.error('Error formatting record:', error);
          skipped++;
          return null;
        }
      }).filter(Boolean); // Remove nulls
      
      try {
        // Insert batch into database
        const result = await db.insert(laundromats).values(importBatch);
        imported += importBatch.length;
        console.log(`Batch ${batches} imported successfully: ${importBatch.length} records.`);
      } catch (error) {
        console.error('Error importing batch:', error);
        skipped += batch.length;
      }
      
      // Progress indicator for large datasets
      if (imported % 500 === 0 || imported + skipped === records.length) {
        console.log(`Progress: ${imported} imported, ${skipped} skipped. Total: ${imported + skipped}/${records.length}`);
      }
    }
    
    console.log('\nImport complete!');
    console.log(`Successfully imported ${imported} records.`);
    console.log(`Skipped ${skipped} records due to errors.`);
    console.log('The laundromat data is now in your database and ready to use!');
    
  } catch (error) {
    console.error('Database import failed:', error);
  }
}

// Run the import
importEnrichedData()
  .then(() => {
    console.log('Database import process completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Import process failed:', error);
    process.exit(1);
  });