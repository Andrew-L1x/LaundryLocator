import React, { useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star } from 'lucide-react';

interface NearbyLaundromatsMapProps {
  laundromats: Laundromat[];
  latitude: number;
  longitude: number;
  searchRadius: string;
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
  // Parse rating to number or default to 0
  const rating = laundromat.rating ? parseFloat(laundromat.rating) : 0;
  
  // Premium and featured status
  if (laundromat.isPremium) return 'purple';
  if (laundromat.isFeatured) return 'orange';
  
  // Rating-based colors
  if (rating >= 4.5) return 'green';
  if (rating >= 3.5) return 'blue';
  if (rating >= 2.5) return 'yellow';
  if (rating > 0) return 'red';
  
  // Default color
  return 'gray';
};

const NearbyLaundromatsMap: React.FC<NearbyLaundromatsMapProps> = ({
  laundromats,
  latitude,
  longitude,
  searchRadius,
  className = '',
}) => {
  const [selectedLaundromat, setSelectedLaundromat] = useState<Laundromat | null>(null);

  // Convert coordinates to numbers
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  
  // Center map on user's location
  const center = { lat, lng };
  
  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  // Close info window when map is clicked
  const handleMapClick = () => {
    setSelectedLaundromat(null);
  };

  // Generate SVG marker for custom colors
  const createSvgMarkerIcon = (color: string) => {
    const svgMarker = {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
      fillColor: color,
      fillOpacity: 0.9,
      strokeWeight: 1,
      strokeColor: '#ffffff',
      scale: 1.5,
      anchor: { x: 12, y: 22 },
    };
    return svgMarker;
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
          Laundromats Within {searchRadius} Miles
        </h3>
      </div>
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={11}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {/* User location marker */}
        <Marker
          position={center}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new google.maps.Size(40, 40),
          }}
          title="Your Location"
        />
        
        {/* Laundromat markers */}
        {laundromats.map((laundromat) => (
          <Marker
            key={laundromat.id}
            position={{
              lat: parseFloat(laundromat.latitude),
              lng: parseFloat(laundromat.longitude),
            }}
            onClick={() => setSelectedLaundromat(laundromat)}
            icon={createSvgMarkerIcon(getMarkerColor(laundromat))}
            title={laundromat.name}
          />
        ))}
        
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
                <Link href={`/laundromat/${selectedLaundromat.slug}`}>
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
                    <Link href={`/laundromat/${selectedLaundromat.slug}`}>View Details</Link>
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

export default NearbyLaundromatsMap;