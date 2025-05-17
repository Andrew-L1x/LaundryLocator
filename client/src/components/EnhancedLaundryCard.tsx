import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StarIcon, MapPinIcon, PhoneIcon, ClockIcon } from 'lucide-react';
import type { Laundromat } from '@shared/schema';

interface EnhancedLaundryCardProps {
  laundromat: Laundromat & { 
    distance?: number;
  };
  showDistance?: boolean;
}

const EnhancedLaundryCard: React.FC<EnhancedLaundryCardProps> = ({ 
  laundromat, 
  showDistance = false 
}) => {
  // Format phone number for display
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Format distance for display
  const formatDistance = (miles: number) => {
    if (miles < 0.1) {
      return 'Less than 0.1 miles';
    }
    return `${miles.toFixed(1)} miles`;
  };

  // Get first relevant tag for badge
  const getPrimaryTag = (tags: string) => {
    if (!tags) return null;
    
    // Priority tags to display
    const priorityTerms = ['24 hour', 'coin', 'card', 'self service', 'wash and fold', 'dry cleaning'];
    
    const tagList = tags.split(',').map(t => t.trim().toLowerCase());
    for (const term of priorityTerms) {
      const match = tagList.find(t => t.includes(term));
      if (match) return match;
    }
    
    return tagList[0] || null;
  };

  // Parse rating value properly
  const getRating = () => {
    if (!laundromat.rating) return 0;
    const ratingValue = typeof laundromat.rating === 'string' 
      ? parseFloat(laundromat.rating) 
      : laundromat.rating;
    return isNaN(ratingValue) ? 0 : ratingValue;
  };

  // Get review count safely
  const getReviewCount = () => {
    const reviewCountField = laundromat.reviewCount || laundromat.review_count || 0;
    const count = typeof reviewCountField === 'string'
      ? parseInt(reviewCountField)
      : reviewCountField;
    return isNaN(count) ? 0 : count;
  };

  // Check if premium/featured
  const isPremium = laundromat.premium === true || laundromat.isPremium === true;
  const isFeatured = laundromat.featured === true || laundromat.isFeatured === true;

  // Get image URL
  const imageUrl = laundromat.imageUrl || laundromat.image_url || '';
  
  // Get description content
  const summary = laundromat.seoSummary || laundromat.seo_summary || '';
  const tags = laundromat.seoTags || laundromat.seo_tags || '';

  return (
    <Card className="overflow-hidden h-full flex flex-col transition-all hover:shadow-md">
      <div className="relative">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={laundromat.name} 
            className="h-48 w-full object-cover"
          />
        ) : (
          <div className="h-48 w-full bg-gradient-to-r from-blue-100 to-blue-200 flex items-center justify-center">
            <span className="text-lg font-medium text-blue-800">{laundromat.name}</span>
          </div>
        )}
        
        {isPremium && (
          <Badge className="absolute top-2 right-2 bg-yellow-500 hover:bg-yellow-600">Premium</Badge>
        )}
        {isFeatured && (
          <Badge className="absolute top-2 left-2 bg-purple-600 hover:bg-purple-700">Featured</Badge>
        )}
      </div>
      
      <CardContent className="p-4 flex-grow">
        <h3 className="text-lg font-bold mb-1 line-clamp-1">{laundromat.name}</h3>
        
        {showDistance && laundromat.distance !== undefined && (
          <div className="text-sm font-medium text-green-600 mb-2 flex items-center">
            <MapPinIcon className="h-3 w-3 mr-1" />
            {formatDistance(laundromat.distance)}
          </div>
        )}
        
        <div className="mb-2 flex items-center">
          {getRating() > 0 ? (
            <>
              <div className="flex items-center bg-green-50 text-green-700 px-2 py-0.5 rounded text-sm">
                <StarIcon className="h-3 w-3 mr-1 fill-current" />
                <span className="font-medium">{getRating().toFixed(1)}</span>
              </div>
              {getReviewCount() > 0 && (
                <span className="text-xs text-gray-500 ml-1">
                  ({getReviewCount()} reviews)
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-500">No ratings yet</span>
          )}
        </div>
        
        {laundromat.address && (
          <div className="flex items-start mb-1">
            <MapPinIcon className="h-4 w-4 text-gray-400 mr-1 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600 line-clamp-1">{laundromat.address}</p>
          </div>
        )}
        
        {laundromat.phone && (
          <div className="flex items-center mb-1">
            <PhoneIcon className="h-4 w-4 text-gray-400 mr-1 flex-shrink-0" />
            <p className="text-sm text-gray-600">{formatPhone(laundromat.phone)}</p>
          </div>
        )}
        
        {laundromat.hours && (
          <div className="flex items-start mb-1">
            <ClockIcon className="h-4 w-4 text-gray-400 mr-1 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600 line-clamp-1">{laundromat.hours}</p>
          </div>
        )}
        
        {summary && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {summary}
          </p>
        )}
        
        {getPrimaryTag(tags) && (
          <div className="mt-3">
            <Badge variant="outline" className="text-xs">
              {getPrimaryTag(tags)}
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 mt-auto">
        <Button asChild className="w-full">
          <Link href={`/laundry/${laundromat.slug}`}>
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EnhancedLaundryCard;