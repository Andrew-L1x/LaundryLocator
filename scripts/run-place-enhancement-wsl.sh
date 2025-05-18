#!/bin/bash

# Run Place Enhancement for WSL
# This shell script automates running the batch-place-enhancement.js script
# in a Linux/WSL environment.
#
# Usage:
#   bash scripts/run-place-enhancement-wsl.sh

# Create log file if it doesn't exist
LOGFILE="batch-place-enhancement.log"
touch $LOGFILE

# Function to log messages
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  local message="[$timestamp] $1"
  echo "$message"
  echo "$message" >> $LOGFILE
}

# Progress tracking file
PROGRESS_FILE="place-enhancement-progress.json"
BATCH_SIZE=5 # Process 5 laundromats per batch
PAUSE_BETWEEN_BATCHES=60 # 60 seconds between batches

# Create progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  log "Creating new progress file..."
  echo '{
  "processedCount": 0,
  "totalLaundromats": 27000,
  "lastProcessedId": 0,
  "errors": [],
  "startTime": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}' > $PROGRESS_FILE
fi

# Function to get current position from progress file
get_position() {
  if [ -f "$PROGRESS_FILE" ]; then
    local position=$(grep -o '"lastProcessedId":[0-9]*' $PROGRESS_FILE | cut -d':' -f2)
    if [ -z "$position" ]; then
      echo 0
    else
      echo $position
    fi
  else
    echo 0
  fi
}

# Function to get total processed count
get_processed_count() {
  if [ -f "$PROGRESS_FILE" ]; then
    local count=$(grep -o '"processedCount":[0-9]*' $PROGRESS_FILE | cut -d':' -f2)
    if [ -z "$count" ]; then
      echo 0
    else
      echo $count
    fi
  else
    echo 0
  fi
}

# Function to get total laundromats
get_total_laundromats() {
  if [ -f "$PROGRESS_FILE" ]; then
    local total=$(grep -o '"totalLaundromats":[0-9]*' $PROGRESS_FILE | cut -d':' -f2)
    if [ -z "$total" ]; then
      echo 27000 # Default estimate
    else
      echo $total
    fi
  else
    echo 27000 # Default estimate
  fi
}

# Calculate and log estimated time remaining
log_estimated_time_remaining() {
  local current_position=$(get_position)
  local total_processed=$(get_processed_count)
  local total_laundromats=$(get_total_laundromats)
  
  if [ $total_processed -eq 0 ]; then
    log "No progress data available yet."
    return
  fi
  
  # Get start time from progress file
  local start_time_str=$(grep -o '"startTime":"[^"]*"' $PROGRESS_FILE | cut -d'"' -f4)
  if [ -z "$start_time_str" ]; then
    log "No start time in progress file. Can't calculate time remaining."
    return
  fi
  
  # Calculate elapsed time (rough estimate in seconds)
  local start_timestamp=$(date -d "$start_time_str" +%s)
  local current_timestamp=$(date +%s)
  local elapsed_seconds=$((current_timestamp - start_timestamp))
  local elapsed_hours=$(echo "scale=2; $elapsed_seconds / 3600" | bc)
  
  # Calculate processing rate
  local process_rate=$(echo "scale=2; $total_processed / $elapsed_hours" | bc)
  
  # Calculate estimated time remaining
  local remaining=$((total_laundromats - current_position))
  local est_hours_remaining=$(echo "scale=2; $remaining / $process_rate" | bc)
  
  # Convert to days, hours, minutes
  local days=$(echo "$est_hours_remaining/24" | bc)
  local hours=$(echo "$est_hours_remaining%24" | bc)
  local minutes=$(echo "($est_hours_remaining*60)%60" | bc)
  
  log "Progress: $current_position/$total_laundromats ($(echo "scale=2; ($current_position/$total_laundromats)*100" | bc)%)"
  log "Processing rate: $process_rate laundromats per hour"
  log "Estimated time remaining: $days days, $hours hours, $minutes minutes"
}

# Trap Ctrl+C to exit gracefully
trap ctrl_c INT
function ctrl_c() {
  log "Process stopped by user. Progress saved."
  exit 0
}

# Main loop
log "Starting place enhancement process in WSL environment"
log "Press Ctrl+C to stop the process at any time"

while true; do
  current_position=$(get_position)
  
  # Log progress before each batch
  log "Current position: $current_position"
  log_estimated_time_remaining
  
  # Run one batch
  log "Running batch starting at position $current_position with batch size $BATCH_SIZE"
  node scripts/batch-place-enhancement.js --start $current_position --limit $BATCH_SIZE
  
  # Check exit status
  if [ $? -ne 0 ]; then
    log "Batch failed. Pausing for 2 minutes before retry..."
    sleep 120
  else
    # Pause between batches
    log "Batch completed. Pausing for $PAUSE_BETWEEN_BATCHES seconds before next batch..."
    sleep $PAUSE_BETWEEN_BATCHES
  fi
done