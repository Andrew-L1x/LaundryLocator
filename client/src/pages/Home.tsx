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
import PremiumListingCard from '@/components/PremiumListingCard';
import PremiumListings from '@/components/PremiumListings';
import FeaturedListingsCarousel from '@/components/FeaturedListingsCarousel';
import NearbySearch from '@/components/NearbySearch';
import { Laundromat, City, Filter, LaundryTip, AffiliateProduct } from '@/types/laundromat';
import { getCurrentPosition, reverseGeocode } from '@/lib/geolocation';
import { getLastLocation, saveLastLocation } from '@/lib/storage';
import { generateHomePageContent } from '@/lib/seo';

const Home = () => {
  const [currentLocation, setCurrentLocation] = useState<string>(getLastLocation() || 'Current Location');
  const [filters, setFilters] = useState<Filter>({});
  
  // Fetch featured laundromats
  const featuredData = useQuery<Laundromat[]>({
    queryKey: ['/api/featured-laundromats'],
  });
  
  const featuredLaundromats = featuredData.data || [];
  const featuredError = featuredData.error;
  const refetchFeatured = featuredData.refetch;
  
  // Fetch laundromats with filters
  const { 
    data: laundromats = [],
    error: laundromatsError,
    refetch: refetchLaundromats
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/laundromats', filters],
    queryFn: async ({ queryKey }) => {
      const [, filterParams] = queryKey;
      const params = new URLSearchParams();
      
      if (filterParams.openNow) params.append('openNow', 'true');
      if (filterParams.services?.length) params.append('services', filterParams.services.join(','));
      if (filterParams.rating) params.append('rating', filterParams.rating.toString());
      
      const response = await fetch(`/api/laundromats?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch laundromats');
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
  
  // Attempt to get user's location
  useEffect(() => {
    const tryGeolocation = async () => {
      try {
        // Clear any existing location data 
        import('@/lib/storage').then(({ clearLastLocation }) => {
          clearLastLocation();
        });
        
        // Try to get the user's actual location
        const position = await getCurrentPosition();
        
        if (position) {
          try {
            // Use the Google Maps API to reverse geocode the coordinates
            const locationData = await reverseGeocode(position.lat, position.lng);
            
            // For demonstration purposes, we'll display the user's actual location
            // but still show the Killeen, TX listings in our database
            setCurrentLocation(locationData.formattedAddress);
            saveLastLocation(locationData.formattedAddress);
            
            console.log(`User location detected: ${locationData.formattedAddress} (${locationData.state || 'Unknown state'})`);
            
            return; // Exit if we successfully got the location
          } catch (geocodeError) {
            console.error('Reverse geocoding error:', geocodeError);
          }
        }
        
        // Fallback to Killeen, TX data
        setCurrentLocation('Killeen, TX');
        saveLastLocation('Killeen, TX');
      } catch (error) {
        console.error('Geolocation error:', error);
        // On error, set to Killeen, TX
        setCurrentLocation('Killeen, TX');
        saveLastLocation('Killeen, TX');
      }
    };
    
    tryGeolocation();
  }, []);
  
  // Sample laundry tips
  const laundryTips: LaundryTip[] = [
    {
      id: 1,
      title: 'Guide to Coin Laundry Services',
      description: 'Learn how to get the most out of your coin laundry experience. Tips for efficiency and cost savings.',
      url: '/tips/coin-laundry-guide'
    },
    {
      id: 2,
      title: 'Self-Service vs. Drop-Off: Which is Right for You?',
      description: 'Compare the pros and cons of self-service laundry and drop-off services to find what works for your needs.',
      url: '/tips/self-service-vs-drop-off'
    },
    {
      id: 3,
      title: 'Laundromat Price Comparison Guide',
      description: 'See how prices vary across different laundromats and find the best value for your budget.',
      url: '/tips/price-comparison'
    },
    {
      id: 4,
      title: 'Stain Removal Tips for Common Stains',
      description: 'Expert advice on removing tough stains before your next laundromat visit.',
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
      
      {/* Featured Listings Carousel */}
      {!featuredError && featuredLaundromats.length > 0 && (
        <FeaturedListingsCarousel 
          laundromats={featuredLaundromats}
          title="Premium Laundromats"
          subtitle="Discover top-rated laundry services with enhanced amenities and special offers" 
        />
      )}
      
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
            
            {/* Premium Laundromats */}
            <section className="mb-8">
              <PremiumListings />
            </section>
            
            {/* All Laundromats */}
            <section>
              <h2 className="text-2xl font-bold mb-4">All Laundromats Near You</h2>
              <div id="laundromat-listings">
                {laundromatsError ? (
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
                    {/* Laundromat listings */}
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
