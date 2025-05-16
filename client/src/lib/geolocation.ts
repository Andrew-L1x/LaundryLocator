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
 * 
 * @returns Promise with the user's coordinates or null if geolocation is not available
 */
export function getUserLocation(): Promise<{lat: number, lng: number} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser');
      resolve(null);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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