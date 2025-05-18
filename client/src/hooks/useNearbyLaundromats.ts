import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Laundromat } from '@/types/laundromat';
import { getUserLocation, reverseGeocode } from '@/lib/geolocation';

interface UseNearbyLaundromatsOptions {
  defaultLat?: string | number;
  defaultLng?: string | number;
  defaultRadius?: string | number;
  urlLat?: string | null;
  urlLng?: string | null;
  urlRadius?: string | null;
}

export function useNearbyLaundromats({
  defaultLat = '39.7392',
  defaultLng = '-104.9903',
  defaultRadius = '25',
  urlLat = null,
  urlLng = null,
  urlRadius = null
}: UseNearbyLaundromatsOptions = {}) {
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationName, setLocationName] = useState<string>('Current Location');
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error'>('loading');

  // Parse URL params or use defaults
  const latitude = urlLat || (userLocation?.lat.toString() || defaultLat);
  const longitude = urlLng || (userLocation?.lng.toString() || defaultLng);
  const searchRadius = urlRadius || defaultRadius;

  // Query for laundromats based on location
  const {
    data: laundromats = [],
    isLoading: laundromatLoading,
    error: laundromatError,
    refetch: refetchLaundromats
  } = useQuery<Laundromat[]>({
    queryKey: ['/api/laundromats', latitude, longitude, searchRadius],
    enabled: locationStatus !== 'loading',
    queryFn: async () => {
      try {
        // Set up query parameters
        const params = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
          radius: String(searchRadius)
        });

        // Make the API request with coordinates
        console.log(`Fetching laundromats near coordinates (${latitude},${longitude}) with radius ${searchRadius} miles`);
        const response = await fetch(`/api/laundromats?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch laundromats');
        }
        
        const data = await response.json();
        console.log(`Found ${data.length} laundromats near coordinates`);
        
        // If we get results, return them directly
        if (data && data.length > 0) {
          return data;
        }
        
        // If no results, try Denver endpoint as fallback (only if we're not already in Denver)
        console.log('No results found with coordinates, trying Denver fallback');
        const denverResponse = await fetch('/api/denver-laundromats');
        
        if (denverResponse.ok) {
          const denverData = await denverResponse.json();
          console.log(`Found ${denverData.length} Denver laundromats from fallback`);
          return denverData;
        }
        
        // If Denver fallback fails, return empty array
        return [];
      } catch (error) {
        console.error('Error fetching laundromats:', error);
        
        // Try Denver as a last resort
        try {
          const denverResponse = await fetch('/api/denver-laundromats');
          if (denverResponse.ok) {
            const denverData = await denverResponse.json();
            console.log(`Using Denver fallback: ${denverData.length} laundromats`);
            return denverData;
          }
        } catch (fallbackError) {
          console.error('Denver fallback failed:', fallbackError);
        }
        
        return [];
      }
    }
  });

  // Effect to get user's location on mount
  useEffect(() => {
    // Skip if we already have URL params
    if (urlLat && urlLng) {
      setUserLocation({ 
        lat: parseFloat(urlLat), 
        lng: parseFloat(urlLng) 
      });
      setLocationStatus('success');
      return;
    }
    
    // Otherwise get user's location
    setLocationStatus('loading');
    
    getUserLocation()
      .then(location => {
        if (location) {
          console.log('User location detected:', location);
          setUserLocation(location);
          setLocationStatus('success');
          
          // Try to get a readable location name
          reverseGeocode(location.lat, location.lng)
            .then(data => {
              if (data.formattedAddress) {
                setLocationName(data.formattedAddress);
              }
            })
            .catch(error => {
              console.error('Error reverse geocoding:', error);
            });
        } else {
          // If geolocation fails, default to Denver
          console.log('Geolocation failed, defaulting to Denver, CO');
          setUserLocation({ 
            lat: parseFloat(String(defaultLat)), 
            lng: parseFloat(String(defaultLng)) 
          });
          setLocationName('Denver, CO');
          setLocationStatus('error');
        }
      })
      .catch(error => {
        console.error('Error getting user location:', error);
        setUserLocation({ 
          lat: parseFloat(String(defaultLat)), 
          lng: parseFloat(String(defaultLng)) 
        });
        setLocationName('Denver, CO');
        setLocationStatus('error');
      });
  }, [urlLat, urlLng, defaultLat, defaultLng]);

  return {
    laundromats,
    laundromatLoading,
    laundromatError,
    refetchLaundromats,
    userLocation,
    locationName,
    locationStatus,
    latitude,
    longitude,
    searchRadius
  };
}