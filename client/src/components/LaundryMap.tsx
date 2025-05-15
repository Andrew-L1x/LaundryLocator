import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Laundromat } from '@shared/schema';
import { Link } from 'wouter';

const containerStyle = {
  width: '100%',
  height: '500px'
};

const defaultCenter = {
  lat: 37.7749, // San Francisco
  lng: -122.4194
};

// Default map options
const defaultOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false
};

interface LaundryMapProps {
  laundromats: Laundromat[];
  center?: { lat: number; lng: number };
  zoom?: number;
}

const LaundryMap: React.FC<LaundryMapProps> = ({ 
  laundromats, 
  center = defaultCenter,
  zoom = 10 
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedLaundromat, setSelectedLaundromat] = useState<Laundromat | null>(null);
  
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMarkerClick = (laundromat: Laundromat) => {
    setSelectedLaundromat(laundromat);
  };

  const handleInfoWindowClose = () => {
    setSelectedLaundromat(null);
  };

  if (!isLoaded) return <div className="h-96 flex items-center justify-center">Loading Map...</div>;

  return (
    <div className="w-full rounded-lg overflow-hidden shadow-lg">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={{
          lat: parseFloat(center.lat.toString()),
          lng: parseFloat(center.lng.toString())
        }}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={defaultOptions}
      >
        {laundromats.map((laundromat) => (
          <Marker
            key={laundromat.id}
            position={{
              lat: parseFloat(laundromat.latitude),
              lng: parseFloat(laundromat.longitude)
            }}
            onClick={() => handleMarkerClick(laundromat)}
            icon={{
              url: laundromat.isPremium 
                ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" 
                : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              scaledSize: new window.google.maps.Size(40, 40)
            }}
          />
        ))}

        {selectedLaundromat && (
          <InfoWindow
            position={{
              lat: parseFloat(selectedLaundromat.latitude),
              lng: parseFloat(selectedLaundromat.longitude)
            }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-bold text-lg">{selectedLaundromat.name}</h3>
              <p className="text-sm">{selectedLaundromat.address}</p>
              <p className="text-sm">{selectedLaundromat.city}, {selectedLaundromat.state} {selectedLaundromat.zip}</p>
              <p className="text-sm mt-1">{selectedLaundromat.hours}</p>
              <div className="mt-2 flex gap-1 flex-wrap">
                {selectedLaundromat.services.map((service, idx) => (
                  <span 
                    key={idx}
                    className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                  >
                    {service}
                  </span>
                ))}
              </div>
              <Link 
                to={`/laundry/${selectedLaundromat.slug}`}
                className="mt-3 block text-white bg-blue-600 px-4 py-2 rounded text-center hover:bg-blue-700 transition-colors text-sm"
              >
                View Details
              </Link>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default LaundryMap;