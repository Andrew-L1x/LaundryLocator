import React from 'react';
import { Laundromat } from '@shared/schema';

interface SchemaMarkupProps {
  type: 'business' | 'list' | 'breadcrumb' | 'Article' | 'CollectionPage';
  data: any; // Laundromat or Laundromat[] or breadcrumb items or article/page data
  location?: string;
}

/**
 * Component that renders structured data as JSON-LD script
 */
const SchemaMarkup: React.FC<SchemaMarkupProps> = ({ type, data, location }) => {
  let schemaData: any = null;

  const generateOpeningHours = (hours: string) => {
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

  const generateBusiness = (laundromat: Laundromat) => {
    // Format payment methods for better display
    const paymentMethods = [];
    // Get payment methods from services array if they contain payment-related terms
    if (laundromat.services && Array.isArray(laundromat.services)) {
      const paymentKeywords = ['coin', 'card', 'credit', 'debit', 'cash', 'pay', 'payment'];
      laundromat.services.forEach(service => {
        if (typeof service === 'string' && paymentKeywords.some(keyword => service.toLowerCase().includes(keyword))) {
          paymentMethods.push(service);
        }
      });
    }
    
    // Format services for display
    const services = [];
    if (laundromat.services) {
      if (typeof laundromat.services === 'string') {
        try {
          const parsedServices = JSON.parse(laundromat.services);
          if (Array.isArray(parsedServices)) {
            services.push(...parsedServices);
          }
        } catch (e) {
          // If it can't be parsed as JSON, use as a string
          services.push(laundromat.services);
        }
      } else if (Array.isArray(laundromat.services)) {
        services.push(...laundromat.services);
      }
    }
    
    // Get top services for description
    const topServices = services.slice(0, 3);
    const servicesText = topServices.length > 0 
      ? `${topServices.join(', ')}${services.length > 3 ? ' and more' : ''}` 
      : 'coin-operated machines, self-service, and drop-off service';
    
    // Create maps URL for directions
    const mapsUrl = laundromat.latitude && laundromat.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${laundromat.latitude},${laundromat.longitude}`
      : undefined;
    
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `https://laundromatlocator.com/laundromat/${laundromat.slug}#business`,
      "name": laundromat.name,
      "alternateName": `${laundromat.name} - Laundromat Near Me in ${laundromat.city}, ${laundromat.state}`,
      "description": `${laundromat.name} is a laundromat located in ${laundromat.city}, ${laundromat.state}. Find laundry services near me including ${servicesText}.`,
      "url": `https://laundromatlocator.com/laundromat/${laundromat.slug}`,
      "telephone": laundromat.phone,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": laundromat.address,
        "addressLocality": laundromat.city,
        "addressRegion": laundromat.state,
        "postalCode": laundromat.zip,
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": laundromat.latitude,
        "longitude": laundromat.longitude
      },
      "openingHoursSpecification": generateOpeningHours(laundromat.hours),
      "priceRange": "$$",
      "aggregateRating": laundromat.rating ? {
        "@type": "AggregateRating",
        "ratingValue": laundromat.rating,
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": laundromat.reviewCount || 0,
        "reviewCount": laundromat.reviewCount || 0
      } : undefined,
      "image": laundromat.imageUrl || 
               (laundromat.latitude && laundromat.longitude 
                ? `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                : "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=630"),
      "hasMap": mapsUrl,
      "keywords": `laundromat near me, laundry service ${laundromat.city}, ${laundromat.state} laundromat, coin laundry, self-service laundry, wash and fold`,
      "sameAs": laundromat.website ? [laundromat.website] : [],
      "paymentAccepted": paymentMethods.length > 0 ? paymentMethods.join(', ') : "Cash, Card",
      "potentialAction": {
        "@type": "ViewAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `https://laundromatlocator.com/laundromat/${laundromat.slug}`
        }
      },
      "makesOffer": services.map(service => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": service
        }
      }))
    };
  };

  const generateList = (laundromats: Laundromat[], locationStr: string) => {
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": laundromats.map((laundromat, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "LocalBusiness",
          "name": laundromat.name,
          "image": laundromat.imageUrl || 
                  (laundromat.latitude && laundromat.longitude 
                   ? `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
                   : ""),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": laundromat.address,
            "addressLocality": laundromat.city,
            "addressRegion": laundromat.state,
            "postalCode": laundromat.zip,
            "addressCountry": "US"
          },
          "geo": laundromat.latitude && laundromat.longitude ? {
            "@type": "GeoCoordinates",
            "latitude": laundromat.latitude,
            "longitude": laundromat.longitude
          } : undefined,
          "telephone": laundromat.phone,
          "aggregateRating": laundromat.rating ? {
            "@type": "AggregateRating",
            "ratingValue": laundromat.rating,
            "bestRating": "5",
            "worstRating": "1",
            "reviewCount": laundromat.reviewCount || 0
          } : undefined,
          "url": `https://laundromatlocator.com/laundromat/${laundromat.slug}`
        }
      }))
    };
  };

  const generateBreadcrumb = (items: Array<{name: string, url: string}>) => {
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
  
  const generateArticle = (articleData: any) => {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": articleData.headline,
      "description": articleData.description,
      "image": articleData.image,
      "author": {
        "@type": "Person",
        "name": articleData.author || "Laundry Expert"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Laundromat Directory",
        "logo": {
          "@type": "ImageObject",
          "url": "https://laundromat-directory.com/logo.png"
        }
      },
      "datePublished": articleData.datePublished,
      "articleSection": articleData.articleSection,
      "keywords": articleData.keywords
    };
  };
  
  const generateCollectionPage = (collectionData: any) => {
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "headline": collectionData.headline,
      "description": collectionData.description,
      "url": collectionData.url,
      "image": collectionData.image
    };
  };

  switch (type) {
    case 'business':
      schemaData = generateBusiness(data as Laundromat);
      break;
    case 'list':
      schemaData = generateList(data as Laundromat[], location || '');
      break;
    case 'breadcrumb':
      schemaData = generateBreadcrumb(data as Array<{name: string, url: string}>);
      break;
    case 'Article':
      schemaData = generateArticle(data);
      break;
    case 'CollectionPage':
      schemaData = generateCollectionPage(data);
      break;
    default:
      return null;
  }

  if (!schemaData) {
    return null;
  }

  // Remove undefined values to avoid schema validation errors
  const cleanedData = JSON.stringify(schemaData, (key, value) => {
    return value === undefined ? null : value;
  });

  return (
    <script 
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: cleanedData }}
    />
  );
};

export default SchemaMarkup;