import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import AdContainer from '@/components/AdContainer';
import LaundryMap from '@/components/LaundryMap';
import SchemaMarkup from '@/components/SchemaMarkup';
import MetaTags from '@/components/MetaTags';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import Footer from '@/components/Footer';
import { Laundromat, Review } from '@/types/laundromat';
import { useState } from 'react';
import { isFavorite, saveFavorite, removeFavorite } from '@/lib/storage';

const LaundryDetail = () => {
  const { slug } = useParams();
  const [favorite, setFavorite] = useState<boolean>(isFavorite(0)); // Will update with real ID once loaded
  
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
  
  // Determine if laundromat is open based on hours
  const isOpen = laundromat?.hours === '24 Hours' || true; // In a real app, this would check actual hours
  
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
          {/* Header with image */}
          <div className="relative h-64 bg-gray-200">
            <img 
              src={laundromat.imageUrl || "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=500"} 
              alt={`${laundromat.name} laundromat`}
              className="w-full h-full object-cover"
            />
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
                
                {/* Description */}
                {laundromat.description && (
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold mb-2">About</h2>
                    <p className="text-gray-700">{laundromat.description}</p>
                  </div>
                )}
                
                {/* Reviews */}
                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-4">Customer Reviews</h2>
                  
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
                  
                  <button className="mt-4 bg-primary text-white px-4 py-2 rounded font-medium hover:bg-primary/90">
                    Write a Review
                  </button>
                </div>
              </div>
              
              <div className="w-full lg:w-1/3 lg:pl-6">
                {/* Info box */}
                <div className="border rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold mb-1">Address</h3>
                    <address className="not-italic text-gray-700">
                      {laundromat.address}<br />
                      {laundromat.city}, {laundromat.state} {laundromat.zip}
                    </address>
                    <a 
                      href={`https://maps.google.com/?q=${laundromat.address},${laundromat.city},${laundromat.state},${laundromat.zip}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline mt-1 inline-block"
                    >
                      Get Directions
                    </a>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-semibold mb-1">Hours</h3>
                    <div className="text-gray-700">
                      <div className="flex items-center mb-1">
                        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                          isOpen ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        <span>{isOpen ? 'Open Now' : 'Closed'}</span>
                      </div>
                      <div>{laundromat.hours}</div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h3 className="font-semibold mb-1">Contact</h3>
                    <a 
                      href={`tel:${laundromat.phone}`}
                      className="block text-primary hover:underline"
                    >
                      {laundromat.phone}
                    </a>
                    {laundromat.website && (
                      <a 
                        href={laundromat.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-primary hover:underline"
                      >
                        Visit Website
                      </a>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t">
                    <button className="w-full bg-primary text-white py-2 rounded font-medium hover:bg-primary/90">
                      <i className="fas fa-phone-alt mr-2"></i> Call Now
                    </button>
                    
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
                    <LaundryMap 
                      laundromats={[laundromat]} 
                      center={{
                        lat: parseFloat(laundromat.latitude),
                        lng: parseFloat(laundromat.longitude)
                      }}
                      zoom={15}
                    />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* This would fetch nearby laundromats in a real app */}
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-primary">Loading nearby laundromats...</h3>
                <div className="mt-2 text-gray-500 text-sm">Finding options near this location...</div>
              </div>
            ))}
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default LaundryDetail;
