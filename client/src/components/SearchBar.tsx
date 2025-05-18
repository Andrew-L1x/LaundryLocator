import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SearchBarProps {
  onSearch: (query: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  defaultValue?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search laundromats...',
  defaultValue = '',
}) => {
  const [query, setQuery] = useState(defaultValue);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Update query if defaultValue changes
  useEffect(() => {
    if (defaultValue) {
      setQuery(defaultValue);
    }
  }, [defaultValue]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast({
        title: 'Search query is empty',
        description: 'Please enter a location, ZIP code, or address',
        variant: 'destructive'
      });
      return;
    }
    
    setIsSearching(true);
    const cleanQuery = query.trim();
    
    // Check if query is a ZIP code (5 digits)
    const isZipCode = /^\d{5}$/.test(cleanQuery);
    
    try {
      // For ZIP codes, we'll handle them directly
      if (isZipCode) {
        // For ZIP codes, just pass the query directly to onSearch
        // We'll handle displaying data on the server side
        console.log(`Searching for ZIP code: ${cleanQuery}`);
        onSearch(cleanQuery);
      } else {
        // For non-ZIP searches, try to geocode to get coordinates
        const geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          cleanQuery
        )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
        
        const response = await fetch(geocodeURL);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          // Extract location and coordinates
          const { lat, lng } = data.results[0].geometry.location;
          console.log(`Successfully geocoded "${cleanQuery}" to coordinates: ${lat}, ${lng}`);
          
          // Pass both the search query and coordinates
          onSearch(cleanQuery, lat, lng);
        } else {
          // If geocoding fails, fall back to text search
          console.log(`Could not geocode "${cleanQuery}" - using text search only`);
          onSearch(cleanQuery);
          
          if (data.status !== 'OK') {
            console.warn(`Geocoding API returned: ${data.status}`);
            toast({
              title: 'Location search issue',
              description: 'We couldn\'t pinpoint that exact location. Showing best matches instead.',
              variant: 'destructive'
            });
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fall back to text search if anything goes wrong
      onSearch(cleanQuery);
      
      toast({
        title: 'Search issue',
        description: 'We encountered a problem with your search. Showing best matches instead.',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative flex w-full max-w-full">
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pr-20"
      />
      <Button 
        type="submit" 
        size="sm"
        disabled={isSearching}
        className="absolute right-1 top-1/2 -translate-y-1/2"
      >
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            <span>Search</span>
          </>
        )}
      </Button>
    </form>
  );
};

export default SearchBar;