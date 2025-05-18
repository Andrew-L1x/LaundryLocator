import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import FilterSection from '@/components/FilterSection';
import AdContainer from '@/components/AdContainer';
import LaundryCard from '@/components/LaundryCard';
import LaundryTips from '@/components/LaundryTips';
import ClaimListingForm from '@/components/ClaimListingForm';
import PopularCities from '@/components/PopularCities';
import AffiliateProducts from '@/components/AffiliateProducts';
import CityDirectory from '@/components/CityDirectory';
import MetaTags from '@/components/MetaTags';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import NearbySearch from '@/components/NearbySearch';
import NearbyLaundromatsMap from '@/components/NearbyLaundromatsMap';
import { Laundromat, City, Filter, LaundryTip, AffiliateProduct } from '@/types/laundromat';
import { getCurrentPosition, reverseGeocode } from '@/lib/geolocation';
import { getLastLocation, saveLastLocation } from '@/lib/storage';
import { generateHomePageContent } from '@/lib/seo';
import { stateCoordinates } from '@/lib/stateCoordinates';

const Home = () => {
  // Location management
  const [currentLocation, setCurrentLocation] = useState<string>(getLastLocation() || 'Denver, CO');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [userState, setUserState] = useState<string>("CO");
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ lat: 39.7392, lng: -104.9903 });

  // URL parameters for manual location search
  const searchParams = new URLSearchParams(window.location.search);
  const urlLat = searchParams.get('lat');
  const urlLng = searchParams.get('lng');
  const urlRadius = searchParams.get('radius') || '25';
  const searchMode = searchParams.get('mode');

  // User interface states
  const [showMap, setShowMap] = useState<boolean>(true); // Always show map on home page
  const [filters, setFilters] = useState<Filter>({});
  
  // Default Denver coordinates (fallback)
  const denverLat = 39.7392;
  const denverLng = -104.9903;
  const defaultRadius = '25';

  // Fetch featured laundromats
  const { 
    data: featuredLaundromats = [],
    error: featuredError,
    refetch: refetchFeatured
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/featured-laundromats'],
  });

  // Get user location on component mount
  useEffect(() => {
    // If URL params are provided, use them directly
    if (urlLat && urlLng) {
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`Using URL coordinates: ${lat}, ${lng}`);
        setUserLocation({ lat, lng });
        setMapCenter({ lat, lng });
        setLocationStatus('success');
      } else {
        // Fallback to Denver if invalid coordinates
        console.log('Invalid URL coordinates, using Denver fallback');
        setUserLocation({ lat: denverLat, lng: denverLng });
        setMapCenter({ lat: denverLat, lng: denverLng });
        setLocationStatus('error');
        setUserState("CO");
      }
    } else {
      // No URL params, try to get user's location
      setLocationStatus('loading');
      
      getCurrentPosition()
        .then(location => {
          if (location) {
            console.log('Successfully detected user location:', location);
            setUserLocation(location);
            setMapCenter(location);
            setLocationStatus('success');
            
            // Update display location name and get state via reverse geocoding
            reverseGeocode(location.lat, location.lng)
              .then(locationData => {
                // Save formatted address for display
                if (locationData.formattedAddress) {
                  setCurrentLocation(locationData.formattedAddress);
                  saveLastLocation(locationData.formattedAddress);
                }
                
                // Get state code from reverse geocoding
                if (locationData.state) {
                  console.log("User's state detected:", locationData.state);
                  setUserState(locationData.state);
                }
              })
              .catch(error => {
                console.error('Error reverse geocoding:', error);
                setUserState("CO"); // Fallback to Colorado if geocoding fails
              });
          } else {
            // Default to Denver if geolocation fails
            console.log('Geolocation unavailable, using Denver fallback');
            setUserLocation({ lat: denverLat, lng: denverLng });
            setMapCenter({ lat: denverLat, lng: denverLng });
            setLocationStatus('error');
            setCurrentLocation('Denver, CO');
            setUserState("CO");
          }
        })
        .catch(error => {
          console.error('Error getting location:', error);
          setUserLocation({ lat: denverLat, lng: denverLng });
          setMapCenter({ lat: denverLat, lng: denverLng });
          setLocationStatus('error');
          setCurrentLocation('Denver, CO');
          setUserState("CO");
        });
    }
  }, [urlLat, urlLng]);
  
  // Fetch laundromats with smart fallback
  const { 
    data: laundromats = [],
    error: laundromatsError,
    isLoading: laundromatsLoading,
    refetch: refetchLaundromats
  } = useQuery<Laundromat[]>({
    queryKey: [
      '/api/laundromats', 
      userLocation?.lat || denverLat, 
      userLocation?.lng || denverLng, 
      urlRadius || defaultRadius,
      userState
    ],
    retry: 3,
    enabled: locationStatus !== 'loading',
    queryFn: async ({ queryKey }) => {
      const [, lat, lng, radius, stateCode] = queryKey;
      
      // First try coordinate-based search
      try {
        const params = new URLSearchParams();
        params.append('lat', String(lat));
        params.append('lng', String(lng));
        params.append('radius', String(radius));
        
        console.log(`Fetching laundromats near (${lat}, ${lng}) within ${radius} miles`);
        
        const response = await fetch(`/api/laundromats?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch nearby laundromats');
        
        const data = await response.json();
        console.log(`Found ${data.length} laundromats near coordinates`);
        
        // If we got results, return them
        if (data && data.length > 0) {
          return data;
        }
        
        throw new Error('No nearby laundromats found');
      } catch (error) {
        console.log(`No nearby laundromats found, falling back to state: ${stateCode}`);
        
        try {
          // Try state-based fallback
          const stateParams = new URLSearchParams();
          stateParams.append('state', String(stateCode || 'CO'));
          
          console.log(`Fetching laundromats for state: ${stateCode || 'CO'}`);
          const stateResponse = await fetch(`/api/laundromats?${stateParams.toString()}`);
          
          if (!stateResponse.ok) throw new Error('Failed to fetch state laundromats');
          
          const stateData = await stateResponse.json();
          console.log(`Found ${stateData.length} laundromats in state ${stateCode || 'CO'}`);
          
          // Update map center to state capital
          const stateCenterInfo = stateCoordinates[String(stateCode)] || stateCoordinates['CO'];
          console.log(`Setting map center to ${stateCenterInfo.name}`);
          setMapCenter({ lat: stateCenterInfo.lat, lng: stateCenterInfo.lng });
          
          return stateData;
        } catch (stateError) {
          console.error('State fallback failed, using Denver as final fallback:', stateError);
          
          // Ultimate fallback - try Denver-specific endpoint
          const denverResponse = await fetch('/api/denver-laundromats');
          if (!denverResponse.ok) throw new Error('All fallbacks failed');
          
          const denverData = await denverResponse.json();
          console.log(`Using Denver fallback: ${denverData.length} laundromats`);
          
          // Reset map center to Denver
          setMapCenter({ lat: denverLat, lng: denverLng });
          
          return denverData;
        }
      }
    }
  });

  // Other data fetching
  const { 
    data: popularCities = [],
    error: popularCitiesError,
    isLoading: popularCitiesLoading 
  } = useQuery<City[]>({
    queryKey: ['/api/popular-cities'],
  });

  const { 
    data: laundryTips = [],
    error: laundryTipsError,
    isLoading: laundryTipsLoading 
  } = useQuery<LaundryTip[]>({
    queryKey: ['/api/laundry-tips'],
  });

  const { 
    data: affiliateProducts = [],
    error: affiliateProductsError,
    isLoading: affiliateProductsLoading 
  } = useQuery<AffiliateProduct[]>({
    queryKey: ['/api/affiliate-products'],
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: Filter) => {
    setFilters(newFilters);
  };

  // Generate SEO content
  const seoContent = generateHomePageContent();

  return (
    <div className="flex flex-col min-h-screen">
      <MetaTags
        title={seoContent.title}
        description={seoContent.description}
        keywords={seoContent.keywords}
        ogTitle={seoContent.ogTitle}
        ogDescription={seoContent.ogDescription}
      />

      <main className="flex-grow">
        {/* Hero Section with Search */}
        <HeroSection 
          title="Find Laundromats Near You"
          subtitle="Discover clean, convenient laundromats in your area"
          currentLocation={currentLocation}
        />

        {/* Nearby Laundromat Map Section */}
        {showMap && (
          <section className="container mx-auto py-6 px-4">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-primary">Laundromats Near {currentLocation}</h2>
              
              {laundromatsLoading ? (
                <div className="w-full h-96 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Loading map...</p>
                </div>
              ) : laundromatsError ? (
                <ApiErrorDisplay 
                  error={laundromatsError}
                  message="Unable to load nearby laundromats"
                  onRetry={() => refetchLaundromats()}
                />
              ) : (
                <>
                  <NearbyLaundromatsMap
                    laundromats={laundromats}
                    latitude={mapCenter.lat}
                    longitude={mapCenter.lng}
                    searchRadius={urlRadius || defaultRadius}
                    className="mb-4" 
                  />
                  
                  <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
                    <h3 className="text-lg font-medium mb-2">Map Legend</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                        <span className="text-sm">Your Location</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-sm">Excellent (4.5+)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-sm">Good (3.5-4.4)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span className="text-sm">Average (2.5-3.4)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-sm">Below Average</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Filter Options */}
        <section className="container mx-auto py-4 px-4">
          <FilterSection onFilterChange={handleFilterChange} />
        </section>

        {/* Nearby Results Grid */}
        <section className="container mx-auto py-6 px-4">
          <h2 className="text-2xl font-semibold text-primary mb-6">Laundromats Near {currentLocation}</h2>
          
          {laundromatsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="bg-gray-100 h-64 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : laundromatsError ? (
            <ApiErrorDisplay 
              error={laundromatsError}
              message="Unable to load nearby laundromats"
              onRetry={() => refetchLaundromats()}
            />
          ) : laundromats.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-lg text-gray-600">No laundromats found in your area.</p>
              <p className="text-gray-500 mt-2">Try expanding your search radius or searching for a different location.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {laundromats.slice(0, 6).map((laundromat, index) => (
                <LaundryCard key={laundromat.id} laundromat={laundromat} />
              ))}
            </div>
          )}
          
          {laundromats.length > 6 && (
            <div className="mt-8 text-center">
              <NearbySearch currentLocation={currentLocation} />
            </div>
          )}
        </section>

        {/* Ad Container */}
        <AdContainer className="container mx-auto my-12 px-4" />

        {/* Popular Cities */}
        <section className="container mx-auto py-6 px-4">
          <h2 className="text-2xl font-semibold text-primary mb-6">Popular Cities</h2>
          
          {popularCitiesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="bg-gray-100 h-24 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : popularCitiesError ? (
            <ApiErrorDisplay 
              error={popularCitiesError} 
              message="Unable to load popular cities"
            />
          ) : (
            <PopularCities cities={popularCities} />
          )}
        </section>

        {/* Laundry Tips Section */}
        <section className="container mx-auto py-8 px-4 bg-gray-50 rounded-lg my-8">
          <h2 className="text-2xl font-semibold text-primary mb-6">Laundry Tips & Resources</h2>
          
          {laundryTipsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="bg-white h-64 animate-pulse rounded-lg shadow-sm"></div>
              ))}
            </div>
          ) : laundryTipsError ? (
            <ApiErrorDisplay 
              error={laundryTipsError} 
              message="Unable to load laundry tips"
            />
          ) : (
            <LaundryTips tips={laundryTips} />
          )}
        </section>

        {/* Claim Listing CTA */}
        <section className="container mx-auto py-8 px-4 my-8">
          <ClaimListingForm />
        </section>

        {/* City Directory */}
        <section className="container mx-auto py-8 px-4 bg-gray-50 rounded-lg my-8">
          <h2 className="text-2xl font-semibold text-primary mb-6">Browse Laundromats by City</h2>
          <CityDirectory />
        </section>

        {/* Affiliate Products Section */}
        <section className="container mx-auto py-8 px-4 my-8">
          <h2 className="text-2xl font-semibold text-primary mb-6">Shop Laundry Products</h2>
          
          {affiliateProductsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="bg-gray-100 h-72 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : affiliateProductsError ? (
            <ApiErrorDisplay 
              error={affiliateProductsError} 
              message="Unable to load product recommendations"
            />
          ) : (
            <AffiliateProducts products={affiliateProducts} />
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;