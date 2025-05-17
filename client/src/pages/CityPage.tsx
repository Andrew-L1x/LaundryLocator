import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import AdContainer from '@/components/AdContainer';
import LaundryCard from '@/components/LaundryCard';
import SchemaMarkup from '@/components/SchemaMarkup';
import MetaTags from '@/components/MetaTags';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import Footer from '@/components/Footer';
import { Laundromat, City, Filter } from '@/types/laundromat';
import { generateCityPageContent } from '@/lib/seo';
import FilterSection from '@/components/FilterSection';

const CityPage = () => {
  // Either get city from state/city route or just city route
  const params = useParams();
  const { city, state } = params;
  
  // Use state/city or just city parameter based on which route was matched
  const citySlug = state ? `${city}` : city;
  
  const [filters, setFilters] = useState<Filter>({});
  const [cityData, setCityData] = useState<City | null>(null);
  
  // Fetch city info
  const { 
    data: cityInfo, 
    isLoading: isCityLoading,
    error: cityError,
    refetch: refetchCity
  } = useQuery<City>({
    queryKey: [`/api/cities/${citySlug}`],
  });
  
  // Fetch laundromats in this city
  const { 
    data: laundromats = [], 
    isLoading: isLaundromatsLoading,
    error: laundromatsError,
    refetch: refetchLaundromats
  } = useQuery<Laundromat[]>({
    queryKey: [cityInfo ? `/api/cities/${cityInfo.id}/laundromats` : null, filters],
    enabled: !!cityInfo,
  });
  
  // Update cityData state when cityInfo is loaded
  useEffect(() => {
    if (cityInfo) {
      setCityData(cityInfo);
    }
  }, [cityInfo]);
  
  const handleFilterChange = (newFilters: Filter) => {
    setFilters(newFilters);
  };
  
  // Calculate loading state
  const isLoading = isCityLoading || isLaundromatsLoading;
  
  // Use placeholder data while fetching
  const cityName = cityData?.name || city?.split('-')[0] || '';
  const stateAbbr = cityData?.state || city?.split('-')[1] || '';
  const currentLocationDisplay = `${cityName}, ${stateAbbr}`;
  
  // Generate dynamic SEO content (always in the same place in hook order)
  const seoContent = useMemo(() => {
    if (cityData && Array.isArray(laundromats) && laundromats.length > 0) {
      return generateCityPageContent(cityData, laundromats);
    }
    return null;
  }, [cityData, laundromats]);
  
  // Loading state
  if (isLoading && !cityData) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  // Error state
  if (cityError) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-6 mb-4">
            <ApiErrorDisplay 
              error={cityError as Error}
              resetError={() => refetchCity()}
              message={`We couldn't load information for ${city}. Please try again.`}
            />
            <div className="mt-4 text-center">
              <Link href="/" className="bg-primary text-white px-6 py-2 rounded-lg font-medium inline-block">
                Back to Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  // Not found state  
  if (!cityData && !isCityLoading) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-8 text-center">
            <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
            <h1 className="text-2xl font-semibold mb-2">City Not Found</h1>
            <p className="text-gray-600 mb-4">The city you're looking for doesn't exist in our database.</p>
            <Link href="/" className="bg-primary text-white px-6 py-2 rounded-lg font-medium">
              Back to Home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      {/* SEO Schema Markup */}
      {seoContent && seoContent.schema ? (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoContent.schema) }}
        />
      ) : (
        laundromats.length > 0 && (
          <SchemaMarkup 
            type="list" 
            data={laundromats}
            location={currentLocationDisplay} 
          />
        )
      )}
      
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="city"
        title={seoContent?.title || `Laundromats in ${cityName}, ${stateAbbr} | 24/7 Coin & Self-Service Laundry`}
        description={seoContent?.description || `Find the best laundromats in ${cityName}, ${stateAbbr}. Browse ${cityData?.laundryCount || '20+'}+ coin-operated, 24-hour, and self-service laundry locations with ratings and reviews.`}
        location={currentLocationDisplay}
        service="Laundromats"
        canonicalUrl={`/${city}`}
      />
      
      <Header />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <div className="mb-4 text-sm">
          <Link href="/" className="text-primary hover:underline">Home</Link>
          <span className="mx-2 text-gray-500">/</span>
          <Link href={`/${stateAbbr.toLowerCase()}`} className="text-primary hover:underline">
            {stateAbbr}
          </Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-700">{cityName}</span>
        </div>
        
        {/* SEO-optimized header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{seoContent?.h1 || `Laundromats in ${cityName}, ${stateAbbr}`}</h1>
          <div className="text-gray-600" 
            dangerouslySetInnerHTML={{ 
              __html: seoContent?.intro || 
              `<p>Find the best laundromats in ${cityName} with our comprehensive directory. Browse ${cityData?.laundryCount || '20+'} 
              coin-operated, 24-hour, and self-service laundry locations.</p>`
            }} 
          />
        </div>
        
        {/* Filter Section */}
        <FilterSection 
          onFilterChange={handleFilterChange} 
          currentLocation={currentLocationDisplay} 
        />
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/4">
            {/* Laundromat Listings */}
            <section>
              <h2 className="text-2xl font-bold mb-4">
                {isLaundromatsLoading ? 'Loading Laundromats...' : `${laundromats.length} Laundromats in ${cityName}`}
              </h2>
              
              {isLaundromatsLoading && !laundromats.length ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : laundromatsError ? (
                <div className="bg-white rounded-lg p-6 mb-4">
                  <ApiErrorDisplay 
                    error={laundromatsError as Error}
                    resetError={() => refetchLaundromats()}
                    message={`We couldn't load laundromats in ${cityName}. Please try again or adjust your filters.`}
                  />
                </div>
              ) : laundromats.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <i className="fas fa-search text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-xl font-semibold mb-2">No Laundromats Found</h3>
                  <p className="text-gray-600">We couldn't find any laundromats in {cityName} matching your filters.</p>
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
            
            {/* City Information */}
            <section className="mt-12 bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-2xl font-bold mb-4">About Laundromats in {cityName}, {stateAbbr}</h2>
              <div className="prose max-w-none">
                {seoContent && (
                  <>
                    {seoContent.neighborhoodSection && (
                      <div dangerouslySetInnerHTML={{ __html: seoContent.neighborhoodSection }} />
                    )}
                    
                    {seoContent.servicesSection && (
                      <div dangerouslySetInnerHTML={{ __html: seoContent.servicesSection }} />
                    )}
                    
                    {seoContent.ratingSection && (
                      <div dangerouslySetInnerHTML={{ __html: seoContent.ratingSection }} />
                    )}
                    
                    {seoContent.hoursSection && (
                      <div dangerouslySetInnerHTML={{ __html: seoContent.hoursSection }} />
                    )}
                  </>
                )}
                
                {!seoContent && (
                  <>
                    <p>
                      Looking for laundromats in {cityName}, {stateAbbr}? Our directory features the most comprehensive 
                      list of laundry facilities in the area. Whether you need a 24-hour laundromat, coin-operated 
                      machines, or full-service options with wash-and-fold, we've got you covered.
                    </p>
                    <p>
                      {cityName} offers a variety of laundromat options for residents and visitors. Many locations 
                      provide amenities like free WiFi, comfortable waiting areas, and modern, efficient machines. 
                      Use our search filters to find exactly what you need, whether it's card payment options, 
                      24-hour access, or specific services.
                    </p>
                    <h3 className="text-xl font-semibold mt-6 mb-3">Popular Laundromat Features in {cityName}</h3>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>24-hour access for busy schedules</li>
                      <li>High-capacity machines for large loads</li>
                      <li>Card payment options for cashless convenience</li>
                      <li>Free WiFi while you wait</li>
                      <li>Drop-off and pick-up services</li>
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>
          
          <div className="w-full lg:w-1/4">
            {/* Sticky sidebar ad */}
            <div className="hidden lg:block">
              <AdContainer format="vertical" className="sticky top-24" />
            </div>
            
            {/* Nearby Cities */}
            <div className="bg-white border rounded-lg p-4 mt-6">
              <h3 className="text-lg font-semibold mb-3">Nearby Cities</h3>
              <ul className="space-y-2">
                {/* This would be dynamic in a real app, using nearby cities data */}
                <li>
                  <Link 
                    href={`/laundromats/${stateAbbr === 'CA' ? 'oakland-ca' : 'nearby-city-1'}`} 
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                  >
                    <span>{stateAbbr === 'CA' ? 'Oakland' : 'Nearby City 1'}, {stateAbbr}</span>
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </Link>
                </li>
                <li>
                  <Link 
                    href={`/laundromats/${stateAbbr === 'CA' ? 'berkeley-ca' : 'nearby-city-2'}`} 
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                  >
                    <span>{stateAbbr === 'CA' ? 'Berkeley' : 'Nearby City 2'}, {stateAbbr}</span>
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </Link>
                </li>
                <li>
                  <Link 
                    href={`/laundromats/${stateAbbr === 'CA' ? 'daly-city-ca' : 'nearby-city-3'}`} 
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                  >
                    <span>{stateAbbr === 'CA' ? 'Daly City' : 'Nearby City 3'}, {stateAbbr}</span>
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </Link>
                </li>
              </ul>
              <Link href={`/${stateAbbr.toLowerCase()}`} className="text-primary font-medium text-sm block mt-3 hover:underline">
                All {stateAbbr} Cities →
              </Link>
            </div>
            
            {/* Laundromat Owner CTA */}
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm mt-6">
              <h3 className="text-lg font-semibold">Own a Laundromat in {cityName}?</h3>
              <p className="text-sm mb-3">Claim your listing to update information and respond to reviews.</p>
              <Link 
                href="/claim-listing" 
                className="bg-primary text-white font-medium p-2 rounded hover:bg-primary/90 block text-center"
              >
                Claim Your Listing
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default CityPage;
