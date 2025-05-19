#!/bin/bash

# WSL Place Enhancement Runner
# This script is designed to be run directly in your WSL environment
# without needing to modify any existing git repository files

echo "=========================================="
echo "Starting laundromat data enhancement process"
echo "This script will use the optimized enhancement script"
echo "that works within WSL and Google API constraints"
echo "=========================================="
echo ""

# Make sure the script is executable
chmod +x scripts/run-optimized-enhancement.sh

# Set environment variables if needed (Google Maps API Key)
if [ -f ".env-for-wsl" ]; then
  echo "Found .env-for-wsl file, loading environment variables..."
  source .env-for-wsl
fi

# Start the optimized enhancement script
./scripts/run-optimized-enhancement.sh

# Exit with the same status code
exit $?