import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MetaTags from '@/components/MetaTags';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Search, Building, Phone, Clock } from 'lucide-react';
import type { Laundromat } from '@shared/schema';

// Form validation schema
const searchSchema = z.object({
  searchQuery: z.string().min(3, 'Please enter at least 3 characters'),
});

type SearchFormValues = z.infer<typeof searchSchema>;

const BusinessSearchPage: React.FC = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Laundromat[]>([]);
  
  // Initialize form
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      searchQuery: '',
    },
  });
  
  // Handle form submission for business search
  const onSubmit = async (data: SearchFormValues) => {
    try {
      setIsSearching(true);
      
      // Make API request to search for businesses
      const response = await fetch(`/api/business/search?q=${encodeURIComponent(data.searchQuery)}`);
      
      if (!response.ok) {
        throw new Error('Failed to search for businesses');
      }
      
      const results = await response.json();
      setSearchResults(results);
      
      if (results.length === 0) {
        toast({
          title: 'No Results Found',
          description: 'No laundromats match your search criteria. Try a different search or add your business.',
        });
      }
      
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search Failed',
        description: 'There was a problem searching for businesses. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  // Handle claiming a business
  const handleClaimBusiness = (businessId: number) => {
    navigate(`/business/claim/${businessId}`);
  };
  
  // Handle adding a new business
  const handleAddNewBusiness = () => {
    navigate('/business/add');
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      <MetaTags 
        title="Claim Your Laundromat Business | Laundromat Near Me"
        description="Claim your laundromat business listing to update information, respond to reviews, and enhance your online presence."
      />
      
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Claim Your Business</h1>
          <p className="text-gray-600 mb-8">
            Search for your laundromat business to claim ownership and manage your listing.
          </p>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Search For Your Business</CardTitle>
              <CardDescription>
                Enter your business name, address, or phone number to find your listing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="searchQuery"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name or Location</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input 
                              placeholder="Enter business name, address, or phone number"
                              {...field} 
                            />
                          </FormControl>
                          <Button 
                            type="submit" 
                            disabled={isSearching}
                            className="flex-shrink-0"
                          >
                            {isSearching ? (
                              <>
                                <span className="animate-spin mr-2">⟳</span>
                                Searching...
                              </>
                            ) : (
                              <>
                                <Search className="h-4 w-4 mr-2" />
                                Search
                              </>
                            )}
                          </Button>
                        </div>
                        <FormDescription>
                          Search by full or partial name, street address, city, state, or phone number
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4">Search Results</h2>
              <div className="space-y-4">
                {searchResults.map((business) => (
                  <Card key={business.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-lg font-bold">{business.name}</h3>
                            <div className="flex items-center text-gray-500 text-sm mb-1">
                              <MapPin className="h-3.5 w-3.5 mr-1" />
                              <span>{business.address}, {business.city}, {business.state} {business.zip}</span>
                            </div>
                            <div className="flex items-center text-gray-500 text-sm">
                              <Phone className="h-3.5 w-3.5 mr-1" />
                              <span>{business.phone || 'No phone listed'}</span>
                            </div>
                          </div>
                          <div>
                            {business.ownerId ? (
                              <Badge variant="outline" className="bg-gray-100">Already Claimed</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available to Claim</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="p-4 bg-gray-50 flex justify-end">
                        <Button
                          onClick={() => handleClaimBusiness(business.id)}
                          disabled={!!business.ownerId}
                          variant={business.ownerId ? "outline" : "default"}
                        >
                          {business.ownerId ? 'Already Claimed' : 'Claim This Business'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {/* Don't see your business section */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Don't See Your Business?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                If your laundromat doesn't appear in the search results, you can add it to our directory.
              </p>
              <Button onClick={handleAddNewBusiness} variant="outline">
                Add New Laundromat
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default BusinessSearchPage;