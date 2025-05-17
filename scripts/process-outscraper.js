/**
 * Process Outscraper Excel File
 * 
 * This script reads data from the Outscraper Excel file and imports
 * laundromat records into a JSON format.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// Configuration
const EXCEL_FILE = path.join(process.cwd(), 'attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');
const OUTPUT_FILE = path.join(process.cwd(), 'data/outscraper-laundromats.json');

/**
 * Generate a slug from a name and location
 */
function generateSlug(name, city, state) {
  const base = [
    name,
    city,
    state
  ]
    .map(s => s ? s.toLowerCase() : '')
    .map(s => s.replace(/[^a-z0-9]+/g, '-'))
    .map(s => s.replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-');
  
  return base || 'unnamed-laundromat';
}

/**
 * Generate SEO description for a laundromat
 */
function generateSeoDescription(record) {
  const services = [
    "self-service laundry",
    "coin-operated machines",
    "convenient location",
  ];
  
  if (record.website) {
    services.push("online services");
  }
  
  if (record.rating > 4) {
    services.push("highly rated service");
  }
  
  return `Visit ${record.name} in ${record.city}, ${record.state}. ${
    services.join(', ')
  }. We provide quality laundry services for the ${record.city} community.`;
}

/**
 * Generate SEO title for a laundromat
 */
function generateSeoTitle(record) {
  return `${record.name} - Laundromat in ${record.city}, ${record.state}`;
}

/**
 * Process the Excel file
 */
async function processExcelFile() {
  console.log(`Reading Excel file: ${EXCEL_FILE}`);
  
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${rawData.length} records in Excel file`);
    
    // Process each record
    const processedRecords = rawData.map((row, index) => {
      // Extract state from full address
      let state = "";
      const addressParts = row.address?.split(',') || [];
      if (addressParts.length >= 2) {
        const lastPart = addressParts[addressParts.length - 1].trim();
        const stateZipParts = lastPart.split(' ');
        if (stateZipParts.length >= 1) {
          state = stateZipParts[0].trim();
        }
      }
      
      // Extract city from full address
      let city = "";
      if (addressParts.length >= 2) {
        city = addressParts[addressParts.length - 2].trim();
      }
      
      // Extract street address
      let streetAddress = "";
      if (addressParts.length >= 1) {
        streetAddress = addressParts[0].trim();
      }
      
      // Extract ZIP code
      let zip = "";
      if (addressParts.length >= 2) {
        const lastPart = addressParts[addressParts.length - 1].trim();
        const stateZipParts = lastPart.split(' ');
        if (stateZipParts.length >= 2) {
          zip = stateZipParts[stateZipParts.length - 1].trim();
        }
      }
      
      // Parse rating
      let rating = 0;
      if (row.rating && typeof row.rating === 'string') {
        const match = row.rating.match(/(\d+(\.\d+)?)/);
        if (match) {
          rating = parseFloat(match[1]);
        }
      } else if (typeof row.rating === 'number') {
        rating = row.rating;
      }
      
      // Parse review count
      let reviewCount = 0;
      if (row.reviews && typeof row.reviews === 'string') {
        const match = row.reviews.match(/(\d+)/);
        if (match) {
          reviewCount = parseInt(match[1], 10);
        }
      } else if (typeof row.reviews === 'number') {
        reviewCount = row.reviews;
      }
      
      // Get services
      const services = [
        "self-service laundry",
        "coin-operated"
      ];
      
      // Generate hours
      const hours = {
        "Monday": "7:00 AM - 10:00 PM",
        "Tuesday": "7:00 AM - 10:00 PM",
        "Wednesday": "7:00 AM - 10:00 PM",
        "Thursday": "7:00 AM - 10:00 PM",
        "Friday": "7:00 AM - 10:00 PM",
        "Saturday": "7:00 AM - 10:00 PM",
        "Sunday": "7:00 AM - 10:00 PM"
      };
      
      // Generate amenities
      const amenities = [
        "vending machines",
        "seating area"
      ];
      
      // Generate slug
      const slug = generateSlug(row.title || "Laundromat", city, state);
      
      return {
        id: 2000 + index,
        name: row.title || `Laundromat ${index}`,
        slug,
        address: streetAddress,
        city,
        state,
        zip,
        phone: row.phone || "",
        website: row.website || null,
        latitude: row.gps_coordinates?.split(',')[0]?.trim() || "",
        longitude: row.gps_coordinates?.split(',')[1]?.trim() || "",
        rating: rating || 4.0,
        reviewCount: reviewCount || 0,
        hours: JSON.stringify(hours),
        services: JSON.stringify(services),
        amenities: JSON.stringify(amenities),
        description: row.description || `Laundromat located in ${city}, ${state}.`,
        seoTitle: generateSeoTitle({ name: row.title || "Laundromat", city, state }),
        seoDescription: generateSeoDescription({ 
          name: row.title || "Laundromat", 
          city, 
          state, 
          website: row.website,
          rating
        }),
        seoTags: JSON.stringify([
          "laundromat",
          `laundromat in ${city}`,
          `laundry in ${state}`,
          "coin laundry",
          "self-service laundry"
        ]),
        listingType: "standard",
        isFeatured: false,
        isPremium: false
      };
    });
    
    // Filter out records with missing essential data
    const validRecords = processedRecords.filter(record => 
      record.name && record.city && record.state
    );
    
    console.log(`Processed ${validRecords.length} valid records`);
    
    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validRecords, null, 2));
    console.log(`Saved processed data to ${OUTPUT_FILE}`);
    
    return validRecords;
  } catch (error) {
    console.error("Error processing Excel file:", error);
    throw error;
  }
}

// Run the process
console.log("=== Starting Outscraper Data Processing ===");
processExcelFile()
  .then(data => {
    console.log(`Successfully processed ${data.length} laundromat records`);
    console.log("=== Processing Complete ===");
  })
  .catch(error => {
    console.error("Processing failed:", error);
  });