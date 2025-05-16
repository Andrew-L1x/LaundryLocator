import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2 } from 'lucide-react';

const AddressSearchInput: React.FC = () => {
  const [address, setAddress] = useState('');
  const [_, setLocation] = useLocation();
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      setLocation(`/search?q=${encodeURIComponent(address.trim())}`);
    }
  };
  
  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter ZIP code or address"
          className="flex-grow"
          aria-label="Search by address"
        />
        <Button type="submit" className="whitespace-nowrap">
          Search
        </Button>
      </div>
    </form>
  );
};

const NearMeSearch: React.FC = () => {
  const [locationData, setLocationData] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchRadius, setSearchRadius] = useState('5');
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  const handleLocationSearch = () => {
    setIsLocating(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationData({ lat: latitude, lng: longitude });
          setIsLocating(false);
          // Navigate to the nearby search results page
          navigate(`/nearby?lat=${latitude}&lng=${longitude}&radius=${searchRadius}`);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setIsLocating(false);
          toast({
            title: "Location Error",
            description: "Unable to determine your location. Please try again or enter your address manually.",
            variant: "destructive"
          });
        },
        { maximumAge: 60000, timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      setIsLocating(false);
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="space-y-6 w-full max-w-xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Find Laundromats Near You</h2>
        <p className="text-muted-foreground">Discover clean and convenient laundry services in your area</p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Button 
            onClick={handleLocationSearch} 
            disabled={isLocating}
            className="w-full"
            variant="default"
            size="lg"
          >
            {isLocating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Locating...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Use My Current Location
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="radius" className="whitespace-nowrap">Search Radius:</Label>
            <Select value={searchRadius} onValueChange={setSearchRadius}>
              <SelectTrigger id="radius">
                <SelectValue placeholder="Select distance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mile</SelectItem>
                <SelectItem value="3">3 miles</SelectItem>
                <SelectItem value="5">5 miles</SelectItem>
                <SelectItem value="10">10 miles</SelectItem>
                <SelectItem value="25">25 miles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Search by Address or ZIP Code</Label>
          <AddressSearchInput />
        </div>
      </div>
    </div>
  );
};

export default NearMeSearch;