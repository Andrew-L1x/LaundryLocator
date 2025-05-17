/**
 * Database Import Script
 * 
 * This script takes the enriched laundromat data and imports it directly into the database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/pg-core';
import { fileToBuffer } from 'node:fs/promises';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import data file path
const IMPORT_DATA_PATH = path.join(__dirname, '..', 'data', 'import_ready_laundromats.json');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Connect to the database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Import laundromat data from the enriched file
async function importData() {
  console.log('Starting database import...');
  
  // Read the enriched data
  let laundromats;
  try {
    const data = fs.readFileSync(IMPORT_DATA_PATH, 'utf8');
    laundromats = JSON.parse(data);
    console.log(`Read ${laundromats.length} records from ${IMPORT_DATA_PATH}`);
  } catch (error) {
    console.error(`Error reading data file: ${error.message}`);
    return { success: false, error: error.message };
  }
  
  // Connect to the database
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database');
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Import stats
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 100
    const batchSize = 100;
    
    // Prepare the query
    const insertQuery = `
      INSERT INTO "laundromats" (
        "name", "address", "city", "state", "zip", "phone", "website", 
        "latitude", "longitude", "rating", "reviewCount", "imageUrl", 
        "hours", "description", "slug", "seoTags", "seoSummary", 
        "isPremium", "isFeatured", "isApproved", "ownerClaimed",
        "createdAt", "updatedAt", "premiumScore"
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `;
    
    // Process data in batches
    for (let i = 0; i < laundromats.length; i += batchSize) {
      const batch = laundromats.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(laundromats.length / batchSize)}...`);
      
      // Process each record in the batch
      for (const laundromat of batch) {
        try {
          // Convert string ratings to numeric
          let rating = parseFloat(laundromat.rating) || 0;
          let reviewCount = parseInt(laundromat.reviewCount || laundromat.reviews_count || 0);
          let premiumScore = parseInt(laundromat.premiumScore || laundromat.premium_score || 0);
          
          // Insert into database
          const result = await client.query(insertQuery, [
            laundromat.name,
            laundromat.address,
            laundromat.city,
            laundromat.state,
            laundromat.zip,
            laundromat.phone,
            laundromat.website,
            laundromat.latitude,
            laundromat.longitude,
            rating,
            reviewCount,
            laundromat.imageUrl || laundromat.image_url,
            laundromat.hours,
            laundromat.description,
            laundromat.slug,
            laundromat.seoTags || laundromat.seo_tags,
            laundromat.seoSummary || laundromat.seo_summary,
            laundromat.isPremium || laundromat.is_premium || false,
            laundromat.isFeatured || laundromat.is_featured || false,
            laundromat.isApproved || true,
            laundromat.ownerClaimed || false,
            laundromat.createdAt || laundromat.created_at || new Date().toISOString(),
            laundromat.updatedAt || laundromat.updated_at || new Date().toISOString(),
            premiumScore
          ]);
          
          if (result.rowCount > 0) {
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`Error importing record: ${error.message}`);
          errors++;
        }
      }
      
      // Log progress
      console.log(`Processed ${i + batch.length} / ${laundromats.length} records`);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`
Import complete!
Imported: ${imported}
Skipped: ${skipped}
Errors: ${errors}
Total processed: ${imported + skipped + errors}
    `);
    
    return {
      success: true,
      imported,
      skipped,
      errors,
      total: laundromats.length
    };
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error(`Database error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      client.release();
    }
    pool.end();
  }
}

// Run the import
importData()
  .then(result => {
    if (result.success) {
      console.log('Database import successful!');
    } else {
      console.error(`Database import failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });