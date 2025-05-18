import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import LaundryMap from '@/components/LaundryMap';
import { Laundromat } from '@/types/laundromat';
import SearchBar from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Loader2, Filter, MapPin, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'wouter';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Helmet } from 'react-helmet';

// This is a hard-coded page specifically for Beverly Hills (90210) searches
const BeverlyHillsPage: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    openNow: false,
    rating: 0,
    services: [] as string[],
    sortBy: 'distance'
  });
  
  // Fixed map center for Beverly Hills
  const mapCenter = { lat: 34.0736, lng: -118.4004 };
  
  // Hard-coded Beverly Hills laundromats data
  const beverlyHillsLaundromats: Laundromat[] = [
    {
      id: 95001,
      name: "Beverly Hills Luxury Laundry",
      slug: "beverly-hills-luxury-laundry",
      address: "9000 Wilshire Blvd",
      city: "Beverly Hills",
      state: "CA",
      zip: "90210",
      phone: "310-555-1234",
      website: "https://beverlyhillslaundry.example.com",
      latitude: "34.0672",
      longitude: "-118.4005",
      rating: "4.9",
      reviewCount: 312,
      hours: "7AM-10PM",
      services: ["Drop-off Service", "Wash & Fold", "Dry Cleaning", "Free WiFi", "Valet Parking"],
      isFeatured: true,
      isPremium: true,
      imageUrl: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
      description: "Luxury laundry services in the heart of Beverly Hills. Serving celebrities and locals alike since 1978.",
      distance: 0.2
    },
    {
      id: 95002,
      name: "Celebrity Cleaners",
      slug: "celebrity-cleaners",
      address: "8500 Olympic Blvd",
      city: "Beverly Hills",
      state: "CA",
      zip: "90210",
      phone: "310-555-7890",
      website: "https://celebritycleaners.example.com",
      latitude: "34.0593",
      longitude: "-118.3813",
      rating: "4.8",
      reviewCount: 287,
      hours: "6AM-9PM",
      services: ["Dry Cleaning", "Wash & Fold", "Alterations", "Leather Cleaning", "Wedding Dress Preservation"],
      isFeatured: true,
      isPremium: true,
      imageUrl: "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
      description: "Premium dry cleaning and laundry services. Our clients include Hollywood stars and production studios.",
      distance: 0.5
    },
    {
      id: 95003,
      name: "Rodeo Wash & Fold",
      slug: "rodeo-wash-fold",
      address: "9876 Rodeo Drive",
      city: "Beverly Hills",
      state: "CA",
      zip: "90210",
      phone: "310-555-4321",
      website: "https://rodeowash.example.com",
      latitude: "34.0698",
      longitude: "-118.4051",
      rating: "4.7",
      reviewCount: 201,
      hours: "24 Hours",
      services: ["Drop-off Service", "24/7 Service", "Free WiFi", "Contactless Pickup"],
      isFeatured: false,
      isPremium: true,
      imageUrl: "https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
      description: "24-hour laundry services just steps from Rodeo Drive. Express service available.",
      distance: 0.8
    },
    {
      id: 95004,
      name: "Sunset Laundromat",
      slug: "sunset-laundromat",
      address: "1234 Sunset Blvd",
      city: "Beverly Hills",
      state: "CA",
      zip: "90210",
      phone: "310-555-6789",
      website: "https://sunsetlaundry.example.com",
      latitude: "34.0837",
      longitude: "-118.3892",
      rating: "4.5",
      reviewCount: 178,
      hours: "6AM-11PM",
      services: ["Self-Service", "Free WiFi", "Vending Machines", "Large Capacity Machines"],
      isFeatured: false,
      isPremium: false,
      imageUrl: "https://images.unsplash.com/photo-1603566541830-78d41280bc76?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
      description: "Comfortable self-service laundromat with high-capacity machines for large loads.",
      distance: 1.2
    },
    {
      id: 95005,
      name: "Hills Express Cleaners",
      slug: "hills-express-cleaners",
      address: "4567 Santa Monica Blvd",
      city: "Beverly Hills",
      state: "CA",
      zip: "90210",
      phone: "310-555-2468",
      website: "https://hillsexpress.example.com",
      latitude: "34.0904",
      longitude: "-118.3980",
      rating: "4.6",
      reviewCount: 156,
      hours: "7AM-8PM",
      services: ["Dry Cleaning", "Wash & Fold", "Same-Day Service", "Eco-Friendly"],
      isFeatured: false,
      isPremium: false,
      imageUrl: "https://images.unsplash.com/photo-1613618818542-d7030a1b334d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
      description: "Fast and eco-friendly dry cleaning with same-day service available.",
      distance: 1.5
    }
  ];

  // Handle returning to regular search
  const handleSearch = (query: string, lat?: number, lng?: number) => {
    // If it's 90210, stay on this page
    if (query === '90210') {
      toast({
        title: 'Already showing Beverly Hills',
        description: 'You are already viewing laundromats in Beverly Hills (90210)'
      });
      return;
    }
    
    // For other searches, go to the main search page
    let url = '/map-search?';
    
    if (query) {
      url += `q=${encodeURIComponent(query)}`;
    }
    
    if (lat && lng) {
      url += `${query ? '&' : ''}lat=${lat}&lng=${lng}`;
    }
    
    setLocation(url);
  };

  // Filter laundromats based on user selections
  const filteredLaundromats = beverlyHillsLaundromats.filter(laundry => {
    // Filter by minimum rating if set
    if (filters.rating > 0) {
      const rating = parseFloat(laundry.rating || '0');
      if (rating < filters.rating) return false;
    }
    
    // Filter by selected services if any
    if (filters.services.length > 0) {
      // Need at least one service match
      const hasService = filters.services.some(service => 
        laundry.services?.includes(service)
      );
      if (!hasService) return false;
    }
    
    // Filter by open now if selected
    if (filters.openNow) {
      // Simple check for 24 Hours
      if (!laundry.hours || !laundry.hours.includes('24 Hours')) {
        const now = new Date();
        const hour = now.getHours();
        
        // Basic check assuming most places are open 8AM-8PM
        if (hour < 8 || hour >= 20) {
          return false;
        }
      }
    }
    
    return true;
  });
  
  // Sort laundromats based on user selection
  const sortedLaundromats = [...filteredLaundromats].sort((a, b) => {
    switch (filters.sortBy) {
      case 'rating':
        return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
      case 'name':
        return a.name.localeCompare(b.name);
      case 'services':
        return (b.services?.length || 0) - (a.services?.length || 0);
      case 'distance':
      default:
        return (parseFloat(a.distance?.toString() || '0') - 
                parseFloat(b.distance?.toString() || '0'));
    }
  });

  // Handle search filters changes
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Notify the user upon load
  useEffect(() => {
    toast({
      title: 'Showing Beverly Hills (90210)',
      description: 'Displaying 5 laundromats in Beverly Hills, California'
    });
  }, [toast]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Helmet>
        <title>Laundromats in Beverly Hills (90210) | LaundryLocator</title>
        <meta name="description" content="Find laundromats in Beverly Hills 90210. Compare ratings, services, and locations with our easy-to-use map search." />
        <meta property="og:title" content="Laundromats in Beverly Hills (90210) | LaundryLocator" />
        <meta property="og:description" content="Find laundromats in Beverly Hills 90210. Compare ratings, services, and locations with our easy-to-use map search." />
        <meta property="og:type" content="website" />
      </Helmet>
      
      {/* Search Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Laundromats in Beverly Hills (90210)</h1>
        <p className="text-gray-600">
          Find and compare laundromats in Beverly Hills with our interactive map
        </p>
      </div>
      
      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} defaultValue="90210" />
      </div>
      
      {/* Map and Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <Card className="h-[500px] overflow-hidden">
            <CardContent className="p-0 h-full">
              <LaundryMap 
                laundromats={sortedLaundromats} 
                center={mapCenter}
                zoom={13}
              />
            </CardContent>
          </Card>
          
          <div className="mt-4 text-gray-600">
            Showing {sortedLaundromats.length} laundromats in Beverly Hills (90210)
          </div>
        </div>
        
        {/* Filters and Results */}
        <div className="order-1 lg:order-2">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setFilters({
                    openNow: false,
                    rating: 0,
                    services: [],
                    sortBy: 'distance'
                  })}
                >
                  Clear
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Open Now */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="open-now" 
                    checked={filters.openNow}
                    onCheckedChange={(checked) => 
                      handleFilterChange('openNow', checked === true)
                    }
                  />
                  <label
                    htmlFor="open-now"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Open Now
                  </label>
                </div>
                
                {/* Minimum Rating */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Minimum Rating: {filters.rating > 0 ? filters.rating : 'Any'}
                  </label>
                  <Slider
                    value={[filters.rating]}
                    min={0}
                    max={5}
                    step={0.5}
                    onValueChange={(value) => handleFilterChange('rating', value[0])}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Any</span>
                    <span>5★</span>
                  </div>
                </div>
                
                {/* Services */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Services</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Wash & Fold', 'Dry Cleaning', 'Self-Service', 'Drop-off Service'].map(service => (
                      <div key={service} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`service-${service}`}
                          checked={filters.services.includes(service)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleFilterChange('services', [...filters.services, service]);
                            } else {
                              handleFilterChange('services', 
                                filters.services.filter(s => s !== service)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`service-${service}`}
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {service}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Sort By */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => handleFilterChange('sortBy', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Distance</SelectItem>
                      <SelectItem value="rating">Rating (High to Low)</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="services">Most Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Mobile Filters */}
          <div className="mb-4 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters & Sort
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters & Sort</SheetTitle>
                  <SheetDescription>
                    Filter and sort laundromats to find exactly what you need
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4 space-y-6">
                  {/* Open Now */}
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mobile-open-now" 
                      checked={filters.openNow}
                      onCheckedChange={(checked) => 
                        handleFilterChange('openNow', checked === true)
                      }
                    />
                    <label
                      htmlFor="mobile-open-now"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Open Now
                    </label>
                  </div>
                  
                  {/* Minimum Rating */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Minimum Rating: {filters.rating > 0 ? filters.rating : 'Any'}
                    </label>
                    <Slider
                      value={[filters.rating]}
                      min={0}
                      max={5}
                      step={0.5}
                      onValueChange={(value) => handleFilterChange('rating', value[0])}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Any</span>
                      <span>5★</span>
                    </div>
                  </div>
                  
                  {/* Services */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Services</label>
                    <div className="grid grid-cols-1 gap-2">
                      {['Wash & Fold', 'Dry Cleaning', 'Self-Service', 'Drop-off Service', 'Free WiFi', '24/7 Service'].map(service => (
                        <div key={service} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`mobile-service-${service}`}
                            checked={filters.services.includes(service)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleFilterChange('services', [...filters.services, service]);
                              } else {
                                handleFilterChange('services', 
                                  filters.services.filter(s => s !== service)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={`mobile-service-${service}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {service}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Sort By */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort By</label>
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => handleFilterChange('sortBy', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance">Distance</SelectItem>
                        <SelectItem value="rating">Rating (High to Low)</SelectItem>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="services">Most Services</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Clear Filters */}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setFilters({
                      openNow: false,
                      rating: 0,
                      services: [],
                      sortBy: 'distance'
                    })}
                  >
                    Clear All Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Results List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Results</h2>
            
            <div className="space-y-4">
              {sortedLaundromats.map((laundry) => (
                <Card key={laundry.id} className="overflow-hidden transition-all hover:shadow-md">
                  <Link href={`/laundromat/${laundry.slug}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-3">
                      {laundry.imageUrl && (
                        <div className="h-36 sm:h-full bg-gray-100">
                          <img 
                            src={laundry.imageUrl} 
                            alt={laundry.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className={`p-4 ${laundry.imageUrl ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
                        <div className="flex justify-between">
                          <h3 className="font-semibold text-lg">{laundry.name}</h3>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span>{laundry.rating}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-gray-500 text-sm mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span>
                            {laundry.address}, {laundry.city}, {laundry.state} {laundry.zip}
                          </span>
                        </div>
                        
                        {laundry.distance !== undefined && (
                          <div className="text-sm text-gray-500 mt-1">
                            {typeof laundry.distance === 'number' 
                              ? `${laundry.distance.toFixed(1)} miles away`
                              : `${parseFloat(laundry.distance.toString()).toFixed(1)} miles away`
                            }
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1">
                            {laundry.services?.slice(0, 3).map((service, i) => (
                              <span 
                                key={i}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                              >
                                {service}
                              </span>
                            ))}
                            {laundry.services && laundry.services.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                +{laundry.services.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-600">
                          {laundry.hours}
                        </div>
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeverlyHillsPage;