import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import FilterSection from '@/components/FilterSection';
import AdContainer from '@/components/AdContainer';
import ListingCard from '@/components/ListingCard';
import LaundryMap from '@/components/LaundryMap';
import SchemaMarkup from '@/components/SchemaMarkup';
import MetaTags from '@/components/MetaTags';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
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
    const queryParam = params.get('q');
    
    if (locationParam) {
      setCurrentLocation(locationParam);
      saveLastLocation(locationParam);
      saveRecentSearch(locationParam);
    } else if (queryParam) {
      // If searching by query/ZIP, use that as the location name
      const displayLocation = queryParam.match(/^\d{5}$/) ? 
        `ZIP ${queryParam}` : queryParam;
      setCurrentLocation(displayLocation);
      saveLastLocation(displayLocation);
      saveRecentSearch(displayLocation);
    } else {
      // If using coordinates, set a default display name
      setCurrentLocation('Current Location');
    }
  }, [location]);
  
  // Fetch laundromats based on search parameters
  const { 
    data: laundromats = [], 
    isLoading,
    error: searchError,
    refetch: refetchSearch 
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/laundromats', { 
      q: searchParams.get('q') || searchParams.get('location') || '',
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
      {/* SEO Schema Markup */}
      {laundromats.length > 0 && 
        <SchemaMarkup 
          type="list" 
          data={laundromats}
          location={currentLocation} 
        />
      }
      
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="service"
        title={`Laundromats in ${currentLocation || 'Your Area'}`}
        description={`Find the best laundromats in ${currentLocation || 'your area'}. Compare prices, services, and amenities to make laundry day easier.`}
        location={currentLocation}
        service="Laundromats"
      />
      
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
              ) : searchError ? (
                <div className="bg-white rounded-lg p-6 mb-4">
                  <ApiErrorDisplay 
                    error={searchError as Error}
                    resetError={() => refetchSearch()}
                    message="We couldn't find laundromats matching your search. Please try again or adjust your search criteria."
                  />
                </div>
              ) : laundromats.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-xl font-semibold mb-2">
                    {/^\d{5}$/.test(searchParams.get('q') || '') 
                      ? `No Laundromats within ${searchParams.get('radius') || '5'} miles of ZIP ${searchParams.get('q')}`
                      : 'No Laundromats Found'
                    }
                  </h3>
                  {/^\d{5}$/.test(searchParams.get('q') || '') ? (
                    <>
                      <p className="text-gray-600 mb-2">We're currently importing our database of 27,000+ laundromats nationwide.</p>
                      <p className="text-gray-600 mb-4">ZIP code {searchParams.get('q')} will be available soon as we continue updating our data.</p>
                      <div className="space-y-3">
                        <div>
                          <Link to={`/search?q=${searchParams.get('q')}&radius=${Math.min(25, (parseInt(searchParams.get('radius') || '5') + 5))}`} className="inline-block bg-primary text-white py-2 px-4 rounded mr-2">
                            Try a Wider Search Area
                          </Link>
                          <Link to="/" className="inline-block bg-secondary text-white py-2 px-4 rounded">
                            Browse Featured Laundromats
                          </Link>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-600">Try adjusting your search or filters to find laundromats in your area.</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Google Map */}
                  <div className="mb-8">
                    <LaundryMap 
                      laundromats={laundromats} 
                      center={
                        searchParams.get('lat') && searchParams.get('lng') 
                          ? { 
                              lat: parseFloat(searchParams.get('lat') || "0"), 
                              lng: parseFloat(searchParams.get('lng') || "0") 
                            } 
                          : undefined
                      }
                      zoom={12}
                    />
                  </div>
                  
                  {/* Laundromat Listings */}
                  <div id="laundromat-listings" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {laundromats.map((laundromat, index) => (
                      <div key={laundromat.id} className="mb-4">
                        <ListingCard 
                          laundromat={laundromat}
                          userLocation={
                            searchParams.get('lat') && searchParams.get('lng') 
                              ? { 
                                  lat: parseFloat(searchParams.get('lat') || "0"), 
                                  lng: parseFloat(searchParams.get('lng') || "0") 
                                } 
                              : undefined
                          }
                        />
                        
                        {/* Insert ad after every 2 listings */}
                        {index % 2 === 1 && index < laundromats.length - 1 && (
                          <AdContainer 
                            key={`ad-${index}`} 
                            format="native" 
                            className="mt-4 rounded-lg border border-gray-200 p-4" 
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
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
