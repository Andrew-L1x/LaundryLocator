import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import AdContainer from '@/components/AdContainer';
import SchemaMarkup from '@/components/SchemaMarkup';
import MetaTags from '@/components/MetaTags';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import Footer from '@/components/Footer';
import { State, City, Laundromat } from '@/types/laundromat';
import { generateStatePageContent } from '@/lib/seo';

const StatePage = () => {
  const { state: stateSlug } = useParams();
  const [stateData, setStateData] = useState<State | null>(null);
  
  // Fetch state info
  const { 
    data: stateInfo, 
    isLoading: isStateLoading,
    error: stateError,
    refetch: refetchState
  } = useQuery<State>({
    queryKey: [`/api/states/${stateSlug}`],
  });
  
  useEffect(() => {
    if (stateInfo) {
      setStateData(stateInfo);
    }
  }, [stateInfo]);
  
  // Fetch cities in this state
  const { 
    data: cities = [], 
    isLoading: isCitiesLoading,
    error: citiesError,
    refetch: refetchCities
  } = useQuery<City[]>({
    queryKey: [stateData ? `/api/states/${stateData.abbr}/cities` : null],
    enabled: !!stateData,
  });
  
  // Fetch laundromats in this state for SEO content generation
  const {
    data: laundromats = [],
    isLoading: isLaundromatsLoading
  } = useQuery<Laundromat[]>({
    queryKey: [stateData ? `/api/laundromats?state=${stateData.abbr}` : null],
    enabled: !!stateData,
  });
  
  // Generate dynamic SEO content
  const seoContent = useMemo(() => {
    if (stateData && cities.length > 0) {
      return generateStatePageContent(stateData, cities, laundromats);
    }
    return null;
  }, [stateData, cities, laundromats]);
  
  const isLoading = isStateLoading || isCitiesLoading || isLaundromatsLoading;
  
  if (isLoading && !stateData) {
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
  
  if (stateError) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-6 mb-4">
            <ApiErrorDisplay 
              error={stateError as Error}
              resetError={() => refetchState()}
              message={`We couldn't load information for ${stateSlug}. Please try again.`}
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
  
  if (!stateData && !isStateLoading) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-8 text-center">
            <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
            <h1 className="text-2xl font-semibold mb-2">State Not Found</h1>
            <p className="text-gray-600 mb-4">The state you're looking for doesn't exist in our database.</p>
            <Link href="/" className="bg-primary text-white px-6 py-2 rounded-lg font-medium">
              Back to Home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  // Get the state name for display (either from data or from URL)
  const stateName = stateData?.name || stateSlug?.charAt(0).toUpperCase() + stateSlug?.slice(1) || '';
  const stateAbbr = stateData?.abbr || '';
  
  // Group cities alphabetically
  const groupedCities: { [key: string]: City[] } = {};
  
  cities.forEach(city => {
    const firstLetter = city.name.charAt(0).toUpperCase();
    if (!groupedCities[firstLetter]) {
      groupedCities[firstLetter] = [];
    }
    groupedCities[firstLetter].push(city);
  });
  
  const alphabeticalKeys = Object.keys(groupedCities).sort();
  
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      {/* SEO Schema Markup - Breadcrumbs */}
      {seoContent && seoContent.schema ? (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoContent.schema) }}
        />
      ) : !isLoading && stateData && (
        <SchemaMarkup 
          type="breadcrumb" 
          data={[
            { name: 'Home', url: '/' },
            { name: stateData.name, url: `/${stateSlug}` }
          ]} 
        />
      )}
      
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="state"
        title={seoContent?.title || `Laundromats in ${stateName} | 24/7 Coin & Self-Service Laundry Directory`}
        description={seoContent?.description || `Find ${stateData?.laundryCount || '100+'}+ laundromats in ${stateName}. Browse our directory of coin-operated, 24-hour, and self-service laundry locations by city.`}
        location={stateName}
        service="Laundromats"
        canonicalUrl={`/${stateSlug}`}
      />
      
      <Header />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <div className="mb-4 text-sm">
          <Link href="/" className="text-primary hover:underline">Home</Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-700">{stateName}</span>
        </div>
        
        {/* SEO-optimized header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{seoContent?.h1 || `Laundromats in ${stateName}`}</h1>
          <div className="text-gray-600" dangerouslySetInnerHTML={{ 
            __html: seoContent?.intro || `
              <p>Find the best laundromats in ${stateName} with our comprehensive directory. 
              Browse ${stateData?.laundryCount || '100+'} coin-operated, 24-hour, and self-service 
              laundry locations across ${cities.length} cities.</p>
            `}} 
          />
        </div>
        
        {/* Featured Cities */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Popular Cities in {stateName}</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {isCitiesLoading ? (
              Array(8).fill(0).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border p-4 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-2 w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                </div>
              ))
            ) : citiesError ? (
              <div className="col-span-full">
                <div className="bg-white rounded-lg p-6 border">
                  <ApiErrorDisplay 
                    error={citiesError as Error}
                    resetError={() => refetchCities()}
                    message={`We couldn't load cities in ${stateName}. Please try again.`}
                  />
                </div>
              </div>
            ) : cities.length === 0 ? (
              <div className="col-span-full bg-white rounded-lg p-8 text-center border">
                <p className="text-gray-600">No cities found for this state. Please try another state.</p>
              </div>
            ) : (
              cities
                .sort((a, b) => b.laundryCount - a.laundryCount)
                .slice(0, 8)
                .map(city => (
                  <Link 
                    key={city.id}
                    href={`/cities/${city.slug}`}
                    className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-primary">{city.name}</h3>
                    <p className="text-gray-500 text-sm">{city.laundryCount} laundromats</p>
                  </Link>
                ))
            )}
          </div>
        </section>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/4">
            {/* All Cities */}
            <section className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold mb-6">All Cities with Laundromats in {stateName}</h2>
              
              {isCitiesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : cities.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <i className="fas fa-map-marker-alt text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-xl font-semibold mb-2">No Cities Found</h3>
                  <p className="text-gray-600">We couldn't find any cities with laundromats in {stateName}.</p>
                </div>
              ) : (
                <div>
                  {/* Alphabet navigation */}
                  <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
                    {alphabeticalKeys.map(letter => (
                      <a 
                        key={letter}
                        href={`#section-${letter}`}
                        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-primary hover:text-white rounded-full font-medium text-sm"
                      >
                        {letter}
                      </a>
                    ))}
                  </div>
                  
                  {/* City listings by letter */}
                  <div className="space-y-6">
                    {alphabeticalKeys.map(letter => (
                      <div key={letter} id={`section-${letter}`}>
                        <h3 className="text-xl font-semibold mb-3 border-b pb-2">{letter}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {groupedCities[letter].map(city => (
                            <Link 
                              key={city.id}
                              href={`/cities/${city.slug}`}
                              className="p-2 hover:bg-gray-50 rounded flex justify-between items-center"
                            >
                              <span>{city.name}</span>
                              <span className="text-gray-500 text-sm">{city.laundryCount}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
            
            {/* State Information */}
            <section className="mt-12 bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-2xl font-bold mb-4">About Laundromats in {stateName}</h2>
              <div className="prose max-w-none">
                {seoContent?.citiesSection && (
                  <div dangerouslySetInnerHTML={{ __html: seoContent.citiesSection }} />
                )}
                
                {seoContent?.servicesSection && (
                  <div dangerouslySetInnerHTML={{ __html: seoContent.servicesSection }} />
                )}
                
                {seoContent?.ratingSection && (
                  <div dangerouslySetInnerHTML={{ __html: seoContent.ratingSection }} />
                )}
                
                {/* Fallback content if no dynamic content is available */}
                {!seoContent && (
                  <>
                    <p>
                      Looking for laundromats in {stateName}? Our directory features the most comprehensive 
                      list of laundry facilities throughout the state. Whether you need a 24-hour laundromat, 
                      coin-operated machines, or full-service options with wash-and-fold, we've got you covered.
                    </p>
                    <p>
                      {stateName} offers a variety of laundromat options for residents and visitors across its many cities 
                      and towns. Many locations provide amenities like free WiFi, comfortable waiting areas, 
                      and modern, efficient machines. Use our search filters to find exactly what you need, 
                      whether it's card payment options, 24-hour access, or specific services.
                    </p>
                    <h3 className="text-xl font-semibold mt-6 mb-3">Popular Laundromat Features in {stateName}</h3>
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
            
            {/* Neighboring States */}
            <div className="bg-white border rounded-lg p-4 mt-6">
              <h3 className="text-lg font-semibold mb-3">Neighboring States</h3>
              <ul className="space-y-2">
                {/* This would be dynamic in a real app, using actual neighboring states */}
                {stateAbbr === 'CA' ? (
                  <>
                    <li>
                      <Link 
                        href="/nevada" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Nevada</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/oregon" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Oregon</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/arizona" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Arizona</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                  </>
                ) : stateAbbr === 'NY' ? (
                  <>
                    <li>
                      <Link 
                        href="/new-jersey" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>New Jersey</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/connecticut" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Connecticut</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/pennsylvania" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Pennsylvania</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link 
                        href="/neighboring-state-1" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Neighboring State 1</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/neighboring-state-2" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Neighboring State 2</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/neighboring-state-3" 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <span>Neighboring State 3</span>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </Link>
                    </li>
                  </>
                )}
              </ul>
              <Link href="/states" className="text-primary font-medium text-sm block mt-3 hover:underline">
                View All States →
              </Link>
            </div>
            
            {/* Laundromat Owner CTA */}
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm mt-6">
              <h3 className="text-lg font-semibold">Own a Laundromat in {stateName}?</h3>
              <p className="text-sm mb-3">Claim your listing to update information and respond to reviews.</p>
              <Link 
                href="/claim-listing" 
                className="bg-primary text-white font-medium p-2 rounded hover:bg-primary/90 block text-center"
              >
                Claim Your Listing
              </Link>
            </div>
            
            {/* Native in-feed ad */}
            <AdContainer 
              format="native" 
              className="mt-6 rounded-lg border border-gray-200 p-4" 
            />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default StatePage;
