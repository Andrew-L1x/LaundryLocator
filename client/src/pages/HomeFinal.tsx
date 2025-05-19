import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
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

  // URL parameters for manual location search
  const searchParams = new URLSearchParams(window.location.search);
  const urlLat = searchParams.get('lat');
  const urlLng = searchParams.get('lng');
  const urlRadius = searchParams.get('radius') || '25';
  const searchMode = searchParams.get('mode');

  // User interface states - map removed to eliminate API costs
  const [filters, setFilters] = useState<Filter>({});
  
  // Default Denver coordinates (fallback)
  const denverLat = 39.7392;
  const denverLng = -104.9903;
  const defaultRadius = '25';

  // Fetch featured laundromats
  const featuredData = useQuery<Laundromat[]>({
    queryKey: ['/api/featured-laundromats'],
  });
  
  const featuredLaundromats = featuredData.data || [];
  const featuredError = featuredData.error;

  // Get user location on component mount
  useEffect(() => {
    // If URL params are provided, use them directly
    if (urlLat && urlLng) {
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`Using URL coordinates: ${lat}, ${lng}`);
        setUserLocation({ lat, lng });
        // Map center removed
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

  // Popular cities data
  const { 
    data: popularCities = [],
    error: popularCitiesError,
    isLoading: popularCitiesLoading 
  } = useQuery<City[]>({
    queryKey: ['/api/popular-cities'],
  });

  // Laundry tips data
  const { 
    data: laundryTips = [],
    error: laundryTipsError,
    isLoading: laundryTipsLoading 
  } = useQuery<LaundryTip[]>({
    queryKey: ['/api/laundry-tips'],
  });

  // Affiliate products data
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

  // SEO content
  const seoContent = {
    title: "Find Your Nearest Laundromat | LaundryLocator",
    description: "Discover laundromats near you with LaundryLocator. Find ratings, hours, amenities, and directions to the best laundry services in your area.",
    h1: "Find Laundromats Near You",
    intro: "Looking for a convenient laundromat near you? LaundryLocator helps you find the best laundry services in your area with detailed information on facilities, amenities, and customer reviews.",
    featuredServicesSection: "Popular Laundromat Services",
    topCitiesSection: "Popular Cities",
    tipsSection: "Laundry Tips & Resources",
    schema: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://laundrylocator.com/",
      "name": "LaundryLocator - Find Laundromats Near You",
      "description": "Find local laundromats with ratings, reviews, and directions. Search for coin-operated, 24-hour, and full-service laundries near you.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://laundrylocator.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <MetaTags title={seoContent.title} description={seoContent.description} />

      <main className="flex-grow">
        {/* Hero Section with Search */}
        <HeroSection />
        
        {/* Horizontal Ad Banner */}
        <div className="container mx-auto py-3 px-4">
          <AdContainer format="horizontal" className="mx-auto max-w-4xl" slotId="3584589216" />
        </div>

        {/* Redesigned Layout - Map and Search in Two Columns */}
        <section className="container mx-auto py-6 px-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column - Map Section */}
            <div className="w-full md:w-8/12">
              <h2 className="text-2xl font-semibold text-primary mb-4">
                Laundromats Near {currentLocation}
              </h2>
              
              {laundromatsLoading ? (
                <div className="w-full bg-gray-100 animate-pulse rounded-lg p-6 flex items-center justify-center">
                  <p className="text-gray-500">Loading laundromats...</p>
                </div>
              ) : laundromatsError ? (
                <ApiErrorDisplay 
                  error={laundromatsError}
                  message="Unable to load nearby laundromats"
                />
              ) : (
                <div className="bg-blue-50 p-6 rounded-lg mb-6 border border-blue-100">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-primary mr-3">
                      <span role="img" aria-label="location" className="text-lg">📍</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-lg text-gray-800">Searching in {currentLocation}</h3>
                      <p className="text-sm text-gray-600">Found {laundromats.length} laundromats within {urlRadius || defaultRadius} miles</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(filters).filter(([k, v]) => v).map(([key]) => (
                      <span key={key} className="bg-white px-3 py-1 rounded-full text-xs font-medium text-gray-700 border border-gray-200">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    ))}
                  </div>
                  
                  <Link 
                    href={`/search?q=${currentLocation}&lat=${userLocation?.lat || denverLat}&lng=${userLocation?.lng || denverLng}&radius=${urlRadius || defaultRadius}`} 
                    className="text-primary hover:underline text-sm flex items-center"
                  >
                    View all results <span className="ml-1">→</span>
                  </Link>
                </div>
              )}
              
              {/* Laundromat Grid below map */}
              <h3 className="text-xl font-semibold text-primary mb-4">Featured Laundromats</h3>
              
              {laundromatsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="bg-gray-100 h-40 animate-pulse rounded-lg"></div>
                  ))}
                </div>
              ) : laundromatsError ? (
                <ApiErrorDisplay 
                  error={laundromatsError}
                  message="Unable to load nearby laundromats"
                />
              ) : laundromats.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-600">No laundromats found in your area.</p>
                  <p className="text-gray-500 text-sm mt-1">Try expanding your search radius or searching for a different location.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {laundromats.slice(0, 4).map((laundromat) => (
                    <LaundryCard key={laundromat.id} laundromat={laundromat} />
                  ))}
                </div>
              )}
              
              {laundromats.length > 4 && (
                <div className="mt-4 text-center">
                  <Link 
                    href={`/search?q=${currentLocation}&lat=${userLocation?.lat || denverLat}&lng=${userLocation?.lng || denverLng}&radius=${urlRadius || defaultRadius}`} 
                    className="text-primary hover:underline"
                  >
                    See all nearby laundromats →
                  </Link>
                </div>
              )}
              
              {/* Laundry Tips - Moved here to match width of map & laundromats */}
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-primary mb-4">Laundry Tips & Resources</h3>
                {laundryTipsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(2)].map((_, index) => (
                      <div key={index} className="bg-white h-40 animate-pulse rounded-lg shadow-sm"></div>
                    ))}
                  </div>
                ) : laundryTipsError ? (
                  <ApiErrorDisplay 
                    error={laundryTipsError} 
                    message="Unable to load laundry tips"
                  />
                ) : (
                  <LaundryTips tips={laundryTips.slice(0, 2)} />
                )}
              </div>
            </div>
            
            {/* Right Column - Claim Listing, Ad, and Popular Cities */}
            <div className="w-full md:w-4/12">
              {/* Claim Listing Form - Moved to sidebar */}
              <div className="mb-6">
                <ClaimListingForm />
              </div>
              
              {/* Ad Container */}
              <div className="mb-6">
                <AdContainer className="w-full" format="vertical" />
              </div>
              
              {/* Popular Cities - Moved from bottom section */}
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">Popular Cities</h3>
                <div className="grid grid-cols-1 gap-2">
                  {popularCitiesLoading ? (
                    <div className="animate-pulse space-y-2">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-10 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                  ) : (
                    popularCities.slice(0, 8).map((city) => (
                      <Link 
                        key={city.id}
                        href={`/cities/${city.slug}`}
                        className="flex items-center p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <h4 className="font-medium text-sm">{city.name}, {city.state}</h4>
                          <p className="text-xs text-gray-500">{city.laundryCount} laundromats</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <div className="mt-3 text-center">
                  <Link href="/states" className="text-primary hover:underline text-sm">
                    See all states →
                  </Link>
                </div>
              </div>
              
              {/* Popular Searches */}
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-primary mb-3">Popular Searches</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/search?q=24-hour+laundromat" className="text-gray-700 hover:text-primary">
                      24-Hour Laundromats
                    </Link>
                  </li>
                  <li>
                    <Link href="/search?q=coin+operated+laundromat" className="text-gray-700 hover:text-primary">
                      Coin-Operated Laundromats
                    </Link>
                  </li>
                  <li>
                    <Link href="/search?q=laundromat+with+wifi" className="text-gray-700 hover:text-primary">
                      Laundromats with WiFi
                    </Link>
                  </li>
                  <li>
                    <Link href="/search?q=card+payment+laundromat" className="text-gray-700 hover:text-primary">
                      Card Payment Laundromats
                    </Link>
                  </li>
                  <li>
                    <Link href="/search?q=laundromat+with+wash+and+fold" className="text-gray-700 hover:text-primary">
                      Wash & Fold Services
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Cities section removed - now displayed in the right sidebar */}

        {/* Laundry Tips Section removed from here - now placed under the laundromats */}

        {/* Claim Listing CTA removed - now in sidebar */}

        {/* Browse by Region - Using the same widget as the AllStatesPage */}
        <section className="container mx-auto py-6 px-4 bg-blue-50 rounded-lg my-6">
          <h2 className="text-xl font-semibold text-primary mb-4 text-center">Find Laundromats by Region</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2">Northeast</h3>
              <ul className="space-y-1 text-gray-600">
                <li><Link href="/states/new-york" className="hover:text-blue-600">New York</Link></li>
                <li><Link href="/states/massachusetts" className="hover:text-blue-600">Massachusetts</Link></li>
                <li><Link href="/states/pennsylvania" className="hover:text-blue-600">Pennsylvania</Link></li>
                <li><Link href="/states/new-jersey" className="hover:text-blue-600">New Jersey</Link></li>
                <li><Link href="/states/connecticut" className="hover:text-blue-600">Connecticut</Link></li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2">Midwest</h3>
              <ul className="space-y-1 text-gray-600">
                <li><Link href="/states/illinois" className="hover:text-blue-600">Illinois</Link></li>
                <li><Link href="/states/michigan" className="hover:text-blue-600">Michigan</Link></li>
                <li><Link href="/states/ohio" className="hover:text-blue-600">Ohio</Link></li>
                <li><Link href="/states/wisconsin" className="hover:text-blue-600">Wisconsin</Link></li>
                <li><Link href="/states/indiana" className="hover:text-blue-600">Indiana</Link></li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2">South</h3>
              <ul className="space-y-1 text-gray-600">
                <li><Link href="/states/florida" className="hover:text-blue-600">Florida</Link></li>
                <li><Link href="/states/texas" className="hover:text-blue-600">Texas</Link></li>
                <li><Link href="/states/georgia" className="hover:text-blue-600">Georgia</Link></li>
                <li><Link href="/states/north-carolina" className="hover:text-blue-600">North Carolina</Link></li>
                <li><Link href="/states/virginia" className="hover:text-blue-600">Virginia</Link></li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2">West</h3>
              <ul className="space-y-1 text-gray-600">
                <li><Link href="/states/california" className="hover:text-blue-600">California</Link></li>
                <li><Link href="/states/washington" className="hover:text-blue-600">Washington</Link></li>
                <li><Link href="/states/colorado" className="hover:text-blue-600">Colorado</Link></li>
                <li><Link href="/states/arizona" className="hover:text-blue-600">Arizona</Link></li>
                <li><Link href="/states/oregon" className="hover:text-blue-600">Oregon</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="text-center mt-4">
            <Link href="/states" className="text-primary hover:underline">
              View All States →
            </Link>
          </div>
        </section>

        {/* Affiliate Products Section with Manual Placeholders */}
        <section className="container mx-auto py-8 px-4 my-8">
          <h2 className="text-2xl font-semibold text-primary mb-6">Shop Laundry Products</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Product 1 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-blue-100 flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60" 
                  alt="High Efficiency Laundry Detergent" 
                  className="h-40 object-contain"
                />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-lg">High Efficiency Detergent</h3>
                <p className="text-gray-600 text-sm mb-2">Eco-friendly, concentrated formula for front-load washers</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">$18.99</span>
                  <a href="#" className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark">View Details</a>
                </div>
              </div>
            </div>
            
            {/* Product 2 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-green-100 flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1551761429-8232f9f5955c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60" 
                  alt="Mesh Laundry Bags Set" 
                  className="h-40 object-contain"
                />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-lg">Mesh Laundry Bags Set</h3>
                <p className="text-gray-600 text-sm mb-2">5-pack delicates protection bags, various sizes</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">$12.99</span>
                  <a href="#" className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark">View Details</a>
                </div>
              </div>
            </div>
            
            {/* Product 3 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-purple-100 flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60" 
                  alt="Stain Remover Spray" 
                  className="h-40 object-contain"
                />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-lg">Stain Remover Spray</h3>
                <p className="text-gray-600 text-sm mb-2">Professional-grade formula for tough food and oil stains</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">$8.95</span>
                  <a href="#" className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark">View Details</a>
                </div>
              </div>
            </div>
            
            {/* Product 4 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-yellow-100 flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1615397349754-cfa2066a298e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60" 
                  alt="Wool Dryer Balls" 
                  className="h-40 object-contain"
                />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-lg">Wool Dryer Balls</h3>
                <p className="text-gray-600 text-sm mb-2">Natural fabric softener alternative, set of 6 XL balls</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">$15.99</span>
                  <a href="#" className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-primary-dark">View Details</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;