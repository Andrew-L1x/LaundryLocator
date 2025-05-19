import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ChevronRight, MapPin, Star } from 'lucide-react';
import ListingCard from '@/components/ListingCard';
import EnhancedLaundryCard from '@/components/EnhancedLaundryCard';

import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistance } from '@/lib/geolocation';
import { calculateDistanceInMiles } from '@/lib/geolocation';
import type { Laundromat } from '@shared/schema';

export default function NearbySearchResults() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  // Map view has been removed
  const [view] = useState<'list'>('list');
  
  // Parse URL parameters
  const latitude = searchParams.get('lat') || '';
  const longitude = searchParams.get('lng') || '';
  const radius = parseInt(searchParams.get('radius') || '25', 10);
  
  // Current user location for distance calculation
  const userLocation = { lat: parseFloat(latitude), lng: parseFloat(longitude) };
  
  // Fetch nearby laundromats using direct API URL to avoid any query parameter issues
  const apiUrl = `/api/laundromats/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`;
  const { data, isLoading, error } = useQuery({
    queryKey: [apiUrl],
    enabled: !!latitude && !!longitude
  });
  
  // Debug the API URL
  console.log("API URL:", apiUrl);
  console.log("API response:", data);
  
  // Process laundromat data
  const laundromats = React.useMemo(() => {
    // First, ensure we have an array of laundromats to work with
    const laundromatArray = Array.isArray(data) ? data : [];
    console.log("Laundromat array length:", laundromatArray.length);
    
    if (laundromatArray.length === 0) {
      return [];
    }
    
    // Map the data to ensure each laundromat has a proper distance property
    return laundromatArray.map((laundromat: any) => {
      // If the API already provided a distance, ensure it's a number
      if (laundromat.distance !== undefined) {
        return {
          ...laundromat,
          distance: typeof laundromat.distance === 'string' 
            ? parseFloat(laundromat.distance) 
            : laundromat.distance
        };
      }
      
      // Otherwise calculate the distance manually
      const distance = calculateDistanceInMiles(
        userLocation.lat,
        userLocation.lng,
        parseFloat(laundromat.latitude || "0"),
        parseFloat(laundromat.longitude || "0")
      );
      
      return { ...laundromat, distance };
    }).sort((a: any, b: any) => {
      const distA = typeof a.distance === 'number' ? a.distance : 999;
      const distB = typeof b.distance === 'number' ? b.distance : 999;
      return distA - distB;
    });
  }, [data, userLocation]);

  // Render SEO metadata
  const renderMeta = () => {
    let title = 'Nearby Laundromats';
    let description = `Find laundromats near your current location within ${radius} miles radius. Browse by distance, ratings, and amenities.`;
    
    if (laundromats && laundromats.length > 0) {
      const count = laundromats.length;
      title = `${count} Laundromats Near You`;
      description = `Found ${count} laundromats within ${radius} miles of your location. Compare prices, amenities and services to find the perfect laundromat.`;
    }
    
    return (
      <Helmet>
        <title>{title} | LaundryLocator</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>
    );
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="container py-8">
        {renderMeta()}
        <h1 className="text-2xl font-bold mb-6">Finding laundromats near you...</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-1" />
                  <Skeleton className="h-4 w-5/6 mb-1" />
                  <Skeleton className="h-4 w-2/3 mb-3" />
                  <div className="flex justify-between">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="container py-8">
        {renderMeta()}
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error loading nearby laundromats</AlertTitle>
          <AlertDescription>
            We couldn't find laundromats near your location. Please try again or try a different search.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {renderMeta()}
      
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Laundromats Near You</h1>
          <p className="text-gray-600 mb-2">
            Showing {laundromats.length} results within {radius} miles
          </p>
          <p className="flex items-center text-sm text-gray-500">
            <MapPin size={14} className="mr-1" />
            Location based search results ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
          </p>
        </div>
        
        {/* View toggle removed - map functionality removed to reduce API costs */}
        <div className="mt-4 md:mt-0">
          {/* Location information */}
          <div className="bg-blue-50 rounded-md px-4 py-2 text-sm text-gray-700">
            <p className="flex items-center">
              <MapPin size={16} className="mr-1" /> Showing results within {radius} miles
            </p>
          </div>
        </div>
      </div>
      
      <Separator className="mb-6" />

      {/* Only list view is available - map view removed to reduce API costs */}
      <div className="mt-0">
        {(!data || !Array.isArray(data) || data.length === 0) ? (
          <Alert className="mb-6">
            <AlertTitle>No laundromats found nearby</AlertTitle>
            <AlertDescription>
              We couldn't find any laundromats within {radius} miles of your location. 
              Try increasing the search radius or searching by ZIP code instead.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {laundromats.map((laundromat: any) => (
              <EnhancedLaundryCard
                key={laundromat.id}
                laundromat={laundromat}
                showDistance
              />
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Can't find what you're looking for?</h2>
        <div className="flex flex-wrap gap-4">
          <Button asChild>
            <Link href="/">Search by ZIP Code</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/states">Browse by State</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}