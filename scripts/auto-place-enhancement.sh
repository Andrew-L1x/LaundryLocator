#!/bin/bash

# Automated Google Places Enhancement Script
# This script runs the batch-place-enhancement-wsl.js script continuously with
# proper pauses between batches to respect API rate limits and track progress.
#
# Usage: bash scripts/auto-place-enhancement.sh [number_of_batches]
# Example: bash scripts/auto-place-enhancement.sh 500

# Load progress from file if it exists
PROGRESS_FILE="place-enhancement-progress.json"
POSITION=0

if [ -f "$PROGRESS_FILE" ]; then
  # Extract the last processed ID using grep and cut
  LAST_ID=$(grep -o '"lastProcessedId":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
  if [ ! -z "$LAST_ID" ]; then
    POSITION=$LAST_ID
  fi
fi

echo "$(date +"%Y-%m-%d %H:%M:%S") Starting place enhancement process"
echo "$(date +"%Y-%m-%d %H:%M:%S") Press Ctrl+C to stop the process at any time"
echo "$(date +"%Y-%m-%d %H:%M:%S") Current position: $POSITION"

# Check if the file exists and print some info
if [ -f "$PROGRESS_FILE" ]; then
  PROCESSED_COUNT=$(grep -o '"processedCount":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
  TOTAL_COUNT=$(grep -o '"totalLaundromats":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
  
  if [ ! -z "$PROCESSED_COUNT" ] && [ ! -z "$TOTAL_COUNT" ]; then
    PERCENT=$(echo "scale=2; $PROCESSED_COUNT * 100 / $TOTAL_COUNT" | bc)
    echo "$(date +"%Y-%m-%d %H:%M:%S") Progress: $PROCESSED_COUNT / $TOTAL_COUNT laundromats ($PERCENT%)"
  else
    echo "$(date +"%Y-%m-%d %H:%M:%S") Progress data available but incomplete"
  fi
else
  echo "$(date +"%Y-%m-%d %H:%M:%S") No progress data available yet."
fi

# Set up a continuous processing loop that handles batches
BATCH_SIZE=5
MAX_BATCHES=${1:-1000}  # Default to 1000 batches unless specified as first argument
BATCH_COUNT=0

echo "$(date +"%Y-%m-%d %H:%M:%S") Running up to $MAX_BATCHES batches of $BATCH_SIZE laundromats each"
echo "$(date +"%Y-%m-%d %H:%M:%S") Starting position: $POSITION"

# Start the batch processing loop
while [ $BATCH_COUNT -lt $MAX_BATCHES ]; do
  echo "$(date +"%Y-%m-%d %H:%M:%S") Running batch #$((BATCH_COUNT+1)) of $MAX_BATCHES"
  
  # Run the processing script and capture errors
  if node scripts/batch-place-enhancement-wsl.js --start $POSITION --limit $BATCH_SIZE; then
    echo "$(date +"%Y-%m-%d %H:%M:%S") Batch completed successfully"
  else
    echo "$(date +"%Y-%m-%d %H:%M:%S") WARNING: Batch exited with error, continuing with next batch"
  fi
  
  # Get the new position from the progress file
  if [ -f "$PROGRESS_FILE" ]; then
    NEW_POSITION=$(grep -o '"lastProcessedId":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
    if [ ! -z "$NEW_POSITION" ] && [ "$NEW_POSITION" != "$POSITION" ]; then
      POSITION=$NEW_POSITION
      echo "$(date +"%Y-%m-%d %H:%M:%S") Progress updated to position $POSITION"
    else
      # If position didn't update, move forward by batch size
      POSITION=$((POSITION + BATCH_SIZE))
      echo "$(date +"%Y-%m-%d %H:%M:%S") Warning: Progress file not updated. Manually advancing to $POSITION"
    fi
  else
    # If progress file doesn't exist, move forward by batch size
    POSITION=$((POSITION + BATCH_SIZE))
    echo "$(date +"%Y-%m-%d %H:%M:%S") Warning: Progress file not found. Manually advancing to $POSITION"
  fi
  
  # Increment batch counter
  BATCH_COUNT=$((BATCH_COUNT + 1))
  
  # Check progress and show estimated completion
  if [ -f "$PROGRESS_FILE" ]; then
    PROCESSED_COUNT=$(grep -o '"processedCount":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
    TOTAL_COUNT=$(grep -o '"totalLaundromats":[0-9]*' "$PROGRESS_FILE" | cut -d':' -f2)
    
    if [ ! -z "$PROCESSED_COUNT" ] && [ ! -z "$TOTAL_COUNT" ]; then
      PERCENT=$(echo "scale=2; $PROCESSED_COUNT * 100 / $TOTAL_COUNT" | bc)
      REMAINING=$((TOTAL_COUNT - PROCESSED_COUNT))
      
      # Calculate estimated time remaining based on rate of 5 records per minute
      MINUTES_REMAINING=$(echo "scale=1; $REMAINING / 5" | bc)
      HOURS_REMAINING=$(echo "scale=1; $MINUTES_REMAINING / 60" | bc)
      
      echo "$(date +"%Y-%m-%d %H:%M:%S") Progress: $PROCESSED_COUNT / $TOTAL_COUNT laundromats ($PERCENT%)"
      echo "$(date +"%Y-%m-%d %H:%M:%S") Estimated time remaining: $HOURS_REMAINING hours ($MINUTES_REMAINING minutes)"
    fi
  fi
  
  # Add a delay between batches to prevent overloading
  echo "$(date +"%Y-%m-%d %H:%M:%S") Pausing for 5 seconds before next batch"
  sleep 5
done

echo "$(date +"%Y-%m-%d %H:%M:%S") Processing complete after $BATCH_COUNT batches"
echo "$(date +"%Y-%m-%d %H:%M:%S") Final position: $POSITION"