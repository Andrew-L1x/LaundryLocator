#!/bin/bash

# This script starts the background import service and keeps it running
# even if the terminal session is closed

echo "Starting laundromat import service in background mode..."

# Make sure the script has execute permissions
chmod +x scripts/background-import.js

# Run the service with nohup to keep it running after terminal closes
nohup node scripts/background-import.js > import-service.log 2>&1 &

# Get the process ID
IMPORT_PID=$!
echo "Import service started with PID: $IMPORT_PID"
echo $IMPORT_PID > import-service.pid

echo "Service is now running in the background."
echo "To monitor progress, use: tail -f import-log.txt"
echo "To check status, use: cat import-status.json"
echo "To stop the service, use: touch stop-import.txt"