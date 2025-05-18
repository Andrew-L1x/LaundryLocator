// User types
export interface User {
  id: number;
  username: string;
  email: string;
  isBusinessOwner?: boolean;
  role?: string;
  createdAt?: Date;
}

// Nearby Place type
export interface NearbyPlace {
  name: string;
  vicinity?: string;
  category: string;
  priceLevel: string;
  rating?: number;
  walkingDistance: string;
}

// Laundromat types
export interface Laundromat {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string | null;
  latitude: string;
  longitude: string;
  rating?: string | null;
  reviewCount?: number;
  hours: string;
  services: string[];
  imageUrl?: string | null;
  description?: string | null;
  ownerId?: number | null;
  
  // Nearby places from Google API
  nearby_places?: {
    restaurants?: NearbyPlace[];
    activities?: NearbyPlace[];
    transit?: NearbyPlace[];
  };
  
  // Google Places API data
  googleData?: {
    opening_hours?: {
      open_now?: boolean;
      periods?: any[];
      weekday_text?: string[];
    };
    formatted_address?: string;
    business_status?: string;
  };
  
  // Enhanced Google Places data
  google_place_id?: string;
  google_details?: any;
  business_hours?: any[];
  is_24_hours?: boolean;
  
  // Premium listing fields
  listingType?: string;
  isFeatured?: boolean;
  isPremium?: boolean;
  subscriptionActive?: boolean;
  subscriptionExpiry?: Date | null;
  featuredRank?: number | null;
  promotionalText?: string | null;
  amenities?: string[];
  machineCount?: { washers: number, dryers: number };
  photos?: string[];
  specialOffers?: string[];
  
  // Analytics data
  viewCount?: number;
  clickCount?: number;
  lastViewed?: Date | null;
  
  // Verification status
  verified?: boolean;
  verificationDate?: Date | null;
  
  createdAt?: Date;
}

// Review types
export interface Review {
  id: number;
  laundryId: number;
  userId: number;
  rating: number;
  comment?: string | null;
  createdAt?: Date;
}

// Filter interface
export interface Filter {
  openNow?: boolean;
  rating?: number;
  services?: string[];
  [key: string]: any;
}

// Favorite types
export interface Favorite {
  id: number;
  userId: number;
  laundryId: number;
  createdAt?: Date;
}

// City types
export interface City {
  id: number;
  name: string;
  state: string;
  slug: string;
  laundryCount?: number;
}

// State types
export interface State {
  id: number;
  name: string;
  abbr: string;
  slug: string;
  laundryCount?: number;
  comprehensive_content?: any; // Rich detailed state content
}

// Subscription types
export interface Subscription {
  id: number;
  laundryId: number;
  userId: number;
  tier: string;
  amount: number;
  paymentId?: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  autoRenew?: boolean | null;
  createdAt?: Date;
}

// Laundry Tip types
export interface LaundryTip {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  category: string;
  imageUrl?: string | null;
  tags?: string[] | null;
  url?: string;
  createdAt?: Date;
}

// Affiliate Product types
export interface AffiliateProduct {
  id: number;
  name: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  url: string;
}

// Premium Feature types
export interface PremiumFeatures {
  customLogo?: string;
  customColors?: {
    primary: string;
    secondary: string;
  };
  promotionalText?: string;
  highlightedServices?: string[];
  specialOffers?: string[];
  videoUrl?: string;
  customAmenities?: string[];
  virtualTour?: boolean;
  machineAvailability?: boolean;
  [key: string]: any;
}

// SubscriptionPlan types
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'annually';
  features: string[];
  isPopular?: boolean;
  discount?: number; // percentage discount for annual plans
}