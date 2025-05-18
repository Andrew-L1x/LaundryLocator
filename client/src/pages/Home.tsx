import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import FilterSection from '@/components/FilterSection';
import AdContainer from '@/components/AdContainer';
import FeatureLaundryCard from '@/components/FeatureLaundryCard';
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
// Premium listings have been removed
import FeaturedListingsCarousel from '@/components/FeaturedListingsCarousel';
import NearbySearch from '@/components/NearbySearch';
import NearbyLaundromatsMap from '@/components/NearbyLaundromatsMap';
import { Laundromat, City, Filter, LaundryTip, AffiliateProduct } from '@/types/laundromat';
import { getCurrentPosition, reverseGeocode } from '@/lib/geolocation';
import { getLastLocation, saveLastLocation } from '@/lib/storage';
import { generateHomePageContent } from '@/lib/seo';

const Home = () => {
  const [currentLocation, setCurrentLocation] = useState<string>(getLastLocation() || 'Current Location');
  // Parse URL parameters for location-based search
  const searchParams = new URLSearchParams(window.location.search);
  const latitude = searchParams.get('lat');
  const longitude = searchParams.get('lng');
  const searchRadius = searchParams.get('radius') || '25';
  const searchMode = searchParams.get('mode');
  
  // Check if we're in "nearby" mode (from "Use my current location")
  const isNearbySearch = searchMode === 'nearby' && latitude && longitude;
  
  // State for location display
  const [showMap, setShowMap] = useState<boolean>(Boolean(isNearbySearch));
  const [filters, setFilters] = useState<Filter>({});
  
  // Fetch featured laundromats - excluding premium ones
  const featuredData = useQuery<Laundromat[]>({
    queryKey: ['/api/featured-laundromats'],
  });
  
  const featuredLaundromats = featuredData.data || [];
  const featuredError = featuredData.error;
  const refetchFeatured = featuredData.refetch;
  
  // Get user location from URL or default to Denver
  const defaultLat = latitude || '39.7392';
  const defaultLng = longitude || '-104.9903';
  const defaultRadius = searchRadius || '25';
  
  // Fetch laundromats based on location parameters
  const { 
    data: laundromats = [],
    error: laundromatsError,
    refetch: refetchLaundromats
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/laundromats/nearby', defaultLat, defaultLng, defaultRadius, filters],
    queryFn: async ({ queryKey }) => {
      const [, lat, lng, radius, filterParams] = queryKey as [string, string, string, string, any];
      const params = new URLSearchParams();
      
      params.append('lat', lat);
      params.append('lng', lng);
      params.append('radius', radius);
      
      if (filterParams?.openNow) params.append('openNow', 'true');
      if (filterParams?.services?.length) params.append('services', filterParams.services.join(','));
      if (filterParams?.rating) params.append('rating', filterParams.rating.toString());
      
      const response = await fetch(`/api/laundromats/nearby?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch laundromats');
      return response.json();
    }
  });
  
  // Fetch nearby laundromats when we have coordinates
  const { 
    data: nearbyResults = [],
    error: nearbyError,
    isLoading: nearbyLoading
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/laundromats/nearby', latitude, longitude, searchRadius],
    enabled: Boolean(isNearbySearch && latitude && longitude),
    queryFn: async () => {
      const response = await fetch(`/api/laundromats/nearby?lat=${latitude}&lng=${longitude}&radius=${searchRadius}`);
      if (!response.ok) throw new Error('Failed to fetch nearby laundromats');
      return response.json();
    }
  });
  
  // Fetch popular cities
  const { 
    data: popularCities = [],
    error: citiesError,
    refetch: refetchCities
  } = useQuery<City[]>({
    queryKey: ['/api/popular-cities?limit=5'],
  });
  
  // Set up default location if user doesn't share location
  useEffect(() => {
    // Only run if we're not already in nearby search mode (from URL params)
    if (!isNearbySearch) {
      const initializeLocation = async () => {
        // Use the last known location or default to Denver, CO
        const detectedLocation = currentLocation !== 'Current Location' ? 
          currentLocation : 'Denver, CO';
        setCurrentLocation(detectedLocation);
        saveLastLocation(detectedLocation);
      };
      
      initializeLocation();
    }
  }, [isNearbySearch, currentLocation]);
  
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
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <i className="fas fa-award text-yellow-500 mr-2"></i>
                Featured Laundromats
              </h2>
              {featuredError ? (
                <div className="bg-white rounded-lg p-6 mb-4">
                  <ApiErrorDisplay 
                    error={featuredError as Error}
                    resetError={() => refetchFeatured()}
                    message="We couldn't load the featured laundromats. Please try again."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featuredLaundromats.map(laundromat => (
                    <FeatureLaundryCard key={laundromat.id} laundromat={laundromat} />
                  ))}
                </div>
              )}
            </section>
            
            {/* Premium Laundromats section removed */}
            
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
                  // Default map showing all available laundromats
                  <>
                    <NearbyLaundromatsMap
                      laundromats={laundromats} 
                      // Default to Denver, CO as center
                      latitude={39.7392}
                      longitude={-104.9903}
                      searchRadius={"25"}
                      className="mb-4"
                    />
                    <p className="text-sm text-gray-600 mb-4">
                      Showing {laundromats.length} laundromats within 25 miles
                    </p>
                  </>
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
