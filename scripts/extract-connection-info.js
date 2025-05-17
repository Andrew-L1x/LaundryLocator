/**
 * Connection Info Extractor
 * 
 * This script safely extracts the database connection components
 * without revealing the full connection string.
 * 
 * Run with: node scripts/extract-connection-info.js
 */

// Get the DATABASE_URL from environment variables
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL environment variable not set');
  process.exit(1);
}

try {
  // Parse the connection string
  const url = new URL(dbUrl);
  
  // Extract components
  const host = url.hostname;
  const port = url.port || '5432';
  const database = url.pathname.substring(1); // Remove leading slash
  const username = url.username;
  
  // Print information individually (without revealing password)
  console.log('='.repeat(50));
  console.log('DATABASE CONNECTION INFORMATION');
  console.log('='.repeat(50));
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Database: ${database}`);
  console.log(`Username: ${username}`);
  console.log('='.repeat(50));
  console.log('\nFor your .env file on WSL, use this format:');
  console.log(`DATABASE_URL=postgres://${username}:YOUR_PASSWORD@${host}:${port}/${database}`);
  console.log('\nNote: Replace YOUR_PASSWORD with the actual password');
  console.log('='.repeat(50));
  
  // Also provide GOOGLE_MAPS_API_KEY placeholder
  console.log('\nAlso add your Google Maps API key:');
  console.log('GOOGLE_MAPS_API_KEY=your_google_maps_api_key');
  console.log('='.repeat(50));
} catch (error) {
  console.error('Error parsing DATABASE_URL:', error.message);
  process.exit(1);
}