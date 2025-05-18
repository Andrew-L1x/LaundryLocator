#!/bin/bash

# Auto Place Enhancement Script
# This script continuously runs the batch-place-enhancement.js script
# until all laundromats have been processed or the maximum number of
# batches has been reached
#
# Usage: bash scripts/auto-place-enhancement.sh [max_batches]
#
# Example: bash scripts/auto-place-enhancement.sh 5000
#
# This will run up to 5000 batches of place enhancements

MAX_BATCHES=${1:-10000}  # Default to 10000 batches if not specified
BATCH_COUNT=0
LOG_FILE="auto-place-enhancement.log"

# Function to log with timestamp
log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" | tee -a "$LOG_FILE"
}

log "Starting automated place enhancement with max batches: $MAX_BATCHES"

# Check if progress tracking file exists
if [ -f "place-enhancement-progress.json" ]; then
  PROCESSED=$(grep -o '"processedCount":[^,]*' place-enhancement-progress.json | cut -d':' -f2)
  TOTAL=$(grep -o '"total":[^,]*' place-enhancement-progress.json | cut -d':' -f2)
  
  log "Found progress file. Already processed: $PROCESSED out of $TOTAL laundromats"
else
  log "No progress file found. Starting from the beginning."
fi

# Run the enhancement process until completion or max batches
while [ $BATCH_COUNT -lt $MAX_BATCHES ]; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  
  # Get current progress
  if [ -f "place-enhancement-progress.json" ]; then
    PROCESSED=$(grep -o '"processedCount":[^,]*' place-enhancement-progress.json | cut -d':' -f2)
    TOTAL=$(grep -o '"total":[^,]*' place-enhancement-progress.json | cut -d':' -f2)
    
    # Check if we've processed all laundromats
    if [ "$PROCESSED" -ge "$TOTAL" ]; then
      log "All $TOTAL laundromats have been processed! Enhancement complete."
      break
    fi
    
    # Log progress
    PERCENT=$(awk "BEGIN {printf \"%.2f\", ($PROCESSED/$TOTAL)*100}")
    REMAINING=$((TOTAL - PROCESSED))
    AVG_TIME=7  # Average seconds per laundromat with optimized batches
    EST_TIME=$(($REMAINING * $AVG_TIME))
    EST_HOURS=$(($EST_TIME / 3600))
    EST_MINS=$((($EST_TIME % 3600) / 60))
    
    log "Progress: $PROCESSED/$TOTAL laundromats ($PERCENT%)"
    log "Estimated time remaining: ~$EST_HOURS hours $EST_MINS minutes"
  fi
  
  log "Running batch #$BATCH_COUNT of max $MAX_BATCHES"
  
  # Run a batch of place enhancements
  node scripts/batch-place-enhancement.js
  
  # Pause between batches to give the system a chance to breathe
  # and to avoid overloading the Google Places API
  log "Batch completed. Waiting 5 seconds before next batch..."
  sleep 5
done

if [ $BATCH_COUNT -ge $MAX_BATCHES ]; then
  log "Reached maximum number of batches ($MAX_BATCHES). Stopping."
  log "You can continue later by running this script again."
else
  log "Place enhancement process completed successfully!"
fi