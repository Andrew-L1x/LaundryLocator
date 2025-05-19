import { useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { getCurrentPosition } from '@/lib/geolocation';

const Header = () => {
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

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
      // Check if query is a ZIP code (5 digits)
      const isZipCode = /^\d{5}$/.test(searchQuery);
      
      if (isZipCode) {
        // Get coordinates for ZIP codes
        const zipGeocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchQuery
        )},USA&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
        
        const zipResponse = await fetch(zipGeocodeURL);
        const zipData = await zipResponse.json();
        
        if (zipData.status === 'OK' && zipData.results && zipData.results.length > 0) {
          // Extract coordinates for the ZIP code
          const { lat, lng } = zipData.results[0].geometry.location;
          navigate(`/search?q=${searchQuery}&lat=${lat}&lng=${lng}`);
        } else {
          // If geocoding fails, fall back to text search
          navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
      } else {
        // For city/state combinations, also do geocoding
        const geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchQuery
        )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
        
        const response = await fetch(geocodeURL);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          // Extract coordinates
          const { lat, lng } = data.results[0].geometry.location;
          navigate(`/search?q=${encodeURIComponent(searchQuery)}&lat=${lat}&lng=${lng}`);
        } else {
          // If geocoding fails, fall back to text search
          navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fall back to text search if anything goes wrong
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    } finally {
      setIsSearching(false);
    }
  };

  const useMyLocation = async () => {
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      // Navigate to search results with coordinates
      navigate(`/search?lat=${latitude}&lng=${longitude}`);
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
