import { useState, FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';
import { getCurrentPosition } from '@/lib/geolocation';
import { saveLastLocation } from '@/lib/storage';

const SearchBar = () => {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;
    
    setIsSearching(true);
    saveLastLocation(searchTerm);
    navigate(`/search?location=${encodeURIComponent(searchTerm)}`);
    setIsSearching(false);
  };

  const handleUseLocation = async () => {
    try {
      setIsSearching(true);
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      navigate(`/search?lat=${latitude}&lng=${longitude}`);
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Unable to get your location. Please try entering a zip code or city name.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 -mt-8 relative z-10">
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Enter ZIP code or city"
            className="pl-10 h-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <Button 
          type="submit" 
          className="h-12 px-6 bg-primary hover:bg-primary/90"
          disabled={isSearching || !searchTerm}
        >
          Find Laundromats
        </Button>
      </form>
      
      <button 
        type="button" 
        onClick={handleUseLocation}
        className="flex items-center mt-3 text-primary hover:text-primary/80 text-sm font-medium"
        disabled={isSearching}
      >
        <MapPin className="h-4 w-4 mr-1" />
        Use my current location
      </button>
    </div>
  );
};

export default SearchBar;