import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

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
      // For ZIP codes, use Google Maps Geocoding API to get coordinates
      if (isZipCode) {
        console.log(`Searching for ZIP code: ${cleanQuery}`);
        
        // Force proper coordinate-based search for ALL ZIP codes
        // Get coordinates from Google Maps Geocoding API
        const zipGeocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          cleanQuery
        )},USA&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
        
        const zipResponse = await fetch(zipGeocodeURL);
        const zipData = await zipResponse.json();
        
        if (zipData.status === 'OK' && zipData.results && zipData.results.length > 0) {
          // Extract location and coordinates for the ZIP code
          const { lat, lng } = zipData.results[0].geometry.location;
          console.log(`Successfully geocoded ZIP: "${cleanQuery}" to: ${lat}, ${lng}`);
          
          // Create the search parameters for server-side search
          const params = new URLSearchParams({
            q: cleanQuery,
            lat: lat.toString(),
            lng: lng.toString()
          });
          
          // Pre-fetch laundromats for this location to ensure data is available
          try {
            // Simulate a pre-fetch request to prime the server cache
            console.log(`Pre-fetching laundromats for ZIP ${cleanQuery} at coords: ${lat}, ${lng}`);
            const prefetchUrl = `/api/laundromats/nearby?lat=${lat}&lng=${lng}&radius=25`;
            
            // Make the actual request
            const prefetchResponse = await fetch(prefetchUrl);
            const prefetchData = await prefetchResponse.json();
            console.log(`Pre-fetch returned ${prefetchData.length || 0} laundromats`);
            
            // Now complete the search with the pre-fetched data available
            console.log(`⚠️ ZIP SEARCH - Forcing page reload for accurate results`);
            
            // Redirect to the regular search page with the coordinates
            window.location.href = `/search?${params.toString()}`;
            return;
          } catch (prefetchError) {
            console.error('Pre-fetch error:', prefetchError);
            // Continue with normal search even if pre-fetch fails
            onSearch(cleanQuery, lat, lng);
          }
        } else {
          // If geocoding the ZIP fails, fall back to text search but notify user
          console.log(`Geocoding failed for ZIP ${cleanQuery}, using text search`);
          
          toast({
            title: 'Location issue',
            description: 'We couldn\'t find exact coordinates for that ZIP code. Showing best matches instead.',
          });
          
          onSearch(cleanQuery);
        }
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