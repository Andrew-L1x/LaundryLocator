import { ListingType } from './schema';

// Premium tier feature limits
export const PREMIUM_LIMITS = {
  photos: {
    basic: 1,
    premium: 5,
    featured: 10
  },
  amenities: {
    basic: 5,
    premium: 10,
    featured: 20
  },
  services: {
    basic: 5,
    premium: 10,
    featured: 20
  },
  specialOffers: {
    basic: 0,
    premium: 3,
    featured: 5
  }
};

// Premium tier feature access
export const PREMIUM_FEATURES = {
  promotionalText: {
    basic: false,
    premium: true,
    featured: true
  },
  machineCount: {
    basic: false,
    premium: true,
    featured: true
  },
  searchPriority: {
    basic: 3, // lowest priority
    premium: 2,
    featured: 1 // highest priority
  },
  showInFeatured: {
    basic: false,
    premium: false,
    featured: true
  }
};

// Premium tier pricing
export const PREMIUM_PRICING = {
  premium: {
    name: 'Premium Listing',
    description: 'Enhanced visibility and features for your business',
    monthlyPrice: 1999, // $19.99
    annualPrice: 19999, // $199.99 (two months free)
    features: [
      'Priority placement in search results',
      'Add up to 5 photos of your location',
      'Detailed business description',
      'List your washing machine & dryer count',
      'Promotional text for special offerings',
      'Up to 10 amenity listings',
      'Up to 3 special offer listings'
    ]
  },
  featured: {
    name: 'Featured Listing',
    description: 'Maximum visibility and premium features',
    monthlyPrice: 3999, // $39.99
    annualPrice: 39999, // $399.99 (two months free)
    features: [
      'Top placement in search results',
      'Featured section on homepage and search results',
      'Add up to 10 photos of your location',
      'Enhanced business profile',
      'List your washing machine & dryer count',
      'Promotional text for special offerings',
      'Up to 20 amenity listings',
      'Up to 5 special offer listings',
      'Highlighted listing with special badge'
    ]
  }
};

// Helper function to determine if a listing can access a premium feature
export function canAccessFeature(listingType: ListingType, feature: keyof typeof PREMIUM_FEATURES): boolean {
  if (!(feature in PREMIUM_FEATURES)) {
    return false;
  }
  
  const featureAccess = PREMIUM_FEATURES[feature];
  if (typeof featureAccess === 'object' && typeof featureAccess[listingType] === 'boolean') {
    return featureAccess[listingType];
  }
  
  return false;
}

// Helper function to get the limit for a feature based on listing type
export function getFeatureLimit(listingType: ListingType, feature: keyof typeof PREMIUM_LIMITS): number {
  if (!(feature in PREMIUM_LIMITS)) {
    return 0;
  }
  
  return PREMIUM_LIMITS[feature][listingType] || 0;
}

// Helper function to get search priority value (lower is better)
export function getSearchPriority(listingType: ListingType): number {
  return PREMIUM_FEATURES.searchPriority[listingType] || 3;
}