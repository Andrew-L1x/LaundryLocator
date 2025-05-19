/**
 * Script to Update Frontend Components to Use Text Places Data
 * 
 * This script modifies the LaundryDetail component to use the stored
 * text-based Places data instead of making direct Google Places API calls.
 * 
 * Note: This script is for reference to show the changes needed. You should 
 * manually implement these changes in your frontend TypeScript files.
 */

const fs = require('fs');
const path = require('path');

// Log messages with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(
    path.join(process.cwd(), 'frontend-text-places-update.log'),
    `[${timestamp}] ${message}\n`
  );
}

// Generate the new TypeScript interface for text-based Places data
const generatePlacesTextInterface = () => {
  return `
// Text-based Places data interface
export interface PlacesTextData {
  formattedAddress: string;
  formattedPhoneNumber: string;
  weekdayText: string[];
  website: string;
  rating: string | number;
  userRatingsTotal: number;
  
  nearbyPlacesText: {
    name: string;
    type: string;
    distance: string;
    address: string;
    rating: string | number;
  }[];
  
  reviewsText: {
    authorName: string;
    rating: number;
    text: string;
    timeDescription: string;
    language: string;
  }[];
  
  photoInfo: {
    width: number;
    height: number;
    attribution: string;
    url: string;
  }[];
}

// Update Laundromat interface to include places_text_data
export interface Laundromat {
  // [Existing fields...]
  
  // Add text-based Places data
  places_text_data?: PlacesTextData;
}
`;
}

// Generate updated LaundryDetail component function
const generateUpdatedLaundryDetailComponent = () => {
  return `
// Example of how to use places_text_data in the LaundryDetail component

// Replace Google Places photo gallery with text-based photo info
const renderPhotoGallery = () => {
  // First try using places_text_data
  if (laundromat.places_text_data?.photoInfo && laundromat.places_text_data.photoInfo.length > 0) {
    return (
      <div className="relative w-full h-full">
        <img 
          src={laundromat.places_text_data.photoInfo[currentPhotoIndex].url || ''}
          alt={\`\${laundromat.name} laundromat\`}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={(e) => {
            // Fallback to Street View if text-based photo URL fails
            if (laundromat.latitude && laundromat.longitude) {
              e.currentTarget.src = \`https://maps.googleapis.com/maps/api/streetview?size=1200x500&location=\${laundromat.latitude},\${laundromat.longitude}&key=\${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}\`;
            } else {
              e.currentTarget.src = "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500";
            }
          }}
        />
        
        {/* Photo navigation arrows */}
        {laundromat.places_text_data.photoInfo.length > 1 && (
          <>
            <button 
              onClick={() => setCurrentPhotoIndex(prev => prev === 0 ? laundromat.places_text_data.photoInfo.length - 1 : prev - 1)}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-md hover:bg-white transition-colors"
              aria-label="Previous photo"
            >
              <i className="fas fa-chevron-left text-gray-800"></i>
            </button>
            <button 
              onClick={() => setCurrentPhotoIndex(prev => (prev + 1) % laundromat.places_text_data.photoInfo.length)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-md hover:bg-white transition-colors"
              aria-label="Next photo"
            >
              <i className="fas fa-chevron-right text-gray-800"></i>
            </button>
            
            {/* Photo indicator dots */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {laundromat.places_text_data.photoInfo.map((_, index) => (
                <button 
                  key={index}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={\`w-2.5 h-2.5 rounded-full \${currentPhotoIndex === index ? 'bg-white' : 'bg-white/60'}\`}
                  aria-label={\`Go to photo \${index + 1}\`}
                ></button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
  
  // If text-based data not available, fall back to previous implementations...
}

// Example of how to render nearby places from text data
const renderNearbyPlaces = () => {
  if (laundromat.places_text_data?.nearbyPlacesText && laundromat.places_text_data.nearbyPlacesText.length > 0) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Nearby Places</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {laundromat.places_text_data.nearbyPlacesText.slice(0, 6).map((place, index) => (
            <div key={index} className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium">{place.name}</h4>
              <p className="text-sm text-gray-600">{place.type}</p>
              <div className="flex justify-between mt-1 text-sm">
                <span>{place.distance}</span>
                <span className="flex items-center">
                  <i className="fas fa-star text-yellow-500 mr-1"></i>
                  {place.rating}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return null;
}

// Example of how to render reviews from text data
const renderReviews = () => {
  if (laundromat.places_text_data?.reviewsText && laundromat.places_text_data.reviewsText.length > 0) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Customer Reviews</h3>
        <div className="space-y-4">
          {laundromat.places_text_data.reviewsText.slice(0, 3).map((review, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium">{review.authorName}</div>
                <div className="flex items-center">
                  <div className="flex items-center mr-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <i 
                        key={star}
                        className={\`fas fa-star \${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}\`}
                      ></i>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">{review.timeDescription}</div>
                </div>
              </div>
              <p className="text-gray-700">{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return null;
}

// Example of rendering business hours from text data
const renderBusinessHours = () => {
  if (laundromat.places_text_data?.weekdayText && laundromat.places_text_data.weekdayText.length > 0) {
    return (
      <div className="mt-4">
        <h4 className="font-medium mb-2">Business Hours</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          {laundromat.places_text_data.weekdayText.map((dayHours, index) => (
            <li key={index} className="flex">
              <div className="w-32 font-medium">{dayHours.split(': ')[0]}</div>
              <div>{dayHours.split(': ')[1]}</div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  
  return null;
}
`;
}

// Generate updated server routes
const generateUpdatedServerRoutes = () => {
  return `
// Update laundromat API endpoints to return places_text_data
app.get(\`\${apiRouter}/laundromats/:slug\`, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const query = \`
      SELECT *, places_text_data
      FROM laundromats
      WHERE slug = $1
      LIMIT 1
    \`;
    
    const result = await pool.query(query, [slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Laundromat not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching laundromat:', error);
    res.status(500).json({ message: 'Error fetching laundromat' });
  }
});
`;
}

// Write the suggested changes to reference files
function writeReferenceFiles() {
  try {
    const outputDir = path.join(process.cwd(), 'reference');
    
    // Ensure reference directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write interface updates
    fs.writeFileSync(
      path.join(outputDir, 'places-text-interfaces.ts'),
      generatePlacesTextInterface()
    );
    
    // Write component updates
    fs.writeFileSync(
      path.join(outputDir, 'laundry-detail-text-places.tsx'),
      generateUpdatedLaundryDetailComponent()
    );
    
    // Write server route updates
    fs.writeFileSync(
      path.join(outputDir, 'server-routes-text-places.ts'),
      generateUpdatedServerRoutes()
    );
    
    log('Reference files written to ' + outputDir);
    return true;
  } catch (error) {
    log(`Error writing reference files: ${error.message}`);
    return false;
  }
}

// Run the script to generate reference files
log('Starting frontend update reference generation...');
const success = writeReferenceFiles();
log(`Reference generation ${success ? 'completed successfully' : 'failed'}.`);