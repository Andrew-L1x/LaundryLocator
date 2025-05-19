import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Store, MapPin, Phone, ChevronRight, Info, Star } from 'lucide-react';

const BusinessSearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Search query with debouncing
  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['/api/business/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      
      const response = await fetch(`/api/business/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Failed to search businesses');
      }
      return response.json();
    },
    enabled: searchQuery.length >= 3,
  });
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchQuery.length < 3) {
      toast({
        title: 'Search Query Too Short',
        description: 'Please enter at least 3 characters to search',
        variant: 'destructive',
      });
    }
  };
  
  // Handle business selection
  const handleSelectBusiness = (id: number) => {
    setLocation(`/business/claim/${id}`);
  };
  
  // Handle adding a new business
  const handleAddBusiness = () => {
    setLocation('/business/add');
  };
  
  return (
    <div className="container mx-auto py-8 px-4 md:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Find Your Business</h1>
            <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
              Search for your laundromat to claim ownership and manage your business listing
            </p>
          </div>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Search Your Business</CardTitle>
              <CardDescription>
                Enter your business name, city, or phone number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchSubmit} className="flex space-x-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Search businesses..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    minLength={3}
                  />
                </div>
                <Button type="submit" disabled={searchQuery.length < 3 || isLoading}>
                  Search
                </Button>
              </form>
              
              {searchQuery.length > 0 && searchQuery.length < 3 && (
                <p className="text-sm text-gray-500 mt-2">
                  Please enter at least 3 characters to search
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Search results */}
          {searchQuery.length >= 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {isLoading
                    ? 'Searching...'
                    : searchResults && searchResults.length > 0
                    ? `Found ${searchResults.length} results`
                    : 'No results found'}
                </h2>
                
                <Button 
                  variant="outline" 
                  onClick={handleAddBusiness}
                  disabled={isLoading}
                >
                  <Store className="mr-2 h-4 w-4" />
                  Add New Business
                </Button>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.map((business: any) => (
                    <Card key={business.id} className="overflow-hidden transition-all hover:border-primary/50">
                      <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row">
                          <div className="p-4 md:p-6 flex-grow">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-lg font-semibold">{business.name}</h3>
                                <div className="flex items-center text-sm text-gray-500 mt-1">
                                  <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                                  <span>
                                    {business.address}, {business.city}, {business.state} {business.zip}
                                  </span>
                                </div>
                                {business.phone && (
                                  <div className="flex items-center text-sm text-gray-500 mt-1">
                                    <Phone className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                                    <span>{business.phone}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {business.ownerId ? (
                                  <Badge variant="secondary">Claimed</Badge>
                                ) : (
                                  <Badge variant="outline">Unclaimed</Badge>
                                )}
                                {business.rating && (
                                  <Badge variant="secondary" className="flex items-center">
                                    <Star className="h-3 w-3 mr-1 fill-current" />
                                    {business.rating}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-4 md:border-l bg-gray-50 md:flex md:items-center md:justify-center">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSelectBusiness(business.id)}
                              disabled={!!business.ownerId}
                              className="w-full md:w-auto"
                            >
                              {business.ownerId ? (
                                'Already Claimed'
                              ) : (
                                <>
                                  Claim Business
                                  <ChevronRight className="ml-2 h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchQuery.length >= 3 && !isLoading ? (
                <div>
                  <Alert className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      We couldn't find a business matching "{searchQuery}". If your business isn't listed, you can add it.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="text-center py-4">
                    <Button onClick={handleAddBusiness}>
                      <Store className="mr-2 h-4 w-4" />
                      Add Your Business
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          
          <div className="rounded-lg border bg-card p-6 mt-8">
            <h3 className="font-semibold text-lg mb-2">Why claim your business?</h3>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Get found by more customers looking for laundry services</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Respond to customer reviews and improve your reputation</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Update business information like hours, services, and contact details</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Add photos and promotional offers to attract more customers</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessSearchPage;