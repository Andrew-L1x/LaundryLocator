import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// Stats to track the import progress
let importStats = {
  total: 0,
  imported: 0,
  skipped: 0,
  errors: 0,
  startTime: 0,
  endTime: 0
};

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get information about a data file
export async function getFileInfo(req: Request, res: Response) {
  const { file } = req.query;
  
  if (!file) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  try {
    // Make sure the file exists
    const filePath = path.join(process.cwd(), file.toString());
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }
    
    // Read the file to count items
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const totalItems = Array.isArray(fileData) ? fileData.length : 0;
    
    return res.json({
      file: filePath,
      totalItems,
      fileSize: fs.statSync(filePath).size
    });
  } catch (error: any) {
    console.error('File info error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Get current import statistics
export async function getImportStats(req: Request, res: Response) {
  return res.json({
    ...importStats,
    duration: importStats.endTime ? 
      (importStats.endTime - importStats.startTime) / 1000 : 
      (Date.now() - importStats.startTime) / 1000
  });
}

// Process a batch of data
export async function processBatch(req: Request, res: Response) {
  const { file, batchIndex, batchSize } = req.body;
  
  if (!file) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  if (batchIndex === undefined || batchSize === undefined) {
    return res.status(400).json({ error: 'Batch index and size are required' });
  }
  
  try {
    // Initialize stats if this is the first batch
    if (batchIndex === 0) {
      importStats = {
        total: 0,
        imported: 0,
        skipped: 0,
        errors: 0,
        startTime: Date.now(),
        endTime: 0
      };
    }
    
    // Make sure the file exists
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }
    
    // Read the file
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!Array.isArray(fileData)) {
      return res.status(400).json({ error: 'File data must be an array' });
    }
    
    // Calculate batch limits
    const start = batchIndex * batchSize;
    const end = start + batchSize;
    const batch = fileData.slice(start, end);
    
    // Update total count
    if (batchIndex === 0) {
      importStats.total = fileData.length;
    }
    
    // Process this batch
    const batchStats = await importBatch(batch);
    
    // Update global stats
    importStats.imported += batchStats.imported;
    importStats.skipped += batchStats.skipped;
    importStats.errors += batchStats.errors;
    
    // Check if this is the last batch
    if (end >= fileData.length) {
      importStats.endTime = Date.now();
    }
    
    return res.json({
      ...batchStats,
      totalProcessed: importStats.imported + importStats.skipped + importStats.errors,
      isLastBatch: end >= fileData.length
    });
  } catch (error: any) {
    console.error('Batch processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Import a batch of records into the database
async function importBatch(records: any[]) {
  const batchStats = {
    processed: records.length,
    imported: 0,
    skipped: 0,
    errors: 0
  };
  
  // No records to process
  if (records.length === 0) {
    return batchStats;
  }
  
  // Connect to the database
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    for (const record of records) {
      try {
        // Convert fields to match our schema
        const isPremium = record.isPremium || record.is_premium || false;
        const isFeatured = record.isFeatured || record.is_featured || false;
        const rating = parseFloat(record.rating) || 0;
        const reviewCount = parseInt(record.reviewCount || record.reviews_count || 0);
        
        // Create basic services array if needed
        let services = ['Self-service laundry', 'Coin-operated washing machines', 'High-capacity dryers'];
        if (record.services && Array.isArray(record.services)) {
          services = record.services;
        }
        
        // Create amenities array if needed
        let amenities = ['Vending machines', 'Change machine'];
        if (record.amenities && Array.isArray(record.amenities)) {
          amenities = record.amenities;
        }
        
        // Create machine count if needed
        let machineCount = {
          washers: Math.floor(Math.random() * 20) + 10,
          dryers: Math.floor(Math.random() * 15) + 8
        };
        if (record.machineCount) {
          machineCount = record.machineCount;
        }
        
        // Normalize state abbreviation if needed
        let state = record.state;
        if (state && state.length === 2) {
          state = state.toUpperCase();
        }
        
        // Prepare the query
        const insertQuery = `
          INSERT INTO "laundromats" (
            "name", "address", "city", "state", "zip", "phone", "website", 
            "latitude", "longitude", "rating", "review_count", "image_url", 
            "hours", "description", "slug", "services", "amenities", 
            "machine_count", "listing_type", "is_featured", "verified",
            "created_at", "is_premium"
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `;
        
        // Determine listing type based on premium status
        let listingType = 'basic';
        if (isFeatured) {
          listingType = 'featured';
        } else if (isPremium) {
          listingType = 'premium';
        }
        
        // Execute the query
        const result = await client.query(insertQuery, [
          record.name,
          record.address,
          record.city,
          state,
          record.zip,
          record.phone,
          record.website,
          record.latitude,
          record.longitude,
          rating.toString(),
          reviewCount,
          record.imageUrl || record.image_url,
          record.hours || "Monday-Sunday: 8:00AM-8:00PM",
          record.description || record.seoDescription || record.seo_description || "",
          record.slug,
          JSON.stringify(services),
          JSON.stringify(amenities),
          JSON.stringify(machineCount),
          listingType,
          isFeatured,
          true,
          new Date(),
          isPremium
        ]);
        
        if (result.rowCount > 0) {
          batchStats.imported++;
          
          // Process cities and states
          await processLocationCounts(client, record);
        } else {
          batchStats.skipped++;
        }
      } catch (error) {
        console.error('Record import error:', error);
        batchStats.errors++;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    return batchStats;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Update city and state counts for a record
async function processLocationCounts(client: any, record: any) {
  // Skip if we don't have valid location data
  if (!record.state || !record.city) {
    return;
  }
  
  try {
    // Normalize state abbreviation
    let stateAbbr = record.state;
    if (stateAbbr.length === 2) {
      stateAbbr = stateAbbr.toUpperCase();
    }
    
    // Get state name from abbreviation
    const stateName = getStateNameFromAbbr(stateAbbr);
    const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
    
    // Check if state exists
    const stateResult = await client.query(
      'SELECT id FROM states WHERE abbr = $1',
      [stateAbbr]
    );
    
    let stateId;
    
    if (stateResult.rows.length === 0) {
      // Create state if it doesn't exist
      const newStateResult = await client.query(
        'INSERT INTO states (name, abbr, slug, laundry_count) VALUES ($1, $2, $3, 1) RETURNING id',
        [stateName, stateAbbr, stateSlug]
      );
      stateId = newStateResult.rows[0].id;
    } else {
      stateId = stateResult.rows[0].id;
      // Update laundry count
      await client.query(
        'UPDATE states SET laundry_count = laundry_count + 1 WHERE id = $1',
        [stateId]
      );
    }
    
    // Process city
    const cityName = record.city;
    const citySlug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr.toLowerCase()}`;
    
    // Check if city exists
    const cityResult = await client.query(
      'SELECT id FROM cities WHERE slug = $1',
      [citySlug]
    );
    
    if (cityResult.rows.length === 0) {
      // Create city if it doesn't exist
      await client.query(
        'INSERT INTO cities (name, state, slug, laundry_count) VALUES ($1, $2, $3, 1)',
        [cityName, stateAbbr, citySlug]
      );
    } else {
      // Update laundry count
      await client.query(
        'UPDATE cities SET laundry_count = laundry_count + 1 WHERE id = $1',
        [cityResult.rows[0].id]
      );
    }
  } catch (error) {
    console.error('Error processing location counts:', error);
  }
}

// Get full state name from abbreviation
function getStateNameFromAbbr(abbr: string) {
  const stateMap: {[key: string]: string} = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
  };
  
  return stateMap[abbr.toUpperCase()] || abbr;
}