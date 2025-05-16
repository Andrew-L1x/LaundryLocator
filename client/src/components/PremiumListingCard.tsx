import React from 'react';
import { Link } from 'wouter';
import { Star, MapPin, Clock, Award, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Laundromat } from '@/types/laundromat';

interface PremiumListingCardProps {
  laundromat: Laundromat;
  className?: string;
  showCtaButton?: boolean;
}

const PremiumListingCard: React.FC<PremiumListingCardProps> = ({ 
  laundromat, 
  className = '',
  showCtaButton = true
}) => {
  // Format services as comma-separated list for better readability
  const servicesString = laundromat.services?.join(', ');
  
  // Determine badge type based on listing type
  const renderBadge = () => {
    if (laundromat.listingType === 'featured') {
      return (
        <Badge className="absolute top-3 right-3 bg-amber-500 hover:bg-amber-600 px-3 py-2">
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Featured
        </Badge>
      );
    } else if (laundromat.listingType === 'premium') {
      return (
        <Badge className="absolute top-3 right-3 bg-primary hover:bg-primary/90 px-3 py-2">
          <Award className="h-3.5 w-3.5 mr-1" />
          Premium
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg relative ${className}`}>
      {renderBadge()}
      
      <div className="aspect-video overflow-hidden">
        <img
          src={laundromat.imageUrl || 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400'}
          alt={laundromat.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </div>
      
      <CardHeader className="pb-2">
        <Link href={`/laundry/${laundromat.slug}`} className="text-xl font-bold text-gray-900 hover:text-primary transition-colors line-clamp-1">
          {laundromat.name}
        </Link>
        
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="h-4 w-4 mr-1 inline text-gray-400" />
          <span className="line-clamp-1">
            {laundromat.address}, {laundromat.city}, {laundromat.state} {laundromat.zip}
          </span>
        </div>
        
        {laundromat.rating && (
          <div className="flex items-center mt-1">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i}
                  className={`h-4 w-4 ${
                    i < parseInt(laundromat.rating || '0') 
                      ? 'text-yellow-400 fill-yellow-400' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="ml-2 text-sm text-gray-600">
              {laundromat.reviewCount || 0} reviews
            </span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pb-4">
        {laundromat.promotionalText && (
          <div className="text-sm font-medium text-primary mb-3">
            {laundromat.promotionalText}
          </div>
        )}
        
        <div className="text-sm text-gray-600 line-clamp-2 mb-3">
          {laundromat.description || `${laundromat.name} offers convenient laundry services in ${laundromat.city}, ${laundromat.state}.`}
        </div>
        
        <div className="flex items-start gap-1 text-sm text-gray-600 mb-3">
          <Clock className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
          <div>
            {laundromat.hours || 'Open 24/7'}
          </div>
        </div>
        
        {laundromat.services && (
          <div className="mt-3">
            <Separator className="mb-3" />
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Services</div>
            <div className="flex flex-wrap gap-1">
              {laundromat.services.slice(0, 5).map((service, i) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {service}
                </Badge>
              ))}
              {laundromat.services.length > 5 && (
                <Badge variant="outline" className="font-normal">
                  +{laundromat.services.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {laundromat.specialOffers && laundromat.specialOffers.length > 0 && (
          <div className="mt-3">
            <Separator className="mb-3" />
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Special Offers</div>
            <div className="text-sm">
              {laundromat.specialOffers[0]}
              {laundromat.specialOffers.length > 1 && (
                <span className="text-primary text-xs ml-1">
                  +{laundromat.specialOffers.length - 1} more offers
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      {showCtaButton && (
        <CardFooter className="pt-0">
          <Button className="w-full" asChild>
            <Link href={`/laundry/${laundromat.slug}`}>
              View Details
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default PremiumListingCard;