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
    
    try {
      // Special handling for ZIP codes
      const zipCodePattern = /^\d{5}$/;
      const isZipCode = zipCodePattern.test(query.trim());
      
      // Use the geocoding API to convert the search to coordinates
      const geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        isZipCode ? `${query.trim()} USA` : query
      )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
      
      const response = await fetch(geocodeURL);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        // If it's a ZIP code, log for debugging
        if (isZipCode) {
          console.log(`Converting ZIP code ${query} to coordinates: ${lat},${lng}`);
        }
        onSearch(query, lat, lng);
      } else {
        // If geocoding fails, just search by text
        onSearch(query);
        
        if (data.status !== 'OK') {
          console.error('Geocoding error:', data.status);
          toast({
            title: 'Location not found',
            description: 'We couldn\'t find that location. Try a different ZIP code or city name.',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fall back to text search if geocoding fails
      onSearch(query);
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