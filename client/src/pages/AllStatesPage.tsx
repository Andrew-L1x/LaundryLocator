import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AdContainer from '@/components/AdContainer';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import MetaTags from '@/components/MetaTags';
import { State } from '@/types/laundromat';

const AllStatesPage = () => {
  // Fetch all states
  const { 
    data: states = [],
    isLoading,
    error,
    refetch
  } = useQuery<State[]>({
    queryKey: ['/api/states'],
  });

  // Group states by region
  const regions = {
    'Northeast': ['CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
    'Midwest': ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'],
    'South': ['AL', 'AR', 'DC', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
    'West': ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY']
  };

  // Map states to regions
  const statesByRegion = Object.entries(regions).reduce((acc, [region, abbreviations]) => {
    acc[region] = states.filter(state => abbreviations.includes(state.abbr));
    return acc;
  }, {} as Record<string, State[]>);

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="home"
        title="Laundromats Across the United States | Find Locations by State"
        description="Browse our comprehensive directory of laundromats across all 50 states. Find coin-operated, self-service, and 24-hour laundry facilities near you."
        canonicalUrl="/states"
      />
      
      <Header />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <div className="mb-4 text-sm">
          <Link href="/" className="text-primary hover:underline">Home</Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-700">All States</span>
        </div>
        
        {/* SEO-optimized header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Laundromats by State</h1>
          <p className="text-gray-600">
            Find laundromats across the United States. Browse our comprehensive directory 
            organized by state to locate self-service, coin-operated, and 24-hour laundry 
            facilities near you.
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg p-6 mb-4">
            <ApiErrorDisplay 
              error={error as Error}
              resetError={() => refetch()}
              message="We couldn't load the state directory. Please try again."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {Object.entries(statesByRegion).map(([region, regionStates]) => (
              <section key={region} className="bg-white rounded-lg p-6 shadow-sm">
                <h2 className="text-2xl font-bold mb-4">{region}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {regionStates.map(state => (
                    <Link 
                      key={state.id}
                      href={`/${state.slug}`}
                      className="flex flex-col items-center p-3 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="text-4xl mb-2">{state.abbr}</div>
                      <h3 className="text-center font-medium">{state.name}</h3>
                      <span className="text-xs text-gray-500 mt-1">{state.laundryCount} laundromats</span>
                    </Link>
                  ))}
                  {regionStates.length === 0 && (
                    <p className="col-span-full text-gray-500 text-center py-4">
                      No states available for this region
                    </p>
                  )}
                </div>
              </section>
            ))}
            
            {states.length === 0 && !isLoading && !error && (
              <div className="bg-white rounded-lg p-8 text-center">
                <i className="fas fa-map-marked-alt text-4xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-semibold mb-2">No States Available</h3>
                <p className="text-gray-600">Our state directory is currently being updated. Please check back later.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Map visualization section */}
        <section className="mt-12 mb-8">
          <h2 className="text-2xl font-bold mb-4">United States Laundromat Map</h2>
          <div className="bg-white rounded-lg p-6 border">
            <p className="text-gray-600 mb-6">
              Use our interactive map to explore laundromat coverage across the United States. 
              Darker regions indicate a higher concentration of laundry facilities.
            </p>
            
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              {/* This would be a map visualization component */}
              <p className="text-gray-500">Interactive map loading...</p>
            </div>
            
            <div className="mt-4 text-center">
              <Link 
                href="/laundromat-density-map" 
                className="text-primary font-medium hover:underline"
              >
                View Full Interactive Map
              </Link>
            </div>
          </div>
        </section>
        
        {/* Popular searches */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Popular Searches</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {['24-hour laundromats', 'Coin laundry near me', 'Self-service laundry', 
              'Laundromats with Wi-Fi', 'Card-operated laundromats', 'Eco-friendly laundromats'
            ].map(term => (
              <Link 
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <i className="fas fa-search text-primary mr-2"></i>
                <span>{term}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default AllStatesPage;