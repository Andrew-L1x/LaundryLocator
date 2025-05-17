#!/bin/bash

# Import all laundromat data in chunks
# This script runs the import-chunk.js script multiple times with different starting indices
# to import all 27,000+ laundromats

# Total records in the dataset
TOTAL_RECORDS=27187

# Size of each chunk to process
CHUNK_SIZE=1000

# Calculate number of chunks needed
NUM_CHUNKS=$((($TOTAL_RECORDS + $CHUNK_SIZE - 1) / $CHUNK_SIZE))

echo "Starting import of all $TOTAL_RECORDS laundromats in $NUM_CHUNKS chunks"

# Loop through all chunks
for ((i=0; i<$NUM_CHUNKS; i++)); do
  START_INDEX=$((i * $CHUNK_SIZE))
  END_INDEX=$((START_INDEX + $CHUNK_SIZE - 1))
  
  if [ $END_INDEX -ge $TOTAL_RECORDS ]; then
    END_INDEX=$((TOTAL_RECORDS - 1))
  fi
  
  echo ""
  echo "===================================================================================="
  echo "Processing chunk $((i + 1)) of $NUM_CHUNKS (records $START_INDEX to $END_INDEX)"
  echo "===================================================================================="
  
  # Run the import script with the current chunk
  START_INDEX=$START_INDEX CHUNK_SIZE=$CHUNK_SIZE node scripts/import-chunk.js
  
  # Check if the import was successful
  if [ $? -ne 0 ]; then
    echo "Error: Import failed for chunk $((i + 1)). Stopping."
    exit 1
  fi
  
  echo "Chunk $((i + 1)) completed successfully"
  
  # Check current count of laundromats
  echo "Current progress:"
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM laundromats;"
  
  # Sleep for a few seconds to allow database to recover
  echo "Waiting 5 seconds before next chunk..."
  sleep 5
done

echo ""
echo "===================================================================================="
echo "All chunks completed! Final counts:"
echo "===================================================================================="
psql $DATABASE_URL -c "SELECT COUNT(*) FROM laundromats;"
psql $DATABASE_URL -c "SELECT state, COUNT(*) as count FROM laundromats GROUP BY state ORDER BY count DESC LIMIT 10;"
psql $DATABASE_URL -c "SELECT COUNT(DISTINCT city) as city_count, COUNT(DISTINCT state) as state_count FROM laundromats;"

echo "Import process completed!"