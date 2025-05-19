import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import Header from '@/components/Header';
import AdContainer from '@/components/AdContainer';
import LaundryMap from '@/components/LaundryMap';
import MapLegend from '@/components/MapLegend';
import SchemaMarkup from '@/components/SchemaMarkup';
import MetaTags from '@/components/MetaTags';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import Footer from '@/components/Footer';
import ListingCard from '@/components/ListingCard';
import { Laundromat, Review } from '@/types/laundromat';
import { useState } from 'react';
import { isFavorite, saveFavorite, removeFavorite } from '@/lib/storage';

// Component to display nearby laundromats
interface NearbyLaundromatsProps {
  currentId: number;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

const NearbyLaundromats: React.FC<NearbyLaundromatsProps> = ({
  currentId,
  latitude,
  longitude,
  city,
  state
}) => {
  const { 
    data: nearbyLaundromats = [], 
    isLoading,
    error
  } = useQuery<Laundromat[]>({
    queryKey: [`/api/laundromats/nearby/${currentId}`, { lat: latitude, lng: longitude }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey;
      const queryParams = new URLSearchParams();
      
      if (params.lat) queryParams.append('lat', params.lat.toString());
      if (params.lng) queryParams.append('lng', params.lng.toString());
      
      const response = await fetch(`/api/laundromats/nearby/${currentId}?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch nearby laundromats');
      }
      
      return response.json();
    },
    enabled: Boolean(currentId && latitude && longitude)
  });
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (error) {
    // If the API endpoint for nearby laundromats isn't available,
    // fall back to showing laundromats from the same city/state
    return (
      <CitySimilarLaundromats currentId={currentId} city={city} state={state} />
    );
  }
  
  if (!nearbyLaundromats.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white col-span-3 text-center">
          <p className="text-gray-600">No other laundromats found nearby.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {nearbyLaundromats.slice(0, 3).map(laundromat => (
        <ListingCard 
          key={laundromat.id} 
          laundromat={laundromat} 
        />
      ))}
    </div>
  );
};

// Fallback component that shows laundromats in the same city
const CitySimilarLaundromats: React.FC<{
  currentId: number;
  city: string;
  state: string;
}> = ({ currentId, city, state }) => {
  const { 
    data: similarLaundromats = [], 
    isLoading,
    error
  } = useQuery<Laundromat[]>({
    queryKey: [`/api/cities/${city.toLowerCase()}-${state.toLowerCase()}/laundromats`],
    enabled: Boolean(city && state)
  });
  
  const filteredLaundromats = similarLaundromats.filter(l => l.id !== currentId).slice(0, 3);
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (error || !filteredLaundromats.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white col-span-3 text-center">
          <p className="text-gray-600">No other laundromats found in {city}, {state}.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {filteredLaundromats.map(laundromat => (
        <ListingCard 
          key={laundromat.id} 
          laundromat={laundromat} 
        />
      ))}
    </div>
  );
};

const LaundryDetail = () => {
  const { slug } = useParams();
  const [favorite, setFavorite] = useState<boolean>(isFavorite(0)); // Will update with real ID once loaded
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Force scroll to top when component mounts (for both desktop and mobile)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Fetch laundromat details
  const { 
    data: laundromat, 
    isLoading,
    error: laundryError,
    refetch: refetchLaundromat
  } = useQuery<Laundromat>({
    queryKey: [`/api/laundromats/${slug}`],
  });
  
  // Fetch reviews
  const { 
    data: reviews = [],
    error: reviewsError,
    refetch: refetchReviews 
  } = useQuery<Review[]>({
    queryKey: [`/api/laundromats/${laundromat?.id}/reviews`],
    enabled: !!laundromat?.id
  });
  
  // Update favorite status when laundromat is loaded
  if (laundromat && !isLoading) {
    const isFav = isFavorite(laundromat.id);
    if (favorite !== isFav) {
      setFavorite(isFav);
    }
  }
  
  const toggleFavorite = () => {
    if (!laundromat) return;
    
    if (favorite) {
      removeFavorite(laundromat.id);
    } else {
      saveFavorite(laundromat.id);
    }
    
    setFavorite(!favorite);
  };
  
  // Determine if laundromat is open based on business hours
  const determineOpenStatus = () => {
    if (!laundromat) return false;
    
    // If the laundromat is marked as 24 hours
    if (laundromat.is_24_hours) return true;
    if (laundromat.hours === '24 Hours') return true;
    
    try {
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentTime = hour * 100 + minute; // Convert to format like "0930" for 9:30 AM
      
      // Check if we have business hours from Google Places API
      if (laundromat.business_hours && Array.isArray(laundromat.business_hours) && laundromat.business_hours.length > 0) {
        // Find today's hours
        const todayHours = laundromat.business_hours.find(period => {
          if (!period || typeof period !== 'object') return false;
          if (!period.open || typeof period.open !== 'object') return false;
          if (!('day' in period.open) || period.open.day === undefined || period.open.day === null) return false;
          
          return Number(period.open.day) === day;
        });
        
        if (todayHours && todayHours.open && todayHours.close) {
          const openTimeStr = todayHours.open.time;
          const closeTimeStr = todayHours.close.time;
          
          if (openTimeStr && closeTimeStr) {
            const openTime = parseInt(openTimeStr);
            const closeTime = parseInt(closeTimeStr);
            
            if (!isNaN(openTime) && !isNaN(closeTime)) {
              // Handle cases where the business closes after midnight
              if (closeTime < openTime) {
                return currentTime >= openTime || currentTime < closeTime;
              }
              
              return currentTime >= openTime && currentTime < closeTime;
            }
          }
        }
      }
      
      // Fallback to common laundromat hours if no specific hours are available
      if (day === 0 || day === 6) {
        // Weekend hours (often longer)
        return hour >= 6 && hour < 23;
      } else {
        // Weekday hours
        return hour >= 6 && hour < 22;
      }
    } catch (error) {
      console.error('Error determining if open:', error);
      return false;
    }
  };
  
  const isOpen = determineOpenStatus();
  
  if (isLoading) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  if (laundryError) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <ApiErrorDisplay 
            error={laundryError as Error}
            resetError={() => refetchLaundromat()}
            message="We couldn't load the laundromat details. Please try again."
          />
          
          <div className="mt-8 text-center">
            <Link href="/" className="bg-primary text-white px-6 py-2 rounded-lg font-medium">
              Back to Home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  if (!laundromat) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-8 text-center">
            <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
            <h3 className="text-xl font-semibold mb-2">Laundromat Not Found</h3>
            <p className="text-gray-600 mb-4">The laundromat you're looking for doesn't exist or has been removed.</p>
            <Link href="/" className="bg-primary text-white px-6 py-2 rounded-lg font-medium">
              Back to Home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      {laundromat && (
        <>
          <SchemaMarkup type="business" data={laundromat} />
          <MetaTags 
            pageType="business"
            title={`${laundromat.name} - Laundromat in ${laundromat.city}, ${laundromat.state}`}
            description={`${laundromat.name} in ${laundromat.city}, ${laundromat.state} offers ${laundromat.services.join(', ')}. View hours, location, reviews and services.`}
            location={laundromat.name}
            imageUrl={laundromat.imageUrl}
            canonicalUrl={`/laundry/${laundromat.slug}`}
          />
        </>
      )}
      <Header />
      
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/" className="text-primary hover:underline inline-flex items-center">
            <i className="fas fa-arrow-left mr-2"></i> Back to Results
          </Link>
        </div>
        
        {/* Laundromat Detail */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Header with image gallery */}
          <div className="relative h-64 bg-gray-200">
            {/* First try text-based Places photos if available */}
            {laundromat.places_text_data?.photoInfo && laundromat.places_text_data.photoInfo.length > 0 ? (
              <div className="relative w-full h-full">
                <img 
                  src={laundromat.places_text_data.photoInfo[currentPhotoIndex].url}
                  alt={`${laundromat.name} laundromat`}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  onError={(e) => {
                    // Fallback if text-based photo fails
                    if (laundromat.latitude && laundromat.longitude) {
                      e.currentTarget.src = `https://maps.googleapis.com/maps/api/streetview?size=1200x500&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
                    } else {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500";
                    }
                  }}
                />
                {/* Navigation arrows */}
                {laundromat.places_text_data.photoInfo.length > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentPhotoIndex(prev => 
                        prev === 0 ? laundromat.places_text_data!.photoInfo!.length - 1 : prev - 1
                      )}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                      aria-label="Previous photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => setCurrentPhotoIndex(prev => 
                        prev === laundromat.places_text_data!.photoInfo!.length - 1 ? 0 : prev + 1
                      )}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                      aria-label="Next photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
                
