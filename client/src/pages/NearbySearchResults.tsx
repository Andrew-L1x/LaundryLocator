import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import LaundryMap from '@/components/LaundryMap';
import LaundryCard from '@/components/LaundryCard';
import FilterSection from '@/components/FilterSection';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import MetaTags from '@/components/MetaTags';
import { Laundromat, Filter } from '@/types/laundromat';

const NearbySearchResults = () => {
  const [location, setLocation] = useLocation();
  const [filters, setFilters] = useState<Filter>({});
  
  // Parse search parameters from URL
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') || '5';

  // Validate that we have location data
  const hasLocationData = lat && lng;
  
  // Fetch nearby laundromats
  const { 
    data: laundromats = [], 
    isLoading, 
    error,
    refetch
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/nearby-laundromats', { lat, lng, radius }],
    queryFn: async ({ queryKey }) => {
      if (!hasLocationData) return [];
      
      const [, params] = queryKey;
      const queryParams = new URLSearchParams();
      
      if (params.lat) queryParams.append('lat', params.lat as string);
      if (params.lng) queryParams.append('lng', params.lng as string);
      if (params.radius) queryParams.append('radius', params.radius as string);
      
      const response = await fetch(`/api/nearby-laundromats?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch nearby laundromats');
      return response.json();
    },
    enabled: hasLocationData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // If we don't have location data, redirect to the search page
  useEffect(() => {
    if (!hasLocationData) {
      setLocation('/search');
    }
  }, [hasLocationData, setLocation]);
  
  // Apply filters to laundromats (client-side filtering)
  const filteredLaundromats = laundromats.filter(laundromat => {
    if (filters.openNow) {
      // This would require parsing opening hours which can be complex
      // For simplicity, not implementing real-time open/closed check here
    }
    
    if (filters.services?.length) {
      // Check if laundromat offers all required services
      const hasAllServices = filters.services.every(service => 
        laundromat.services.includes(service)
      );
      if (!hasAllServices) return false;
    }
    
    if (filters.rating && laundromat.rating) {
      if (parseInt(laundromat.rating) < filters.rating) return false;
    }
    
    return true;
  });

  // Calculate center point for the map
  const center = hasLocationData ? { 
    lat: parseFloat(lat as string), 
    lng: parseFloat(lng as string) 
  } : undefined;
  
  if (!hasLocationData) {
    return null; // Will redirect to search page
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <MetaTags 
        pageType="search"
        title="Nearby Laundromats | Laundromat Directory"
        description={`Find laundromats within ${radius} miles of your current location. Browse by services, hours, and more.`}
        canonicalUrl={`/search/nearby`}
      />
      
      <h1 className="text-3xl font-bold mb-2">Nearby Laundromats</h1>
      <p className="text-gray-600 mb-6">
        Showing laundromats within {radius} miles of your location
      </p>
      
      {/* Filter Section */}
      <div className="mb-6">
        <FilterSection 
          onFilterChange={setFilters} 
          currentLocation="your location"
        />
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-gray-500">Finding laundromats near you...</p>
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            We couldn't find laundromats near your location. Please try again or use a different search method.
          </AlertDescription>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            className="mt-2"
          >
            Try Again
          </Button>
        </Alert>
      ) : filteredLaundromats.length === 0 ? (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Results</AlertTitle>
          <AlertDescription>
            We couldn't find any laundromats matching your criteria within {radius} miles. 
            Try increasing your search radius or adjusting your filters.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Map View */}
          <div className="mb-6 rounded-lg overflow-hidden border border-gray-200">
            <LaundryMap 
              laundromats={filteredLaundromats} 
              center={center}
              height="400px"
              zoom={12}
            />
          </div>
          
          <div className="flex items-center gap-2 my-4">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{filteredLaundromats.length} Laundromats Found</h2>
          </div>
          
          <Separator className="my-4" />
          
          {/* List View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLaundromats.map(laundromat => (
              <LaundryCard 
                key={laundromat.id} 
                laundromat={laundromat} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default NearbySearchResults;