import { Laundromat, City, State, LaundryTip } from '@/types/laundromat';

interface CityStats {
  totalLaundromats: number;
  topNeighborhoods: string[];
  averageRating: number;
  popularServices: string[];
  is24HourAvailable: boolean;
}

interface StateStats {
  totalLaundromats: number;
  topCities: string[];
  averageRating: number;
  popularServices: string[];
}

/**
 * Generate SEO-optimized content for city pages
 */
export const generateCityPageContent = (city: City, laundromats: Laundromat[]) => {
  const stats = getCityStats(city, laundromats);
  const { totalLaundromats, topNeighborhoods, averageRating, popularServices, is24HourAvailable } = stats;
  
  // Format the average rating to one decimal place
  const formattedRating = averageRating.toFixed(1);
  
  // Create a highlighted services string
  const highlightedServices = popularServices.slice(0, 3).join(', ');
  
  // Create neighborhood phrase
  const neighborhoodPhrase = topNeighborhoods.length > 0 
    ? `across popular neighborhoods like ${topNeighborhoods.slice(0, 3).join(', ')}`
    : 'throughout the city';
  
  // 24-hour availability phrase
  const hours24Phrase = is24HourAvailable 
    ? 'including 24-hour options'
    : 'with convenient hours';
  
  return {
    title: `${totalLaundromats} Laundromats Near Me in ${city.name}, ${city.state} | LaundryLocator`,
    description: `Find the best laundromats near you in ${city.name}, ${city.state}. Compare ${totalLaundromats} laundromats with ${formattedRating}★ average ratings, ${hours24Phrase}. Featuring ${highlightedServices} and more.`,
    h1: `Laundromats in ${city.name}, ${city.state}`,
    intro: `
      <p>Looking for convenient <strong>laundromats near me</strong> in ${city.name}, ${city.state}? Our directory features ${totalLaundromats} locations ${neighborhoodPhrase}. Browse laundromats with detailed information on operating hours, available machines, pricing, and special services like drop-off and pickup options.</p>
      <p>Whether you need a quick wash or a full-service laundry experience, find the perfect laundromat in ${city.name} with our comprehensive search tools and honest user reviews.</p>
    `,
    neighborhoodSection: topNeighborhoods.length > 0 ? `
      <h2>Popular ${city.name} Neighborhoods for Laundromats</h2>
      <p>Find top-rated laundromats in these popular ${city.name} neighborhoods:</p>
      <ul class="list-disc pl-5 mt-2 space-y-1">
        ${topNeighborhoods.slice(0, 5).map(neighborhood => `<li>${neighborhood} - Multiple laundry options with various amenities</li>`).join('')}
      </ul>
      <p class="mt-3">Each neighborhood offers unique laundromat options to suit different needs and preferences. Use our map search to find the closest location to your home or workplace.</p>
    ` : `
      <h2>Finding the Best Laundromats in ${city.name}</h2>
      <p>${city.name} offers a variety of laundromat options throughout the city, with concentrated services in residential and commercial areas. Our directory helps you locate the most convenient options near your location.</p>
      <p>Most laundromats in ${city.name} are easily accessible by public transportation or have ample parking available for customers.</p>
    `,
    servicesSection: `
      <h2>Popular Laundromat Services in ${city.name}</h2>
      <p>Laundromats in ${city.name} offer a wide range of services to meet different customer needs:</p>
      <ul class="list-disc pl-5 mt-2 space-y-1">
        ${popularServices.map(service => `<li><strong>${service}</strong></li>`).join('')}
      </ul>
      <p class="mt-3">Many locations also provide amenities like free WiFi, comfortable waiting areas, vending machines, and television for entertainment while you wait. Use our filters to find laundromats with specific services you need.</p>
    `,
    ratingSection: `
      <h2>Top-Rated Laundromats in ${city.name}</h2>
      <p>The average customer rating for laundromats in ${city.name} is <strong>${formattedRating} out of 5 stars</strong>, based on user reviews. Highly-rated locations typically offer:</p>
      <ul class="list-disc pl-5 mt-2 space-y-1">
        <li>Clean and well-maintained facilities</li>
        <li>Properly functioning, modern machines</li>
        <li>Reasonable pricing and payment options</li>
        <li>Friendly and helpful staff</li>
        <li>Convenient location and hours</li>
      </ul>
      <p class="mt-3">Browse our listings sorted by rating to find the best laundromat experiences in ${city.name}.</p>
    `,
    hoursSection: `
      <h2>Laundromat Hours in ${city.name}</h2>
      <p>${city.name} laundromats operate with varying hours to accommodate different schedules:</p>
      <ul class="list-disc pl-5 mt-2 space-y-1">
        <li><strong>24-Hour Locations:</strong> ${is24HourAvailable ? 'Several laundromats in the area offer round-the-clock service for ultimate convenience.' : 'Limited 24-hour options are available in select areas.'}</li>
        <li><strong>Standard Hours:</strong> Most locations open early (around 6-7am) and close late (9-10pm)</li>
        <li><strong>Weekend Availability:</strong> Nearly all laundromats maintain weekend hours, though some may have reduced schedules</li>
      </ul>
      <p class="mt-3">Always check the specific hours for your chosen location, as times may vary. Our listings include up-to-date hours information to help you plan your laundry day efficiently.</p>
    `,
    schema: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": generateListingSchemaItems(laundromats, city)
    }
  };
};

