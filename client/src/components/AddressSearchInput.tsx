import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { isZipCode, hasFallbackDataForZip } from '@/lib/zipFallbackData';

interface AddressSearchInputProps {
  searchRadius?: string;
}

declare global {
  interface Window {
    google: any;
    initAutocomplete: () => void;
  }
}

const AddressSearchInput: React.FC<AddressSearchInputProps> = ({ searchRadius = '25' }) => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [_, setLocation] = useLocation();
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Initialize Google Maps Autocomplete
    const loadGoogleMapsScript = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        initAutocomplete();
        return;
      }
      
      // If not loaded, set up the script
      window.initAutocomplete = initAutocomplete;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initAutocomplete`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      return () => {
        window.initAutocomplete = null;
        document.head.removeChild(script);
      };
    };
    
    loadGoogleMapsScript();
  }, []);
  
  const initAutocomplete = () => {
    if (!inputRef.current) return;
    
    // Create the autocomplete object
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'geometry', 'formatted_address']
    });
    
    // Set up the event listener for place changed
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry) return;
      
      // Extract the ZIP code if available
      let zipCode = '';
      for (const component of place.address_components) {
        if (component.types.includes('postal_code')) {
          zipCode = component.short_name;
          break;
        }
      }
      
      // Use either the full address or just the ZIP code if available
      setAddress(zipCode || place.formatted_address);
    });
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    
    setIsLoading(true);
    
    try {
      // If it's a ZIP code (5 digits), use the fallback system
      if (isZipCode(address.trim())) {
        const zip = address.trim();
        // If we have fallback data for this ZIP code, automatically use it
        const hasZipFallback = hasFallbackDataForZip(zip);
        
        if (hasZipFallback) {
          console.log(`Using fallback data for ZIP ${zip}`);
          setLocation(`/search?q=${encodeURIComponent(zip)}&useZipFallback=true&radius=${searchRadius}`);
        } else {
          // For ZIP codes without fallback data, search normally
          setLocation(`/search?q=${encodeURIComponent(zip)}&radius=${searchRadius}`);
        }
      } else {
        // For non-ZIP searches, get geocoding from Google Maps first
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ address: address.trim() }, (results: any, status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results[0]);
            } else {
              reject(new Error(`Geocoding failed: ${status}`));
            }
          });
        });
        
        // Extract location data from result
        const location = (result as any).geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        // Search with coordinates for more accurate results
        setLocation(`/search?q=${encodeURIComponent(address.trim())}&lat=${lat}&lng=${lng}&radius=${searchRadius}`);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      // Fallback to text search if geocoding fails
      setLocation(`/search?q=${encodeURIComponent(address.trim())}&radius=${searchRadius}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
          <Input
            ref={inputRef}
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter ZIP code, city, or full address"
            className="flex-grow text-gray-900 bg-white pr-10"
            aria-label="Search by address"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader size="sm" />
            </div>
          )}
        </div>
        <Button type="submit" className="whitespace-nowrap" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>
    </form>
  );
};

export default AddressSearchInput;