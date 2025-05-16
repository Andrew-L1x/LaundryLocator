import { useLocation } from 'wouter';
import NearMeSearch from './NearMeSearch';

const HeroSection = () => {
  const [_, setLocation] = useLocation();

  return (
    <div className="bg-gradient-to-r from-primary/80 to-primary text-white py-16">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Find Nearby Laundromats</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          Locate clean, convenient laundromats in your area with real-time availability and reviews.
        </p>
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg max-w-2xl mx-auto">
          <NearMeSearch />
        </div>
      </div>
    </div>
  );
};

export default HeroSection;