import React from 'react';

interface MetaTagsProps {
  pageType: 'home' | 'city' | 'state' | 'service' | 'business';
  title: string;
  description: string;
  location?: string;
  service?: string;
  qualifier?: string;
  imageUrl?: string;
  canonicalUrl?: string;
}

/**
 * Component to handle SEO metadata for pages
 */
const MetaTags: React.FC<MetaTagsProps> = ({
  pageType,
  title,
  description,
  location,
  service,
  qualifier,
  imageUrl,
  canonicalUrl,
}) => {
  const baseUrl = 'https://laundromat-directory.com';
  const fullCanonicalUrl = canonicalUrl ? `${baseUrl}${canonicalUrl}` : window.location.href;
  const defaultImageUrl = `${baseUrl}/images/default-og-image.jpg`;
  
  // Set default title and description if not provided
  const pageTitle = title || generateSeoTitle(pageType, location, service, qualifier);
  const pageDescription = description || generateSeoDescription(pageType, location, service, qualifier);
  
  // Inject meta tags into document head
  React.useEffect(() => {
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
    
    // Update canonical link
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', fullCanonicalUrl);
    
    // Clean up
    return () => {
      // No need to clean up as pages will update their own meta tags
    };
  }, [pageTitle, pageDescription, imageUrl, fullCanonicalUrl]);
  
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
  const suffix = ' | Laundromat Directory';
  
  switch (pageType) {
    case 'home':
      return 'Find Laundromats Near Me | Laundromat Directory';
    case 'city':
      return `${prefix}${serviceText}${locationText}${suffix}`;
    case 'state':
      return `Top Laundromats in ${location}${suffix}`;
    case 'service':
      return `${prefix}${serviceText}${locationText}${suffix}`;
    case 'business':
      return `${location} - Hours, Services & Reviews${suffix}`;
    default:
      return `Find Laundromats Near Me | Laundromat Directory`;
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
      return 'Find clean, affordable laundromats near you. Compare prices, hours, services, and reviews to find the perfect place for laundry day.';
    case 'city':
      return `Discover ${prefix}${serviceText}${locationText}. Compare pricing, amenities, and reviews for all local laundry facilities in your area.`;
    case 'state':
      return `Comprehensive directory of laundromats across ${location}. Find locations with coin-operated machines, drop-off service, and more.`;
    case 'service':
      return `Find ${prefix}${serviceText}${locationText}. Sort by distance, ratings, and amenities to find the best option for your laundry needs.`;
    case 'business':
      return `View hours, services, prices, and customer reviews for ${location}. Get directions and see if they offer wash and fold, drop-off, or self-service options.`;
    default:
      return 'Find local laundromats with our comprehensive directory. Compare services, hours, and pricing for a better laundry experience.';
  }
}

export default MetaTags;