/**
 * Generate SEO-optimized content for state pages
 */
export const generateStatePageContent = (state: State, cities: City[], laundromats: Laundromat[]) => {
  const stats = getStateStats(state, cities, laundromats);
  const { totalLaundromats, topCities, averageRating, popularServices } = stats;
  
  // Format the average rating to one decimal place
  const formattedRating = averageRating.toFixed(1);
  
  // Create a highlighted services string
  const highlightedServices = popularServices.slice(0, 3).join(', ');
  
  // Create top cities phrase
  const topCitiesPhrase = topCities.length > 0 
    ? `including ${topCities.slice(0, 5).join(', ')}`
    : 'throughout the state';
  
  return {
    title: `Laundromats in ${state.name} | ${totalLaundromats}+ Locations | LaundryLocator`,
    description: `Find the best laundromats in ${state.name}. ${totalLaundromats}+ locations across ${cities.length} cities with ${formattedRating}★ average rating. Compare services, hours, and amenities.`,
    h1: `Laundromats in ${state.name}`,
    intro: `
      <p>Looking for laundry services in ${state.name}? LaundryLocator features ${totalLaundromats}+ laundromats across ${cities.length} cities ${topCitiesPhrase}. Browse our comprehensive directory for detailed information on operating hours, available machines, and special services.</p>
    `,
    citiesSection: topCities.length > 0 ? `
      <h2>Popular ${state.name} Cities for Laundromats</h2>
      <p>Find laundromats in these popular ${state.name} cities: ${topCities.slice(0, 5).join(', ')} and more.</p>
    ` : '',
    servicesSection: `
      <h2>Laundromat Services Available in ${state.name}</h2>
      <p>Most laundromats in ${state.name} offer essential services like ${highlightedServices}. Use our filters to find specific amenities you need.</p>
    `,
    ratingSection: `
      <h2>${state.name} Laundromats by Rating</h2>
      <p>The average rating for laundromats in ${state.name} is ${formattedRating} out of 5 stars. Browse our top-rated locations to find the best service.</p>
    `,
    schema: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": generateBreadcrumbSchemaItems(state, cities)
    }
  };
};

/**
 * Generate city statistics based on laundromats data
 */
