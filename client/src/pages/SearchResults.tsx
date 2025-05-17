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
import { isZipCode, hasFallbackDataForZip, getFallbackDataForZip } from '@/lib/zipFallbackData';

const SearchResults = () => {
  const [location] = useLocation();
  const [searchParams, setSearchParams] = useState<URLSearchParams>(new URLSearchParams(window.location.search));
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [filters, setFilters] = useState<Filter>({});
  
  const [_, navigate] = useLocation();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchParams(params);
    
    const locationParam = params.get('location');
    const queryParam = params.get('q');
    const latParam = params.get('lat');
    const lngParam = params.get('lng');
    
    // If no search parameters are provided, redirect to home page
    if (!queryParam && !locationParam && !latParam && !lngParam) {
      console.log('No search parameters provided, redirecting to home page');
      navigate('/');
      return;
    }
    
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
    } else if (latParam && lngParam) {
      // If using coordinates, set a default display name
      setCurrentLocation('Current Location');
    } else {
      // Default case - no search parameters
      setCurrentLocation('');
    }
  }, [location, navigate]);
  
  // Fetch laundromats based on search parameters
  // Check if we're searching for a ZIP code that has fallback data
  const searchQuery = searchParams.get('q') || '';
  const useZipFallback = searchParams.get('useZipFallback') === 'true';
  
  // Check if this is a ZIP code search with available fallback data
  const isZipSearch = isZipCode(searchQuery);
  const hasFallbackData = isZipSearch && hasFallbackDataForZip(searchQuery);
  
  // Get fallback data if available for this ZIP code
  const fallbackLaundromat = hasFallbackData ? getFallbackDataForZip(searchQuery) : null;
  
  // Initialize with fallback data if available
  const initialData = fallbackLaundromat ? [fallbackLaundromat] : [];
  
  // Set the location display for ZIP code with fallback data
  useEffect(() => {
    if (hasFallbackData && fallbackLaundromat) {
      const displayLocation = `${fallbackLaundromat.city}, ${fallbackLaundromat.state} ${fallbackLaundromat.zip}`;
      setCurrentLocation(displayLocation);
    }
  }, [hasFallbackData, fallbackLaundromat]);
  
  const { 
    data: laundromats = initialData, 
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
      const [, params] = queryKey as [string, any];
      
      // If we're using the ZIP fallback system and have fallback data for this ZIP
      const query = params.q as string;
      if (useZipFallback && query && isZipCode(query) && hasFallbackDataForZip(query)) {
        console.log(`Using fallback data for ZIP ${query}`);
        return [getFallbackDataForZip(query)!];
      }
      
      const queryParams = new URLSearchParams();
      if (query) queryParams.append('q', query);
      if (params.lat && params.lng) {
        queryParams.append('lat', String(params.lat));
        queryParams.append('lng', String(params.lng));
      }
      if (params.openNow) queryParams.append('openNow', 'true');
      if (params.services?.length) queryParams.append('services', params.services.join(','));
      if (params.rating) queryParams.append('rating', String(params.rating));
      
      const response = await fetch(`/api/laundromats?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch laundromats');
      const responseData = await response.json();
      
      // If we have an empty result for a ZIP code, check if we have fallback data
      if (responseData.length === 0 && query && isZipCode(query) && hasFallbackDataForZip(query)) {
        console.log(`No results from API for ZIP ${query}, using fallback data`);
        return [getFallbackDataForZip(query)!];
      }
      
      return responseData;
    },
    initialData: hasFallbackData ? initialData : undefined,
    enabled: !!searchParams.get('location') || !!(searchParams.get('lat') && searchParams.get('lng')) || !!searchParams.get('q')
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
                      <p className="text-gray-600 mb-4">
                        <span className="font-semibold">Don't see what you're looking for?</span> We're continuously adding to our database of 27,000+ laundromats.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                          <h4 className="font-medium text-blue-800 mb-2">Search Options</h4>
                          <ul className="list-disc pl-5 space-y-1 text-blue-700">
                            <li>Try increasing your search radius</li>
                            <li>Search by city or state name instead of ZIP</li>
                            <li>Browse your state's directory for a complete listing</li>
                          </ul>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 justify-center">
                          <Link to={`/search?q=${searchParams.get('q')}&radius=${Math.min(25, (parseInt(searchParams.get('radius') || '5') + 10))}`} className="inline-block bg-primary text-white py-2 px-4 rounded">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              Wider Area (15 miles)
                            </span>
                          </Link>
                          
                          <Link to={`/search?q=${searchParams.get('q')}&radius=25`} className="inline-block bg-secondary text-white py-2 px-4 rounded">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                              </svg>
                              Maximum Range (25 mi)
                            </span>
                          </Link>
                          
                          <Link to="/states" className="inline-block bg-blue-600 text-white py-2 px-4 rounded">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              Browse By State
                            </span>
                          </Link>
                          
                          <Link to="/" className="inline-block bg-gray-500 text-white py-2 px-4 rounded">
                            <span className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              Return Home
                            </span>
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
