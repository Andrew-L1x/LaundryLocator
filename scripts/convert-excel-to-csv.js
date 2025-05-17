import xlsx from 'xlsx';
import fs from 'fs-extra';
import path from 'path';

// Ensure output directory exists
fs.ensureDirSync('data/csv_uploads');

// Read the Excel file
console.log('Reading Excel file...');
const workbook = xlsx.readFile('attached_assets/Outscraper-20250515181738xl3e_laundromat.xlsx');

// Get the first sheet
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

// Convert to CSV
console.log('Converting to CSV...');
const csvData = xlsx.utils.sheet_to_csv(worksheet);

// Save the CSV file
const outputPath = path.join('data/csv_uploads', 'laundromat_data.csv');
fs.writeFileSync(outputPath, csvData);

console.log(`File converted and saved to ${outputPath}`);
console.log(`Total rows: ${csvData.split('\n').length - 1}`);