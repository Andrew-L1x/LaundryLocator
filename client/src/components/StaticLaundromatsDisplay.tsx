import React, { useState } from 'react';
import { Laundromat } from '../types/laundromat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Phone, Clock, Star, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

interface StaticLaundromatsDisplayProps {
  laundromats: Laundromat[];
  center?: { lat: number, lng: number };
  zoom?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  showMap?: boolean;
}

/**
 * StaticLaundromatsDisplay Component
 * 
 * This component displays a static list of laundromats with a fallback
 * map image, perfect for detail pages and location-specific views.
 */
const StaticLaundromatsDisplay: React.FC<StaticLaundromatsDisplayProps> = ({
  laundromats,
  center,
  zoom = 12,
  width = "100%",
  height = 400,
  className = '',
  showMap = true,
}) => {
  const [selectedLaundromat, setSelectedLaundromat] = useState<Laundromat | null>(null);
  
  // Calculate center from laundromats if not provided
  const getMapCenter = () => {
    if (center) {
      return center;
    }
    
    if (laundromats.length === 0) {
      return { lat: 39.8283, lng: -98.5795 }; // Geographic center of the US
    }
    
    const sumLat = laundromats.reduce((sum, laundry) => sum + parseFloat(laundry.latitude), 0);
    const sumLng = laundromats.reduce((sum, laundry) => sum + parseFloat(laundry.longitude), 0);
    
    return {
      lat: sumLat / laundromats.length,
      lng: sumLng / laundromats.length
    };
  };
  
  const mapCenter = getMapCenter();
  
  // Generate map URL - either from Google Static Maps API or from local cache
  const getMapUrl = () => {
    const { lat, lng } = mapCenter;
    const formattedLat = String(lat).replace(/\./g, '_');
    const formattedLng = String(lng).replace(/\./g, '_');
    const fileWidth = typeof width === 'number' ? width : 600;
    const fileHeight = typeof height === 'number' ? height : 350;
    
    // Check if we have a cached map
    const cachedFile = `/maps/static/map_${formattedLat}_${formattedLng}_${zoom}_${fileWidth}x${fileHeight}.jpg`;
    
    return cachedFile;
  };
  
  // Generate fallback image URLs for different map views
  const fallbackImageUrls = {
    city: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350",
    residential: "https://images.unsplash.com/photo-1515263487990-61b07816b324?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350",
    suburb: "https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350",
    rural: "https://images.unsplash.com/photo-1623197339746-d0da012fe7e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=350"
  };
  
  // Format address for display
  const formatAddress = (laundromat: Laundromat) => {
    let parts = [];
    if (laundromat.address) parts.push(laundromat.address);
    if (laundromat.city) parts.push(laundromat.city);
    if (laundromat.state) parts.push(laundromat.state);
    if (laundromat.zip) parts.push(laundromat.zip);
    
    return parts.join(', ');
  };
  
  return (
    <div className={`static-laundromats-display ${className}`}>
      {showMap && (
        <div className="mb-6 rounded-lg overflow-hidden shadow-md" style={{ height }}>
          <img 
            src={getMapUrl()}
            alt={`Map showing ${laundromats.length} laundromats`}
            onError={(e) => {
              // If map image fails, use a fallback
              e.currentTarget.src = fallbackImageUrls.city;
            }}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {laundromats.map((laundromat) => (
          <Card 
            key={laundromat.id}
            className={`shadow-sm hover:shadow-md transition-shadow cursor-pointer ${selectedLaundromat?.id === laundromat.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedLaundromat(laundromat)}
          >
            <CardContent className="p-4">
              <h3 className="font-semibold text-lg mb-1">{laundromat.name}</h3>
              
              {/* Address */}
              <div className="flex items-start gap-1 text-sm text-gray-600 mb-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{formatAddress(laundromat)}</span>
              </div>
              
              {/* Rating */}
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
              
              {/* Hours */}
              {laundromat.hours && (
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>{laundromat.hours}</span>
                </div>
              )}
              
              {/* Phone */}
              {laundromat.phone && (
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Phone className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>{laundromat.phone}</span>
                </div>
              )}
              
              {/* Services */}
              {laundromat.services && laundromat.services.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {laundromat.services.slice(0, 3).map((service, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                  {laundromat.services.length > 3 && (
                    <span className="text-xs text-gray-500">+{laundromat.services.length - 3} more</span>
                  )}
                </div>
              )}
              
              {/* Bottom actions */}
              <div className="mt-4 flex justify-between">
                <Link 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${laundromat.latitude},${laundromat.longitude}`}
                  target="_blank"
                >
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    <Navigation className="h-3 w-3" />
                    Directions
                  </Button>
                </Link>
                
                <Link href={`/laundromat/${laundromat.slug}`}>
                  <Button size="sm" className="text-xs gap-1">
                    Details
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {laundromats.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No laundromats found in this area.</p>
            <p className="text-sm text-gray-500 mt-1">Try expanding your search radius.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaticLaundromatsDisplay;