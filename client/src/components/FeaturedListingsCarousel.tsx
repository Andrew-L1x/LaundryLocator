import React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Laundromat } from '@/types/laundromat';
import PremiumListingCard from './PremiumListingCard';

interface FeaturedListingsCarouselProps {
  laundromats: Laundromat[];
  title?: string;
  subtitle?: string;
}

const FeaturedListingsCarousel: React.FC<FeaturedListingsCarouselProps> = ({
  laundromats,
  title = 'Featured Listings',
  subtitle,
}: FeaturedListingsCarouselProps) => {
  if (!laundromats.length) return null;

  return (
    <section className="py-10 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="mt-2 text-lg text-gray-600 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        <Carousel
          opts={{
            align: 'start',
            loop: laundromats.length > 3,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {laundromats.map((laundromat) => (
              <CarouselItem 
                key={laundromat.id}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <div className="h-full">
                  <PremiumListingCard 
                    laundromat={laundromat} 
                    className="h-full" 
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center mt-8 gap-2">
            <CarouselPrevious className="relative static" />
            <CarouselNext className="relative static" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default FeaturedListingsCarousel;