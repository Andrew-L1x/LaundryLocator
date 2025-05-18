import React, { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star } from 'lucide-react';
import { stateCoordinates } from '@/lib/stateCoordinates';

// Keep these static to avoid unnecessary API reloads
const libraries: ("places" | "geometry")[] = ["places", "geometry"];

interface UniversalLaundromatsMapProps {
  laundromats: Laundromat[];
  latitude: number;
  longitude: number;
  radius: string;
  userState?: string;
  className?: string;
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
}) => {
  const [selectedLaundromat, setSelectedLaundromat] = useState<Laundromat | null>(null);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ 
    lat: typeof latitude === 'string' ? parseFloat(latitude) : latitude, 
    lng: typeof longitude === 'string' ? parseFloat(longitude) : longitude 
  });
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [isStateFallback, setIsStateFallback] = useState<boolean>(false);

  // Convert coordinates to numbers
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  
  // Load Google Maps API with static libraries array to prevent reloading
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries,
  });

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

  // Close info window when map is clicked
  const handleMapClick = () => {
    setSelectedLaundromat(null);
  };

  // Use simple colored marker icons from Google Maps
  const getColoredMarkerIcon = (color: string) => {
    let markerIcon;
    
    switch(color) {
      case 'purple':
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png';
        break;
      case 'orange':
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png';
        break;
      case 'green':
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
        break;
      case 'blue':
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        break;
      case 'yellow':
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
        break;
      case 'gray':
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/grey-dot.png';
        break;
      default:
        markerIcon = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
    }
    
    return {
      url: markerIcon,
      scaledSize: new google.maps.Size(32, 32)
    };
  };

  if (!isLoaded) {
    return (
      <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} style={containerStyle}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

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
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          // Add circle to show the search radius
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {/* User location marker - bright orange */}
        <Marker
          position={{ lat, lng }}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
            scaledSize: new google.maps.Size(40, 40),
          }}
          title="Your Location"
        />
        
        {/* Laundromat markers */}
        {laundromats && laundromats.length > 0 && laundromats.map((laundromat) => {
          // Make sure we have valid coordinates
          if (!laundromat.latitude || !laundromat.longitude) {
            return null;
          }
          
          // Try to parse coordinates as numbers
          const lat = parseFloat(laundromat.latitude);
          const lng = parseFloat(laundromat.longitude);
          
          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lng)) {
            return null;
          }
          
          // Create marker with valid coordinates
          return (
            <Marker
              key={laundromat.id}
              position={{ lat, lng }}
              onClick={() => setSelectedLaundromat(laundromat)}
              icon={getColoredMarkerIcon(getMarkerColor(laundromat))}
              title={laundromat.name}
            />
          );
        })}
        
        {/* Info window for selected laundromat */}
        {selectedLaundromat && (
          <InfoWindow
            position={{
              lat: parseFloat(selectedLaundromat.latitude),
              lng: parseFloat(selectedLaundromat.longitude),
            }}
            onCloseClick={() => setSelectedLaundromat(null)}
          >
            <Card className="w-64 shadow-none border-0">
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
                <div className="mt-2">
                  <Button 
                    asChild 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs"
                  >
                    <Link 
                      href={`/laundromat/${selectedLaundromat.slug}`}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default UniversalLaundromatsMap;