#!/bin/bash

# WSL Text Enhancement Script for LaundryLocator
# This script converts Google Places API data to text format to reduce API costs

# Load environment variables
export $(grep -v '^#' .env-for-wsl | xargs)

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
echo "Text enhancement started at $(date '+%Y-%m-%d %H:%M:%S')" > $LOG_FILE

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
  echo "{\"lastProcessedId\":$LAST_ID,\"totalProcessed\":$TOTAL_PROCESSED,\"successCount\":$SUCCESS_COUNT,\"errorCount\":$ERROR_COUNT,\"batchCount\":$BATCH_COUNT,\"startTime\":\"$(jq -r '.startTime' $PROGRESS_FILE)\",\"lastUpdateTime\":\"$(date -Iseconds)\"}" > $PROGRESS_FILE
}

# Function to get total count
get_total_count() {
  TOTAL_COUNT=$(psql -t -c "SELECT COUNT(*) FROM laundromats" | tr -d '[:space:]')
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
  RESULTS=$(psql -t -c "$BATCH_QUERY")
  
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
    
    # Check if we have business hours
    if [ "$BUSINESS_HOURS" != "" ] && [ "$BUSINESS_HOURS" != "null" ]; then
      log "ID $ID has business hours data"
      
      # Run a Node.js script to convert business hours to text format
      WEEKDAY_TEXT=$(node -e "
        const businessHours = $BUSINESS_HOURS;
        
        function convertHoursToText(businessHours) {
          if (!Array.isArray(businessHours) || businessHours.length === 0) {
            return [];
          }
          
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const result = [];
          
          // Create a map to hold days and their opening/closing times
          const dayMap = {};
          
          // Initialize all days as 'Closed'
          days.forEach(day => {
            dayMap[day] = 'Closed';
          });
          
          // Fill in actual hours
          businessHours.forEach(period => {
            if (!period || typeof period !== 'object') return;
            
            try {
              if (period.open && typeof period.open === 'object' && 
                  period.close && typeof period.close === 'object') {
                
                if (typeof period.open.day === 'number' && period.open.day >= 0 && period.open.day <= 6) {
                  const day = days[period.open.day];
                  let openTime = 'Unknown';
                  let closeTime = 'Unknown';
                  
                  if (typeof period.open.time === 'string' && period.open.time.length >= 4) {
                    // Convert 24-hour time to 12-hour format
                    const hour = parseInt(period.open.time.slice(0, 2));
                    const minute = period.open.time.slice(2);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour % 12 || 12;
                    openTime = \`\${hour12}:\${minute} \${ampm}\`;
                  }
                  
                  if (typeof period.close.time === 'string' && period.close.time.length >= 4) {
                    // Convert 24-hour time to 12-hour format
                    const hour = parseInt(period.close.time.slice(0, 2));
                    const minute = period.close.time.slice(2);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour % 12 || 12;
                    closeTime = \`\${hour12}:\${minute} \${ampm}\`;
                  }
                  
                  dayMap[day] = \`\${openTime} – \${closeTime}\`;
                }
              }
            } catch (error) {
              console.error('Error processing hours:', error);
            }
          });
          
          // Check for 24-hour operation
          const allSameHours = new Set(Object.values(dayMap)).size === 1 && 
                              Object.values(dayMap)[0].includes('12:00 AM – 11:59 PM');
          
          if (allSameHours) {
            return ['Open 24 hours, 7 days a week'];
          }
          
          // Convert map to array of strings
          days.forEach(day => {
            result.push(\`\${day}: \${dayMap[day]}\`);
          });
          
          return result;
        }
        
        console.log(JSON.stringify(convertHoursToText(businessHours)));
      ")
      
      # Update text data with weekday text
      TEXT_DATA=$(echo $TEXT_DATA | jq --argjson weekdayText "$WEEKDAY_TEXT" '.weekdayText = $weekdayText')
    fi
    
    # Check if we have Google details
    if [ "$GOOGLE_DETAILS" != "" ] && [ "$GOOGLE_DETAILS" != "null" ]; then
      log "ID $ID has Google details data"
      
      # Convert reviews
      if echo "$GOOGLE_DETAILS" | grep -q '"reviews"'; then
        # Run a Node.js script to extract reviews
        REVIEWS=$(node -e "
          const googleDetails = $GOOGLE_DETAILS;
          
          function processReviews(googleDetails) {
            if (!googleDetails || !googleDetails.reviews || !Array.isArray(googleDetails.reviews)) {
              return [];
            }
            
            return googleDetails.reviews.map(review => {
              if (!review || typeof review !== 'object') return null;
              
              try {
                return {
                  author: review.author_name || review.author || 'Anonymous',
                  rating: review.rating || 0,
                  text: review.text || '',
                  time: review.time ? new Date(review.time * 1000).toISOString() : new Date().toISOString(),
                  language: review.language || 'en'
                };
              } catch (error) {
                console.error('Error processing review:', error);
                return null;
              }
            }).filter(Boolean);
          }
          
          console.log(JSON.stringify(processReviews(googleDetails)));
        ")
        
        # Update text data with reviews
        TEXT_DATA=$(echo $TEXT_DATA | jq --argjson reviews "$REVIEWS" '.reviews = $reviews')
      fi
      
      # Convert photos
      if echo "$GOOGLE_DETAILS" | grep -q '"photos"'; then
        # Run a Node.js script to extract photo references
        PHOTO_REFS=$(node -e "
          const googleDetails = $GOOGLE_DETAILS;
          
          function processPhotos(googleDetails) {
            if (!googleDetails || !googleDetails.photos || !Array.isArray(googleDetails.photos)) {
              return [];
            }
            
            return googleDetails.photos.map((photo, index) => {
              if (!photo || typeof photo !== 'object') return null;
              
              try {
                return {
                  id: index,
                  reference: photo.photo_reference || '',
                  width: photo.width || 0,
                  height: photo.height || 0,
                  attribution: photo.html_attributions && photo.html_attributions.length > 0 ? 
                              photo.html_attributions[0] || '' : ''
                };
              } catch (error) {
                console.error('Error processing photo:', error);
                return null;
              }
            }).filter(Boolean);
          }
          
          console.log(JSON.stringify(processPhotos(googleDetails)));
        ")
        
        # Update text data with photo references
        TEXT_DATA=$(echo $TEXT_DATA | jq --argjson photoRefs "$PHOTO_REFS" '.photoRefs = $photoRefs')
      fi
    fi
    
    # Check if we have nearby places
    if [ "$NEARBY_PLACES" != "" ] && [ "$NEARBY_PLACES" != "null" ]; then
      log "ID $ID has nearby places data"
      
      # Run a Node.js script to convert nearby places to text format
      NEARBY_PLACES_TEXT=$(node -e "
        const nearbyPlaces = $NEARBY_PLACES;
        
        function formatNearbyPlaces(nearbyPlaces) {
          if (!Array.isArray(nearbyPlaces) || nearbyPlaces.length === 0) {
            return {};
          }
          
          const placesByType = {};
          
          nearbyPlaces.forEach(place => {
            if (!place || typeof place !== 'object') return;
            
            try {
              // Get the primary type of the place
              const types = place.types || [];
              const type = types.length > 0 ? types[0] : 'other';
              
              if (!placesByType[type]) {
                placesByType[type] = [];
              }
              
              placesByType[type].push({
                name: place.name || 'Unknown Place',
                vicinity: place.vicinity || '',
                distance: place.distance || null,
                rating: place.rating || null,
                placeId: place.place_id || null
              });
            } catch (error) {
              console.error('Error processing nearby place:', error);
            }
          });
          
          return placesByType;
        }
        
        console.log(JSON.stringify(formatNearbyPlaces(nearbyPlaces)));
      ")
      
      # Update text data with nearby places
      TEXT_DATA=$(echo $TEXT_DATA | jq --argjson nearbyPlaces "$NEARBY_PLACES_TEXT" '.nearbyPlaces = $nearbyPlaces')
    fi
    
    # Update the database with text data
    UPDATE_QUERY="
      UPDATE laundromats
      SET places_text_data = '$TEXT_DATA'
      WHERE id = $ID
    "
    
    psql -c "$UPDATE_QUERY" > /dev/null
    
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
        PERCENT=$(echo "scale=2; $TOTAL_PROCESSED * 100 / $TOTAL_COUNT" | bc)
        log "Progress: $TOTAL_PROCESSED / $TOTAL_COUNT ($PERCENT%) - Success: $SUCCESS_COUNT, Errors: $ERROR_COUNT"
      fi
    fi
  done <<< "$RESULTS"
  
  # Return success (0) to continue processing batches
  return 0
}

# Main script
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
PERCENT=$(echo "scale=2; $TOTAL_PROCESSED * 100 / $TOTAL_COUNT" | bc)
ELAPSED=$(( $(date +%s) - $(date -d "$(jq -r '.startTime' $PROGRESS_FILE)" +%s) ))
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