                {/* Photo counter indicator */}
                <div className="absolute bottom-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-sm">
                  {currentPhotoIndex + 1} / {laundromat.places_text_data.photoInfo.length}
                </div>
                
                {/* Thumbnail navigation (dots) */}
                {laundromat.places_text_data.photoInfo.length > 1 && (
                  <div className="absolute bottom-22 left-0 right-0 flex justify-center space-x-1 mb-2">
                    {laundromat.places_text_data.photoInfo.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={`h-2 w-2 rounded-full ${
                          currentPhotoIndex === index ? 'bg-white' : 'bg-white/40'
                        }`}
                        aria-label={`Go to photo ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : laundromat.google_details?.photos && laundromat.google_details.photos.length > 0 ? (
              // Fallback to original Google details photos if text data is not available
              <div className="relative w-full h-full">
                <img 
                  src={laundromat.google_details.photos[currentPhotoIndex].url}
                  alt={`${laundromat.name} laundromat`}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  onError={(e) => {
                    // Fallback if Google photo fails
                    if (laundromat.latitude && laundromat.longitude) {
                      e.currentTarget.src = `https://maps.googleapis.com/maps/api/streetview?size=1200x500&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
                    } else {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500";
                    }
                  }}
                />
                {/* Navigation arrows */}
                {laundromat.google_details.photos.length > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentPhotoIndex(prev => 
                        prev === 0 ? laundromat.google_details!.photos!.length - 1 : prev - 1
                      )}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                      aria-label="Previous photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => setCurrentPhotoIndex(prev => 
                        prev === laundromat.google_details!.photos!.length - 1 ? 0 : prev + 1
                      )}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                      aria-label="Next photo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
                
                {/* Photo counter indicator */}
                <div className="absolute bottom-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-sm">
                  {currentPhotoIndex + 1} / {laundromat.google_details.photos.length}
                </div>
                
                {/* Thumbnail navigation (dots) */}
                {laundromat.google_details.photos.length > 1 && (
                  <div className="absolute bottom-22 left-0 right-0 flex justify-center space-x-1 mb-2">
                    {laundromat.google_details.photos.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={`h-2 w-2 rounded-full ${
                          currentPhotoIndex === index ? 'bg-white' : 'bg-white/40'
                        }`}
                        aria-label={`Go to photo ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Fallback to regular photos or direct imageUrl
              (laundromat.imageUrl || (laundromat.photos && Array.isArray(laundromat.photos) && laundromat.photos.length > 0)) ? (
                <img 
                  src={
                    // First try direct imageUrl
                    laundromat.imageUrl || 
                    // Then try the first photo in the photos array if available
                    (laundromat.photos && Array.isArray(laundromat.photos) && laundromat.photos.length > 0 
                      ? laundromat.photos[0] 
                      // This fallback shouldn't be reached due to the conditional, but keeping it for safety
                      : ""
                    )
                  } 
                  alt={`${laundromat.name} laundromat`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // If the image fails to load, try to show Google Street View instead
                    if (laundromat.latitude && laundromat.longitude) {
                      e.currentTarget.src = `https://maps.googleapis.com/maps/api/streetview?size=1200x500&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
                    } else {
                      // If no coordinates, fallback to default image
                      e.currentTarget.src = "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500";
                    }
                  }}
                />
              ) : (
                // If no image is available, use Google Street View based on coordinates
                laundromat.latitude && laundromat.longitude ? (
                  <img 
                    src={`https://maps.googleapis.com/maps/api/streetview?size=1200x500&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                    alt={`Street view of ${laundromat.name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fall back to a laundromat-specific stock image if Street View fails
                      e.currentTarget.src = "https://images.unsplash.com/photo-1596194757945-9e0b62c929e6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500";
                    }}
                  />
                ) : (
                  // If no coordinates available, use default image
                  <img 
                    src="https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500"
                    alt={`${laundromat.name} laundromat`}
                    className="w-full h-full object-cover"
                  />
                )
              )
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <h1 className="text-3xl font-bold text-white">{laundromat.name}</h1>
            </div>
            
            {/* Favorite button */}
            <button 
              onClick={toggleFavorite}
              className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
            >
              <i className={`${favorite ? 'fas' : 'far'} fa-heart text-red-500 text-xl`}></i>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <div className="flex flex-wrap justify-between">
              <div className="mb-6 w-full lg:w-2/3">
                {/* Rating and reviews */}
                <div className="flex items-center mb-4">
                  <span className="text-sm text-gray-600 mr-2">Google Review</span>
                  <span className="text-2xl font-bold text-yellow-500 mr-2">{laundromat.rating}</span>
                  <div className="flex text-yellow-500 mr-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <i key={star} className={`fas fa-star ${parseInt(laundromat.rating) >= star ? 'text-yellow-500' : 'text-gray-300'}`}></i>
                    ))}
                  </div>
                  <span className="text-gray-600">({laundromat.reviewCount} reviews)</span>
                </div>
                
                {/* Services */}
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-2">Services</h2>
                  <div className="flex flex-wrap gap-2">
                    {laundromat.services.map(service => (
                      <span key={service} className="bg-blue-50 text-primary px-3 py-1 rounded-full text-sm">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Description and Business Information */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3">About</h2>
                  
                  {/* Description */}
                  {laundromat.description && (
                    <div className="mb-4">
                      <p className="text-gray-700">{laundromat.description}</p>
                    </div>
                  )}
                  
                  {/* Photo gallery has been moved to the main header image */}
                  
                  {/* Business Information */}
                  <div className="mt-4 space-y-4">
                    {/* Address */}
                    <div className="flex items-start">
                      <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                        <span className="font-medium">📍</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Address</h3>
                        <p className="text-gray-700">
                          {laundromat.address}
                        </p>
                        <p className="text-gray-700">
                          {laundromat.city}, {laundromat.state} {laundromat.zip}
                        </p>
                        <a 
                          href={`https://maps.google.com/?q=${laundromat.address},${laundromat.city},${laundromat.state},${laundromat.zip}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-sm hover:underline mt-1 inline-block"
                        >
                          Get Directions
                        </a>
                      </div>
                    </div>
                    
                    {/* Hours */}
                    <div className="flex items-start">
                      <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                        <span className="font-medium">⏰</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Hours</h3>
                        <div className="text-gray-700">
                          <div className="flex items-center mb-1">
                            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                              isOpen ? 'bg-green-500' : 'bg-red-500'
                            }`}></span>
                            <span>{isOpen ? 'Open Now' : 'Closed'}</span>
                          </div>
                          
                          {laundromat.is_24_hours ? (
                            <p className="text-green-600 font-medium">Open 24 Hours</p>
                          ) : Array.isArray(laundromat.business_hours) && laundromat.business_hours.length > 0 ? (
                            <div className="space-y-1 text-sm">
                              {laundromat.business_hours.map((period, index) => {
                                if (!period || typeof period !== 'object') return null;
                                
                                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                let openDay = 'Unknown';
                                let openTime = 'Unknown';
                                let closeTime = 'Unknown';
                                
                                try {
                                  if (period.open && typeof period.open === 'object') {
                                    if (typeof period.open.day === 'number' && period.open.day >= 0 && period.open.day <= 6) {
                                      openDay = days[period.open.day];
                                    }
                                    
                                    if (typeof period.open.time === 'string' && period.open.time.length >= 4) {
                                      openTime = `${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}`;
                                    }
                                  }
                                  
                                  if (period.close && typeof period.close === 'object') {
                                    if (typeof period.close.time === 'string' && period.close.time.length >= 4) {
                                      closeTime = `${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}`;
                                    }
                                  } else {
                                    closeTime = '24 Hours';
                                  }
                                } catch (error) {
                                  console.error('Error parsing business hours:', error);
                                }
                                
                                return (
                                  <div key={`hours-${index}`} className="flex justify-between">
                                    <span className="font-medium">{openDay}</span>
                                    <span>{openTime} - {closeTime}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div>{laundromat.hours || 'Call for hours'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Machine Details */}
                    <div className="flex items-start">
                      <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                        <span className="font-medium">🧺</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Machine Details</h3>
                        <div className="space-y-1 text-sm text-gray-700">
                          <div className="flex justify-between">
                            <span>Washers:</span>
                            <span>{laundromat.machineCount?.washers || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Dryers:</span>
                            <span>{laundromat.machineCount?.dryers || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>XL Machines:</span>
                            <span>{laundromat.hasLargeMachines ? 'Yes' : (laundromat.hasLargeMachines === false ? 'No' : 'Unknown')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Fold Tables:</span>
                            <span>{laundromat.hasFoldTables ? 'Yes' : (laundromat.hasFoldTables === false ? 'No' : 'Unknown')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Detergent Vending:</span>
                            <span>{laundromat.hasDetergentVending ? 'Yes' : (laundromat.hasDetergentVending === false ? 'No' : 'Unknown')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Options */}
                    <div className="flex items-start">
                      <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                        <span className="font-medium">💳</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Payment Options</h3>
                        {laundromat.paymentMethods && laundromat.paymentMethods.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {laundromat.paymentMethods.map(option => (
                              <span key={option} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                                {option}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-700 text-sm">Unknown payment options</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Amenities */}
                    <div className="flex items-start">
                      <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                        <span className="font-medium">🛋️</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Amenities</h3>
                        {laundromat.amenities && laundromat.amenities.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {laundromat.amenities.map(amenity => (
                              <span key={amenity} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                                {amenity}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-700 text-sm">Unknown amenities</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Contact */}
                    {(laundromat.phone || laundromat.google_details?.formattedPhone) && (
                      <div className="flex items-start">
                        <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                          <span className="font-medium">📞</span>
                        </div>
                        <div>
                          <h3 className="font-medium">Contact</h3>
                          <p className="text-gray-700">
                            {laundromat.google_details?.formattedPhone || laundromat.phone}
                          </p>
                          <a 
                            href={`tel:${laundromat.google_details?.formattedPhone || laundromat.phone}`}
                            className="text-primary text-sm hover:underline mt-1 inline-block"
                          >
                            Call Now
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {/* Website */}
                    {(laundromat.website || (laundromat.google_details && laundromat.google_details.website)) && (
                      <div className="flex items-start">
                        <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center min-w-[36px]">
                          <span className="font-medium">🌐</span>
                        </div>
                        <div>
                          <h3 className="font-medium">Website</h3>
                          <a 
                            href={laundromat.google_details?.website ? 
                              (laundromat.google_details.website.startsWith('http') ? 
                                laundromat.google_details.website : 
                                `https://${laundromat.google_details.website}`) : 
                              (laundromat.website ? 
                                (laundromat.website.startsWith('http') ? 
                                  laundromat.website : 
                                  `https://${laundromat.website}`) : 
                                '#')} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-words"
                          >
                            {laundromat.google_details?.website ? 
                              laundromat.google_details.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : 
                              (laundromat.website ? 
                                laundromat.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : 
                                '')}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Nearby Places - New Unified Section Using Text Data */}
                <div className="mb-6 bg-white p-4 border rounded-lg">
                  <h2 className="text-lg font-semibold mb-3">
                    <span className="text-primary">📍</span> Nearby Places
                  </h2>
                  <div className="space-y-3">
                    {laundromat.places_text_data?.nearbyPlacesText && laundromat.places_text_data.nearbyPlacesText.length > 0 ? (
                      // Use the text-based data which should be more efficient
                      laundromat.places_text_data.nearbyPlacesText
                        .filter((place, index, self) => 
                          index === self.findIndex(p => p.name === place.name)
                        )
                        .slice(0, 6)
                        .map((place, index) => (
                          <div key={`textplace-${index}`} className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3">
                              <span className="text-lg">
                                {place.type?.includes('restaurant') ? '🍽️' : 
                                 place.type?.includes('cafe') ? '☕' : 
                                 place.type?.includes('bar') ? '🍸' : 
                                 place.type?.includes('store') ? '🛒' :
                                 place.type?.includes('park') ? '🌳' :
                                 place.type?.includes('library') ? '📚' :
                                 place.type?.includes('gym') ? '💪' : '📍'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <h3 className="font-medium">{place.name}</h3>
                                {place.rating && (
                                  <div className="flex items-center text-sm">
                                    <i className="fas fa-star text-yellow-400 mr-1"></i>
                                    <span>{place.rating}</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{place.type}</p>
                              <p className="text-sm text-gray-600">{place.distance}</p>
                              {place.address && (
                                <p className="text-xs text-gray-500 mt-1">{place.address}</p>
                              )}
                            </div>
                          </div>
                        ))
                    ) : laundromat.nearby_places?.restaurants && laundromat.nearby_places.restaurants.length > 0 ? (
                      // Fallback to the old data format if text data isn't available
                      laundromat.nearby_places.restaurants
                        .filter((place, index, self) => 
                          index === self.findIndex(p => p.name === place.name)
                        )
                        .slice(0, 5)
                        .map((place, index) => (
                          <div key={`restaurant-${index}`} className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3">
                              <span className="text-lg">
                                {place.category === 'Café' ? '☕' : 
                                 place.category === 'Bakery' ? '🥐' :
                                 place.category === 'Bar' ? '🍺' : '🍽️'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium">{place.name}</h3>
                              <p className="text-sm text-gray-600">
                                {place.walkingDistance} • {place.category || 'Restaurant'} 
                                {place.priceLevel ? ` • ${place.priceLevel}` : ''}
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        <p>No restaurants found nearby. Please check back later as we update our database with the latest information.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Time-to-Do Suggestions - New Section */}
                <div className="mb-6 bg-white p-4 border rounded-lg">
                  <h2 className="text-lg font-semibold mb-3">
                    <span className="text-primary">⏱️</span> While Your Laundry Runs
                  </h2>
                  <p className="text-sm text-gray-600 mb-3">Have 90 minutes? Here's what you can do nearby:</p>
                  <div className="space-y-3">
                    {laundromat.nearby_places?.activities && laundromat.nearby_places.activities.length > 0 ? (
                      // Using filter to remove duplicates
                      laundromat.nearby_places.activities
                        .filter((place, index, self) => 
                          index === self.findIndex(p => p.name === place.name)
                        )
                        .slice(0, 5)
                        .map((place, index) => (
                          <div key={`activity-${index}`} className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3">
                              <span className="text-lg">
                                {place.category === 'Library' ? '📚' : 
                                 place.category === 'Park' ? '🏞️' :
                                 place.category === 'Mall' ? '🛒' :
                                 place.category?.includes('shop') ? '🛍️' : '🏙️'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium">{place.name}</h3>
                              <p className="text-sm text-gray-600">
                                {place.walkingDistance} • {place.category || 'Activity'}
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        <p>We're working on gathering activity information for this area. Please check back soon!</p>
                        <div className="mt-2">
                          <div className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3">
                              <span className="text-lg">📱</span>
                            </div>
                            <div>
                              <h3 className="font-medium">Browse Online</h3>
                              <p className="text-sm text-gray-600">Use our free WiFi to explore local activities</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Public Transit Info - New Section */}
                <div className="mb-6 bg-white p-4 border rounded-lg">
                  <h2 className="text-lg font-semibold mb-3">
                    <span className="text-primary">🚌</span> Public Transit
                  </h2>
                  <div className="space-y-3">
                    {laundromat.nearby_places?.transit && laundromat.nearby_places.transit.length > 0 ? (
                      // Using filter to remove duplicates
                      laundromat.nearby_places.transit
                        .filter((place, index, self) => 
                          index === self.findIndex(p => p.name === place.name)
                        )
                        .slice(0, 3)
                        .map((place, index) => (
                          <div key={`transit-${index}`} className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center" style={{minWidth: '36px'}}>
                              <span className="font-medium">
                                {place.category === 'Bus Stop' ? '🚌' : 
                                 place.category === 'Subway' ? '🚇' :
                                 place.category === 'Train' ? '🚆' : '🚏'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium">{place.name}</h3>
                              <p className="text-sm text-gray-600">{place.walkingDistance} • {place.category || 'Transit'}</p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        <p>No public transit information available for this location.</p>
                        <p className="mt-1">This laundromat is best accessed by car or rideshare.</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Shopping Options - New Section */}
                <div className="mb-6 bg-white p-4 border rounded-lg">
                  <h2 className="text-lg font-semibold mb-3">
                    <span className="text-primary">🛍️</span> Nearby Shopping
                  </h2>
                  <div className="space-y-3">
                    {laundromat.nearby_places?.restaurants && 
                     laundromat.nearby_places.restaurants.filter(place => 
                       place.category === 'Supermarket' || 
                       place.category === 'Convenience Store' || 
                       place.category === 'Pharmacy' ||
                       place.category === 'Department Store' ||
                       place.category === 'Dollar Store' ||
                       place.category === 'Grocery Store' ||
                       place.category === 'Shopping Mall'
                     ).length > 0 ? (
                      // Using filter to remove duplicates and get only shopping-related places
                      laundromat.nearby_places.restaurants
                        .filter(place => 
                          place.category === 'Supermarket' || 
                          place.category === 'Convenience Store' || 
                          place.category === 'Grocery Store' ||
                          place.category === 'Department Store' ||
                          place.category === 'Pharmacy' ||
                          place.category === 'Dollar Store' ||
                          place.category === 'Shopping Mall'
                        )
                        .filter((place, index, self) => 
                          index === self.findIndex(p => p.name === place.name)
                        )
                        .slice(0, 5)
                        .map((place, index) => (
                          <div key={`shopping-${index}`} className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3 flex items-center justify-center" style={{minWidth: '36px'}}>
                              <span className="font-medium">
                                {place.category === 'Supermarket' ? '🛒' : 
                                 place.category === 'Convenience Store' ? '🏪' :
                                 place.category === 'Grocery Store' ? '🥑' : 
                                 place.category === 'Pharmacy' ? '💊' :
                                 place.category === 'Department Store' ? '👚' :
                                 place.category === 'Dollar Store' ? '💵' :
                                 place.category === 'Shopping Mall' ? '🛍️' : '🛒'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium">{place.name}</h3>
                              <p className="text-sm text-gray-600">{place.walkingDistance} • {place.category || 'Shop'}</p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        <p>No shopping options found nearby. We're continuously updating our database with the latest information.</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Disclaimer Section */}
                <div className="mt-6 mb-4 bg-gray-50 p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="text-amber-500 mr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Information Notice</p>
                      <p>The details on this page (hours, machine count, amenities) are estimates based on typical laundromats in this area and may not be 100% accurate. Open/closed status is determined using common business hours and may not reflect actual hours.</p>
                      <p className="mt-1">Are you the owner of this laundromat? <Link href="/claim-business" className="text-blue-600 hover:underline">Claim this listing</Link> to update your information.</p>
                    </div>
                  </div>
                </div>
                
                {/* Reviews */}
                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-4">Customer Reviews</h2>
                  
                  {/* Google Reviews Section */}
                  {laundromat.google_details?.reviews && laundromat.google_details.reviews.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-md font-semibold mb-3 flex items-center">
                        <span className="mr-2">Google Reviews</span>
                        <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {laundromat.google_details.reviews.length}
                        </span>
                      </h3>
                      <div className="space-y-4">
                        {laundromat.google_details.reviews.map((review, index) => (
                          <div key={`google-${index}`} className="border-b pb-4">
                            <div className="flex items-center mb-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full mr-3 flex items-center justify-center text-blue-600">
                                <i className="fab fa-google"></i>
                              </div>
                              <div>
                                <div className="font-medium">{review.author}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(review.time * 1000).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex text-yellow-500 mb-2">
                              {[1, 2, 3, 4, 5].map(star => (
                                <i key={star} className={`fas fa-star ${review.rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}></i>
                              ))}
                            </div>
                            <p className="text-gray-700">
                              {review.text.length > 200 ? 
                                `${review.text.substring(0, 200)}...` : 
                                review.text
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Site Reviews Section */}
                  <div className="mb-6">
                    <h3 className="text-md font-semibold mb-3 flex items-center">
                      <span className="mr-2">LaundryLocator Reviews</span>
                      <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {reviews.length}
                      </span>
                    </h3>
                    
                    {reviewsError ? (
                      <ApiErrorDisplay 
                        error={reviewsError as Error}
                        resetError={() => refetchReviews()}
                        message="We couldn't load the reviews for this laundromat. Please try again."
                      />
                    ) : reviews.length === 0 ? (
                      <p className="text-gray-500">No reviews yet. Be the first to review this laundromat!</p>
                    ) : (
                      <div className="space-y-4">
                        {reviews.map(review => (
                          <div key={review.id} className="border-b pb-4">
                            <div className="flex items-center mb-2">
                              <div className="w-8 h-8 bg-gray-300 rounded-full mr-3 flex items-center justify-center">
                                <i className="fas fa-user text-gray-500"></i>
                              </div>
                              <div>
                                <div className="font-medium">Anonymous User</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(review.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex text-yellow-500 mb-2">
                              {[1, 2, 3, 4, 5].map(star => (
                                <i key={star} className={`fas fa-star ${review.rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}></i>
                              ))}
                            </div>
                            <p className="text-gray-700">{review.comment || "Great service!"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button className="mt-4 bg-primary text-white px-4 py-2 rounded font-medium hover:bg-primary/90">
                    Write a Review
                  </button>
                </div>
              </div>
              
              <div className="w-full lg:w-1/3 lg:pl-6">
                {/* Info box */}
                <div className="border rounded-lg p-4">
                  {/* Busy Times Section */}
                  <div className="mb-4">
                    <h3 className="font-semibold mb-1">Busy Times</h3>
                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      <p className="mb-1"><span className="font-medium">Most crowded:</span> Unknown</p>
                      <p><span className="font-medium">Quietest:</span> Unknown</p>
                    </div>
                  </div>
                  
                  {/* Call button */}
                  <div className="pt-2">
                    {laundromat.phone ? (
                      <a 
                        href={`tel:${laundromat.phone}`}
                        className="block w-full bg-primary text-white py-2 rounded font-medium hover:bg-primary/90 text-center"
                      >
                        <i className="fas fa-phone-alt mr-2"></i> Call Now
                      </a>
                    ) : (
                      <button disabled className="w-full bg-gray-300 text-gray-600 py-2 rounded font-medium cursor-not-allowed">
                        <i className="fas fa-phone-alt mr-2"></i> No Phone Available
                      </button>
                    )}
                    
                    {laundromat.isPremium && (
                      <div className="mt-4 bg-yellow-50 p-2 rounded text-center">
                        <span className="text-xs font-semibold text-yellow-700">PREMIUM LISTING</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Map */}
                <div className="mt-6 mb-6">
                  <h3 className="font-semibold mb-3">Location</h3>
                  {laundromat && (
                    <>
                      <LaundryMap 
                        laundromats={[laundromat]} 
                        center={{
                          lat: parseFloat(laundromat.latitude),
                          lng: parseFloat(laundromat.longitude)
                        }}
                        zoom={15}
                        showLegend={true}
                      />
                      {/* Map legend is now handled inside the LaundryMap component for consistency */}
                    </>
                  )}
                </div>
                
                {/* Ad */}
                <div className="mt-6">
                  <AdContainer format="vertical" className="mb-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Related laundromats */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Other Laundromats Nearby</h2>
          
          {laundromat && (
            <NearbyLaundromats 
              currentId={laundromat.id} 
              latitude={parseFloat(laundromat.latitude)} 
              longitude={parseFloat(laundromat.longitude)}
              city={laundromat.city}
              state={laundromat.state}
            />
          )}
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default LaundryDetail;
