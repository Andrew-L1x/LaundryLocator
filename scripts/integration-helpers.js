// Helper functions to integrate the enriched laundromat data
import fs from 'fs-extra';
import { stringify } from 'csv-stringify/sync';

// Format enriched data into a standardized JSON structure
// that can be easily imported by the DB server
export function prepareEnrichedDataForImport(sourcePath) {
  try {
    // Load the enriched CSV data
    const csvData = fs.readFileSync(sourcePath, 'utf8');
    const lines = csvData.split('\n');
    const header = lines[0].split(',');
    
    // Create a sample of the first 500 laundromats for quick import
    const sampleData = [];
    
    for (let i = 1; i < Math.min(lines.length, 501); i++) {
      if (!lines[i].trim()) continue;
      
      const columns = parseCsvLine(lines[i]);
      const record = {};
      
      header.forEach((field, index) => {
        record[field] = columns[index] || '';
      });
      
      sampleData.push(record);
    }
    
    // Save the transformed data
    const outputPath = 'data/import/sample_laundromats.json';
    fs.ensureDirSync('data/import');
    fs.writeFileSync(outputPath, JSON.stringify(sampleData, null, 2));
    
    // Also create a simplified CSV for database import
    const simplifiedData = sampleData.map(record => ({
      name: record.name,
      slug: record.slug,
      address: record.full_address,
      city: record.city,
      state: record.state,
      zip: record.postal_code,
      phone: record.phone,
      website: record.site,
      latitude: record.latitude,
      longitude: record.longitude,
      description: record.seoDescription,
      summary: record.seoSummary,
      hours: record.working_hours,
      image_url: record.photo,
      logo_url: record.logo || '',
      rating: record.rating || 0,
      review_count: record.reviews || 0,
      seo_tags: record.seoTags,
      premium_score: record.premiumScore || 50,
      featured: parseInt(record.premiumScore) >= 95 ? 'true' : 'false',
      premium: parseInt(record.premiumScore) >= 90 ? 'true' : 'false'
    }));
    
    const simplifiedCsv = stringify(simplifiedData, { header: true });
    fs.writeFileSync('data/import/sample_laundromats.csv', simplifiedCsv);
    
    return {
      success: true,
      message: `Prepared ${sampleData.length} records for import`,
      jsonPath: outputPath,
      csvPath: 'data/import/sample_laundromats.csv'
    };
  } catch (error) {
    return {
      success: false,
      message: `Error preparing data: ${error.message}`
    };
  }
}

// Parse a CSV line handling quoted fields correctly
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Double quotes inside quotes
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}