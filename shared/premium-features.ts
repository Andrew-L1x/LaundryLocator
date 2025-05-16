/**
 * Premium features definitions and utilities for the Laundromat Directory
 * These features control what capabilities are available for each listing tier
 */

// Define the listing types
export type ListingType = 'basic' | 'premium' | 'featured';

// Define the premium features interface
export interface PremiumFeatures {
  photoLimit: number;
  showHours: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  highlightListing: boolean;
  prioritySearch: boolean;
}

// Define features for each listing type
const PREMIUM_FEATURES: Record<ListingType, PremiumFeatures> = {
  basic: {
    photoLimit: 1,
    showHours: true,
    showPhone: false,
    showWebsite: false,
    highlightListing: false,
    prioritySearch: false
  },
  premium: {
    photoLimit: 5,
    showHours: true,
    showPhone: true,
    showWebsite: true,
    highlightListing: false,
    prioritySearch: true
  },
  featured: {
    photoLimit: 10,
    showHours: true,
    showPhone: true,
    showWebsite: true,
    highlightListing: true,
    prioritySearch: true
  }
};

/**
 * Get premium features for a listing type
 * @param listingType The type of listing (basic, premium, featured)
 * @returns The premium features available for that listing type
 */
export function getPremiumFeatures(listingType: ListingType): PremiumFeatures {
  return PREMIUM_FEATURES[listingType] || PREMIUM_FEATURES.basic;
}

/**
 * Premium plan definitions
 */
export const PREMIUM_PLANS = {
  premium: {
    name: 'Premium Listing',
    description: 'Enhance visibility with premium placement in search results, phone and website display, and up to 5 photos.',
    monthlyPrice: 1999, // $19.99 per month
    annualPrice: 19999, // $199.99 per year (about 16% discount)
    features: [
      'Display phone number and website',
      'Higher placement in search results',
      'Upload up to 5 photos',
      'Detailed business information',
      'Enhanced business profile'
    ]
  },
  featured: {
    name: 'Featured Listing',
    description: 'Maximum visibility with featured listings on the homepage, highlighted appearance, and up to 10 photos.',
    monthlyPrice: 3999, // $39.99 per month
    annualPrice: 39999, // $399.99 per year (about 16% discount)
    features: [
      'All Premium Listing features',
      'Highlighted appearance in search results',
      'Featured placement on homepage',
      'Upload up to 10 photos',
      'Priority search ranking',
      'Special promotional text'
    ]
  }
};

/**
 * Calculate prorated refund amount
 * @param originalAmount Original amount paid (in cents)
 * @param startDate Subscription start date
 * @param endDate Subscription end date
 * @param cancelDate Date of cancellation
 * @returns Refund amount in cents
 */
export function calculateProratedRefund(
  originalAmount: number,
  startDate: Date,
  endDate: Date,
  cancelDate: Date = new Date()
): number {
  const totalDuration = endDate.getTime() - startDate.getTime();
  const remainingDuration = endDate.getTime() - cancelDate.getTime();
  
  // If already ended or invalid dates, no refund
  if (remainingDuration <= 0 || totalDuration <= 0) {
    return 0;
  }
  
  // Calculate prorated refund
  const refundRatio = remainingDuration / totalDuration;
  return Math.round(originalAmount * refundRatio);
}

/**
 * Check if a subscription is active
 * @param status Subscription status
 * @returns Boolean indicating if the subscription is considered active
 */
export function isSubscriptionActive(status: string | null): boolean {
  return status === 'active' || status === 'past_due';
}

/**
 * Get formatted price for display
 * @param amount Price in cents
 * @returns Formatted price string (e.g., "$19.99")
 */
export function formatPrice(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}