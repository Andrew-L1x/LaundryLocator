import React, { useState, useEffect } from 'react';
import { Laundromat } from '../types/laundromat';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Search, Phone, Star, Clock, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import MapLegend from '@/components/MapLegend';
import StaticMapDisplay from '@/components/StaticMapDisplay';

interface StaticLaundryMapPageProps {
  laundromats: Laundromat[];
  center?: { lat: number, lng: number };
  initialZoom?: number;
  title?: string;
  description?: string;
  showSearchBar?: boolean;
  showFilters?: boolean;
  className?: string;
}

/**
 * StaticLaundryMapPage Component
 * 
 * This component completely replaces the Google Maps JavaScript API with static maps.
 * It provides a full-featured map page with search, filters, and interactive laundromat listings.
 */
const StaticLaundryMapPage: React.FC<StaticLaundryMapPageProps> = ({
  laundromats,
  center,
  initialZoom = 14,
  title = "Laundromats Near You",
  description,
  showSearchBar = true,
  showFilters = true,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLaundromat, setSelectedLaundromat] = useState<Laundromat | null>(null);
  const [filteredLaundromats, setFilteredLaundromats] = useState<Laundromat[]>(laundromats);
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    "open_now": false,
    "coin_operated": false,
    "card_payment": false,
    "24_hours": false,
    "drop_off_service": false,
    "wifi": false,
  });
  
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
  
  // Get center coordinates
  const mapCenter = calculateCenter();
  
  // Apply filters and search
  useEffect(() => {
    let results = [...laundromats];
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(laundromat => {
        return (
          laundromat.name.toLowerCase().includes(query) ||
          (laundromat.address && laundromat.address.toLowerCase().includes(query)) ||
          (laundromat.city && laundromat.city.toLowerCase().includes(query))
        );
      });
    }
    
    // Apply active filters
    if (activeFilters.open_now) {
      // This would require checking hours data - simplified implementation
      results = results.filter(laundromat => laundromat.hours !== "Closed");
    }
    
    if (activeFilters.coin_operated) {
      results = results.filter(laundromat => 
        laundromat.services?.some(service => 
          service.toLowerCase().includes('coin') || 
          service.toLowerCase().includes('self service')
        )
      );
    }
    
    if (activeFilters.card_payment) {
      results = results.filter(laundromat => 
        laundromat.services?.some(service => 
          service.toLowerCase().includes('card')
        )
      );
    }
    
    if (activeFilters['24_hours']) {
      results = results.filter(laundromat => 
        laundromat.hours?.includes('24') || 
        laundromat.services?.some(service => service.includes('24'))
      );
    }
    
    if (activeFilters.drop_off_service) {
      results = results.filter(laundromat => 
        laundromat.services?.some(service => 
          service.toLowerCase().includes('drop') || 
          service.toLowerCase().includes('wash and fold')
        )
      );
    }
    
    if (activeFilters.wifi) {
      results = results.filter(laundromat => 
        laundromat.services?.some(service => 
          service.toLowerCase().includes('wifi')
        )
      );
    }
    
    setFilteredLaundromats(results);
  }, [laundromats, searchQuery, activeFilters]);
  
  // Toggle filter
  const toggleFilter = (filterName: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };
  
  // Handle marker click from the map
  const handleMarkerClick = (laundromat: Laundromat) => {
    setSelectedLaundromat(laundromat);
  };
  
  // Format address
  const formatAddress = (laundromat: Laundromat) => {
    let parts = [];
    if (laundromat.address) parts.push(laundromat.address);
    if (laundromat.city) parts.push(laundromat.city);
    if (laundromat.state) parts.push(laundromat.state);
    if (laundromat.zip) parts.push(laundromat.zip);
    
    return parts.join(', ');
  };
  
  return (
    <div className={`static-laundry-map-page ${className}`}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        {description && <p className="text-gray-600">{description}</p>}
      </div>
      
      {/* Search & Filters */}
      {showSearchBar && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input 
              type="text"
              placeholder="Search by name, address, or city..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}
      
      {showFilters && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Badge 
            variant={activeFilters.open_now ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleFilter('open_now')}
          >
            Open Now
          </Badge>
          <Badge 
            variant={activeFilters.coin_operated ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleFilter('coin_operated')}
          >
            Coin Operated
          </Badge>
          <Badge 
            variant={activeFilters.card_payment ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleFilter('card_payment')}
          >
            Card Payment
          </Badge>
          <Badge 
            variant={activeFilters['24_hours'] ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleFilter('24_hours')}
          >
            24 Hours
          </Badge>
          <Badge 
            variant={activeFilters.drop_off_service ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleFilter('drop_off_service')}
          >
            Drop-off Service
          </Badge>
          <Badge 
            variant={activeFilters.wifi ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleFilter('wifi')}
          >
            Free WiFi
          </Badge>
        </div>
      )}
      
      {/* Results count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {filteredLaundromats.length} {filteredLaundromats.length === 1 ? 'laundromat' : 'laundromats'} found
        </p>
      </div>
      
      {/* Main content: Map and Listings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Static Map */}
          <StaticMapDisplay
            latitude={mapCenter.lat}
            longitude={mapCenter.lng}
            zoom={initialZoom}
            height="600px"
            markers={filteredLaundromats}
            onMarkerClick={handleMarkerClick}
            className="mb-4"
          />
          
          {/* Map Legend */}
          <MapLegend className="mb-6" />
        </div>
        
        {/* Laundromat listings */}
        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
          {filteredLaundromats.length > 0 ? (
            filteredLaundromats.map(laundromat => (
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
                        <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {service}
                        </span>
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
            ))
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No laundromats found.</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaticLaundryMapPage;