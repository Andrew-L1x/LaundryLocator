import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import FilterSection from '@/components/FilterSection';
import AdContainer from '@/components/AdContainer';
import LaundryCard from '@/components/LaundryCard';
import Footer from '@/components/Footer';
import { Laundromat, Filter } from '@/types/laundromat';
import { saveLastLocation, saveRecentSearch } from '@/lib/storage';

const SearchResults = () => {
  const [location] = useLocation();
  const [searchParams, setSearchParams] = useState<URLSearchParams>(new URLSearchParams(window.location.search));
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [filters, setFilters] = useState<Filter>({});
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchParams(params);
    
    const locationParam = params.get('location');
    if (locationParam) {
      setCurrentLocation(locationParam);
      saveLastLocation(locationParam);
      saveRecentSearch(locationParam);
    } else {
      // If using coordinates, set a default display name
      setCurrentLocation('Current Location');
    }
  }, [location]);
  
  // Fetch laundromats based on search parameters
  const { data: laundromats = [], isLoading } = useQuery<Laundromat[]>({
    queryKey: ['/api/laundromats', { 
      q: searchParams.get('location') || '',
      lat: searchParams.get('lat') || undefined,
      lng: searchParams.get('lng') || undefined,
      ...filters
    }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey;
      const queryParams = new URLSearchParams();
      
      if (params.q) queryParams.append('q', params.q as string);
      if (params.lat && params.lng) {
        queryParams.append('lat', params.lat as string);
        queryParams.append('lng', params.lng as string);
      }
      if (params.openNow) queryParams.append('openNow', 'true');
      if (params.services?.length) queryParams.append('services', (params.services as string[]).join(','));
      if (params.rating) queryParams.append('rating', params.rating as string);
      
      const response = await fetch(`/api/laundromats?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch laundromats');
      return response.json();
    },
    enabled: !!searchParams.get('location') || !!(searchParams.get('lat') && searchParams.get('lng'))
  });
  
  const handleFilterChange = (newFilters: Filter) => {
    setFilters(newFilters);
  };
  
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      <Header />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      <main className="container mx-auto px-4 py-6">
        {/* Filter Section */}
        <FilterSection 
          onFilterChange={handleFilterChange} 
          currentLocation={currentLocation} 
        />
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/4">
            {/* Search Results */}
            <section>
              <h2 className="text-2xl font-bold mb-4">
                {isLoading ? 'Searching...' : `Found ${laundromats.length} Laundromats`}
              </h2>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : laundromats.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-xl font-semibold mb-2">No Laundromats Found</h3>
                  <p className="text-gray-600">Try adjusting your search or filters to find laundromats in your area.</p>
                </div>
              ) : (
                <div id="laundromat-listings">
                  {laundromats.map((laundromat, index) => (
                    <>
                      <LaundryCard key={laundromat.id} laundromat={laundromat} />
                      
                      {/* Insert ad after every 2 listings */}
                      {index % 2 === 1 && index < laundromats.length - 1 && (
                        <AdContainer 
                          key={`ad-${index}`} 
                          format="native" 
                          className="my-4 rounded-lg border border-gray-200 p-4" 
                        />
                      )}
                    </>
                  ))}
                </div>
              )}
            </section>
          </div>
          
          <div className="w-full lg:w-1/4">
            {/* Sticky sidebar ad */}
            <div className="hidden lg:block">
              <AdContainer format="vertical" className="sticky top-24" />
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default SearchResults;