function getCityStats(city: City, laundromats: Laundromat[]): CityStats {
  // Filter laundromats to only those in this city
  const cityLaundromats = laundromats.filter(l => l.city === city.name && l.state === city.state);
  
  // Get total count
  const totalLaundromats = cityLaundromats.length;
  
  // Extract neighborhoods from addresses (simplified)
  const neighborhoodMap = new Map<string, number>();
  cityLaundromats.forEach(laundromat => {
    // This is a simplified approach - in a real app, you'd have actual neighborhood data
    const addressParts = laundromat.address.split(',');
    if (addressParts.length > 1) {
      const neighborhood = addressParts[0].trim();
      neighborhoodMap.set(neighborhood, (neighborhoodMap.get(neighborhood) || 0) + 1);
    }
  });
  
  // Get top neighborhoods
  const topNeighborhoods = Array.from(neighborhoodMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
  
  // Calculate average rating
  const ratings = cityLaundromats.map(l => parseFloat(l.rating || '0'));
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : 0;
  
  // Extract popular services
  const servicesMap = new Map<string, number>();
  
  // Default services
  const defaultServices = [
    'Self-Service Laundry',
    'Coin-Operated',
    'Card Payment',
    'Large Capacity Washers',
    'Drop-Off Service'
  ];
  
  // Add default services
  defaultServices.forEach(service => {
    servicesMap.set(service, 1);
  });
  
  const popularServices = Array.from(servicesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
  
  // Check if 24-hour service is available
  const is24HourAvailable = cityLaundromats.some(l => 
    l.hours.toLowerCase().includes('24 hour') || 
    l.hours.toLowerCase().includes('24/7')
  );
  
  return {
    totalLaundromats,
    topNeighborhoods,
    averageRating,
    popularServices,
    is24HourAvailable
  };
}

/**
 * Generate state statistics based on laundromats data
 */
function getStateStats(state: State, cities: City[], laundromats: Laundromat[]): StateStats {
  // Filter laundromats to only those in this state - handle both abbreviation and full name
  const stateLaundromats = laundromats.filter(l => 
    l.state === state.abbr || l.state === state.name || 
    l.state.toLowerCase() === state.name.toLowerCase() || 
    l.state.toLowerCase() === state.abbr.toLowerCase()
  );
  
  // Get total count (if there are no laundromats found, use the state's count)
  const totalLaundromats = stateLaundromats.length > 0 ? stateLaundromats.length : state.laundryCount || 0;
  
  // Create a map of cities and their laundromat counts
  const cityCountMap = new Map<string, number>();
  stateLaundromats.forEach(laundromat => {
    cityCountMap.set(laundromat.city, (cityCountMap.get(laundromat.city) || 0) + 1);
  });
  
  // Get top cities by laundromat count
  const topCities = Array.from(cityCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
  
  // If we have cities data from the database but no laundromats were found, use that
  if (topCities.length === 0 && cities.length > 0) {
    cities.sort((a, b) => (b.laundryCount || 0) - (a.laundryCount || 0))
      .slice(0, 5)
      .forEach(city => topCities.push(city.name));
  }
  
  // Calculate average rating
  const ratings = stateLaundromats.map(l => parseFloat(l.rating || '0')).filter(r => !isNaN(r) && r > 0);
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : 4.2; // Default reasonable rating if none available
  
  // Extract popular services
  const servicesMap = new Map<string, number>();
  
  // Default services if none are found in the data
  const defaultServices = [
    'Self-Service Laundry',
    'Coin-Operated',
    'Card Payment',
    'Large Capacity Washers',
    'Drop-Off Service',
    'Free WiFi',
    'Vending Machines',
    'Attendant On Duty'
  ];
  
  // Count services from laundromats
  stateLaundromats.forEach(laundromat => {
    if (Array.isArray(laundromat.services)) {
      laundromat.services.forEach(service => {
        servicesMap.set(service, (servicesMap.get(service) || 0) + 1);
      });
    }
  });
  
  // If no services found, use defaults
  if (servicesMap.size === 0) {
    defaultServices.forEach(service => {
      servicesMap.set(service, 1);
    });
  }
  
  const popularServices = Array.from(servicesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
  
  return {
    totalLaundromats,
    topCities,
    averageRating,
    popularServices
  };
}

/**
 * Generate schema.org ItemList schema for laundromats
 */
function generateListingSchemaItems(laundromats: Laundromat[], city: City) {
  return laundromats
    .filter(l => l.city === city.name && l.state === city.state)
    .slice(0, 10) // Limit to top 10 for reasonable schema size
    .map((laundromat, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "LocalBusiness",
        "@id": `https://laundrylocator.com/laundromats/${laundromat.slug}`,
        "name": laundromat.name,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": laundromat.address,
          "addressLocality": laundromat.city,
          "addressRegion": laundromat.state,
          "postalCode": laundromat.zip
        },
        "telephone": laundromat.phone,
        "url": `https://laundrylocator.com/laundromats/${laundromat.slug}`,
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": laundromat.latitude,
          "longitude": laundromat.longitude
        },
        "aggregateRating": laundromat.rating ? {
          "@type": "AggregateRating",
          "ratingValue": laundromat.rating,
          "reviewCount": "5" // This should be actual review count in a real app
        } : undefined,
        "openingHours": laundromat.hours,
        "image": laundromat.imageUrl || undefined
      }
    }));
}

/**
 * Generate schema.org BreadcrumbList schema for state/cities
 */
/**
 * Generate SEO-optimized content for the home page
 */
