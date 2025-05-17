/**
 * Generate Correct Environment File
 * 
 * This script generates a more accurate .env file using the PG* environment variables
 * which are more reliable than extracting from DATABASE_URL.
 */

import fs from 'fs';

// Get direct PG environment variables
const {
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  GOOGLE_MAPS_API_KEY
} = process.env;

// Validate required variables
if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
  console.error('Missing required database environment variables');
  process.exit(1);
}

if (!GOOGLE_MAPS_API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY environment variable');
  process.exit(1);
}

// Build the DATABASE_URL
const port = PGPORT || '5432';
const databaseUrl = `postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${port}/${PGDATABASE}`;

// Generate the .env file content
const envContent = `# Database connection
DATABASE_URL=${databaseUrl}

# API Keys
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}

# This file was generated on ${new Date().toISOString()}
# Copy this file to your WSL environment to run the import scripts
`;

// Print to console
console.log('Generated corrected .env file content:');
console.log('-'.repeat(50));
console.log(`PGHOST: ${PGHOST}`);
console.log(`PGPORT: ${port}`);
console.log(`PGDATABASE: ${PGDATABASE}`);
console.log(`PGUSER: ${PGUSER}`);
console.log('PGPASSWORD: [REDACTED]');
console.log('-'.repeat(50));
console.log('\nThe complete .env file (with actual credentials) has been saved to: .env-corrected\n');

// Write to file
fs.writeFileSync('.env-corrected', envContent);

console.log('Instructions:');
console.log('1. Copy the .env-corrected file to your WSL environment');
console.log('2. Rename it to .env in your project directory');
console.log('3. Run the import scripts with: node large-batch-import.js');