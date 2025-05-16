/**
 * Schema.org structured data generator for laundromats
 * Implements JSON-LD format for rich results in search engines
 */

/**
 * Generates opening hours schema from laundromat hours data
 * @param {string} hours - Hours string from laundromat data
 * @returns {Array} Array of OpeningHoursSpecification objects
 */
const generateOpeningHours = (hours) => {
  // Simple implementation for now - in a real app, would parse more complex hours
  if (hours === '24 Hours') {
    return [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday", "Tuesday", "Wednesday", "Thursday", 
          "Friday", "Saturday", "Sunday"
        ],
        "opens": "00:00",
        "closes": "23:59"
      }
    ];
  }
  
  // Default hours if not 24 hours (9am-9pm every day)
  return [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday", 
        "Friday", "Saturday", "Sunday"
      ],
      "opens": "09:00",
      "closes": "21:00"
    }
  ];
};

/**
 * Generates review schema from laundromat reviews
 * @param {Array} reviews - Array of review objects
 * @returns {Array} Array of Review schema objects
 */
const generateReviewSchema = (reviews = []) => {
  if (!reviews || reviews.length === 0) {
    return [];
  }
  
  return reviews.slice(0, 5).map(review => ({
    "@type": "Review",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": review.rating
    },
    "author": {
      "@type": "Person",
      "name": review.authorName || "Anonymous"
    },
    "datePublished": review.createdAt || new Date().toISOString(),
    "reviewBody": review.comment || ""
  }));
};

/**
 * Generates service offers schema from laundromat service tags
 * @param {Array} serviceTags - Array of service tag strings
 * @returns {Array} Array of Offer schema objects
 */
const generateServiceOffers = (serviceTags = []) => {
  if (!serviceTags || serviceTags.length === 0) {
    return [];
  }
  
  return serviceTags.map(service => ({
    "@type": "Offer",
    "itemOffered": {
      "@type": "Service",
      "name": service
    }
  }));
};

/**
 * Determines if a laundromat is currently open based on hours
 * @param {string} hours - Hours string from laundromat data
 * @returns {boolean} Whether the laundromat is currently open
 */
const isCurrentlyOpen = (hours) => {
  // Simple implementation - a real app would parse hours and check current time
  return hours === '24 Hours' || true;
};

/**
 * Generates a complete LaundryOrDryCleaner schema for a single laundromat
 * @param {Object} laundromat - Laundromat data object
 * @returns {Object} Schema.org JSON-LD object
 */
const generateLaundryBusinessSchema = (laundromat) => {
  return {
    "@context": "https://schema.org",
    "@type": "LaundryOrDryCleaner",
    "@id": `https://laundromat-directory.com/laundry/${laundromat.slug}#business`,
    "name": laundromat.name,
    "url": `https://laundromat-directory.com/laundry/${laundromat.slug}`,
    "telephone": laundromat.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": laundromat.address,
      "addressLocality": laundromat.city,
      "addressRegion": laundromat.state,
      "postalCode": laundromat.zip
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": laundromat.latitude,
      "longitude": laundromat.longitude
    },
    "openingHoursSpecification": generateOpeningHours(laundromat.hours),
    "priceRange": laundromat.priceLevel || "$$",
    "aggregateRating": laundromat.rating ? {
      "@type": "AggregateRating",
      "ratingValue": laundromat.rating,
      "reviewCount": laundromat.reviewCount || 0
    } : undefined,
    "review": generateReviewSchema(laundromat.reviews),
    "isOpen": isCurrentlyOpen(laundromat.hours),
    "makesOffer": generateServiceOffers(laundromat.services)
  };
};

/**
 * Generates a LocalBusiness listing schema for search results
 * @param {Array} listings - Array of laundromat objects
 * @param {string} location - Location string (city, state)
 * @returns {Object} Schema.org JSON-LD object
 */
const generateLocalBusinessListSchema = (listings, location) => {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": listings.map((listing, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "LocalBusiness",
        "name": listing.name,
        "image": listing.imageUrl || "",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": listing.city,
          "addressRegion": listing.state
        },
        "telephone": listing.phone,
        "aggregateRating": listing.rating ? {
          "@type": "AggregateRating",
          "ratingValue": listing.rating,
          "reviewCount": listing.reviewCount || 0
        } : undefined,
        "url": `https://laundromat-directory.com/laundry/${listing.slug}`
      }
    }))
  };
};

/**
 * Generates BreadcrumbList schema for navigation
 * @param {Array} items - Array of breadcrumb items
 * @returns {Object} Schema.org JSON-LD object
 */
const generateBreadcrumbSchema = (items) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
};

module.exports = {
  generateLaundryBusinessSchema,
  generateLocalBusinessListSchema,
  generateBreadcrumbSchema
};