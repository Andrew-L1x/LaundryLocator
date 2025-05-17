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
    return {
      "@context": "https://schema.org",
      "@type": "LaundryOrDryCleaner",
      "@id": `https://laundromat-directory.com/laundry/${laundromat.slug}#business`,
      "name": laundromat.name,
      "alternateName": `${laundromat.name} - Laundromat Near Me in ${laundromat.city}, ${laundromat.state}`,
      "description": `${laundromat.name} is a laundromat located in ${laundromat.city}, ${laundromat.state}. Find laundry services near me including ${(laundromat.services || []).slice(0, 3).join(', ')}${laundromat.services && laundromat.services.length > 3 ? ' and more' : ''}.`,
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
      "priceRange": "$$",
      "aggregateRating": laundromat.rating ? {
        "@type": "AggregateRating",
        "ratingValue": laundromat.rating,
        "reviewCount": laundromat.reviewCount || 0
      } : undefined,
      "image": laundromat.imageUrl || `https://laundromat-directory.com/laundromats/${laundromat.slug}.jpg`,
      "isOpen": laundromat.hours === '24 Hours' || true,
      "keywords": `laundromat near me, laundry service ${laundromat.city}, ${laundromat.state} laundromat, coin laundry, self-service laundry, wash and fold`,
      "sameAs": laundromat.website ? [laundromat.website] : [],
      "makesOffer": laundromat.services?.map(service => ({
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
          "image": laundromat.imageUrl || "",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": laundromat.city,
            "addressRegion": laundromat.state
          },
          "telephone": laundromat.phone,
          "aggregateRating": laundromat.rating ? {
            "@type": "AggregateRating",
            "ratingValue": laundromat.rating,
            "reviewCount": laundromat.reviewCount || 0
          } : undefined,
          "url": `https://laundromat-directory.com/laundry/${laundromat.slug}`
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