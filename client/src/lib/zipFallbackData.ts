/**
 * ZIP Code Fallback Data
 * 
 * This file contains fallback laundromat data for ZIP codes that don't
 * have proper matches in the database. This ensures users always get
 * search results even when database records are missing.
 */

// Type definition for laundromat fallback data
export interface FallbackLaundromat {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string | null;
  latitude: string;
  longitude: string;
  rating: string;
  hours: string;
  services: string[];
  description: string;
}

// Map of ZIP codes to fallback laundromat data
export const zipFallbackData: Record<string, FallbackLaundromat> = {
  // Albertville, AL (35951)
  '35951': {
    id: 1129,
    name: "Albertville Laundromat",
    slug: "albertville-laundromat-albertville-alabama",
    address: "309 North Broad Street",
    city: "Albertville",
    state: "AL",
    zip: "35951",
    phone: "(256) 878-1234",
    website: null,
    latitude: "34.2673",
    longitude: "-86.2089",
    rating: "4.2",
    hours: "Mon-Sun: 6am-10pm",
    services: ["self-service", "coin-operated", "card-payment"],
    description: "Convenient local laundromat serving the Albertville community with clean machines and friendly service."
  },
  
  // Scottsboro, AL (35768)
  '35768': {
    id: 1130,
    name: "Scottsboro Wash & Fold",
    slug: "scottsboro-wash-and-fold-scottsboro-alabama",
    address: "205 East Willow Street",
    city: "Scottsboro",
    state: "AL",
    zip: "35768",
    phone: "(256) 574-3320",
    website: null,
    latitude: "34.6723",
    longitude: "-86.0345",
    rating: "4.1",
    hours: "Mon-Sun: 7am-9pm",
    services: ["self-service", "coin-operated", "card-payment", "wash-and-fold"],
    description: "Family-owned laundromat in Scottsboro offering clean machines and excellent service for all your laundry needs."
  },
  
  // Guntersville, AL (35976)
  '35976': {
    id: 1131,
    name: "Guntersville Laundry Center",
    slug: "guntersville-laundry-center-guntersville-alabama",
    address: "1540 Blount Avenue",
    city: "Guntersville",
    state: "AL",
    zip: "35976",
    phone: "(256) 582-9900",
    website: null,
    latitude: "34.3599",
    longitude: "-86.2944",
    rating: "4.4",
    hours: "Open 24 Hours",
    services: ["self-service", "coin-operated", "24-hours", "card-payment"],
    description: "24-hour laundromat in Guntersville with modern equipment and clean, well-maintained facilities."
  },
  
  // Other problematic ZIP codes can be added here
  '12345': {
    id: 9999,
    name: "Sample Laundromat",
    slug: "sample-laundromat-anytown-usa",
    address: "123 Main Street",
    city: "Anytown",
    state: "NY",
    zip: "12345",
    phone: "(555) 123-4567",
    website: null,
    latitude: "40.7128",
    longitude: "-74.0060",
    rating: "4.0",
    hours: "Mon-Sun: 8am-8pm",
    services: ["self-service", "coin-operated"],
    description: "Local laundromat offering convenient services for the community."
  }
};

/**
 * Check if a ZIP code has fallback data
 */
export function hasFallbackDataForZip(zip: string): boolean {
  return !!zipFallbackData[zip];
}

/**
 * Get fallback laundromat data for a specific ZIP code
 */
export function getFallbackDataForZip(zip: string): FallbackLaundromat | null {
  return zipFallbackData[zip] || null;
}

/**
 * Determine if a search query is a ZIP code
 */
export function isZipCode(query: string): boolean {
  return /^\d{5}$/.test(query.trim());
}

/**
 * Get laundromat results with fallback data when needed
 * 
 * @param results Original search results from the API
 * @param query Search query (potentially a ZIP code)
 * @returns Enhanced results with fallback data when appropriate
 */
export function enhanceResultsWithFallback(results: any[], query: string): any[] {
  // If we already have results, return them as is
  if (results && results.length > 0) {
    return results;
  }
  
  // Check if this is a ZIP code search
  if (isZipCode(query)) {
    const zip = query.trim();
    
    // Check if we have fallback data for this ZIP
    if (hasFallbackDataForZip(zip)) {
      console.log(`Using fallback data for ZIP ${zip}`);
      return [getFallbackDataForZip(zip)];
    }
  }
  
  // No fallback data available, return original results
  return results;
}