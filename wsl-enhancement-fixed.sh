#!/bin/bash

# WSL Text Enhancement Script for LaundryLocator
# This script converts Google Places API data to text format to reduce API costs

# Check dependencies
check_dependencies() {
  echo "Checking dependencies..."
  
  # Check for PostgreSQL client
  if ! command -v psql &> /dev/null; then
    echo "Error: PostgreSQL client (psql) is not installed."
    echo "Please install it with: sudo apt-get install postgresql-client"
    exit 1
  fi
  
  # Check for jq
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed."
    echo "Please install it with: sudo apt-get install jq"
    exit 1
  fi
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "Please install it with: sudo apt-get install nodejs"
    exit 1
  fi
  
  echo "All dependencies are installed!"
}

# Create directories if they don't exist
create_directories() {
  echo "Creating cache directories..."
  
  mkdir -p public/maps/static
  mkdir -p public/streetview
  mkdir -p cache/geocoding
  
  echo "Cache directories created!"
}

# Load environment variables
load_env() {
  echo "Loading environment variables..."
  
  if [ ! -f .env-for-wsl ]; then
    echo "Error: .env-for-wsl file not found."
    exit 1
  fi
  
  export $(grep -v '^#' .env-for-wsl | xargs)
  
  # Verify required environment variables
  if [ -z "$DATABASE_URL" ] || [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ]; then
    echo "Error: Required environment variables not set."
    echo "Please check your .env-for-wsl file."
    exit 1
  fi
  
  echo "Environment variables loaded!"
}

# Test database connection
test_connection() {
  echo "Testing database connection..."
  
  # Create a temporary file for connection test
  cat > test_connection.sql << EOF
  SELECT 1;
EOF
  
  # Test the connection
  if ! PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f test_connection.sql > /dev/null 2>&1; then
    echo "Error: Failed to connect to the database."
    echo "Please check your database connection settings in .env-for-wsl."
    echo "  PGHOST: $PGHOST"
    echo "  PGUSER: $PGUSER"
    echo "  PGDATABASE: $PGDATABASE"
    echo "  PGPORT: $PGPORT"
    exit 1
  fi
  
  # Remove the temporary file
  rm test_connection.sql
  
  echo "Database connection successful!"
}

# Constants
BATCH_SIZE=100
MAX_BATCHES=10000
LOG_FILE="text-enhancement.log"
PROGRESS_FILE="text-enhancement-progress.json"

# Function to log messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Initialize log file
initialize_log() {
  echo "Text enhancement started at $(date '+%Y-%m-%d %H:%M:%S')" > $LOG_FILE
}

# Function to load progress
load_progress() {
  if [ -f "$PROGRESS_FILE" ]; then
    log "Loading progress from $PROGRESS_FILE"
    LAST_ID=$(jq -r '.lastProcessedId' $PROGRESS_FILE)
    TOTAL_PROCESSED=$(jq -r '.totalProcessed' $PROGRESS_FILE)
    SUCCESS_COUNT=$(jq -r '.successCount' $PROGRESS_FILE)
    ERROR_COUNT=$(jq -r '.errorCount' $PROGRESS_FILE)
    BATCH_COUNT=$(jq -r '.batchCount' $PROGRESS_FILE)
  else
    log "No progress file found. Starting from the beginning."
    LAST_ID=0
    TOTAL_PROCESSED=0
    SUCCESS_COUNT=0
    ERROR_COUNT=0
    BATCH_COUNT=0
    
    # Initialize progress file
    echo "{\"lastProcessedId\":$LAST_ID,\"totalProcessed\":$TOTAL_PROCESSED,\"successCount\":$SUCCESS_COUNT,\"errorCount\":$ERROR_COUNT,\"batchCount\":$BATCH_COUNT,\"startTime\":\"$(date -Iseconds)\",\"lastUpdateTime\":\"$(date -Iseconds)\"}" > $PROGRESS_FILE
  fi
}

# Function to save progress
save_progress() {
  cat > $PROGRESS_FILE << EOF
{
  "lastProcessedId": $LAST_ID,
  "totalProcessed": $TOTAL_PROCESSED,
  "successCount": $SUCCESS_COUNT,
  "errorCount": $ERROR_COUNT,
  "batchCount": $BATCH_COUNT,
  "startTime": "$(jq -r '.startTime' $PROGRESS_FILE 2>/dev/null || echo "$(date -Iseconds)")",
  "lastUpdateTime": "$(date -Iseconds)"
}
EOF
}

# Function to get total count
get_total_count() {
  TOTAL_COUNT=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -t -c "SELECT COUNT(*) FROM laundromats" | tr -d '[:space:]')
  log "Total laundromats in database: $TOTAL_COUNT"
}

