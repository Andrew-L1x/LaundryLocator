import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, ExternalLink } from 'lucide-react';
import MapLegend from '@/components/MapLegend';
import { stateCoordinates } from '@/lib/stateCoordinates';

interface UniversalLaundromatsMapProps {
  laundromats: Laundromat[];
  latitude: number;
  longitude: number;
  radius: string;
  userState?: string;
  className?: string;
  showLegend?: boolean;
}

// Default map container style
const containerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: '0.5rem',
};

// Function to determine marker color based on rating and premium status
const getMarkerColor = (laundromat: Laundromat) => {
  try {
    // Parse rating to number or default to 0
    const rating = laundromat?.rating ? parseFloat(laundromat.rating) : 0;
    
    // Rating-based colors
    if (rating >= 4.5) return 'green';
    if (rating >= 3.5) return 'blue';
    if (rating >= 2.5) return 'yellow';
    if (rating > 0) return 'red';
    
    // Default color
    return 'gray';
  } catch (error) {
    console.error('Error determining marker color:', error);
    return 'red'; // Default fallback color
  }
};

const UniversalLaundromatsMap: React.FC<UniversalLaundromatsMapProps> = ({
  laundromats,
  latitude,
  longitude,
  radius,
  userState = 'CO',
  className = '',
  showLegend = true,
}) => {
  const [selectedLaundromat, setSelectedLaundromat] = useState<Laundromat | null>(null);
  const [isStateFallback, setIsStateFallback] = useState<boolean>(false);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ 
    lat: typeof latitude === 'string' ? parseFloat(latitude) : latitude, 
    lng: typeof longitude === 'string' ? parseFloat(longitude) : longitude 
  });
  const [mapZoom, setMapZoom] = useState<number>(12);

  // Convert coordinates to numbers
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;

  // Use effect to determine if we need to use state fallback
  useEffect(() => {
    if (laundromats.length === 0) {
      // No laundromats found near user location, use state fallback
      setIsStateFallback(true);
      const stateInfo = stateCoordinates[userState] || stateCoordinates['CO'];
      setMapCenter({ lat: stateInfo.lat, lng: stateInfo.lng });
      setMapZoom(8); // Zoom out to show more of the state
    } else {
      // Laundromats found, center on user location
      setIsStateFallback(false);
      setMapCenter({ lat, lng });
      setMapZoom(12);
    }
  }, [laundromats, lat, lng, userState]);

  // Format coordinates for static map URL
  const formatCoord = (coord: number): string => {
    return coord.toFixed(6).replace(/\./g, '_');
  };

  // Calculate coordinates for the map center
  const centerLat = mapCenter.lat;
  const centerLng = mapCenter.lng;

  // Build static map path with appropriate cache key
  const staticMapPath = `/maps/static/map_${formatCoord(centerLat)}_${formatCoord(centerLng)}_${mapZoom}_600x350.jpg`;

  // Build Google Static Maps URL as fallback
  const buildGoogleStaticMapUrl = () => {
    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=${mapZoom}&size=600x350&scale=2&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    
    // Add user location marker (orange)
    url += `&markers=color:orange|${lat},${lng}`;
    
    // Add laundromat markers (limited to 15 for URL length constraints)
    const markersToShow = laundromats.slice(0, 15);
    
    if (markersToShow.length > 0) {
      markersToShow.forEach(laundromat => {
        const markerLat = parseFloat(laundromat.latitude);
        const markerLng = parseFloat(laundromat.longitude);
        
        if (!isNaN(markerLat) && !isNaN(markerLng)) {
          // Use marker color based on rating
          const color = getMarkerColor(laundromat);
          url += `&markers=color:${color}|${markerLat},${markerLng}`;
        }
      });
    }
    
    return url;
  };

  // Generate a fallback image URL from Unsplash (aerial city view)
  const fallbackImageUrl = "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350";

  // Handle marker click (simulated from clicking the laundromat card)
  const handleLaundromatSelect = (laundromat: Laundromat) => {
    setSelectedLaundromat(laundromat === selectedLaundromat ? null : laundromat);
  };

  return (
    <div className={`rounded-lg overflow-hidden shadow-md ${className}`}>
      <div className="bg-primary text-white py-2 px-4">
        <h3 className="font-medium flex items-center">
          <MapPin className="w-4 h-4 mr-1" />
          {isStateFallback 
            ? `Laundromats in ${stateCoordinates[userState]?.name || 'Colorado'}`
            : `Laundromats Within ${radius} Miles`
          }
        </h3>
      </div>
      
      {/* Static Map Image with Fallbacks */}
      <div className="relative" style={containerStyle}>
        <img 
          src={staticMapPath}
          alt={`Map of laundromats within ${radius} miles`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Try Google Static Maps API as first fallback
            (e.target as HTMLImageElement).src = buildGoogleStaticMapUrl();
            
            // If that fails too, use the fallback image
            (e.target as HTMLImageElement).onerror = () => {
              (e.target as HTMLImageElement).src = fallbackImageUrl;
              (e.target as HTMLImageElement).alt = "Map temporarily unavailable";
              
              // Add an overlay explanation
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                const overlay = document.createElement('div');
                overlay.className = "absolute inset-0 flex items-center justify-center bg-black bg-opacity-40";
                overlay.innerHTML = '<p class="text-white text-lg font-medium">Map temporarily unavailable</p>';
                parent.appendChild(overlay);
              }
            };
          }}
        />
        
        {/* Selected laundromat popup */}
        {selectedLaundromat && (
          <div className="absolute bottom-3 left-3 right-3 md:w-64 md:left-auto z-10">
            <Card className="shadow-lg border-0">
              <CardContent className="p-3">
                <Link href={`/laundromat/${selectedLaundromat.slug}`} 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <h4 className="font-semibold text-primary hover:underline">{selectedLaundromat.name}</h4>
                </Link>
                <p className="text-xs text-gray-600 mb-2">{selectedLaundromat.address}</p>
                {selectedLaundromat.rating && (
                  <div className="flex items-center mt-1">
                    <div className="flex items-center">
                      <Star className="h-3 w-3 text-yellow-500 mr-1" fill="currentColor" />
                      <span className="text-xs font-medium">{selectedLaundromat.rating}</span>
                    </div>
                    {selectedLaundromat.reviewCount && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({selectedLaundromat.reviewCount} reviews)
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => setSelectedLaundromat(null)}
                  >
                    Close
                  </Button>
                  
                  <Button 
                    asChild 
                    size="sm" 
                    className="text-xs"
                  >
                    <Link 
                      href={`/laundromat/${selectedLaundromat.slug}`}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                      View Details
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Laundromat list under the map */}
      <div className="max-h-64 overflow-y-auto p-3 border-t">
        {laundromats.length > 0 ? (
          <div className="space-y-3">
            {laundromats.slice(0, 5).map(laundromat => (
              <div 
                key={laundromat.id}
                className={`p-2 rounded-md cursor-pointer transition-colors ${
                  selectedLaundromat?.id === laundromat.id 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
                onClick={() => handleLaundromatSelect(laundromat)}
              >
                <h4 className="font-medium text-sm">{laundromat.name}</h4>
                <div className="flex items-center text-xs text-gray-600 mt-1">
                  <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{laundromat.address}</span>
                </div>
                {laundromat.rating && (
                  <div className="flex items-center mt-1">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i}
                          className={`h-2 w-2 ${
                            i < parseInt(laundromat.rating || '0') 
                              ? 'text-yellow-400 fill-yellow-400' 
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {laundromats.length > 5 && (
              <div className="text-center text-xs text-gray-500 mt-2">
                + {laundromats.length - 5} more laundromats in this area
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">No laundromats found in this area</p>
          </div>
        )}
      </div>
      
      {showLegend && <MapLegend className="mt-4 p-3" showTitle={false} />}
    </div>
  );
};

export default UniversalLaundromatsMap;