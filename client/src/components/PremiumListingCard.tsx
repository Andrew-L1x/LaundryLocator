import { Link } from 'wouter';
import { Star, MapPin, Clock, Award, CheckCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Laundromat } from '@/types/laundromat';

interface PremiumListingCardProps {
  laundromat: Laundromat;
  className?: string;
}

const PremiumListingCard = ({ laundromat, className = '' }: PremiumListingCardProps) => {
  const { 
    name, 
    slug, 
    address, 
    city, 
    state, 
    rating, 
    services, 
    hours,
    listingType,
    isPremium,
    isFeatured,
    promotionalText,
    imageUrl
  } = laundromat;

  // Format rating for display
  const ratingValue = parseFloat(rating || '0');
  const formattedRating = ratingValue.toFixed(1);
  
  // Get premium badge color based on listing type
  const getBadgeColor = () => {
    if (isFeatured) return 'bg-amber-600 hover:bg-amber-700';
    if (isPremium) return 'bg-primary hover:bg-primary/90';
    return 'bg-gray-600 hover:bg-gray-700';
  };

  // Get premium badge label based on listing type
  const getBadgeLabel = () => {
    if (isFeatured) return 'FEATURED';
    if (isPremium) return 'PREMIUM';
    return 'BASIC';
  };

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${className} ${isFeatured ? 'border-amber-300 ring-1 ring-amber-200' : isPremium ? 'border-primary/20' : ''}`}>
      {/* Premium Badge */}
      {(isPremium || isFeatured) && (
        <div className="absolute top-0 right-0 z-10">
          <Badge className={`${getBadgeColor()} m-2 px-2 py-1 font-semibold uppercase text-white`}>
            {isFeatured ? <Award className="mr-1 h-3 w-3" /> : <Zap className="mr-1 h-3 w-3" />}
            {getBadgeLabel()}
          </Badge>
        </div>
      )}

      {/* Laundry Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={imageUrl || 'https://placehold.co/600x400?text=Laundromat'}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <div className="flex items-center text-white">
            <Star className="mr-1 h-4 w-4 text-yellow-400" />
            <span className="font-medium">{formattedRating}</span>
          </div>
        </div>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1 text-xl">
          <Link href={`/laundromats/${slug}`} className="hover:text-primary focus:outline-none">
            {name}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-start">
          <MapPin className="mr-1 h-4 w-4 shrink-0 text-gray-400" />
          <span className="line-clamp-2">
            {address}, {city}, {state}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-2">
        {/* Promotional Text for Premium/Featured Listings */}
        {(isPremium || isFeatured) && promotionalText && (
          <p className="mb-3 text-sm italic text-primary">{promotionalText}</p>
        )}

        {/* Hours (Shortened for Premium Listings) */}
        <div className="mb-3 flex items-start">
          <Clock className="mr-1 h-4 w-4 shrink-0 text-gray-400" />
          <span className="text-sm text-gray-600">{hours}</span>
        </div>

        {/* Services */}
        <div className="flex flex-wrap gap-2">
          {services.slice(0, 3).map((service, index) => (
            <Badge key={index} variant="outline" className="bg-gray-50">
              {service}
            </Badge>
          ))}
          {services.length > 3 && (
            <Badge variant="outline" className="bg-gray-50">
              +{services.length - 3} more
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        {isFeatured ? (
          <Link
            href={`/laundromats/${slug}`}
            className="flex w-full items-center justify-center rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            View Featured Listing
          </Link>
        ) : isPremium ? (
          <Link
            href={`/laundromats/${slug}`}
            className="flex w-full items-center justify-center rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            View Premium Listing
          </Link>
        ) : (
          <Link
            href={`/laundromats/${slug}`}
            className="flex w-full items-center justify-center rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200"
          >
            View Details
          </Link>
        )}
      </CardFooter>
    </Card>
  );
};

export default PremiumListingCard;