/**
 * Script to start the background import process in a detached mode
 * This allows the import to continue even when the browser is disconnected
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function startImportService() {
  console.log('Starting laundromat import service in background mode...');
  
  try {
    // Check if there's already a process running
    try {
      const pid = await fs.readFile('/home/runner/workspace/import-service.pid', 'utf8');
      console.log(`Found existing import service with PID: ${pid}`);
      
      // Check if process is still running
      try {
        process.kill(parseInt(pid), 0);
        console.log('Import service is already running. Stop it first if you want to restart.');
        return;
      } catch (e) {
        console.log('Previous import service is not running, starting new one...');
      }
    } catch (e) {
      // No PID file, continue
    }
    
    // Start the background process
    const child = spawn('node', ['scripts/background-import.js'], {
      detached: true,
      stdio: 'ignore',
      cwd: '/home/runner/workspace'
    });
    
    // Detach the child process
    child.unref();
    
    console.log(`Import service started with PID: ${child.pid}`);
    console.log(`
===== Import Service Information =====
- The import service is now running in the background
- It will continue to run even when you disconnect from Replit
- Progress is saved to '/home/runner/workspace/import-progress.json'
- Logs are saved to '/home/runner/workspace/import-log.json'
- To stop the service manually, use 'node scripts/stop-background-import.js'
- To check the status, use 'node scripts/check-import-status.js'
====================================
    `);
  } catch (error) {
    console.error(`Error starting import service: ${error.message}`);
  }
}

startImportService().catch(console.error);