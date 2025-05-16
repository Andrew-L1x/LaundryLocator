import React from 'react';
import { Link } from 'wouter';
import { MapPin, Clock, Phone, Globe, Info, Star, Award, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Laundromat } from '@shared/schema';
import { calculateDistance } from '../lib/geolocation';
import { ListingType } from '@shared/premium-features';

interface UserLocation {
  lat: number;
  lng: number;
}

interface ListingCardProps {
  laundromat: Laundromat;
  userLocation?: UserLocation | null;
}

// Helper function to format phone numbers
const formatPhoneNumber = (phone: string): string => {
  // Basic formatting for US phone numbers
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

// Helper function to check if the laundromat is currently open
const isOpenNow = (hours: string): boolean => {
  if (!hours) return false;
  
  try {
    // This is a simplified implementation - a more robust version would parse
    // the hours string and compare against current day/time
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    const time = now.getHours() * 100 + now.getMinutes();
    
    // Example hours format: "mon: 6:00am-10:00pm, tue: 6:00am-10:00pm, ..."
    const hoursLower = hours.toLowerCase();
    const dayRegex = new RegExp(`${day}:\\s*([\\d:]+(?:am|pm))\\s*-\\s*([\\d:]+(?:am|pm))`, 'i');
    const match = hoursLower.match(dayRegex);
    
    if (!match) return false;
    
    const open = match[1];
    const close = match[2];
    
    // Convert times to minutes since midnight for comparison
    const convertTime = (timeStr: string) => {
      const [hourStr, minuteStr] = timeStr.replace(/[apAP][mM]/, '').split(':');
      let hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr || '0', 10);
      
      if (timeStr.toLowerCase().includes('pm') && hour < 12) {
        hour += 12;
      } else if (timeStr.toLowerCase().includes('am') && hour === 12) {
        hour = 0;
      }
      
      return hour * 100 + minute;
    };
    
    const openTime = convertTime(open);
    const closeTime = convertTime(close);
    
    // Handle cases where closing time is past midnight
    if (closeTime < openTime) {
      return time >= openTime || time < closeTime;
    }
    
    return time >= openTime && time < closeTime;
  } catch (error) {
    console.error('Error parsing hours:', error);
    return false;
  }
};

const ListingCard: React.FC<ListingCardProps> = ({ laundromat, userLocation }) => {
  const distance = userLocation 
    ? calculateDistance(
        userLocation.lat, 
        userLocation.lng, 
        parseFloat(laundromat.latitude), 
        parseFloat(laundromat.longitude)
      ) 
    : null;
    
  // Determine listing type based on the premium tier system
  const listingType = laundromat.listingType as ListingType || 'basic';
  const isPremium = listingType === 'premium' || listingType === 'featured';
  const isFeatured = listingType === 'featured';
  const isSubscriptionActive = laundromat.subscriptionStatus === 'active';
  
  // Define styling based on listing type
  const cardStyles = {
    basic: '',
    premium: 'border-primary/20 shadow-sm',
    featured: 'relative border-primary shadow-md'
  };
  
  // Badge components for different listing types
  const PremiumBadge = () => (
    <div className="absolute top-0 right-0 bg-blue-500 text-white px-2 py-1 text-xs font-semibold rounded-bl-md flex items-center gap-1">
      <Star className="h-3 w-3" />
      Premium
    </div>
  );
  
  const FeaturedBadge = () => (
    <div className="absolute top-0 right-0 bg-primary text-white px-2 py-1 text-xs font-semibold rounded-bl-md flex items-center gap-1">
      <Crown className="h-3 w-3" />
      Featured
    </div>
  );
  
  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${cardStyles[listingType]}`}>
      {/* Show badge based on listing type */}
      {isPremium && isSubscriptionActive && (
        isFeatured ? <FeaturedBadge /> : <PremiumBadge />
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-bold text-lg">{laundromat.name}</CardTitle>
            <CardDescription className="text-sm mt-1">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span>{laundromat.address}, {laundromat.city}, {laundromat.state} {laundromat.zip}</span>
              </div>
              {distance !== null && (
                <div className="flex items-center gap-1 mt-1 text-primary font-medium">
                  <MapPin className="h-3 w-3" />
                  <span>{distance.toFixed(1)} miles away</span>
                </div>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="flex flex-col space-y-2">
          {/* Hours display - available for all listing types */}
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className={`text-sm font-medium ${isOpenNow(laundromat.hours) ? 'text-green-600' : 'text-red-500'}`}>
              {isOpenNow(laundromat.hours) ? 'Open Now' : 'Closed'}
            </span>
          </div>
          
          {/* Phone display - only for premium & featured listings with active subscription */}
          {isPremium && isSubscriptionActive && laundromat.phone && (
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
              <a href={`tel:${laundromat.phone}`} className="text-sm text-primary hover:underline">
                {formatPhoneNumber(laundromat.phone)}
              </a>
            </div>
          )}
          
          {/* Website display - only for premium & featured listings with active subscription */}
          {isPremium && isSubscriptionActive && laundromat.website && (
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
              <a 
                href={laundromat.website} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-primary hover:underline truncate max-w-[200px]"
              >
                {laundromat.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </div>
          )}
          
          {/* Show promotional text for featured listings */}
          {isFeatured && isSubscriptionActive && laundromat.promotionalText && (
            <div className="mt-2 text-sm italic text-primary/80 border-l-2 border-primary/20 pl-2">
              "{laundromat.promotionalText}"
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1 mt-3">
          {laundromat.services && laundromat.services.slice(0, 3).map(service => (
            <Badge key={service} variant="outline" className="text-xs">
              {service}
            </Badge>
          ))}
          {laundromat.services && laundromat.services.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{laundromat.services.length - 3} more
            </Badge>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-primary hover:text-primary-foreground hover:bg-primary"
          asChild
        >
          <Link href={`/laundromat/${laundromat.slug}`}>
            <Info className="h-4 w-4 mr-1" />
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ListingCard;