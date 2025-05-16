import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, ChevronRight } from 'lucide-react';

interface LaundryMapProps {
  laundromats: Laundromat[];
  center?: { lat: number, lng: number };
  zoom?: number;
  height?: string;
  width?: string;
  containerClassName?: string;
}

// Map container style will be overridden by containerClassName if provided
const containerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.5rem',
};

// Default center is San Francisco
const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194
};

const LaundryMap: React.FC<LaundryMapProps> = ({
  laundromats,
  center = defaultCenter,
  zoom = 12,
  height = '500px',
  width = '100%',
  containerClassName = '',
}) => {
  const [selectedLaundry, setSelectedLaundry] = useState<Laundromat | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  // Load the Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  // Calculate center from laundromats if not provided
  const calculateCenter = useCallback(() => {
    if (laundromats.length === 0) return center;
    
    // Get average lat and lng
    const sumLat = laundromats.reduce((sum, laundry) => sum + parseFloat(laundry.latitude), 0);
    const sumLng = laundromats.reduce((sum, laundry) => sum + parseFloat(laundry.longitude), 0);
    
    return {
      lat: sumLat / laundromats.length,
      lng: sumLng / laundromats.length
    };
  }, [laundromats, center]);

  // Callback when map is loaded
  const onLoad = useCallback((map: google.maps.Map) => {
    setMapRef(map);
    
    // Fit bounds to markers if there are multiple laundromats
    if (laundromats.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      laundromats.forEach(laundry => {
        bounds.extend({
          lat: parseFloat(laundry.latitude),
          lng: parseFloat(laundry.longitude)
        });
      });
      map.fitBounds(bounds);
    }
  }, [laundromats]);

  // Callback when map is unmounted
  const onUnmount = useCallback(() => {
    setMapRef(null);
  }, []);

  // Handle marker click
  const handleMarkerClick = (laundry: Laundromat) => {
    setSelectedLaundry(laundry);
    
    if (mapRef) {
      mapRef.panTo({
        lat: parseFloat(laundry.latitude),
        lng: parseFloat(laundry.longitude)
      });
    }
  };

  // Close info window
  const handleInfoWindowClose = () => {
    setSelectedLaundry(null);
  };

  // Handle loading error
  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <h3 className="text-lg font-semibold">Error loading map</h3>
        <p>Sorry, we couldn't load the map. Please try again later.</p>
      </div>
    );
  }

  // Loading placeholder
  if (!isLoaded) {
    return (
      <div className={`animate-pulse ${containerClassName}`} style={{ height, width }}>
        <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName || ''} style={{ height: height, width: width }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={calculateCenter()}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
        }}
      >
        {/* Render markers for each laundromat */}
        {laundromats.map(laundry => (
          <Marker
            key={laundry.id}
            position={{
              lat: parseFloat(laundry.latitude),
              lng: parseFloat(laundry.longitude)
            }}
            onClick={() => handleMarkerClick(laundry)}
            icon={{
              url: laundry.isPremium || laundry.isFeatured
                ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new google.maps.Size(40, 40)
            }}
            animation={google.maps.Animation.DROP}
          />
        ))}

        {/* Info window for selected laundromat */}
        {selectedLaundry && (
          <InfoWindow
            position={{
              lat: parseFloat(selectedLaundry.latitude),
              lng: parseFloat(selectedLaundry.longitude)
            }}
            onCloseClick={handleInfoWindowClose}
          >
            <Card className="w-64 border-0 shadow-none">
              <CardContent className="p-3">
                <h3 className="font-semibold text-lg mb-1">{selectedLaundry.name}</h3>
                
                <div className="flex items-start gap-1 text-sm text-gray-600 mb-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{selectedLaundry.address}, {selectedLaundry.city}</span>
                </div>
                
                {selectedLaundry.rating && (
                  <div className="flex items-center mb-2">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i}
                          className={`h-3 w-3 ${
                            i < parseInt(selectedLaundry.rating || '0') 
                              ? 'text-yellow-400 fill-yellow-400' 
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs ml-1 text-gray-600">
                      {selectedLaundry.reviewCount || 0} reviews
                    </span>
                  </div>
                )}
                
                {selectedLaundry.promotionalText && (
                  <p className="text-xs text-primary font-medium mb-2">
                    {selectedLaundry.promotionalText}
                  </p>
                )}
              </CardContent>
              
              <CardFooter className="p-3 pt-0">
                <Link href={`/laundry/${selectedLaundry.slug}`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs flex items-center justify-center">
                    View Details
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default LaundryMap;