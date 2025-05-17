/**
 * Launcher script for address fixing
 * 
 * This script spawns the address fixing process and properly captures
 * output to a log file.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Output log file
const logFile = path.join(logsDir, 'address-fix.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Log timestamp at start
const startTimestamp = new Date().toISOString();
logStream.write(`\n\n=== Address Fix Process Started at ${startTimestamp} ===\n\n`);

// Start the address fixing script
const addressFixProcess = spawn('node', [path.join(__dirname, 'fix-placeholder-addresses.js')], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

// Pipe stdout and stderr to the log file
addressFixProcess.stdout.pipe(logStream);
addressFixProcess.stderr.pipe(logStream);

addressFixProcess.on('close', (code) => {
  const endTimestamp = new Date().toISOString();
  logStream.write(`\n\n=== Address Fix Process Ended at ${endTimestamp} with code ${code} ===\n\n`);
  logStream.end();
});

// Display process ID for management
console.log(`Address fix process started with PID: ${addressFixProcess.pid}`);
console.log(`Log file: ${logFile}`);

// Let the process run independently of this script
addressFixProcess.unref();