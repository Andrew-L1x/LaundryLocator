/**
 * Calculates the distance between two geographic points in miles
 * 
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Haversine formula for calculating distance between two points on the Earth
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Converts degrees to radians
 * 
 * @param deg Angle in degrees
 * @returns Angle in radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

/**
 * Gets the user's current location using the browser's Geolocation API
 * Includes caching to localStorage for better UX on revisits
 * 
 * @returns Promise with the user's coordinates or null if geolocation is not available
 */
export function getUserLocation(): Promise<{lat: number, lng: number} | null> {
  return new Promise((resolve) => {
    // Check for cached location first
    const cachedLocation = localStorage.getItem('user_location');
    
    if (cachedLocation) {
      try {
        const location = JSON.parse(cachedLocation);
        if (location.lat && location.lng && 
            !isNaN(location.lat) && !isNaN(location.lng) &&
            new Date().getTime() - location.timestamp < 30 * 60 * 1000) { // 30 minute cache
          console.log('Using cached location:', location);
          return resolve({lat: location.lat, lng: location.lng});
        }
      } catch (e) {
        console.error('Error parsing cached location:', e);
        // Continue with live location if cache parsing fails
      }
    }
    
    // Fall back to browser geolocation
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser');
      resolve(null);
      return;
    }
    
    // Show loading indicator or message to user that we're getting their location
    console.log('Requesting user location...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date().getTime()
        };
        
        // Cache the location for future use
        localStorage.setItem('user_location', JSON.stringify(location));
        console.log('User location detected:', location);
        
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        
        // Default to Denver if geolocation fails
        const denverLocation = { lat: 39.7392, lng: -104.9903 };
        console.log('Defaulting to Denver location:', denverLocation);
        
        resolve(null);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, // Increased timeout for slower connections
        maximumAge: 15 * 60 * 1000 // Allow locations up to 15 mins old
      }
    );
  });
}

/**
 * Gets the user's current location (alias for getUserLocation to maintain backward compatibility)
 * 
 * @returns Promise with the user's coordinates or null if geolocation is not available
 */
export function getCurrentPosition(): Promise<{lat: number, lng: number} | null> {
  return getUserLocation();
}

/**
 * Reverse geocode coordinates into a readable address using Google Maps API
 * 
 * @param lat Latitude coordinate
 * @param lng Longitude coordinate
 * @returns Promise with formatted address string and additional location data
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  formattedAddress: string;
  city?: string;
  state?: string;
  stateAbbr?: string;
}> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Try to get a city and state from the address components
      const result = data.results[0];
      let city = '';
      let state = '';
      let stateAbbr = '';
      
      for (const component of result.address_components) {
        if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
          stateAbbr = component.short_name;
        }
      }
      
      const formattedAddress = city && stateAbbr 
        ? `${city}, ${stateAbbr}` 
        : result.formatted_address.split(',').slice(0, 2).join(',');
      
      return {
        formattedAddress,
        city,
        state,
        stateAbbr
      };
    } else {
      throw new Error('Failed to reverse geocode coordinates');
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}

/**
 * Formats a distance value into a human-readable string
 * 
 * @param distance Distance in miles
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance < 0.1) {
    return 'less than 0.1 miles';
  } else if (distance < 1) {
    return `${(distance * 10).toFixed(0) / 10} miles`;
  } else {
    return `${distance.toFixed(1)} miles`;
  }
}

/**
 * A more precise distance calculation specifically for NearbySearchResults
 * 
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistance(lat1, lon1, lat2, lon2);
}

/**
 * Sorts laundromats by distance from a given location
 * 
 * @param laundromats Array of laundromats
 * @param userLocation User's location coordinates
 * @returns Sorted array of laundromats
 */
export function sortByDistance(laundromats: any[], userLocation: {lat: number, lng: number}): any[] {
  if (!userLocation) return laundromats;
  
  return [...laundromats].sort((a, b) => {
    const distanceA = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      parseFloat(a.latitude),
      parseFloat(a.longitude)
    );
    
    const distanceB = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      parseFloat(b.latitude),
      parseFloat(b.longitude)
    );
    
    return distanceA - distanceB;
  });
}