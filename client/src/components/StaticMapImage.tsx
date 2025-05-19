import React, { useState } from 'react';

/**
 * StaticMapImage Component
 * 
 * This component reduces Google Static Maps API costs by:
 * 1. Using pre-cached static map images when available
 * 2. Only making API calls when cached versions aren't available
 * 3. Using fallback images to prevent unnecessary API calls
 * 
 * Using the pattern: /maps/static/map_${lat}_${lng}_${zoom}_${width}x${height}.jpg
 */
interface StaticMapImageProps {
  latitude: string | number;
  longitude: string | number;
  zoom?: number;
  width?: number;
  height?: number;
  markers?: Array<{
    lat: string | number;
    lng: string | number;
    color?: string;
    label?: string;
  }>;
  className?: string;
  alt?: string;
  fallbackImage?: string;
}

const StaticMapImage: React.FC<StaticMapImageProps> = ({
  latitude,
  longitude,
  zoom = 14,
  width = 600,
  height = 300,
  markers = [],
  className = '',
  alt = 'Map',
  fallbackImage = 'https://images.unsplash.com/photo-1581362072978-14998d01fdce?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300',
}) => {
  const [useApi, setUseApi] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Format coordinates for consistent caching
  const lat = typeof latitude === 'string' ? latitude : latitude.toString();
  const lng = typeof longitude === 'string' ? longitude : longitude.toString();
  
  // Build cached path for static map - format: map_lat_lng_zoom_widthxheight.jpg
  // Coordinates are formatted with underscores for URL paths
  const cachedPath = `/maps/static/map_${lat.replace(/\./g, '_')}_${lng.replace(/\./g, '_')}_${zoom}_${width}x${height}.jpg`;
  
  // Build Google Static Maps API URL as fallback
  const buildGoogleMapsUrl = () => {
    let url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    
    // Add markers if provided
    if (markers.length > 0) {
      const markerParams = markers.map(marker => {
        const color = marker.color || 'red';
        const label = marker.label || '';
        return `color:${color}|label:${label}|${marker.lat},${marker.lng}`;
      }).join('&markers=');
      
      url += `&markers=${markerParams}`;
    } else {
      // Add a default marker at the center if no markers provided
      url += `&markers=color:red|${lat},${lng}`;
    }
    
    return url;
  };
  
  // Handle error loading cached image
  const handleCachedImageError = () => {
    if (!useApi) {
      setUseApi(true);
    } else {
      setImageError(true);
    }
  };
  
  // Render fallback if both cached and API images fail
  if (imageError) {
    return (
      <img 
        src={fallbackImage}
        alt={alt}
        className={className}
        width={width}
        height={height}
      />
    );
  }
  
  // Attempt to use cached image first, fall back to API if that fails
  return (
    <img 
      src={useApi ? buildGoogleMapsUrl() : cachedPath}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onError={handleCachedImageError}
    />
  );
};

export default StaticMapImage;