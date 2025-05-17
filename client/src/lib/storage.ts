// Local storage utilities for favorites and recent searches

export const STORAGE_KEYS = {
  FAVORITES: 'laundrylocator_favorites',
  RECENT_SEARCHES: 'laundrylocator_recent_searches',
  LAST_LOCATION: 'laundrylocator_last_location'
};

// Save a laundromat to favorites
export function saveFavorite(laundryId: number): void {
  const favorites = getFavorites();
  if (!favorites.includes(laundryId)) {
    favorites.push(laundryId);
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  }
}

// Remove a laundromat from favorites
export function removeFavorite(laundryId: number): void {
  const favorites = getFavorites();
  const updatedFavorites = favorites.filter(id => id !== laundryId);
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updatedFavorites));
}

// Get all favorites
export function getFavorites(): number[] {
  const favoritesJson = localStorage.getItem(STORAGE_KEYS.FAVORITES);
  return favoritesJson ? JSON.parse(favoritesJson) : [];
}

// Check if a laundromat is in favorites
export function isFavorite(laundryId: number): boolean {
  const favorites = getFavorites();
  return favorites.includes(laundryId);
}

// Save a recent search
export function saveRecentSearch(query: string, lat?: number, lng?: number): void {
  const searches = getRecentSearches();
  const newSearch = { 
    query, 
    lat, 
    lng, 
    timestamp: new Date().getTime() 
  };
  
  // Remove any duplicate searches
  const filteredSearches = searches.filter(search => search.query !== query);
  
  // Add new search at the beginning
  filteredSearches.unshift(newSearch);
  
  // Keep only the 5 most recent searches
  const recentSearches = filteredSearches.slice(0, 5);
  
  localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recentSearches));
}

// Get recent searches
export function getRecentSearches(): Array<{
  query: string;
  lat?: number;
  lng?: number;
  timestamp: number;
}> {
  const searchesJson = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
  return searchesJson ? JSON.parse(searchesJson) : [];
}

// Save last known location
export function saveLastLocation(location: string): void {
  localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, location);
}

// Get last known location
export function getLastLocation(): string {
  return localStorage.getItem(STORAGE_KEYS.LAST_LOCATION) || '';
}

// Clear last known location
export function clearLastLocation(): void {
  localStorage.removeItem(STORAGE_KEYS.LAST_LOCATION);
}
