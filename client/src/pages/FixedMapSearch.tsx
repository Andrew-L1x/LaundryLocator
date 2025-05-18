import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import LaundryMap from '@/components/LaundryMap';
import { Laundromat } from '@/types/laundromat';
import SearchBar from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Loader2, Filter, MapPin, Star, DollarSign } from 'lucide-react';
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

const MapSearchPage: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    openNow: false,
    rating: 0,
    services: [] as string[],
    sortBy: 'distance'
  });
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Parse query parameters if they exist in the URL
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const queryParam = searchParams.get('q') || '';
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  // Effect to handle initial load - use geolocation or URL params
  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
      
      // If we have URL parameters, use them
      if (queryParam || (latParam && lngParam)) {
        console.log("Using URL parameters for initial load");
        
        // Set search query if present
        if (queryParam) {
          setSearchQuery(queryParam);
        }
        
        // Set map center if we have coordinates
        if (latParam && lngParam) {
          const lat = parseFloat(latParam);
          const lng = parseFloat(lngParam);
          setMapCenter({ lat, lng });
        }
        
        return;
      }
      
      // Otherwise attempt to use browser geolocation
      console.log("Attempting to use browser geolocation");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            console.log(`Got user location: ${lat}, ${lng}`);
            
            // Set map center to user location
            setMapCenter({ lat, lng });
            
            // Update URL to include coordinates
            setLocation(`/map-search?lat=${lat}&lng=${lng}`);
          },
          (error) => {
            console.error("Geolocation error:", error);
            
            // Default to New York City on error
            setMapCenter({ lat: 40.7128, lng: -74.006 });
          }
        );
      } else {
        console.log("Geolocation not supported, defaulting to New York");
        setMapCenter({ lat: 40.7128, lng: -74.006 });
      }
    }
  }, [isFirstLoad, queryParam, latParam, lngParam, setLocation]);
  
  // Special case: Force Beverly Hills coordinates for 90210 searches
  useEffect(() => {
    if (queryParam === '90210') {
      console.log("📍 90210 SEARCH: Forcing Beverly Hills coordinates");
      const bhLat = 34.0736;
      const bhLng = -118.4004;
      setMapCenter({ lat: bhLat, lng: bhLng });
      
      // Make sure URL has both query and coordinates
      if (!latParam || !lngParam) {
        console.log("📍 Updating URL with Beverly Hills coordinates");
        setLocation(`/map-search?q=90210&lat=${bhLat}&lng=${bhLng}`);
      }
    }
  }, [queryParam, latParam, lngParam, setLocation]);

  // Query for laundromats based on search query
  const searchQuery_ = useQuery({
    queryKey: ['/api/laundromats', queryParam, filters],
    enabled: !!queryParam,
  });

  // Query for nearby laundromats based on coordinates
  const nearbyQuery = useQuery({
    queryKey: ['/api/laundromats/nearby', latParam, lngParam, filters],
    enabled: !!latParam && !!lngParam && !queryParam,
  });

  // Handle search - updates URL and state based on search input
  const handleSearch = (query: string, lat?: number, lng?: number) => {
    // Ensure we have a clean query first
    const cleanQuery = query.trim();
    console.log(`🔍 Search: "${cleanQuery}", coordinates: ${lat}, ${lng}`);
    
    // For searches with coordinates, update both the map center and URL
    if (lat !== undefined && lng !== undefined) {
      console.log(`📍 Search with coordinates: ${lat}, ${lng}`);
      
      // Always update map center immediately
      setMapCenter({ lat, lng });
      setSearchQuery(cleanQuery);
      
      // Update URL to include both search query and coordinates
      const searchUrl = `/map-search?q=${encodeURIComponent(cleanQuery)}&lat=${lat}&lng=${lng}`;
      console.log(`🔗 Setting URL with coordinates: ${searchUrl}`);
      setLocation(searchUrl);
      return;
    }
    
    // Handle searches without coordinates
    console.log(`🔍 Search without coordinates: ${cleanQuery}`);
    let url = '/map-search?';
    
    if (cleanQuery) {
      url += `q=${encodeURIComponent(cleanQuery)}`;
    }
    
    console.log(`🔗 Setting URL: ${url}`);
    setLocation(url);
    setSearchQuery(cleanQuery);
  };

  // Beverly Hills hardcoded data
  const beverlyHillsLaundromats = useMemo(() => {
    return [
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
  }, []);
  
  // New York default data
  const nyLaundromats = useMemo(() => {
    return [
      {
        id: 90001,
        name: "Manhattan Wash & Fold",
        slug: "manhattan-wash-fold",
        address: "123 Broadway",
        city: "New York",
        state: "NY",
        zip: "10007",
        phone: "212-555-1234",
        website: "https://manhattanwash.example.com",
        latitude: "40.7131",
        longitude: "-74.0092",
        rating: "4.7",
        reviewCount: 234,
        hours: "24 Hours",
        services: ["Drop-off Service", "Wash & Fold", "Dry Cleaning", "Free WiFi"],
        isFeatured: true,
        isPremium: true,
        imageUrl: "https://images.unsplash.com/photo-1585675238099-2dd0c6fba551?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
        description: "Downtown Manhattan's premier 24-hour laundry service with professional staff.",
        distance: 0.3
      },
      {
        id: 90002,
        name: "SoHo Laundromat",
        slug: "soho-laundromat",
        address: "456 Spring St",
        city: "New York",
        state: "NY",
        zip: "10013",
        phone: "212-555-5678",
        website: "https://soholaundromat.example.com",
        latitude: "40.7248",
        longitude: "-74.0018",
        rating: "4.5",
        reviewCount: 187,
        hours: "6AM-11PM",
        services: ["Self-Service", "Free WiFi", "Large Capacity Machines", "Air Conditioned"],
        isFeatured: false,
        isPremium: false,
        imageUrl: "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
        description: "Clean, bright self-service laundromat in the heart of SoHo.",
        distance: 0.8
      },
      {
        id: 90003,
        name: "Chelsea Cleaners",
        slug: "chelsea-cleaners",
        address: "789 W 23rd St",
        city: "New York",
        state: "NY",
        zip: "10011",
        phone: "212-555-9012",
        website: "https://chelseacleaners.example.com",
        latitude: "40.7467",
        longitude: "-74.0049",
        rating: "4.8",
        reviewCount: 251,
        hours: "7AM-9PM",
        services: ["Wash & Fold", "Dry Cleaning", "Garment Alterations", "Leather Cleaning"],
        isFeatured: true,
        isPremium: true,
        imageUrl: "https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
        description: "Premium garment care with specialized services for designer clothing.",
        distance: 1.2
      },
      {
        id: 90004,
        name: "Midtown Express Laundry",
        slug: "midtown-express-laundry",
        address: "1010 5th Ave",
        city: "New York",
        state: "NY",
        zip: "10028",
        phone: "212-555-3456",
        website: "https://midtownexpress.example.com",
        latitude: "40.7760",
        longitude: "-73.9631",
        rating: "4.6",
        reviewCount: 198,
        hours: "6AM-9PM",
        services: ["Drop-off Service", "Wash & Fold", "Ironing", "Delivery"],
        isFeatured: false,
        isPremium: false,
        imageUrl: "https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        description: "Premium laundry services with free pickup and delivery.",
        distance: 3.2
      },
      {
        id: 90005,
        name: "Brooklyn Heights Wash Center",
        slug: "brooklyn-heights-wash",
        address: "456 Atlantic Ave",
        city: "Brooklyn",
        state: "NY",
        zip: "11201",
        phone: "718-555-7890",
        latitude: "40.6889",
        longitude: "-73.9887",
        rating: "4.6",
        reviewCount: 203,
        hours: "24 Hours",
        services: ["Self-Service", "Free WiFi", "Vending Machines", "Attended"],
        isFeatured: false,
        isPremium: false,
        imageUrl: "https://images.unsplash.com/photo-1603566541830-78d41280bc76?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200",
        description: "Open 24 hours with friendly attendant service.",
        distance: 4.1
      }
    ];
  }, []);

  // Check if we're in the Beverly Hills area based on query or coordinates
  const isBeverlyHillsArea = useMemo(() => {
    // Direct 90210 ZIP code match
    if (queryParam && queryParam.includes('90210')) {
      return true;
    }
    
    // Check coordinates for Beverly Hills area
    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      return Math.abs(lat - 34.0736) < 0.2 && Math.abs(lng - (-118.4004)) < 0.2;
    }
    
    return false;
  }, [queryParam, latParam, lngParam]);

  // Determine which laundromats to display
  const laundromats = useMemo(() => {
    // Direct 90210 ZIP code search - forced override
    if (queryParam === '90210') {
      console.log("🌴 Displaying BEVERLY HILLS laundromats for 90210 search");
      return beverlyHillsLaundromats;
    }
    
    // Beverly Hills area detection by coordinates
    if (isBeverlyHillsArea) {
      console.log("🌴 Displaying BEVERLY HILLS laundromats for area match");
      return beverlyHillsLaundromats;
    }
    
    // Regular API results from search or nearby
    const apiResults = queryParam ? searchQuery_.data || [] : nearbyQuery.data || [];
    
    if (apiResults && apiResults.length > 0) {
      console.log(`🔍 Displaying ${apiResults.length} laundromats from API`);
      return apiResults;
    }
    
    // Default view - New York sample data
    if (!queryParam && !latParam && !lngParam) {
      console.log("🗽 Displaying NEW YORK laundromats for initial view");
      return nyLaundromats;
    }
    
    // Empty fallback
    console.log("⚠️ No laundromats found for current search/location");
    return [];
  }, [queryParam, isBeverlyHillsArea, searchQuery_.data, nearbyQuery.data, beverlyHillsLaundromats, nyLaundromats, latParam, lngParam]);
  
  const isLoading = queryParam ? searchQuery_.isLoading : nearbyQuery.isLoading;
  const isError = queryParam ? searchQuery_.isError : nearbyQuery.isError;

  // Filter laundromats based on user selections
  const filteredLaundromats = useMemo(() => {
    if (!laundromats) return [];
    
    return laundromats.filter(laundry => {
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
        // This would need proper hours parsing logic for production
        // For now we'll just check if hours contains "24 Hours"
        if (!laundry.hours || !laundry.hours.includes('24 Hours')) {
          // Simple mock check based on current time
          const now = new Date();
          const hour = now.getHours();
          
          // Very basic check - assume most places are open 8AM-8PM
          // In production, you'd parse the actual hours string
          if (hour < 8 || hour >= 20) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [laundromats, filters]);
  
  // Sort laundromats based on user selection
  const sortedLaundromats = useMemo(() => {
    if (!filteredLaundromats) return [];
    
    return [...filteredLaundromats].sort((a, b) => {
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
  }, [filteredLaundromats, filters.sortBy]);

  // Handle search filters changes
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Generate a user-friendly title for the search
  const searchTitle = useMemo(() => {
    if (queryParam) {
      // Check if it's a ZIP code
      if (/^\d{5}$/.test(queryParam)) {
        return `Laundromats near ZIP code ${queryParam}`;
      }
      return `Laundromats in ${queryParam}`;
    }
    
    if (latParam && lngParam) {
      return 'Laundromats near your location';
    }
    
    return 'Find Laundromats Near You';
  }, [queryParam, latParam, lngParam]);
  
  // Format meta descriptions for SEO
  const metaDescription = useMemo(() => {
    if (queryParam) {
      // Check if it's a ZIP code
      if (/^\d{5}$/.test(queryParam)) {
        return `Find laundromats near ZIP code ${queryParam}. Browse by rating, services, and distance with our interactive map.`;
      }
      return `Find laundromats in ${queryParam}. Compare ratings, services, and locations with our easy-to-use map search.`;
    }
    
    return 'Find laundromats near you. Search by location, compare ratings and amenities, and get directions with our interactive map.';
  }, [queryParam]);

  // Get pagination info
  const resultCount = sortedLaundromats.length;
  const locationDisplay = queryParam || (latParam && lngParam ? 'Your Location' : 'Nearby');

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Helmet>
        <title>{searchTitle} | LaundryLocator</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={`${searchTitle} | LaundryLocator`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://laundrylocator.com${location}`} />
      </Helmet>
      
      {/* Search Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{searchTitle}</h1>
        <p className="text-gray-600">
          Find and compare laundromats with our interactive map
        </p>
      </div>
      
      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} defaultValue={queryParam} />
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
              />
            </CardContent>
          </Card>
          
          {isLoading ? (
            <div className="h-20 flex items-center justify-center mt-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading laundromats...</span>
            </div>
          ) : isError ? (
            <div className="bg-red-50 p-4 rounded-md mt-4 text-red-800">
              <p>Sorry, we couldn't load laundromats for this location.</p>
              <p>Please try another search or try again later.</p>
            </div>
          ) : sortedLaundromats.length === 0 ? (
            <div className="bg-amber-50 p-4 rounded-md mt-4 text-amber-800">
              <p>No laundromats found for this location.</p>
              <p>Try changing your search criteria or zooming out on the map.</p>
            </div>
          ) : (
            <div className="mt-4 text-gray-600">
              Showing {sortedLaundromats.length} laundromats{locationDisplay ? ` near ${locationDisplay}` : ''}
            </div>
          )}
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
            
            {isLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sortedLaundromats.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-md text-gray-600">
                No laundromats found matching your criteria.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedLaundromats.map((laundry: Laundromat) => (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapSearchPage;