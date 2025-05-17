import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, ChevronDown } from 'lucide-react';
import AddressSearchInput from '@/components/AddressSearchInput';

const NearMeSearch: React.FC = () => {
  const [locationData, setLocationData] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchRadius, setSearchRadius] = useState('5');
  const getRadiusLabel = (value: string) => {
    return value === "1" ? "1 mile" : 
           value === "3" ? "3 miles" : 
           value === "5" ? "5 miles" : 
           value === "10" ? "10 miles" : 
           value === "25" ? "25 miles" : 
           "Select distance";
  };
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
          
          let errorMessage = "Unable to determine your location. Please try again or enter your address manually.";
          
          // Provide more specific error messages based on the error code
          switch(error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = "Location access was denied. Please enable location services in your browser settings and try again.";
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = "Your location information is unavailable. Please try again or search by ZIP code instead.";
              break;
            case 3: // TIMEOUT
              errorMessage = "Location request timed out. Please check your connection and try again.";
              break;
          }
          
          toast({
            title: "Location Error",
            description: errorMessage,
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
          
          <div className="mt-3 p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="radius" className="whitespace-nowrap font-medium text-sm">Search Radius:</Label>
                <span className="font-semibold text-sm text-primary">{getRadiusLabel(searchRadius)}</span>
              </div>
              <div className="flex-grow">
                <div className="relative">
                  <div className="w-full md:w-36 h-10 px-3 py-2 rounded-md border border-input bg-white flex items-center justify-between text-sm">
                    <span>Change radius</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </div>
                  <Select value={searchRadius} onValueChange={setSearchRadius}>
                    <SelectTrigger id="radius" className="absolute inset-0 opacity-0">
                      <SelectValue>{getRadiusLabel(searchRadius)}</SelectValue>
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
              <p className="text-xs text-gray-500 md:ml-2">Choose how far to search around your location</p>
            </div>
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