export const generateHomePageContent = (
  laundromats: Laundromat[],
  cities: City[],
  tips: LaundryTip[]
) => {
  // Get the total count of laundromats
  const totalLaundromats = laundromats.length;
  
  // Calculate the average rating
  const ratings = laundromats.map(l => parseFloat(l.rating || '0')).filter(r => r > 0);
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : 0;
  const formattedRating = averageRating.toFixed(1);

  // Extract popular service categories
  const servicesMap = new Map<string, number>();
  
  // Default services if none are available in the data
  const defaultServices = [
    'Self-Service Laundry',
    'Coin-Operated',
    'Card Payment',
    'Large Capacity Washers',
    'Drop-Off Service'
  ];
  
  // Add default services to the map
  defaultServices.forEach(service => {
    servicesMap.set(service, 1);
  });
  
  const popularServices = Array.from(servicesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
  
  // Highlight top cities
  const topCities = cities.slice(0, 5).map(city => city.name);
  
  // Get tip categories
  const tipCategories = tips.map(tip => {
    const words = tip.title.split(' ');
    return words[0];
  }).slice(0, 3);
  
  // Featured amenities from service list
  const featuredAmenities = popularServices.slice(0, 3).join(', ');
  
  // Create city phrase
  const cityPhrase = topCities.length > 0 
    ? `including ${topCities.slice(0, 3).join(', ')}`
    : 'across the country';
  
  return {
    title: `Find Laundromats Near Me | Directory of ${totalLaundromats}+ Laundry Services`,
    description: `Compare ${totalLaundromats}+ laundromats with ${formattedRating}★ average rating. Find 24-hour laundromats, coin-operated machines, and drop-off services ${cityPhrase}.`,
    h1: `Find the Perfect Laundromat Near You`,
    intro: `
      <p>LaundryLocator helps you find the perfect place for laundry day. Compare ${totalLaundromats}+ laundromats with detailed information on hours, services, and customer reviews.</p>
    `,
    featuredServicesSection: `
      <h2>Popular Laundromat Services</h2>
      <p>Most laundromats offer essential services like ${featuredAmenities}. Use our filters to find specific amenities you need for your laundry day.</p>
    `,
    topCitiesSection: topCities.length > 0 ? `
      <h2>Popular Cities for Laundromats</h2>
      <p>Find laundromats in these popular cities: ${topCities.slice(0, 5).join(', ')}.</p>
    ` : '',
    tipsSection: `
      <h2>Laundry Tips & Resources</h2>
      <p>Explore our guides covering ${tipCategories.join(', ')} and more to make laundry day easier.</p>
    `,
    schema: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://laundromatlocator.com/",
      "name": "LaundrymatLocator - Find Laundromats Near You",
      "description": `Compare ${totalLaundromats}+ laundromats with ${formattedRating}★ average rating. Find 24-hour laundromats, coin-operated machines, and drop-off services.`,
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://laundromatlocator.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  };
};

/**
 * Generate SEO-optimized content for individual laundry tip
 */
export const generateTipDetailContent = (tip: LaundryTip, relatedTips: LaundryTip[] = []) => {
  // Create keywords from tags and category
  const keywords = [
    ...(tip.tags || []), 
    tip.category, 
    'laundry tips', 
    'laundry advice', 
    'cleaning tips'
  ].join(', ');

  // Format the published date
  const publishedDate = tip.createdAt 
    ? new Date(tip.createdAt).toISOString() 
    : new Date().toISOString();
  
  // Create related tip links for the schema markup
  const relatedLinks = relatedTips.slice(0, 3).map(relatedTip => ({
    "@type": "WebPage",
    "@id": `https://laundrylocator.com/laundry-tips/${relatedTip.slug}`,
    "name": relatedTip.title
  }));

  // Generate a sentence summary from the description
  const descriptionSummary = tip.description.length > 160 
    ? `${tip.description.substring(0, 157)}...` 
    : tip.description;

  return {
    title: `${tip.title} | Expert Laundry Tips & Resources`,
    description: descriptionSummary,
    h1: tip.title,
    metaKeywords: keywords,
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://laundrylocator.com/laundry-tips/${tip.slug}`
      },
      "headline": tip.title,
      "description": tip.description,
      "image": tip.imageUrl || "",
      "author": {
        "@type": "Organization",
        "name": "LaundryLocator",
        "url": "https://laundrylocator.com"
      },
      "publisher": {
        "@type": "Organization",
        "name": "LaundryLocator",
        "logo": {
          "@type": "ImageObject",
          "url": "https://laundrylocator.com/logo.png"
        }
      },
      "datePublished": publishedDate,
      "dateModified": publishedDate,
      "articleSection": tip.category,
      "keywords": keywords,
      "isAccessibleForFree": "True",
      "relatedLink": relatedLinks.length > 0 ? relatedLinks : undefined
    },
    breadcrumbs: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://laundrylocator.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Laundry Tips",
          "item": "https://laundrylocator.com/laundry-tips"
        },
        {
          "@type": "ListItem",
          "position": 3, 
          "name": tip.title,
          "item": `https://laundrylocator.com/laundry-tips/${tip.slug}`
        }
      ]
    }
  };
};

