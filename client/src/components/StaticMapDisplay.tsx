import React, { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink } from 'lucide-react';
import { Laundromat } from '@/types/laundromat';

interface StaticMapDisplayProps {
  latitude: string | number;
  longitude: string | number;
  zoom?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  markers?: Laundromat[];
  onMarkerClick?: (laundromat: Laundromat) => void;
  showInfo?: boolean;
}

/**
 * StaticMapDisplay Component
 * 
 * This component displays a static map image instead of loading the Google Maps JavaScript API.
 * It uses cached map images, drastically reducing API costs.
 */
const StaticMapDisplay: React.FC<StaticMapDisplayProps> = ({
  latitude,
  longitude,
  zoom = 14,
  width = '100%',
  height = '400px',
  className = '',
  markers = [],
  onMarkerClick,
  showInfo = true,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<Laundromat | null>(null);
  const [imageError, setImageError] = useState(false);
  
  // Format coordinates for path
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  
  // Format for cache path
  const formatCoord = (coord: number): string => {
    return coord.toFixed(6).replace(/\./g, '_');
  };
  
  // Build cached static map path
  const staticMapPath = `/maps/static/map_${formatCoord(lat)}_${formatCoord(lng)}_${zoom}_600x500.jpg`;
  
  // Build fallback Google Static Maps URL
  const buildGoogleStaticMapUrl = () => {
    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=600x500&scale=2&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    
    // Add markers (limit to 15 for URL length constraints)
    const markersToShow = markers.slice(0, 15);
    
    // If we have markers, add them to the URL
    if (markersToShow.length > 0) {
      markersToShow.forEach((marker, index) => {
        const markerLat = typeof marker.latitude === 'string' ? parseFloat(marker.latitude) : marker.latitude;
        const markerLng = typeof marker.longitude === 'string' ? parseFloat(marker.longitude) : marker.longitude;
        
        url += `&markers=color:red|${markerLat},${markerLng}`;
      });
    } else {
      // If no markers, just add the center point
      url += `&markers=color:blue|${lat},${lng}`;
    }
    
    return url;
  };
  
  // Generate a fallback image URL from Unsplash (aerial city view)
  const fallbackImageUrl = "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=500";
  
  // Handle marker click (simulated from the UI)
  const handleMarkerClick = (marker: Laundromat) => {
    setSelectedMarker(marker);
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  };
  
  // Get closest markers to simulate click behavior
  const getClosestMarkers = (x: number, y: number, containerWidth: number, containerHeight: number) => {
    // Map image is 600x500 in our cache
    const mapWidth = 600;
    const mapHeight = 500;
    
    // Scale x,y to match the map dimensions
    const scaledX = (x / containerWidth) * mapWidth;
    const scaledY = (y / containerHeight) * mapHeight;
    
    // Calculate distances to each marker
    // This is just a rough approximation based on pixel positions
    const markersWithDistances = markers.map(marker => {
      // Calculate pixel position based on Mercator projection (simplified)
      const latRad = (lat * Math.PI) / 180;
      const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
      
      const centerPixelY = mapHeight / 2;
      const centerPixelX = mapWidth / 2;
      
      const markerLat = typeof marker.latitude === 'string' ? parseFloat(marker.latitude) : marker.latitude;
      const markerLng = typeof marker.longitude === 'string' ? parseFloat(marker.longitude) : marker.longitude;
      
      // Calculate relative pixel offsets based on lat/lng differences
      // This is an extremely simplified approximation for demo purposes
      const latDiff = markerLat - lat;
      const lngDiff = markerLng - lng;
      
      // Rough pixels per degree at this zoom level
      const pixelsPerLatDegree = mapHeight / (360 / Math.pow(2, zoom));
      const pixelsPerLngDegree = mapWidth / (360 / Math.pow(2, zoom));
      
      const markerPixelY = centerPixelY - (latDiff * pixelsPerLatDegree);
      const markerPixelX = centerPixelX + (lngDiff * pixelsPerLngDegree);
      
      // Calculate distance to click point
      const distance = Math.sqrt(
        Math.pow(markerPixelX - scaledX, 2) + 
        Math.pow(markerPixelY - scaledY, 2)
      );
      
      return { marker, distance };
    });
    
    // Sort by distance
    markersWithDistances.sort((a, b) => a.distance - b.distance);
    
    // Return closest marker if it's within a reasonable distance (50 pixels)
    if (markersWithDistances.length > 0 && markersWithDistances[0].distance < 50) {
      return markersWithDistances[0].marker;
    }
    
    return null;
  };
  
  // Handle click on the map image
  const handleMapClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!markers.length) return;
    
    // Get click coordinates relative to the image
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find closest marker
    const closestMarker = getClosestMarkers(x, y, rect.width, rect.height);
    
    if (closestMarker) {
      handleMarkerClick(closestMarker);
    } else {
      setSelectedMarker(null);
    }
  };
  
  return (
    <div className={`static-map-container ${className}`} style={{ width, height, position: 'relative' }}>
      {/* Static Map Image with Fallbacks */}
      {!imageError ? (
        <img 
          src={staticMapPath}
          alt="Map"
          className="w-full h-full object-cover rounded-lg"
          style={{ cursor: 'pointer' }}
          onClick={handleMapClick}
          onError={(e) => {
            // Try Google Static Maps API as first fallback
            (e.target as HTMLImageElement).src = buildGoogleStaticMapUrl();
            
            // If that fails too, use the fallback image
            (e.target as HTMLImageElement).onerror = () => {
              setImageError(true);
            };
          }}
        />
      ) : (
        <div className="w-full h-full rounded-lg bg-gray-100 flex items-center justify-center">
          <img 
            src={fallbackImageUrl}
            alt="Map unavailable"
            className="w-full h-full object-cover rounded-lg opacity-70"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <p className="text-white text-lg font-medium">Map temporarily unavailable</p>
          </div>
        </div>
      )}
      
      {/* Info popup for selected marker */}
      {selectedMarker && showInfo && (
        <Card className="absolute z-10 bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 shadow-lg bg-white border-0">
          <CardContent className="p-4">
            <h3 className="font-semibold text-lg mb-1">{selectedMarker.name}</h3>
            <div className="flex items-start gap-1 text-sm text-gray-600 mb-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                {selectedMarker.address}
                {selectedMarker.city && `, ${selectedMarker.city}`}
                {selectedMarker.state && `, ${selectedMarker.state}`}
              </span>
            </div>
            
            <div className="flex space-x-2 mt-3">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => setSelectedMarker(null)}
              >
                Close
              </Button>
              <Link href={`/laundromat/${selectedMarker.slug}`}>
                <Button size="sm" className="flex-1 gap-1">
                  Details
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StaticMapDisplay;