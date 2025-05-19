import React from 'react';
import { Laundromat } from '../types/laundromat';
import { Link } from 'wouter';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Star, ExternalLink } from 'lucide-react';
import MapLegend from '@/components/MapLegend';

interface StaticLaundryMapProps {
  laundromats: Laundromat[];
  center?: { lat: number, lng: number };
  zoom?: number;
  height?: string;
  width?: string;
  containerClassName?: string;
  showLegend?: boolean;
}

const StaticLaundryMap: React.FC<StaticLaundryMapProps> = ({
  laundromats,
  center,
  zoom = 14,
  height = '500px',
  width = '100%',
  containerClassName = '',
  showLegend = true,
}) => {
  // Calculate center from laundromats if not provided
  const calculateCenter = () => {
    // Use provided center if available
    if (center) {
      return { lat: center.lat, lng: center.lng };
    }
    
    // If no laundromats, use US center
    if (laundromats.length === 0) {
      return { lat: 39.8283, lng: -98.5795 };
    }
    
    // Get average lat and lng from laundromats
    const sumLat = laundromats.reduce((sum, laundry) => sum + parseFloat(laundry.latitude), 0);
    const sumLng = laundromats.reduce((sum, laundry) => sum + parseFloat(laundry.longitude), 0);
    
    return {
      lat: sumLat / laundromats.length,
      lng: sumLng / laundromats.length
    };
  };

  // Format a static map URL with markers
  const getStaticMapUrl = () => {
    const mapCenter = calculateCenter();
    
    // Check if we have a cached static map first
    const cacheKey = `map_${mapCenter.lat.toFixed(6).replace(/\./g, '_')}_${mapCenter.lng.toFixed(6).replace(/\./g, '_')}_${zoom}_600x500.jpg`;
    const cachedPath = `/maps/static/${cacheKey}`;
    
    // If we have more than 20 laundromats, limit to 20 markers to avoid URL length limits
    const markersToShow = laundromats.slice(0, 20);
    
    // Create fallback URL in case cached map is not available
    let markerParams = '';
    if (markersToShow.length > 0) {
      // Create markers string
      markerParams = markersToShow.map(l => 
        `&markers=color:red|${parseFloat(l.latitude).toFixed(6)},${parseFloat(l.longitude).toFixed(6)}`
      ).join('');
    } else {
      // If no markers, add a center marker
      markerParams = `&markers=color:blue|${mapCenter.lat.toFixed(6)},${mapCenter.lng.toFixed(6)}`;
    }
    
    const fallbackUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${mapCenter.lat.toFixed(6)},${mapCenter.lng.toFixed(6)}&zoom=${zoom}&size=600x500&scale=2${markerParams}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    
    return { cachedPath, fallbackUrl };
  };

  // Get map URLs
  const { cachedPath, fallbackUrl } = getStaticMapUrl();

  // Get laundromat cards to display alongside the map
  const getLaundromatCards = () => {
    return laundromats.slice(0, 5).map(laundromat => (
      <Card key={laundromat.id} className="mb-3 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-1">{laundromat.name}</h3>
          
          <div className="flex items-start gap-1 text-sm text-gray-600 mb-2">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{laundromat.address}, {laundromat.city}</span>
          </div>
          
          {laundromat.rating && (
            <div className="flex items-center mb-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i}
                    className={`h-3 w-3 ${
                      i < parseFloat(laundromat.rating || '0') 
                        ? 'text-yellow-400 fill-yellow-400' 
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs ml-1 text-gray-600">
                {laundromat.reviewCount || 0} reviews
              </span>
            </div>
          )}
          
          {laundromat.services && laundromat.services.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {laundromat.services.slice(0, 3).map((service, idx) => (
                <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {service}
                </span>
              ))}
              {laundromat.services.length > 3 && (
                <span className="text-xs text-gray-500">+{laundromat.services.length - 3} more</span>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="p-4 pt-0">
          <Link href={`/laundromat/${laundromat.slug}`}>
            <Button variant="outline" size="sm" className="w-full">
              View Details
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    ));
  };

  return (
    <div className={`${containerClassName}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div style={{ height, width: '100%', position: 'relative' }}>
            {/* Static map image with fallback */}
            <img 
              src={cachedPath} 
              alt="Map of laundromats"
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                // If cached image fails, use fallback URL
                (e.target as HTMLImageElement).src = fallbackUrl;
              }}
            />
            
            {/* Optional Legend */}
            {showLegend && (
              <div className="absolute bottom-3 left-3 right-3">
                <MapLegend />
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-auto" style={{maxHeight: height}}>
          <h3 className="font-semibold text-lg mb-3">
            Laundromats in this area ({laundromats.length})
          </h3>
          {getLaundromatCards()}
          
          {laundromats.length > 5 && (
            <p className="text-sm text-gray-600 text-center">
              + {laundromats.length - 5} more laundromats in this area
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaticLaundryMap;