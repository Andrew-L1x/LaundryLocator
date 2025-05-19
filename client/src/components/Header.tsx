import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { getCurrentPosition } from '@/lib/geolocation';
import { isZipCode, hasFallbackDataForZip } from '@/lib/zipFallbackData';

declare global {
  interface Window {
    google: any;
    initHeaderAutocomplete: () => void;
  }
}

const Header = () => {
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        initAutocomplete();
        return;
      }
      
      // If not loaded, set up the script
      window.initHeaderAutocomplete = initAutocomplete;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initHeaderAutocomplete`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      return () => {
        window.initHeaderAutocomplete = null;
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
      setLocation(zipCode || place.formatted_address);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const searchQuery = location.trim();
    if (!searchQuery) {
      toast({
        title: "Location Required",
        description: "Please enter a location or use your current location.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSearching(true);
    
    try {
      // If it's a ZIP code (5 digits), use the fallback system
      if (isZipCode(searchQuery)) {
        const zip = searchQuery;
        // If we have fallback data for this ZIP code, use it
        const hasZipFallback = hasFallbackDataForZip(zip);
        
        if (hasZipFallback) {
          console.log(`Using fallback data for ZIP ${zip}`);
          navigate(`/search?q=${encodeURIComponent(zip)}&useZipFallback=true&radius=25`);
        } else {
          // For ZIP codes without fallback data, search normally
          // Get coordinates for ZIP codes
          const geocoder = new window.google.maps.Geocoder();
          try {
            const result = await new Promise((resolve, reject) => {
              geocoder.geocode({ address: zip }, (results: any, status: string) => {
                if (status === 'OK' && results && results.length > 0) {
                  resolve(results[0]);
                } else {
                  reject(new Error(`Geocoding failed: ${status}`));
                }
              });
            });
            
            // Extract location data
            const location = (result as any).geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            
            navigate(`/search?q=${zip}&lat=${lat}&lng=${lng}&radius=25`);
          } catch (geocodeError) {
            console.error("ZIP geocoding error:", geocodeError);
            navigate(`/search?q=${encodeURIComponent(zip)}&radius=25`);
          }
        }
      } else {
        // For non-ZIP searches, get geocoding from Google Maps first
        try {
          const geocoder = new window.google.maps.Geocoder();
          const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: searchQuery }, (results: any, status: string) => {
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
          navigate(`/search?q=${encodeURIComponent(searchQuery)}&lat=${lat}&lng=${lng}&radius=25`);
        } catch (error) {
          console.error("Geocoding error:", error);
          // Fallback to text search if geocoding fails
          navigate(`/search?q=${encodeURIComponent(searchQuery)}&radius=25`);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fall back to text search if anything goes wrong
      navigate(`/search?q=${encodeURIComponent(searchQuery)}&radius=25`);
    } finally {
      setIsSearching(false);
    }
  };

  const useMyLocation = async () => {
    try {
      const position = await getCurrentPosition();
      if (position && position.coords) {
        const { latitude, longitude } = position.coords;
        
        // Navigate to search results with coordinates
        navigate(`/search?lat=${latitude}&lng=${longitude}`);
      }
    } catch (error) {
      toast({
        title: "Location Error",
        description: "Unable to get your location. Please enter your ZIP code.",
        variant: "destructive"
      });
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-primary">
              <Link href="/" className="flex items-center">
                <i className="fas fa-washer text-primary mr-2"></i>
                Laundromat Near Me
              </Link>
            </h1>
          </div>
          
          {/* Main Search Bar */}
          <div className="w-full md:w-auto flex-1 md:max-w-xl">
            <div className="relative">
              <form id="search-form" className="flex" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  type="text"
                  id="location-search"
                  placeholder="Enter ZIP code or city, state"
                  className="w-full rounded-l-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-primary text-white rounded-r-lg px-4 hover:bg-primary/90 flex items-center"
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-search"></i>
                  )}
                </button>
              </form>
              <button
                onClick={useMyLocation}
                className="absolute right-16 top-1/2 transform -translate-y-1/2 text-primary text-sm font-medium flex items-center"
              >
                <i className="fas fa-location-arrow mr-1"></i>
                <span className="hidden sm:inline">My Location</span>
              </button>
            </div>
          </div>
          
          <nav className="flex items-center space-x-4 md:space-x-6">
            <Link href="/states" className="text-gray-600 hover:text-primary font-medium">
              <i className="fas fa-map-marked-alt mr-1"></i>
              <span className="hidden sm:inline">Browse States</span>
            </Link>
            <Link href="/laundry-tips" className="text-gray-600 hover:text-primary font-medium">
              <i className="fas fa-lightbulb mr-1"></i>
              <span className="hidden sm:inline">Laundry Tips</span>
            </Link>
            <Link href="/favorites" className="text-gray-600 hover:text-primary font-medium">
              <i className="far fa-heart mr-1"></i>
              <span className="hidden sm:inline">Favorites</span>
            </Link>
            <Link href="/business/1" className="text-gray-600 hover:text-primary font-medium">
              <i className="fas fa-store mr-1"></i>
              <span className="hidden sm:inline">For Owners</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
