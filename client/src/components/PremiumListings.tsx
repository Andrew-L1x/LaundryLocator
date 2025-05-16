import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  MapPin, 
  Clock, 
  Phone, 
  Star, 
  Award, 
  ChevronRight 
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const PremiumListings = () => {
  // Fetch premium laundromats
  const { data: premiumLaundromats, isLoading, error } = useQuery({
    queryKey: ['/api/premium-laundromats'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Premium Laundromats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <div className="flex items-center">
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-2/3 mt-2" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <p className="text-red-500">Unable to load premium laundromats.</p>
      </div>
    );
  }

  // If no premium laundromats, don't display the section
  if (!premiumLaundromats || premiumLaundromats.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Premium Laundromats</h2>
        <Link href="/business-owners" className="text-primary text-sm font-medium flex items-center hover:underline">
          List your business <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {premiumLaundromats.slice(0, 6).map((laundry) => (
          <Card key={laundry.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-lg flex items-center">
                {laundry.name}
                <Badge className="ml-2 bg-primary text-white" variant="default">Premium</Badge>
              </CardTitle>
              <div className="flex items-center text-sm text-gray-500">
                {laundry.rating && (
                  <div className="flex items-center mr-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i}
                        className={`h-3 w-3 ${
                          i < parseInt(laundry.rating || '0') 
                            ? 'text-yellow-400 fill-yellow-400' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1">
                      {laundry.reviewCount || 0}
                    </span>
                  </div>
                )}
                <Award className="h-4 w-4 text-primary mr-1" />
                <span>Verified Business</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                  <span>{laundry.address}, {laundry.city}, {laundry.state} {laundry.zip}</span>
                </div>
                {laundry.hours && (
                  <div className="flex items-start">
                    <Clock className="h-4 w-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                    <span>{laundry.hours}</span>
                  </div>
                )}
                {laundry.phone && (
                  <div className="flex items-start">
                    <Phone className="h-4 w-4 mr-2 mt-0.5 text-gray-500 flex-shrink-0" />
                    <span>{laundry.phone}</span>
                  </div>
                )}
                {laundry.promotionalText && (
                  <div className="mt-2 text-primary font-medium">
                    {laundry.promotionalText}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Link href={`/laundry/${laundry.slug}`} className="w-full">
                <Button variant="outline" className="w-full">View Details</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PremiumListings;