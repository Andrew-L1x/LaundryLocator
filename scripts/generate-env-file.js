/**
 * Environment File Generator
 * 
 * This script generates a properly formatted .env file with
 * the database connection information and API keys.
 */

import fs from 'fs';

// Get environment variables
const {
  PGUSER,
  PGPASSWORD,
  PGHOST,
  PGPORT,
  PGDATABASE,
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
console.log('Generated .env file content:');
console.log('-'.repeat(50));
console.log('DATABASE_URL=postgres://' + PGUSER + ':********@' + PGHOST + ':' + port + '/' + PGDATABASE);
console.log('GOOGLE_MAPS_API_KEY=' + GOOGLE_MAPS_API_KEY.substring(0, 3) + '...' + GOOGLE_MAPS_API_KEY.substring(GOOGLE_MAPS_API_KEY.length - 3));
console.log('-'.repeat(50));
console.log('\nThe complete .env file (with actual credentials) has been saved to: .env-for-wsl\n');

// Write to file
fs.writeFileSync('.env-for-wsl', envContent);

console.log('Instructions:');
console.log('1. Copy the .env-for-wsl file to your WSL environment');
console.log('2. Rename it to .env in your project directory');
console.log('3. Run the import scripts with: node large-batch-import.js');