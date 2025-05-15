export interface Laundromat {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  latitude: string;
  longitude: string;
  rating: string;
  reviewCount: number;
  hours: string;
  services: string[];
  isFeatured: boolean;
  isPremium: boolean;
  imageUrl?: string;
  description?: string;
  isOpen?: boolean; // Calculated based on current time and hours
  distance?: string; // Calculated based on user location
}

export interface City {
  id: number;
  name: string;
  state: string;
  slug: string;
  laundryCount: number;
}

export interface State {
  id: number;
  name: string;
  abbr: string;
  slug: string;
  laundryCount: number;
}

export interface Review {
  id: number;
  laundryId: number;
  userId: number;
  rating: number;
  comment?: string;
  createdAt: string;
  username?: string;
}

export interface Filter {
  openNow?: boolean;
  services?: string[];
  rating?: number;
  sortBy?: 'distance' | 'rating';
}

export interface SearchParams {
  location?: string;
  lat?: string;
  lng?: string;
  filters?: Filter;
}

export interface LaundryTip {
  id: number;
  title: string;
  description: string;
  url: string;
}

export interface AffiliateProduct {
  id: number;
  name: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  url: string;
}
