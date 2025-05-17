/**
 * Check the status of the laundromat import process
 * Shows progress information and estimated time remaining
 */

import { promises as fs } from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const PROGRESS_FILE = '/home/runner/workspace/import-progress.json';
const PID_FILE = '/home/runner/workspace/import-service.pid';
const TOTAL_RECORDS = 27188;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkImportStatus() {
  console.log('Checking laundromat import status...');
  
  try {
    // Check if process is running
    let isRunning = false;
    try {
      const pidData = await fs.readFile(PID_FILE, 'utf8');
      const pid = parseInt(pidData.trim());
      
      try {
        process.kill(pid, 0);
        isRunning = true;
        console.log(`Import service is running with PID: ${pid}`);
      } catch (e) {
        console.log('Import service is not currently running');
      }
    } catch (e) {
      console.log('No active import service found');
    }
    
    // Load progress file
    let progress = null;
    try {
      const progressData = await fs.readFile(PROGRESS_FILE, 'utf8');
      progress = JSON.parse(progressData);
    } catch (e) {
      console.log('No progress data found');
      return;
    }
    
    // Get current database count
    const countResult = await pool.query('SELECT COUNT(*) FROM laundromats');
    const currentCount = parseInt(countResult.rows[0].count);
    
    // Calculate progress percentages
    const remainingStates = progress.remainingStates || [];
    const completedStates = progress.completedStates || [];
    const totalStates = remainingStates.length + completedStates.length;
    const completedStateCount = completedStates.length;
    const recordProgress = Math.round((currentCount / TOTAL_RECORDS) * 100);
    const stateProgress = totalStates > 0 ? Math.round((completedStateCount / totalStates) * 100) : 0;
    
    // Calculate time estimates
    let estimatedRemaining = 'unknown';
    if (progress.recordsPerMinute > 0) {
      const remaining = TOTAL_RECORDS - currentCount;
      const minutesRemaining = remaining / progress.recordsPerMinute;
      const hoursRemaining = (minutesRemaining / 60).toFixed(1);
      estimatedRemaining = `${hoursRemaining} hours`;
    }
    
    // Format last update time
    const lastUpdate = new Date(progress.lastUpdate || progress.startTime);
    const timeSinceUpdate = Math.round((Date.now() - lastUpdate.getTime()) / 1000 / 60);
    
    // State distribution
    const stateDistribution = await pool.query(
      "SELECT state, COUNT(*) FROM laundromats GROUP BY state ORDER BY COUNT(*) DESC LIMIT 10"
    );
    
    // Print status report
    console.log(`
===== Laundromat Import Status =====
Service status: ${isRunning ? 'Running' : 'Stopped'}
Current progress: ${currentCount} of ${TOTAL_RECORDS} records (${recordProgress}%)
States completed: ${completedStates} of ${totalStates} (${stateProgress}%)
Current state: ${progress.currentState || 'None'}
Current offset: ${progress.currentOffset || 0}
Import rate: ${Math.round(progress.recordsPerMinute || 0)} records/minute
Estimated time remaining: ${estimatedRemaining}
Last update: ${timeSinceUpdate} minutes ago
Total batches run: ${progress.batchesRun || 0}
Total run time: ${Math.round((progress.totalRunTime || 0) / 60)} minutes

Top 10 States:
${stateDistribution.rows.map(row => `- ${row.state}: ${row.count} records`).join('\n')}

Remaining states: ${remainingStates.length}
${remainingStates.length <= 10 ? 
  '- ' + remainingStates.join('\n- ') : 
  '(too many to list)'}
==================================
    `);
    
    // Check for errors
    if (progress.errors && progress.errors.length > 0) {
      console.log(`\n===== Recent Errors (${progress.errors.length} total) =====`);
      // Show the last 5 errors
      const recentErrors = progress.errors.slice(-5);
      for (const error of recentErrors) {
        console.log(`- ${error.timestamp}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error checking status: ${error.message}`);
  } finally {
    await pool.end();
  }
}

checkImportStatus().catch(console.error);