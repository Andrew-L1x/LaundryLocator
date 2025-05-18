import { useEffect } from 'react';

interface MetaTagsProps {
  pageType?: 'home' | 'city' | 'state' | 'service' | 'business' | 'tips' | 'tip-detail' | 'all-states' | 'admin';
  title: string;
  description: string;
  location?: string;
  service?: string;
  qualifier?: string;
  imageUrl?: string;
  canonicalUrl?: string;
  keywords?: string;
  noIndex?: boolean;
}

/**
 * Component to handle SEO metadata for pages
 */
const MetaTags = (props: MetaTagsProps) => {
  const {
    pageType,
    title,
    description,
    location,
    service,
    qualifier,
    imageUrl,
    canonicalUrl,
    keywords,
    noIndex
  } = props;
  const baseUrl = 'https://laundromat-directory.com';
  const fullCanonicalUrl = canonicalUrl ? `${baseUrl}${canonicalUrl}` : window.location.href;
  const defaultImageUrl = `${baseUrl}/images/default-og-image.jpg`;
  
  // Set default title and description if not provided
  const pageTitle = title || generateSeoTitle(pageType || 'home', location || '', service || '', qualifier || '');
  const pageDescription = description || generateSeoDescription(pageType || 'home', location || '', service || '', qualifier || '');
  
  // Inject meta tags into document head
  useEffect(() => {
    // Set title
    document.title = pageTitle;
    
    // Update meta tags
    updateMetaTag('description', pageDescription);
    updateMetaTag('og:title', pageTitle);
    updateMetaTag('og:description', pageDescription);
    updateMetaTag('og:image', imageUrl || defaultImageUrl);
    updateMetaTag('og:url', fullCanonicalUrl);
    updateMetaTag('og:type', 'website');
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', pageTitle);
    updateMetaTag('twitter:description', pageDescription);
    updateMetaTag('twitter:image', imageUrl || defaultImageUrl);
    
    // Add keywords if provided
    if (keywords) {
      updateMetaTag('keywords', keywords);
    }
    
    // Add robots meta tag if noIndex is true
    if (noIndex) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateMetaTag('robots', 'index, follow');
    }
    
    // Update canonical link
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', fullCanonicalUrl);
    
  }, [pageTitle, pageDescription, imageUrl, fullCanonicalUrl, keywords, noIndex]);
  
  return null; // This component doesn't render anything visible
};

/**
 * Updates or creates a meta tag
 */
function updateMetaTag(name: string, content: string) {
  // First, try to find an existing tag
  let metaTag;
  if (name.startsWith('og:')) {
    metaTag = document.querySelector(`meta[property="${name}"]`);
  } else {
    metaTag = document.querySelector(`meta[name="${name}"]`);
  }
  
  // If tag doesn't exist, create it
  if (!metaTag) {
    metaTag = document.createElement('meta');
    if (name.startsWith('og:')) {
      metaTag.setAttribute('property', name);
    } else {
      metaTag.setAttribute('name', name);
    }
    document.head.appendChild(metaTag);
  }
  
  // Set content
  metaTag.setAttribute('content', content);
}

/**
 * Generates an SEO-optimized title based on page context
 */
function generateSeoTitle(
  pageType: string, 
  location?: string, 
  service?: string, 
  qualifier?: string
): string {
  const prefix = qualifier ? `${qualifier} ` : '';
  const serviceText = service ? `${service} ` : 'Laundromats ';
  const locationText = location ? `in ${location}` : 'Near Me';
  const suffix = ' | LaundryLocator';
  
  switch (pageType) {
    case 'home':
      return 'Laundromat Near Me | Find 24/7 Coin & Self-Service Laundromats';
    case 'city':
      return `${prefix}${serviceText}${locationText} | Open 24hr, Coin Laundry${suffix}`;
    case 'state':
      return `Top Rated Laundromats in ${location} | Local Laundry Services${suffix}`;
    case 'service':
      return `${prefix}${serviceText}${locationText} | 24-Hour Service${suffix}`;
    case 'business':
      return `${location} | Hours, Directions & Services${suffix}`;
    case 'tips':
      return 'Laundry Tips & Resources | Expert Advice for Better Laundry';
    case 'tip-detail':
      return `${location || 'Laundry Tip'} | Laundry Tips & Resources`;
    case 'all-states':
      return 'Browse Laundromats by State | Find Laundry Services Across the USA';
    default:
      return `Find Laundromats Near Me | Open 24/7 | LaundryLocator`;
  }
}

/**
 * Generates an SEO-optimized description based on page context
 */
function generateSeoDescription(
  pageType: string, 
  location?: string, 
  service?: string, 
  qualifier?: string
): string {
  const prefix = qualifier ? `${qualifier} ` : '';
  const serviceText = service ? `${service} ` : 'laundromats ';
  const locationText = location ? `in ${location}` : 'near you';
  
  switch (pageType) {
    case 'home':
      return 'Find laundromat near me with coin machines, 24-hour service, and affordable prices. Search by ZIP code or current location to discover the closest laundromats with ratings and reviews.';
    case 'city':
      return `Discover ${prefix}${serviceText}${locationText} with our complete directory. Compare Google ratings, business hours, payment options, and amenities for all local laundry facilities in your area.`;
    case 'state':
      return `Comprehensive directory of ${prefix}laundromats across ${location}. Find locations with coin-operated machines, card payment options, 24-hour access, drop-off service, and free WiFi.`;
    case 'service':
      return `Find ${prefix}${serviceText}${locationText} with our interactive map. Filter by distance, Google ratings, and amenities like WiFi, ATM, vending machines, and folding stations for your laundry needs.`;
    case 'business':
      return `View hours, services, Google ratings, and directions for ${location}. See pricing, available machines, payment methods, and nearby restaurants or shops to visit while your laundry runs.`;
    case 'tips':
      return 'Learn expert laundry tips and tricks for stain removal, fabric care, energy-saving methods, and more. Get the most out of your laundry experience with our helpful resources and step-by-step guides.';
    case 'tip-detail':
      return location || 'Discover professional advice and step-by-step instructions for better laundry results. Learn techniques to keep your clothes clean, fresh, and looking new longer with our expert laundry guides.';
    case 'all-states':
      return 'Explore our comprehensive directory of laundromats across all 50 states. Find self-service laundry facilities, coin laundries, and drop-off services sorted by location, ratings, and amenities.';
    default:
      return 'Find local laundromats with our comprehensive directory. Compare Google ratings, services, hours, and pricing for the best laundry experience in your neighborhood.';
  }
}

export default MetaTags;