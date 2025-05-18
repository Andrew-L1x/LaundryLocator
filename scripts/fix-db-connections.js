/**
 * Fix Database Connections Script
 * 
 * This script automatically updates all JavaScript files in the scripts folder
 * to use secure SSL database connections.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptsDir = path.resolve(__dirname);

// Log function
function log(message) {
  console.log(`${new Date().toISOString()} - ${message}`);
}

// Find all JavaScript files
function findJsFiles(dir) {
  const files = fs.readdirSync(dir);
  return files.filter(file => file.endsWith('.js')).map(file => path.join(dir, file));
}

// Update pool configuration in files
function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has a database connection
    if (content.includes('new pg.Pool(') || content.includes('new Pool(')) {
      
      // Don't update this file itself
      if (filePath.includes('fix-db-connections.js')) {
        return false;
      }
      
      // Pattern for regular pool connection with pg
      const pgPoolPattern = /const\s+pool\s*=\s*new\s+pg\.Pool\(\s*\{\s*connectionString\s*:\s*process\.env\.DATABASE_URL\s*,?\s*\}\s*\)/;
      
      // Pattern for regular pool connection with Pool imported
      const poolPattern = /const\s+pool\s*=\s*new\s+Pool\(\s*\{\s*connectionString\s*:\s*process\.env\.DATABASE_URL\s*,?\s*\}\s*\)/;
      
      // Check if already has SSL
      if (content.includes('ssl: {') && content.includes('require: true')) {
        log(`File ${path.basename(filePath)} already has SSL config.`);
        return false;
      }
      
      // Replace pg.Pool pattern
      if (pgPoolPattern.test(content)) {
        content = content.replace(pgPoolPattern, 
          `const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
})`);
        fs.writeFileSync(filePath, content);
        return true;
      }
      
      // Replace Pool pattern
      if (poolPattern.test(content)) {
        content = content.replace(poolPattern, 
          `const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
})`);
        fs.writeFileSync(filePath, content);
        return true;
      }
      
      log(`Could not find exact pattern in ${path.basename(filePath)} - manual update may be needed.`);
      return false;
    }
    
    return false;
  } catch (error) {
    log(`Error updating ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  log('======================================');
  log('STARTING DATABASE CONNECTION SSL FIX');
  log('======================================');
  
  const jsFiles = findJsFiles(scriptsDir);
  log(`Found ${jsFiles.length} JavaScript files`);
  
  let updatedCount = 0;
  
  for (const file of jsFiles) {
    const fileName = path.basename(file);
    log(`Checking ${fileName}...`);
    
    const updated = updateFile(file);
    if (updated) {
      updatedCount++;
      log(`Updated ${fileName} with SSL configuration.`);
    }
  }
  
  log('======================================');
  log(`COMPLETED - Updated ${updatedCount} files`);
  log('======================================');
}

// Run the script
main().catch(error => {
  log(`Error: ${error.message}`);
  process.exit(1);
});