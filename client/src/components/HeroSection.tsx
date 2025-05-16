import SearchBar from './SearchBar';
import { useLocation } from 'wouter';

const HeroSection = () => {
  const [_, setLocation] = useLocation();

  const handleSearch = (query: string, lat?: number, lng?: number) => {
    let url = '/map-search?';
    
    if (query) {
      url += `q=${encodeURIComponent(query)}`;
    }
    
    if (lat && lng) {
      url += `${query ? '&' : ''}lat=${lat}&lng=${lng}`;
    }
    
    setLocation(url);
  };

  return (
    <div className="bg-gradient-to-r from-primary/80 to-primary text-white py-16">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Find Nearby Laundromats</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          Locate clean, convenient laundromats in your area with real-time availability and reviews.
        </p>
        <div className="max-w-md mx-auto">
          <SearchBar 
            onSearch={handleSearch}
            placeholder="Enter ZIP code or address..."
          />
        </div>
      </div>
    </div>
  );
};

export default HeroSection;