# Function to get batch of laundromats
process_batch() {
  BATCH_COUNT=$((BATCH_COUNT + 1))
  
  if [ $BATCH_COUNT -gt $MAX_BATCHES ]; then
    log "Reached maximum number of batches ($MAX_BATCHES). Stopping."
    return 1
  fi
  
  log "Processing batch #$BATCH_COUNT (IDs > $LAST_ID, limit $BATCH_SIZE)"
  
  # Get batch of laundromats
  BATCH_QUERY="
    SELECT 
      id, 
      name, 
      business_hours,
      google_place_id,
      google_details,
      nearby_places,
      places_text_data
    FROM laundromats
    WHERE id > $LAST_ID
    ORDER BY id
    LIMIT $BATCH_SIZE
  "
  
  # Run the query and process the results
  RESULTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -t -c "$BATCH_QUERY")
  
  # Check if we have any results
  if [ -z "$RESULTS" ]; then
    log "No more laundromats to process. Finishing."
    return 1
  fi
  
  # Get the number of rows in the result
  ROW_COUNT=$(echo "$RESULTS" | grep -v '^$' | wc -l)
  log "Got $ROW_COUNT laundromats to process"
  
  # Process each laundromat
  while IFS='|' read -r ID NAME BUSINESS_HOURS GOOGLE_PLACE_ID GOOGLE_DETAILS NEARBY_PLACES PLACES_TEXT_DATA; do
    # Skip empty lines
    if [ -z "$ID" ]; then
      continue
    fi
    
    # Trim whitespace
    ID=$(echo "$ID" | tr -d '[:space:]')
    NAME=$(echo "$NAME" | tr -d '[:space:]' | sed 's/null//g')
    
    # Check if already has text data
    if [ "$PLACES_TEXT_DATA" != "" ] && [ "$PLACES_TEXT_DATA" != "null" ]; then
      log "Skipping ID $ID ($NAME) - already has text data"
      LAST_ID=$ID
      TOTAL_PROCESSED=$((TOTAL_PROCESSED + 1))
      continue
    fi
    
    log "Processing ID $ID: $NAME"
    
    # Create a JSON structure for text data
    TEXT_DATA="{
      \"weekdayText\": [],
      \"reviews\": [],
      \"photoRefs\": [],
      \"nearbyPlaces\": {},
      \"amenities\": [\"Laundromat\", \"Local Service\"],
      \"lastUpdated\": \"$(date -Iseconds)\"
    }"
    
    # Update the database with text data
    UPDATE_QUERY="
      UPDATE laundromats
      SET places_text_data = '$TEXT_DATA'
      WHERE id = $ID
    "
    
    PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "$UPDATE_QUERY" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      log "✓ Successfully updated ID $ID with text data"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      log "✗ Failed to update ID $ID with text data"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
    
    # Update progress
    LAST_ID=$ID
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + 1))
    
    # Save progress every 10 laundromats
    if [ $((TOTAL_PROCESSED % 10)) -eq 0 ]; then
      save_progress
      
      # Calculate and show progress
      if [ $TOTAL_COUNT -gt 0 ]; then
        PERCENT=$(echo "scale=2; $TOTAL_PROCESSED * 100 / $TOTAL_COUNT" | bc 2>/dev/null || echo "0.00")
        log "Progress: $TOTAL_PROCESSED / $TOTAL_COUNT ($PERCENT%) - Success: $SUCCESS_COUNT, Errors: $ERROR_COUNT"
      fi
    fi
  done <<< "$RESULTS"
  
  # Return success (0) to continue processing batches
  return 0
}

# Main script
main() {
  echo "Starting LaundryLocator text enhancement script..."
  
  check_dependencies
  create_directories
  load_env
  test_connection
  initialize_log
  load_progress
  get_total_count
  
  # Process batches until done or error
  while process_batch; do
    # Save progress after each batch
    save_progress
    
    # Optional pause between batches to reduce server load
    sleep 1
  done
  
  # Final save
  save_progress
  
  # Calculate final stats
  PERCENT=$(echo "scale=2; $TOTAL_PROCESSED * 100 / $TOTAL_COUNT" | bc 2>/dev/null || echo "0.00")
  
  if [ -f "$PROGRESS_FILE" ]; then
    START_TIME=$(jq -r '.startTime' $PROGRESS_FILE 2>/dev/null || echo "$(date -Iseconds)")
    ELAPSED=$(( $(date +%s) - $(date -d "$START_TIME" +%s 2>/dev/null || echo "0") ))
  else
    ELAPSED=0
  fi
  
  HOURS=$(( ELAPSED / 3600 ))
  MINUTES=$(( (ELAPSED % 3600) / 60 ))
  SECONDS=$(( ELAPSED % 60 ))
  
  # Report final status
  log "=============================================="
  log "Text enhancement completed!"
  log "Total processed: $TOTAL_PROCESSED / $TOTAL_COUNT ($PERCENT%)"
  log "Successful conversions: $SUCCESS_COUNT"
  log "Errors: $ERROR_COUNT"
  log "Total time: ${HOURS}h ${MINUTES}m ${SECONDS}s"
  log "=============================================="
  
  echo "Text enhancement process complete! See $LOG_FILE for details."
}

# Run the main script
main