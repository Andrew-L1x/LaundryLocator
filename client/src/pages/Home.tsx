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
import UniversalLaundromatsMap from '@/components/UniversalLaundromatsMap';
import { Laundromat, City, Filter, LaundryTip, AffiliateProduct } from '@/types/laundromat';
import { getCurrentPosition, reverseGeocode } from '@/lib/geolocation';
import { getLastLocation, saveLastLocation } from '@/lib/storage';
import { generateHomePageContent } from '@/lib/seo';
import { stateCoordinates } from '@/lib/stateCoordinates';


const Home = () => {
  const [currentLocation, setCurrentLocation] = useState<string>(getLastLocation() || 'Denver, CO');
  // Parse URL parameters for location-based search
  const searchParams = new URLSearchParams(window.location.search);
  const urlLatitude = searchParams.get('lat');
  const urlLongitude = searchParams.get('lng');
  const urlRadius = searchParams.get('radius') || '25';
  const searchMode = searchParams.get('mode');
  
  // Check if we're in "nearby" mode (from "Use my current location")
  const isNearbySearch = searchMode === 'nearby' && urlLatitude && urlLongitude;
  
  // Map location state (always show map on home page)
  const [showMap, setShowMap] = useState<boolean>(true);
  const [filters, setFilters] = useState<Filter>({});
  const [lastLocation, setLastLocation] = useState<string>(() => {
    return localStorage.getItem('laundry_location') || 'Denver, CO';
  });
  
  // Location state
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  // Default Denver coordinates
  const denverLat = 39.7392;
  const denverLng = -104.9903;
  const defaultRadius = '25';
  
  // Fetch featured laundromats - excluding premium ones
  const featuredData = useQuery<Laundromat[]>({
    queryKey: ['/api/featured-laundromats'],
  });
  
  const featuredLaundromats = featuredData.data || [];
  const featuredError = featuredData.error;
  const refetchFeatured = featuredData.refetch;
  
  // State for tracking user's state code (e.g., "CO" for Colorado)
  const [userState, setUserState] = useState<string>("CO");
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number}>({ lat: denverLat, lng: denverLng });
  
  // Get user location on component mount
  useEffect(() => {
    // If URL params are provided, use them directly
    if (urlLatitude && urlLongitude) {
      const lat = parseFloat(urlLatitude);
      const lng = parseFloat(urlLongitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        setUserLocation({ lat, lng });
        setMapCenter({ lat, lng });
        setLocationStatus('success');
      } else {
        // Fallback to Denver if invalid coordinates
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
  }, [urlLatitude, urlLongitude]);
  
  // Query to get laundromats with smart state-based fallback
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
      
      // First try coordinate-based search (works for ANY location)
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
          // Try state-based fallback (get laundromats for entire state)
          const stateParams = new URLSearchParams();
          stateParams.append('state', stateCode || 'CO');
          
          console.log(`Fetching laundromats for state: ${stateCode || 'CO'}`);
          const stateResponse = await fetch(`/api/laundromats?${stateParams.toString()}`);
          
          if (!stateResponse.ok) throw new Error('Failed to fetch state laundromats');
          
          const stateData = await stateResponse.json();
          console.log(`Found ${stateData.length} laundromats in state ${stateCode || 'CO'}`);
          
          // Update map center to state capital if we're using the state fallback
          import('@/lib/stateCoordinates').then(module => {
            const stateCenterInfo = module.stateCoordinates[stateCode] || module.stateCoordinates['CO'];
            console.log(`Setting map center to ${stateCenterInfo.name} (${stateCenterInfo.lat}, ${stateCenterInfo.lng})`);
            setMapCenter({ lat: stateCenterInfo.lat, lng: stateCenterInfo.lng });
          });
          
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
  
  // For direct API compatibility with existing components
  const nearbyResults = laundromats;
  const nearbyError = laundromatsError;
  
  // This effect has been replaced with the new location handling implementation
  const nearbyLoading = laundromatsLoading;
  
  // Fetch popular cities
  const { 
    data: popularCities = [],
    error: citiesError,
    refetch: refetchCities
  } = useQuery<City[]>({
    queryKey: ['/api/popular-cities?limit=5'],
  });
  
  // Set up location detection with improved handling for any city
  useEffect(() => {
    // Detect if we need to get location - only if not already in a nearby search mode
    const needsLocationDetection = !isNearbySearch;
    
    // Get last location from state variable which is already initialized
    // from localStorage in the state declaration above
    
    const initializeLocation = async () => {
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            // Success handler
            (position) => {
              const { latitude, longitude } = position.coords;
              console.log("Got user's actual location:", latitude, longitude);
              
              // Update URL params
              const url = new URL(window.location.href);
              url.searchParams.set('lat', latitude.toString());
              url.searchParams.set('lng', longitude.toString());
              url.searchParams.set('radius', searchRadius);
              url.searchParams.set('mode', 'nearby');
              
              // Try to get location name
              reverseGeocode(latitude, longitude)
                .then((locationInfo) => {
                  const formattedLocation = locationInfo?.formattedAddress || "Your Current Location";
                  setCurrentLocation(formattedLocation);
                  saveLastLocation(formattedLocation);
                  
                  // Force a reload to ensure we get fresh data for this exact location
                  window.location.href = url.toString();
                })
                .catch((error) => {
                  console.error("Geocoding error:", error);
                  setCurrentLocation("Your Current Location");
                  
                  // Still reload with proper coordinates
                  window.location.href = url.toString();
                });
            },
            
            // Error handler - fall back to a location, but generically
            (error) => {
              console.error("Geolocation error:", error);
              
              // Use previously saved location or default to Denver
              const fallbackLocation = lastLocation;
              setCurrentLocation(fallbackLocation);
              saveLastLocation(fallbackLocation);
              
              // Use default coordinates for Denver
              const url = new URL(window.location.href);
              url.searchParams.set('lat', '39.7392');
              url.searchParams.set('lng', '-104.9903');
              url.searchParams.set('radius', searchRadius);
              url.searchParams.set('mode', 'nearby');
              window.location.href = url.toString();
            },
            { 
              timeout: 10000, 
              maximumAge: 30000, // Shorter cache time
              enableHighAccuracy: true 
            }
          );
        } else {
          // No geolocation support
          console.warn("Geolocation not supported");
          const fallbackLocation = lastLocation;
          setCurrentLocation(fallbackLocation);
          saveLastLocation(fallbackLocation);
          
          // Fall back to default location
          const url = new URL(window.location.href);
          url.searchParams.set('lat', '39.7392');
          url.searchParams.set('lng', '-104.9903');
          url.searchParams.set('radius', searchRadius);
          url.searchParams.set('mode', 'nearby');
          window.location.href = url.toString();
        }
      } catch (error) {
        console.error("Location detection error:", error);
        // Generic fallback
        const fallbackLocation = lastLocation;
        setCurrentLocation(fallbackLocation);
        saveLastLocation(fallbackLocation);
        
        const url = new URL(window.location.href);
        url.searchParams.set('lat', '39.7392');
        url.searchParams.set('lng', '-104.9903');
        url.searchParams.set('radius', searchRadius);
        url.searchParams.set('mode', 'nearby');
        window.location.href = url.toString();
      }
    };
    
    // Only initialize location if needed
    if (needsLocationDetection) {
      initializeLocation();
    }
  }, [isNearbySearch, currentLocation, searchRadius]);
  
  // Sample laundry tips
  const laundryTips: LaundryTip[] = [
    {
      id: 1,
      title: 'Guide to Coin Laundry Services',
      description: 'Learn how to get the most out of your coin laundry experience. Tips for efficiency and cost savings.',
      content: 'Full guide content here',
      category: 'guides',
      slug: 'coin-laundry-guide',
      url: '/tips/coin-laundry-guide'
    },
    {
      id: 2,
      title: 'Self-Service vs. Drop-Off: Which is Right for You?',
      description: 'Compare the pros and cons of self-service laundry and drop-off services to find what works for your needs.',
      content: 'Full comparison content here',
      category: 'guides',
      slug: 'self-service-vs-drop-off',
      url: '/tips/self-service-vs-drop-off'
    },
    {
      id: 3,
      title: 'Laundromat Price Comparison Guide',
      description: 'See how prices vary across different laundromats and find the best value for your budget.',
      content: 'Full price comparison content here',
      category: 'guides',
      slug: 'price-comparison',
      url: '/tips/price-comparison'
    },
    {
      id: 4,
      title: 'Stain Removal Tips for Common Stains',
      description: 'Expert advice on removing tough stains before your next laundromat visit.',
      content: 'Full stain removal guide content here',
      category: 'tips',
      slug: 'stain-removal',
      url: '/tips/stain-removal'
    }
  ];
  
  // Sample affiliate products
  const affiliateProducts: AffiliateProduct[] = [
    {
      id: 1,
      name: 'EcoFresh Detergent',
      rating: 5,
      reviewCount: 187,
      imageUrl: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100',
      url: 'https://amazon.com'
    },
    {
      id: 2,
      name: 'Delicates Mesh Bags (5pc)',
      rating: 4,
      reviewCount: 94,
      imageUrl: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100',
      url: 'https://amazon.com'
    },
    {
      id: 3,
      name: 'Collapsible Laundry Tote',
      rating: 5,
      reviewCount: 136,
      imageUrl: 'https://pixabay.com/get/gbe987a566fa5da67d6ed7c18dc25423d5ab68b70737b429e213f592daa0537eb926a14dd0191d7286fd7b60c0a983ac7db4e6989a026848eb86764f10bbc5e9a_1280.jpg',
      url: 'https://amazon.com'
    }
  ];
  
  // Sample state directory data
  const stateDirectory = {
    'CA': {
      name: 'California',
      cities: [
        { name: 'San Francisco', slug: 'san-francisco-ca', count: 124 },
        { name: 'Los Angeles', slug: 'los-angeles-ca', count: 203 },
        { name: 'San Diego', slug: 'san-diego-ca', count: 134 },
        { name: 'Oakland', slug: 'oakland-ca', count: 87 },
        { name: 'San Jose', slug: 'san-jose-ca', count: 103 }
      ]
    },
    'NY': {
      name: 'New York',
      cities: [
        { name: 'New York City', slug: 'new-york-ny', count: 312 },
        { name: 'Brooklyn', slug: 'brooklyn-ny', count: 187 },
        { name: 'Queens', slug: 'queens-ny', count: 156 },
        { name: 'Buffalo', slug: 'buffalo-ny', count: 64 },
        { name: 'Rochester', slug: 'rochester-ny', count: 53 }
      ]
    },
    'TX': {
      name: 'Texas',
      cities: [
        { name: 'Houston', slug: 'houston-tx', count: 176 },
        { name: 'Dallas', slug: 'dallas-tx', count: 145 },
        { name: 'Austin', slug: 'austin-tx', count: 98 },
        { name: 'San Antonio', slug: 'san-antonio-tx', count: 112 },
        { name: 'Fort Worth', slug: 'fort-worth-tx', count: 87 }
      ]
    }
  };
  
  const handleFilterChange = (newFilters: Filter) => {
    setFilters(newFilters);
  };
  
  // Generate dynamic SEO content based on all fetched data
  const seoContent = useMemo(() => {
    if (laundromats.length > 0) {
      return generateHomePageContent(laundromats, popularCities, laundryTips);
    }
    return null;
  }, [laundromats, popularCities, laundryTips]);

  return (
    <div className="bg-gray-50 text-gray-800">
      {/* SEO Schema Markup */}
      {seoContent && seoContent.schema && (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoContent.schema) }}
        />
      )}
      
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="home"
        title={seoContent?.title || "Find Laundromats Near Me | Laundromat Directory"}
        description={seoContent?.description || "Find clean, affordable laundromats near you. Compare prices, hours, services, and reviews to find the perfect place for laundry day."}
        canonicalUrl="/"
      />
      
      {/* Hero Section with Search */}
      <HeroSection />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      {/* Featured listings section removed */}
      
      <main className="container mx-auto px-4 py-6">
        {/* Filter Section */}
        <FilterSection 
          onFilterChange={handleFilterChange} 
          currentLocation={currentLocation} 
        />
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/4">
            {/* Featured Laundromats */}
            {/* Featured Laundromats section removed */}
            
            {/* Map view - always display */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">
                Laundromats Map
                <span className="block text-sm font-normal text-gray-600 mt-1">
                  {isNearbySearch ? `Showing results within ${searchRadius} miles of your location` : 'Popular laundromats in your area'}
                </span>
              </h2>
              
              {/* Map display for laundromats */}
              <div className="mb-6">
                {isNearbySearch && latitude && longitude ? (
                  // Show map with nearby search results if available
                  nearbyLoading ? (
                    <div className="bg-gray-100 rounded-lg animate-pulse h-64 mb-6">
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Loading map...</p>
                      </div>
                    </div>
                  ) : nearbyError ? (
                    <div className="bg-white rounded-lg p-6 mb-4">
                      <ApiErrorDisplay 
                        error={nearbyError as Error}
                        message="We couldn't load the map. Please try again."
                      />
                    </div>
                  ) : nearbyResults.length > 0 ? (
                    <>
                      <NearbyLaundromatsMap
                        laundromats={nearbyResults}
                        latitude={parseFloat(latitude)}
                        longitude={parseFloat(longitude)}
                        searchRadius={searchRadius}
                        className="mb-4"
                      />
                      <p className="text-sm text-gray-600 mb-4">
                        Found {nearbyResults.length} laundromats within {searchRadius} miles of your location.
                      </p>
                    </>
                  ) : (
                    <div className="bg-white rounded-lg p-8 text-center mb-6">
                      <i className="fas fa-map-marker-alt text-4xl text-gray-300 mb-4"></i>
                      <h3 className="text-xl font-semibold mb-2">No Laundromats Found Nearby</h3>
                      <p className="text-gray-600">We couldn't find any laundromats near your location. Try increasing your search radius.</p>
                    </div>
                  )
                ) : (
                  // Default map using the user's location or Denver as fallback
                  <div className="relative">
                    {/* Map area */}
                    <NearbyLaundromatsMap
                      laundromats={laundromats} 
                      // Use user's location or default
                      latitude={parseFloat(defaultLat)}
                      longitude={parseFloat(defaultLng)}
                      searchRadius={defaultRadius}
                      className="mb-4"
                    />
                    
                    {/* Legend below the map */}
                    <div className="bg-white shadow-sm rounded-lg p-3 mb-4">
                      <h4 className="font-semibold text-sm mb-2">Map Pin Legend</h4>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        <div className="flex items-center">
                          <img src="https://maps.google.com/mapfiles/ms/icons/orange-dot.png" alt="Orange location" className="w-4 h-4 mr-2" />
                          <span className="text-xs">Your Location</span>
                        </div>
                        <div className="flex items-center">
                          <img src="https://maps.google.com/mapfiles/ms/icons/green-dot.png" alt="Green pin" className="w-4 h-4 mr-2" />
                          <span className="text-xs">Top Rated (4.5+)</span>
                        </div>
                        <div className="flex items-center">
                          <img src="https://maps.google.com/mapfiles/ms/icons/blue-dot.png" alt="Blue pin" className="w-4 h-4 mr-2" />
                          <span className="text-xs">Well Rated (3.5-4.4)</span>
                        </div>
                        <div className="flex items-center">
                          <img src="https://maps.google.com/mapfiles/ms/icons/yellow-dot.png" alt="Yellow pin" className="w-4 h-4 mr-2" />
                          <span className="text-xs">Average (2.5-3.4)</span>
                        </div>
                        <div className="flex items-center">
                          <img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Red pin" className="w-4 h-4 mr-2" />
                          <span className="text-xs">Below Average (0-2.4)</span>
                        </div>
                        <div className="flex items-center">
                          <img src="https://maps.google.com/mapfiles/ms/icons/grey-dot.png" alt="Gray pin" className="w-4 h-4 mr-2" />
                          <span className="text-xs">No Rating</span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">
                      Showing {laundromats.length} laundromats within {defaultRadius} miles
                      {!isNearbySearch && <span> of Denver, CO. <button 
                        onClick={() => {
                          // Request user location on map click
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const { latitude, longitude } = position.coords;
                                window.location.href = `/?lat=${latitude}&lng=${longitude}&radius=${defaultRadius}&mode=nearby`;
                              },
                              (error) => {
                                console.error("Geolocation error:", error);
                                // Show toast error
                              }
                            );
                          }
                        }}
                        className="text-primary hover:underline">
                        See laundromats near me
                      </button></span>}
                    </p>
                  </div>
                )}
              </div>
            </section>
            
            {/* Laundromats Near You */}
            <section>
              <h2 className="text-2xl font-bold mb-4">
                {isNearbySearch ? 'Nearby Laundromat Listings' : 'Laundromats Near You'}
                {currentLocation && currentLocation !== 'Current Location' && !isNearbySearch && (
                  <span className="block text-sm font-normal text-gray-600 mt-1">{currentLocation}</span>
                )}
              </h2>
              <div id="laundromat-listings">
                {/* Display nearby laundromats if available */}
                {isNearbySearch && nearbyResults.length > 0 ? (
                  <>
                    {/* Nearby laundromat listings */}
                    {nearbyResults.map((laundromat, index) => (
                      <div key={`nearby-${laundromat.id}`}>
                        <LaundryCard laundromat={laundromat} />
                        
                        {/* Insert ad after every 2 listings */}
                        {index % 2 === 1 && index < nearbyResults.length - 1 && (
                          <AdContainer 
                            format="native" 
                            className="my-4 rounded-lg border border-gray-200 p-4" 
                          />
                        )}
                      </div>
                    ))}
                    
                    <div className="flex justify-center my-8">
                      <button className="bg-primary text-white font-medium px-6 py-3 rounded-lg hover:bg-primary/90 shadow-sm">
                        Load More Laundromats
                      </button>
                    </div>
                  </>
                ) : laundromatsError ? (
                  <div className="bg-white rounded-lg p-6 mb-4">
                    <ApiErrorDisplay 
                      error={laundromatsError as Error}
                      resetError={() => refetchLaundromats()}
                      message="We couldn't load laundromats in your area. Please try again or adjust your filters."
                    />
                  </div>
                ) : laundromats.length === 0 ? (
                  <div className="bg-white rounded-lg p-8 text-center">
                    <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
                    <h3 className="text-xl font-semibold mb-2">No Laundromats Found</h3>
                    <p className="text-gray-600">Try adjusting your filters or search in a different location.</p>
                  </div>
                ) : (
                  <>
                    {/* Fallback to general laundromat listings if no nearby ones */}
                    {laundromats.map((laundromat, index) => (
                      <div key={`listing-${laundromat.id}`}>
                        <LaundryCard laundromat={laundromat} />
                        
                        {/* Insert ad after every 2 listings */}
                        {index % 2 === 1 && index < laundromats.length - 1 && (
                          <AdContainer 
                            format="native" 
                            className="my-4 rounded-lg border border-gray-200 p-4" 
                          />
                        )}
                      </div>
                    ))}
                    
                    <div className="flex justify-center my-8">
                      <button className="bg-primary text-white font-medium px-6 py-3 rounded-lg hover:bg-primary/90 shadow-sm">
                        Load More Laundromats
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
            
            {/* Laundry Tips */}
            <LaundryTips tips={laundryTips} />
          </div>
          
          <div className="w-full lg:w-1/4 space-y-6">
            {/* Sticky sidebar ad */}
            <div className="hidden lg:block">
              <AdContainer format="vertical" className="sticky top-24" />
            </div>
            
            {/* Nearby Search */}
            <NearbySearch />
            
            {/* Claim Listing Form */}
            <ClaimListingForm />
            
            {/* Popular Cities */}
            <PopularCities 
              cities={popularCities} 
              error={citiesError as Error | null}
              onRetry={() => refetchCities()}
            />
            
            {/* Affiliate Products */}
            <AffiliateProducts products={affiliateProducts} />
          </div>
        </div>
      </main>
      
      {/* City Directory */}
      <CityDirectory stateDirectory={stateDirectory} />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Home;
