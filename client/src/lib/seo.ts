import { Laundromat, City, State } from '@/types/laundromat';

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
    title: `${totalLaundromats} Laundromats in ${city.name}, ${city.state} | LaundryLocator`,
    description: `Find the best laundry services in ${city.name}. Compare ${totalLaundromats} laundromats with ${formattedRating}★ average rating, ${hours24Phrase}. Easy access to ${highlightedServices} and more.`,
    h1: `Laundromats in ${city.name}, ${city.state}`,
    intro: `
      <p>Looking for convenient laundry services in ${city.name}? LaundryLocator helps you find the perfect laundromat with ${totalLaundromats} locations ${neighborhoodPhrase}. Our directory provides detailed information including operating hours, available machines, and special services.</p>
    `,
    neighborhoodSection: topNeighborhoods.length > 0 ? `
      <h2>Popular ${city.name} Neighborhoods for Laundromats</h2>
      <p>Discover top-rated laundromats in popular ${city.name} areas including ${topNeighborhoods.slice(0, 3).join(', ')} and more.</p>
    ` : '',
    servicesSection: `
      <h2>Laundromat Services Available in ${city.name}</h2>
      <p>Most laundromats in ${city.name} offer essential services like ${highlightedServices}. Use our filters to find specific amenities you need for your laundry day.</p>
    `,
    ratingSection: `
      <h2>${city.name} Laundromats by Rating</h2>
      <p>The average rating for laundromats in ${city.name} is ${formattedRating} out of 5 stars. Browse our top-rated locations to find the best service.</p>
    `,
    hoursSection: `
      <h2>Laundromat Hours in ${city.name}</h2>
      <p>Find laundromats in ${city.name} ${hours24Phrase}. Filter by operating hours to find locations open when you need them.</p>
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
  cityLaundromats.forEach(laundromat => {
    laundromat.services.forEach(service => {
      servicesMap.set(service, (servicesMap.get(service) || 0) + 1);
    });
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
  // Filter laundromats to only those in this state
  const stateLaundromats = laundromats.filter(l => l.state === state.abbreviation);
  
  // Get total count
  const totalLaundromats = stateLaundromats.length;
  
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
  
  // Calculate average rating
  const ratings = stateLaundromats.map(l => parseFloat(l.rating || '0'));
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : 0;
  
  // Extract popular services
  const servicesMap = new Map<string, number>();
  stateLaundromats.forEach(laundromat => {
    laundromat.services.forEach(service => {
      servicesMap.set(service, (servicesMap.get(service) || 0) + 1);
    });
  });
  
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