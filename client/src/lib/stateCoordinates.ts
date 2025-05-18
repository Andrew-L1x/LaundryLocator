// State coordinates library for map fallback
// Maps each state abbreviation to its capital's coordinates

export interface StateCoordinate {
  name: string;
  lat: number;
  lng: number;
}

export const stateCoordinates: Record<string, StateCoordinate> = {
  'AL': { name: 'Montgomery', lat: 32.3792, lng: -86.3077 },
  'AK': { name: 'Juneau', lat: 58.3019, lng: -134.4197 },
  'AZ': { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
  'AR': { name: 'Little Rock', lat: 34.7465, lng: -92.2896 },
  'CA': { name: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  'CO': { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  'CT': { name: 'Hartford', lat: 41.7658, lng: -72.6734 },
  'DE': { name: 'Dover', lat: 39.1582, lng: -75.5244 },
  'FL': { name: 'Tallahassee', lat: 30.4383, lng: -84.2807 },
  'GA': { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
  'HI': { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
  'ID': { name: 'Boise', lat: 43.6150, lng: -116.2023 },
  'IL': { name: 'Springfield', lat: 39.7817, lng: -89.6501 },
  'IN': { name: 'Indianapolis', lat: 39.7684, lng: -86.1581 },
  'IA': { name: 'Des Moines', lat: 41.5868, lng: -93.6250 },
  'KS': { name: 'Topeka', lat: 39.0473, lng: -95.6752 },
  'KY': { name: 'Frankfort', lat: 38.2007, lng: -84.8732 },
  'LA': { name: 'Baton Rouge', lat: 30.4515, lng: -91.1871 },
  'ME': { name: 'Augusta', lat: 44.3106, lng: -69.7795 },
  'MD': { name: 'Annapolis', lat: 38.9784, lng: -76.4922 },
  'MA': { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  'MI': { name: 'Lansing', lat: 42.7325, lng: -84.5555 },
  'MN': { name: 'St. Paul', lat: 44.9537, lng: -93.0900 },
  'MS': { name: 'Jackson', lat: 32.2988, lng: -90.1848 },
  'MO': { name: 'Jefferson City', lat: 38.5767, lng: -92.1735 },
  'MT': { name: 'Helena', lat: 46.5891, lng: -112.0391 },
  'NE': { name: 'Lincoln', lat: 40.8136, lng: -96.7026 },
  'NV': { name: 'Carson City', lat: 39.1638, lng: -119.7674 },
  'NH': { name: 'Concord', lat: 43.2081, lng: -71.5376 },
  'NJ': { name: 'Trenton', lat: 40.2206, lng: -74.7597 },
  'NM': { name: 'Santa Fe', lat: 35.6870, lng: -105.9378 },
  'NY': { name: 'Albany', lat: 42.6526, lng: -73.7562 },
  'NC': { name: 'Raleigh', lat: 35.7796, lng: -78.6382 },
  'ND': { name: 'Bismarck', lat: 46.8083, lng: -100.7837 },
  'OH': { name: 'Columbus', lat: 39.9612, lng: -82.9988 },
  'OK': { name: 'Oklahoma City', lat: 35.4676, lng: -97.5164 },
  'OR': { name: 'Salem', lat: 44.9429, lng: -123.0351 },
  'PA': { name: 'Harrisburg', lat: 40.2732, lng: -76.8867 },
  'RI': { name: 'Providence', lat: 41.8240, lng: -71.4128 },
  'SC': { name: 'Columbia', lat: 34.0007, lng: -81.0348 },
  'SD': { name: 'Pierre', lat: 44.3683, lng: -100.3510 },
  'TN': { name: 'Nashville', lat: 36.1627, lng: -86.7816 },
  'TX': { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  'UT': { name: 'Salt Lake City', lat: 40.7608, lng: -111.8910 },
  'VT': { name: 'Montpelier', lat: 44.2601, lng: -72.5754 },
  'VA': { name: 'Richmond', lat: 37.5407, lng: -77.4360 },
  'WA': { name: 'Olympia', lat: 47.0379, lng: -122.9007 },
  'WV': { name: 'Charleston', lat: 38.3498, lng: -81.6326 },
  'WI': { name: 'Madison', lat: 43.0731, lng: -89.4012 },
  'WY': { name: 'Cheyenne', lat: 41.1400, lng: -104.8202 },
  'DC': { name: 'Washington', lat: 38.9072, lng: -77.0369 }
};

// Utility function to get state info by code
export function getStateInfo(stateCode: string): StateCoordinate {
  return stateCoordinates[stateCode] || stateCoordinates['CO']; // Default to Colorado if not found
}