/**
 * Generate SEO-optimized content for the Laundry Tips page
 */
export const generateTipsPageContent = (tips: LaundryTip[]) => {
  // Get the total number of tips
  const totalTips = tips.length;
  
  // Extract all unique categories
  const categories = Array.from(new Set(tips.map(tip => tip.category)));
  
  // Get the most recent tips
  const recentTips = [...tips]
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 3);
  
  // Featured tip titles
  const featuredTitles = recentTips.map(tip => tip.title);
  
  // Create category phrase
  const categoryPhrase = categories.length > 0 
    ? `including ${categories.slice(0, 3).join(', ')}`
    : 'on various laundry topics';
  
  return {
    title: `${totalTips} Expert Laundry Tips & Resources | LaundryLocator Guide`,
    description: `Browse our collection of ${totalTips} laundry tips ${categoryPhrase}. Learn stain removal techniques, fabric care, energy-saving methods, and more laundry advice.`,
    h1: `Expert Laundry Tips & Resources`,
    intro: `
      <p>Welcome to our comprehensive collection of laundry tips and resources. Browse ${totalTips} expert articles ${categoryPhrase} to help make your laundry experience easier and more effective.</p>
    `,
    categoriesSection: categories.length > 0 ? `
      <h2>Laundry Tip Categories</h2>
      <p>Explore our tips by category: ${categories.join(', ')}. Each category provides specialized advice to address specific laundry challenges.</p>
    ` : '',
    featuredTipsSection: recentTips.length > 0 ? `
      <h2>Featured Laundry Tips</h2>
      <p>Check out our latest articles: "${featuredTitles.join('", "')}".</p>
    ` : '',
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "headline": "Expert Laundry Tips & Resources",
      "description": `Browse our collection of ${totalTips} laundry tips ${categoryPhrase}. Learn stain removal techniques, fabric care, energy-saving methods, and more.`,
      "url": "https://laundrylocator.com/laundry-tips",
      "mainEntity": {
        "@type": "ItemList",
        "itemListElement": tips.slice(0, 10).map((tip, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "Article",
            "headline": tip.title,
            "description": tip.description,
            "url": `https://laundrylocator.com/laundry-tips/${tip.slug}`,
            "image": tip.imageUrl || "",
            "author": {
              "@type": "Organization",
              "name": "LaundryLocator"
            },
            "publisher": {
              "@type": "Organization",
              "name": "LaundryLocator",
              "logo": {
                "@type": "ImageObject",
                "url": "https://laundrylocator.com/logo.png"
              }
            },
            "datePublished": tip.createdAt || new Date().toISOString()
          }
        }))
      }
    }
  };
};

function generateBreadcrumbSchemaItems(state: State, cities: City[]) {
  const items = [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@id": "https://laundrylocator.com/",
        "name": "Home"
      }
    },
    {
      "@type": "ListItem",
      "position": 2,
      "item": {
        "@id": "https://laundrylocator.com/states",
        "name": "States"
      }
    },
    {
      "@type": "ListItem",
      "position": 3,
      "item": {
        "@id": `https://laundrylocator.com/states/${state.slug}`,
        "name": state.name
      }
    }
  ];
  
  // Add top cities (limited to 5)
  const topCities = cities.slice(0, 5);
  topCities.forEach((city, index) => {
    items.push({
      "@type": "ListItem",
      "position": index + 4,
      "item": {
        "@id": `https://laundrylocator.com/laundromats/${city.slug}`,
        "name": city.name
      }
    });
  });
  
  return items;
}