#!/bin/bash

# This script runs the optimized import multiple times with pauses
# to continuously add laundromat records to the database

echo "Starting multiple laundromat imports..."
echo "This script will run 50 imports with 15-second pauses between each"

TOTAL_RUNS=50
PAUSE_SECONDS=15
COUNT=0

# Create a log file
LOG_FILE="multiple-imports.log"
echo "Starting multiple imports at $(date)" > $LOG_FILE

# Get initial count
INITIAL_COUNT=$(psql -c "SELECT COUNT(*) FROM laundromats" -t | tr -d '[:space:]')
echo "Initial count: $INITIAL_COUNT" >> $LOG_FILE

# Run imports
while [ $COUNT -lt $TOTAL_RUNS ]; do
  COUNT=$((COUNT+1))
  echo "" >> $LOG_FILE
  echo "=== Run $COUNT of $TOTAL_RUNS ===" >> $LOG_FILE
  echo "Starting import at $(date)" >> $LOG_FILE
  
  # Run import and capture output
  node scripts/optimized-import.js >> $LOG_FILE 2>&1
  
  # Get current count
  CURRENT_COUNT=$(psql -c "SELECT COUNT(*) FROM laundromats" -t | tr -d '[:space:]')
  ADDED=$((CURRENT_COUNT - INITIAL_COUNT))
  
  echo "Current count: $CURRENT_COUNT" >> $LOG_FILE
  echo "Added so far: $ADDED" >> $LOG_FILE
  
  # Summary to console
  echo "Completed run $COUNT/$TOTAL_RUNS. Current count: $CURRENT_COUNT (+$ADDED)"
  
  # Pause between runs (except for the last one)
  if [ $COUNT -lt $TOTAL_RUNS ]; then
    echo "Pausing for $PAUSE_SECONDS seconds..."
    sleep $PAUSE_SECONDS
  fi
done

# Final summary
FINAL_COUNT=$(psql -c "SELECT COUNT(*) FROM laundromats" -t | tr -d '[:space:]')
TOTAL_ADDED=$((FINAL_COUNT - INITIAL_COUNT))

echo "" >> $LOG_FILE
echo "=== Multiple Imports Completed ===" >> $LOG_FILE
echo "Starting count: $INITIAL_COUNT" >> $LOG_FILE
echo "Final count: $FINAL_COUNT" >> $LOG_FILE
echo "Total added: $TOTAL_ADDED" >> $LOG_FILE
echo "Completed at $(date)" >> $LOG_FILE

echo ""
echo "Multiple imports completed!"
echo "Starting count: $INITIAL_COUNT"
echo "Final count: $FINAL_COUNT"
echo "Total added: $TOTAL_ADDED"
echo "Detailed log available in $LOG_FILE"