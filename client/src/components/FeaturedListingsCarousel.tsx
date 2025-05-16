import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PremiumListingCard from './PremiumListingCard';
import { Laundromat } from '@/types/laundromat';

interface FeaturedListingsCarouselProps {
  laundromats: Laundromat[];
  title?: string;
  subtitle?: string;
}

const FeaturedListingsCarousel = ({ 
  laundromats,
  title = "Featured Laundromats",
  subtitle = "Discover our premium laundry services with enhanced amenities and special offers"
}: FeaturedListingsCarouselProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidesToShow, setSlidesToShow] = useState(3);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // Update slides to show based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setSlidesToShow(1);
      } else if (window.innerWidth < 1024) {
        setSlidesToShow(2);
      } else {
        setSlidesToShow(3);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxSlides = Math.max(0, laundromats.length - slidesToShow);
  
  const nextSlide = () => {
    setCurrentSlide(prev => Math.min(prev + 1, maxSlides));
  };
  
  const prevSlide = () => {
    setCurrentSlide(prev => Math.max(prev - 1, 0));
  };

  const canGoNext = currentSlide < maxSlides;
  const canGoPrev = currentSlide > 0;

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center md:flex-row md:justify-between md:text-left">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h2>
            <p className="mt-1 text-gray-600">{subtitle}</p>
          </div>
          
          {/* Navigation Arrows (Desktop) */}
          <div className="mt-4 hidden md:mt-0 md:flex md:space-x-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={prevSlide}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Previous slide</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={nextSlide}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-5 w-5" />
              <span className="sr-only">Next slide</span>
            </Button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative overflow-hidden">
          <div
            ref={sliderRef}
            className="flex transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${currentSlide * (100 / slidesToShow)}%)`,
              width: `${(laundromats.length / slidesToShow) * 100}%`
            }}
          >
            {laundromats.map((laundromat) => (
              <div
                key={laundromat.id}
                className="w-full px-2"
                style={{ width: `${100 / laundromats.length * slidesToShow}%` }}
              >
                <PremiumListingCard laundromat={laundromat} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation Arrows (Mobile) */}
        <div className="mt-6 flex justify-center space-x-4 md:hidden">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={prevSlide}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Previous slide</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={nextSlide}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-5 w-5" />
            <span className="sr-only">Next slide</span>
          </Button>
        </div>
        
        {/* Dots indicator */}
        <div className="mt-4 flex justify-center">
          {Array.from({ length: maxSlides + 1 }).map((_, index) => (
            <button
              key={index}
              className={`mx-1 h-2 w-2 rounded-full ${
                index === currentSlide ? 'bg-primary' : 'bg-gray-300'
              }`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedListingsCarousel;