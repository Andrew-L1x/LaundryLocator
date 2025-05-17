import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { State } from '../types/laundromat';
import ApiErrorDisplay from '../components/ApiErrorDisplay';
import Footer from '../components/Footer';
import Header from '../components/Header';
import MetaTags from '../components/MetaTags';
import SchemaMarkup from '../components/SchemaMarkup';

const AllStatesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: states, error, isLoading } = useQuery<State[]>({
    queryKey: ['/api/states'],
  });

  // Filter states based on search query and remove empty entries
  const filteredStates = states?.filter(state => 
    state.name && state.name.trim() !== '' && 
    state.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group states by first letter
  const groupedStates: Record<string, State[]> = {};
  
  filteredStates?.forEach(state => {
    const firstLetter = state.name.charAt(0).toUpperCase();
    if (!groupedStates[firstLetter]) {
      groupedStates[firstLetter] = [];
    }
    groupedStates[firstLetter].push(state);
  });

  // Get all unique first letters for alphabetical index
  const alphabet = Object.keys(groupedStates).sort();

  return (
    <div className="flex flex-col min-h-screen">
      <MetaTags
        pageType="all-states"
        title="Browse Laundromats by State | Find Laundromats Across the USA"
        description="Explore our comprehensive directory of laundromats across all 50 states. Find self-service laundry facilities, coin laundries, and laundry services near you."
        canonicalUrl="/states"
        imageUrl="https://images.unsplash.com/photo-1517677129300-07b130802f46?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=630"
      />
      
      <SchemaMarkup
        type="breadcrumb"
        data={[
          { name: "Home", url: "/" },
          { name: "Browse States", url: "/states" }
        ]}
      />

      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Browse Laundromats by State</h1>
            <p className="text-lg text-gray-600 mb-8">
              Find laundromats and self-service laundry facilities across the United States
            </p>
            
            {/* Search input */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search states..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <ApiErrorDisplay 
              error={error as Error} 
              message="There was an error loading states. Please try again later."
            />
          ) : (
            <div>
              {/* Alphabetical index */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {alphabet.map(letter => (
                  <a 
                    key={letter}
                    href={`#${letter}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium"
                  >
                    {letter}
                  </a>
                ))}
              </div>
              
              {/* States grid by letter */}
              <div className="space-y-8">
                {alphabet.map(letter => (
                  <div key={letter} id={letter} className="scroll-mt-24">
                    <h2 className="text-2xl font-bold px-4 py-2 bg-gray-100 rounded-lg mb-4">{letter}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {groupedStates[letter].map(state => (
                        <Link 
                          key={state.id} 
                          href={`/states/${state.slug}`}
                          className="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div>
                            <h3 className="font-medium text-lg">{state.name}</h3>
                            <p className="text-sm text-gray-500">{state.laundryCount} laundromats</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Regional Map */}
          <div className="mt-16 p-8 bg-blue-50 rounded-lg">
            <h2 className="text-2xl font-bold mb-6 text-center">Find Laundromats by Region</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AllStatesPage;