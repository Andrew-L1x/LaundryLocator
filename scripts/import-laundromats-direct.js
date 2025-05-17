// Direct database import script for enriched laundromat data
import fs from 'fs-extra';
import { parse } from 'csv-parse/sync';
import { pool, db } from '../server/db.js';
import * as schema from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Configuration
const SAMPLE_MODE = process.argv[2] === 'sample';
const CSV_PATH = SAMPLE_MODE 
  ? 'data/import/sample_laundromats.csv'
  : 'data/enriched/enriched_laundromat_data.csv';
const BATCH_SIZE = 50;

// Stats tracking
const stats = {
  totalRecords: 0,
  processedRecords: 0,
  errorCount: 0,
  successCount: 0,
  skippedCount: 0,
  errors: []
};

async function main() {
  console.log(`Starting import from ${CSV_PATH} in ${SAMPLE_MODE ? 'sample' : 'full'} mode`);
  
  try {
    // Ensure the file exists
    if (!fs.existsSync(CSV_PATH)) {
      console.error(`Error: File not found at ${CSV_PATH}`);
      process.exit(1);
    }
    
    // Read and parse the CSV
    const csvData = fs.readFileSync(CSV_PATH, 'utf8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });
    
    stats.totalRecords = records.length;
    console.log(`Found ${records.length} records to process`);
    
    // Process records in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
      console.log(`Processed ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} records`);
    }
    
    // Print final stats
    console.log('\nImport completed:');
    console.log(`- Total records processed: ${stats.processedRecords}/${stats.totalRecords}`);
    console.log(`- Successfully imported: ${stats.successCount}`);
    console.log(`- Skipped (duplicates): ${stats.skippedCount}`);
    console.log(`- Errors: ${stats.errorCount}`);
    
    if (stats.errors.length > 0) {
      console.log('\nFirst 5 errors:');
      stats.errors.slice(0, 5).forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error during import:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

async function processBatch(records) {
  for (const record of records) {
    try {
      stats.processedRecords++;
      
      // Check if a laundromat with this name and address already exists
      const existingLaundromats = await db.select()
        .from(schema.laundromats)
        .where(eq(schema.laundromats.name, record.name));
      
      const duplicate = existingLaundromats.find(l => 
        l.address && l.address.toLowerCase() === record.address.toLowerCase()
      );
      
      if (duplicate) {
        stats.skippedCount++;
        continue;
      }
      
      // Prepare the laundromat data
      const laundryData = {
        name: record.name,
        slug: record.slug || generateSlug(record.name, record.city, record.state),
        address: record.address,
        city: record.city,
        state: record.state,
        zip: record.zip,
        phone: record.phone,
        website: record.website || '',
        email: '',
        description: record.description || '',
        hours: record.hours || '',
        latitude: parseFloat(record.latitude) || 0,
        longitude: parseFloat(record.longitude) || 0,
        image_url: record.image_url || '',
        logo_url: record.logo_url || '',
        rating: parseFloat(record.rating) || 0,
        review_count: parseInt(record.review_count) || 0,
        premium: record.premium === 'true',
        featured: record.featured === 'true',
        verified: false,
        premium_score: parseInt(record.premium_score) || 50,
        status: 'active',
        user_id: null,
        seo_tags: record.seo_tags || '',
        seo_description: record.description || '',
        seo_summary: record.summary || '',
        amenities: record.amenities || ''
      };
      
      // Insert the record
      await db.insert(schema.laundromats).values(laundryData);
      stats.successCount++;
      
    } catch (error) {
      stats.errorCount++;
      stats.errors.push(`Error processing record ${stats.processedRecords}: ${error.message}`);
    }
  }
}

/**
 * Generate a slug for a laundromat
 */
function generateSlug(name, city, state) {
  const baseSlug = `${name} ${city} ${state}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .trim();
    
  return baseSlug;
}

// Run the import
main();