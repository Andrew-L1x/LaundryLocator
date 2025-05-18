/**
 * Comprehensive SEO keywords library for LaundryLocator
 * This file contains organized collections of keywords to be used
 * in meta tags, content generation, and schema markup
 */

// Primary keywords (highest search volume)
export const primaryKeywords = [
  'laundromat near me',
  'laundromats near me',
  'laundry near me',
];

// Service-related keywords
export const serviceKeywords = [
  'laundry service near me',
  'coin laundry near me',
  'drop off laundry near me',
  'wash and fold laundry service near me',
  'laundry pick up and delivery near me',
  'self service laundry near me',
  'laundry pick up and delivery near me',
  'drop off laundry service near me',
  'wash and fold laundry',
];

// Time-sensitive keywords
export const timeKeywords = [
  '24 hour laundry near me',
  '24 hour laundromat near me',
  '24 hr laundromat near me',
  'laundromat open near me',
  'laundromat near me open now',
  'laundry near me open now',
  'laundromat open late near me',
];

// Quality and price keywords
export const qualityPriceKeywords = [
  'best laundromat near me',
  'cheapest laundromat near me',
  'cheap laundromat near me',
  'clean laundromat near me',
  'affordable laundromat near me',
];

// Distance-based keywords
export const distanceKeywords = [
  'laundromat near me within 5 mi',
  'laundromat near me within 1 mi',
  'closest laundromat near me',
  'laundromat walking distance near me',
];

// Business-related keywords (for owners)
export const businessKeywords = [
  'laundromat for sale near me',
  'laundromat near me for sale',
  'laundry business for sale near me',
];

// Amenity-focused keywords
export const amenityKeywords = [
  'laundromat with wifi near me',
  'laundromat with free parking near me',
  'laundromat with big washers near me',
  'laundromat with dryers near me',
  'laundromat with large capacity washers',
  'laundromat with attendant near me',
];

// Payment-related keywords
export const paymentKeywords = [
  'laundromat that takes credit cards near me',
  'laundromat that takes coins near me',
  'laundromat with card payment near me',
  'laundromat with app payment near me',
];

/**
 * Get a set of keywords based on location and attributes
 * @param city - City name
 * @param state - State abbreviation
 * @param attributes - Optional laundromat attributes like '24hour', 'coinop', etc.
 * @returns Array of location-specific keywords
 */
export function getLocationKeywords(city: string, state: string, attributes?: string[]): string[] {
  const locationTerms = [
    `laundromat in ${city} ${state}`,
    `laundromats in ${city} ${state}`,
    `laundry service in ${city} ${state}`,
    `coin laundry in ${city} ${state}`,
    `self service laundry in ${city} ${state}`,
    `${city} ${state} laundromats`,
    `${city} laundromat`,
  ];
  
  // Add attribute-specific keywords if provided
  if (attributes && attributes.length > 0) {
    if (attributes.includes('24hour')) {
      locationTerms.push(
        `24 hour laundromat in ${city} ${state}`,
        `24/7 laundromat in ${city} ${state}`,
        `laundromat open late in ${city} ${state}`
      );
    }
    
    if (attributes.includes('coinop')) {
      locationTerms.push(
        `coin laundry in ${city} ${state}`,
        `coin operated laundromat in ${city} ${state}`
      );
    }
    
    if (attributes.includes('dropoff')) {
      locationTerms.push(
        `drop off laundry service in ${city} ${state}`,
        `wash and fold in ${city} ${state}`,
        `laundry service in ${city} ${state}`
      );
    }
    
    if (attributes.includes('cardpayment')) {
      locationTerms.push(
        `laundromat with card payment in ${city} ${state}`,
        `credit card laundromat in ${city} ${state}`
      );
    }

    if (attributes.includes('wifi')) {
      locationTerms.push(
        `laundromat with wifi in ${city} ${state}`,
        `laundromat with free wifi in ${city} ${state}`
      );
    }
  }
  
  return locationTerms;
}

/**
 * Get all keywords in a single array (useful for metadata)
 */
export function getAllKeywords(): string[] {
  return [
    ...primaryKeywords,
    ...serviceKeywords,
    ...timeKeywords,
    ...qualityPriceKeywords,
    ...distanceKeywords,
    ...amenityKeywords,
    ...paymentKeywords
  ];
}

/**
 * Generate meta keywords string for a specific page
 * @param pageType - Type of page ('home', 'city', 'business', etc.)
 * @param location - Location string (city, state) if applicable
 * @param attributes - Optional laundromat attributes
 */
export function generateMetaKeywords(pageType: string, location?: string, attributes?: string[]): string {
  let keywordSet: string[] = [];
  
  switch (pageType) {
    case 'home':
      keywordSet = [...primaryKeywords, ...serviceKeywords.slice(0, 3), ...timeKeywords.slice(0, 2)];
      break;
    case 'city':
      if (location) {
        const [city, state] = location.split(',').map(part => part.trim());
        keywordSet = getLocationKeywords(city, state, attributes);
      }
      keywordSet = [...keywordSet, ...primaryKeywords];
      break;
    case 'state':
      if (location) {
        keywordSet = [
          `laundromats in ${location}`,
          `${location} laundromats`,
          `laundry services in ${location}`,
          `coin laundry in ${location}`,
          ...primaryKeywords
        ];
      }
      break;
    case 'business':
      if (location) {
        const [city, state] = location.split(',').map(part => part.trim());
        keywordSet = [
          `laundromat in ${city}`,
          `${city} ${state} laundry service`,
          `laundromat near ${city}`,
          ...primaryKeywords
        ];
      }
      if (attributes) {
        if (attributes.includes('24hour')) {
          keywordSet.push(...timeKeywords);
        }
        if (attributes.includes('coinop')) {
          keywordSet.push('coin laundry', 'coin operated laundromat');
        }
      }
      break;
    default:
      keywordSet = primaryKeywords;
  }
  
  // Remove duplicates and join
  const keywordMap: {[key: string]: boolean} = {};
  keywordSet.forEach(keyword => {
    keywordMap[keyword] = true;
  });
  const uniqueKeywords = Object.keys(keywordMap);
  return uniqueKeywords.join(', ');
}