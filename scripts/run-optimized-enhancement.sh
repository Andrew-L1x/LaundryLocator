#!/bin/bash

# Optimized Place Enhancement Runner Script
# This script runs the optimized place enhancement script continuously
# with proper monitoring and error handling

echo "$(date +"%Y-%m-%d %H:%M:%S") Starting optimized place enhancement process"
echo "$(date +"%Y-%m-%d %H:%M:%S") Press Ctrl+C to stop the process at any time"

# Check if the progress file exists
PROGRESS_FILE="place-enhancement-progress.json"
LOG_FILE="optimized-place-enhancement.log"

if [ -f "$PROGRESS_FILE" ]; then
  PROCESSED=$(grep -o '"processedCount":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
  TOTAL=$(grep -o '"total":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
  
  echo "$(date +"%Y-%m-%d %H:%M:%S") Progress: $PROCESSED / $TOTAL laundromats processed"
  
  # Calculate percentage and estimated time remaining
  if [ ! -z "$PROCESSED" ] && [ ! -z "$TOTAL" ] && [ "$TOTAL" -ne 0 ]; then
    PERCENT=$(awk "BEGIN {printf \"%.2f\", ($PROCESSED/$TOTAL)*100}")
    REMAINING=$((TOTAL - PROCESSED))
    
    # Estimate 3 seconds per laundromat (optimized)
    EST_SECONDS=$((REMAINING * 3))
    EST_HOURS=$((EST_SECONDS / 3600))
    EST_MINUTES=$(((EST_SECONDS % 3600) / 60))
    
    echo "$(date +"%Y-%m-%d %H:%M:%S") $PERCENT% complete, estimated time remaining: ~$EST_HOURS hours, $EST_MINUTES minutes"
  fi
else
  echo "$(date +"%Y-%m-%d %H:%M:%S") No progress file found. Starting from the beginning."
fi

# Maximum number of batches to run (very high value to process all)
MAX_BATCHES=${1:-100000}
BATCH_COUNT=0

# Loop to run the script multiple times
while [ $BATCH_COUNT -lt $MAX_BATCHES ]; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  
  echo "$(date +"%Y-%m-%d %H:%M:%S") Running batch #$BATCH_COUNT of max $MAX_BATCHES"
  
  # Run the optimized script
  node scripts/optimized-place-enhancement.js
  
  # Check the exit code
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "$(date +"%Y-%m-%d %H:%M:%S") WARNING: Script exited with error code $EXIT_CODE"
  fi
  
  # Check if all places have been processed
  if [ -f "$PROGRESS_FILE" ]; then
    PROCESSED=$(grep -o '"processedCount":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
    TOTAL=$(grep -o '"total":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
    
    echo "$(date +"%Y-%m-%d %H:%M:%S") Progress: $PROCESSED / $TOTAL laundromats processed"
    
    # Exit if all processing is complete
    if [ "$PROCESSED" -ge "$TOTAL" ]; then
      echo "$(date +"%Y-%m-%d %H:%M:%S") All laundromats have been processed! Enhancement complete."
      break
    fi
  fi
  
  # Add a delay between batch runs to prevent overloading
  echo "$(date +"%Y-%m-%d %H:%M:%S") Waiting 5 seconds before next batch..."
  sleep 5
done

echo "$(date +"%Y-%m-%d %H:%M:%S") Place enhancement process completed after $BATCH_COUNT batches"