/**
 * State Coordinates - Default centers for each US state (capital or major city)
 * Used for the map fallback when no local laundromats are found
 */

export interface StateCoordinates {
  [stateCode: string]: {
    lat: number;
    lng: number;
    name: string; // City or capital name
  };
}

export const stateCoordinates: StateCoordinates = {
  "AL": { lat: 32.3792, lng: -86.3077, name: "Montgomery" },
  "AK": { lat: 58.3019, lng: -134.4197, name: "Juneau" },
  "AZ": { lat: 33.4484, lng: -112.0740, name: "Phoenix" },
  "AR": { lat: 34.7465, lng: -92.2896, name: "Little Rock" },
  "CA": { lat: 38.5816, lng: -121.4944, name: "Sacramento" },
  "CO": { lat: 39.7392, lng: -104.9903, name: "Denver" },
  "CT": { lat: 41.7658, lng: -72.6734, name: "Hartford" },
  "DE": { lat: 39.1582, lng: -75.5244, name: "Dover" },
  "FL": { lat: 30.4383, lng: -84.2807, name: "Tallahassee" },
  "GA": { lat: 33.7490, lng: -84.3880, name: "Atlanta" },
  "HI": { lat: 21.3069, lng: -157.8583, name: "Honolulu" },
  "ID": { lat: 43.6150, lng: -116.2023, name: "Boise" },
  "IL": { lat: 39.7817, lng: -89.6501, name: "Springfield" },
  "IN": { lat: 39.7684, lng: -86.1581, name: "Indianapolis" },
  "IA": { lat: 41.5868, lng: -93.6250, name: "Des Moines" },
  "KS": { lat: 39.0473, lng: -95.6752, name: "Topeka" },
  "KY": { lat: 38.1867, lng: -84.8753, name: "Frankfort" },
  "LA": { lat: 30.4515, lng: -91.1871, name: "Baton Rouge" },
  "ME": { lat: 44.3106, lng: -69.7795, name: "Augusta" },
  "MD": { lat: 38.9784, lng: -76.4922, name: "Annapolis" },
  "MA": { lat: 42.3601, lng: -71.0589, name: "Boston" },
  "MI": { lat: 42.7325, lng: -84.5555, name: "Lansing" },
  "MN": { lat: 44.9537, lng: -93.0900, name: "Saint Paul" },
  "MS": { lat: 32.2988, lng: -90.1848, name: "Jackson" },
  "MO": { lat: 38.5767, lng: -92.1735, name: "Jefferson City" },
  "MT": { lat: 46.5891, lng: -112.0391, name: "Helena" },
  "NE": { lat: 40.8136, lng: -96.7026, name: "Lincoln" },
  "NV": { lat: 39.1638, lng: -119.7674, name: "Carson City" },
  "NH": { lat: 43.2081, lng: -71.5376, name: "Concord" },
  "NJ": { lat: 40.2206, lng: -74.7597, name: "Trenton" },
  "NM": { lat: 35.6870, lng: -105.9378, name: "Santa Fe" },
  "NY": { lat: 42.6526, lng: -73.7562, name: "Albany" },
  "NC": { lat: 35.7796, lng: -78.6382, name: "Raleigh" },
  "ND": { lat: 46.8083, lng: -100.7837, name: "Bismarck" },
  "OH": { lat: 39.9612, lng: -82.9988, name: "Columbus" },
  "OK": { lat: 35.4676, lng: -97.5164, name: "Oklahoma City" },
  "OR": { lat: 44.9429, lng: -123.0351, name: "Salem" },
  "PA": { lat: 40.2732, lng: -76.8867, name: "Harrisburg" },
  "RI": { lat: 41.8240, lng: -71.4128, name: "Providence" },
  "SC": { lat: 34.0000, lng: -81.0350, name: "Columbia" },
  "SD": { lat: 44.3683, lng: -100.3510, name: "Pierre" },
  "TN": { lat: 36.1627, lng: -86.7816, name: "Nashville" },
  "TX": { lat: 30.2672, lng: -97.7431, name: "Austin" },
  "UT": { lat: 40.7608, lng: -111.8910, name: "Salt Lake City" },
  "VT": { lat: 44.2601, lng: -72.5754, name: "Montpelier" },
  "VA": { lat: 37.5407, lng: -77.4360, name: "Richmond" },
  "WA": { lat: 47.0379, lng: -122.9007, name: "Olympia" },
  "WV": { lat: 38.3498, lng: -81.6326, name: "Charleston" },
  "WI": { lat: 43.0731, lng: -89.4012, name: "Madison" },
  "WY": { lat: 41.1400, lng: -104.8202, name: "Cheyenne" },
  "DC": { lat: 38.9072, lng: -77.0369, name: "Washington" }
};