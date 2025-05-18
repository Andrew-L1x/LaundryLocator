import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { saveLastLocation } from '@/lib/storage';

const NearbySearch = () => {
  const [, setLocation] = useLocation();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [zipCode, setZipCode] = useState('');
  const [radius, setRadius] = useState(25); // Default 25 miles radius

  const handleLocationSearch = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      setLocationError(null);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Save location search params
          const searchParams = new URLSearchParams();
          searchParams.append('lat', latitude.toString());
          searchParams.append('lng', longitude.toString());
          searchParams.append('radius', radius.toString());
          
          // Navigate to search results with these params
          setLocation(`/search/nearby?${searchParams.toString()}`);
          
          // Save for future reference
          saveLastLocation('Current Location');
          setIsLocating(false);
        },
        (error) => {
          setIsLocating(false);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError("You denied the request for geolocation. Please enable location services in your browser settings.");
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError("Location information is unavailable. Please try using ZIP code search instead.");
              break;
            case error.TIMEOUT:
              setLocationError("The request to get your location timed out. Please try again.");
              break;
            default:
              setLocationError("An unknown error occurred while trying to get your location.");
              break;
          }
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds
          maximumAge: 0
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser. Please use ZIP code search instead.");
    }
  };

  const handleZipCodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (zipCode.trim()) {
      setLocation(`/search?q=${encodeURIComponent(zipCode.trim())}&radius=${radius}`);
      saveLastLocation(zipCode.trim());
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h2 className="text-xl font-semibold mb-4">Find Laundromats Near You</h2>
      
      <div className="space-y-4">
        {/* Use Current Location */}
        <div>
          <Button
            onClick={handleLocationSearch}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            disabled={isLocating}
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            {isLocating ? 'Locating...' : 'Use My Current Location'}
          </Button>
        </div>
        
        {/* Location error message */}
        {locationError && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              {locationError}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="relative flex items-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-700">Or</span>
          </div>
        </div>
        
        {/* ZIP Code Search */}
        <form onSubmit={handleZipCodeSearch}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Search</Button>
            </div>
          </div>
        </form>
        
        {/* Search Radius */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="radius">Search Radius: {radius} miles</Label>
          </div>
          <Slider
            id="radius"
            min={1}
            max={25}
            step={1}
            value={[radius]}
            onValueChange={(value) => setRadius(value[0])}
          />
          <div className="flex justify-between text-xs text-gray-700">
            <span>1 mile</span>
            <span>25 miles</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NearbySearch;