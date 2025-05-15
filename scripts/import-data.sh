#!/bin/bash

# Get the CSV file path from command line argument
if [ -z "$1" ]; then
  echo "Please provide the path to the CSV file"
  echo "Usage: ./scripts/import-data.sh data/laundromats.csv"
  exit 1
fi

CSV_FILE=$1

# Run the import script
echo "Importing laundromat data from $CSV_FILE..."
tsx server/scripts/import-csv.ts $CSV_FILE