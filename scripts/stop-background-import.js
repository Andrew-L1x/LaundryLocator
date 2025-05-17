/**
 * Script to stop the background import process
 * Creates a stop file that signals the import process to shut down gracefully
 */

import { promises as fs } from 'fs';

async function stopImportService() {
  console.log('Stopping laundromat import service...');
  
  try {
    // Check if process is running
    let pid;
    try {
      pid = await fs.readFile('./import-service.pid', 'utf8');
      console.log(`Found import service with PID: ${pid}`);
    } catch (e) {
      console.log('No active import service found');
      return;
    }
    
    // Create a stop file
    await fs.writeFile('./import-stop', 'STOP');
    console.log('Created stop signal file');
    
    // Try to send SIGINT to the process
    try {
      process.kill(parseInt(pid), 'SIGINT');
      console.log('Sent shutdown signal to import service');
    } catch (e) {
      console.log('Process was not running, removing PID file');
      try {
        await fs.unlink('./import-service.pid');
      } catch (e) {
        // Ignore error when removing file
      }
    }
    
    console.log('Import service will finish current batch and shut down gracefully');
  } catch (error) {
    console.error(`Error stopping import service: ${error.message}`);
  }
}

stopImportService().catch(console.error);