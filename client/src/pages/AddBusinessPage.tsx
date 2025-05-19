import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ArrowLeft, Store, MapPin, Phone, Globe, Clock, AlertTriangle } from 'lucide-react';

// Form validation schema
const addBusinessSchema = z.object({
  name: z.string().min(3, 'Business name must be at least 3 characters'),
  address: z.string().min(5, 'Please enter a valid street address'),
  city: z.string().min(2, 'City is required'),
  state: z.string().length(2, 'Please use 2-letter state code (e.g., TX)').toUpperCase(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'),
  phone: z.string().min(7, 'Valid phone number is required'),
  website: z.string().url('Please enter a valid URL').optional().nullable(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  hours: z.string().min(5, 'Please enter business hours'),
});

type FormValues = z.infer<typeof addBusinessSchema>;

const AddBusinessPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [newBusinessId, setNewBusinessId] = useState<number | null>(null);
  
  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(addBusinessSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      website: '',
      description: '',
      hours: '',
    },
  });
  
  // Add business mutation
  const addBusinessMutation = useMutation({
    mutationFn: (data: FormValues) => {
      return apiRequest('POST', '/api/business/add', data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setNewBusinessId(data.id);
      setIsSubmitted(true);
      
      toast({
        title: 'Business Added Successfully',
        description: 'Your business has been added to our directory.',
        variant: 'default',
      });
      
      window.scrollTo(0, 0);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Adding Business',
        description: error.message || 'An error occurred while adding your business.',
        variant: 'destructive',
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (data: FormValues) => {
    addBusinessMutation.mutate(data);
  };
  
  // Handle back button
  const handleBack = () => {
    setLocation('/business/search');
  };
  
  // Handle claim button
  const handleClaim = () => {
    if (newBusinessId) {
      setLocation(`/business/claim/${newBusinessId}`);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4 md:py-12">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={handleBack}
          disabled={addBusinessMutation.isPending}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>
        
        <div className="space-y-6">
          {isSubmitted && newBusinessId ? (
            <div className="space-y-6">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <AlertDescription className="text-green-700">
                  Your business has been successfully added to our directory!
                </AlertDescription>
              </Alert>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Next Steps</CardTitle>
                  <CardDescription>
                    To manage your business listing, you'll need to claim ownership
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>
                    You've successfully added your business to our directory. The next step is to claim ownership of your listing, which will allow you to:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Update your business information</li>
                    <li>Respond to customer reviews</li>
                    <li>Add photos and special offers</li>
                    <li>Track customer engagement with your listing</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleClaim} className="w-full md:w-auto">
                    <Store className="mr-2 h-4 w-4" />
                    Claim Your Business
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Add Your Business</h1>
                <p className="text-gray-500 mt-2">
                  Fill out the form below to add your laundromat to our directory
                </p>
              </div>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Store className="mr-2 h-5 w-5" />
                        Business Information
                      </CardTitle>
                      <CardDescription>
                        Basic details about your laundromat
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Name*</FormLabel>
                            <FormControl>
                              <Input placeholder="Your Laundromat Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Tell customers about your services, unique features, etc."
                                className="min-h-[100px]"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormDescription>
                              {field.value ? field.value.length : 0}/500 characters
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MapPin className="mr-2 h-5 w-5" />
                        Location
                      </CardTitle>
                      <CardDescription>
                        Where customers can find your business
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address*</FormLabel>
                            <FormControl>
                              <Input placeholder="123 Main St" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid gap-4 sm:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City*</FormLabel>
                              <FormControl>
                                <Input placeholder="City" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State*</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="TX" 
                                  maxLength={2}
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e.target.value.toUpperCase());
                                  }}
                                />
                              </FormControl>
                              <FormDescription>
                                2-letter code
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="zip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP Code*</FormLabel>
                              <FormControl>
                                <Input placeholder="12345" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Phone className="mr-2 h-5 w-5" />
                        Contact Information
                      </CardTitle>
                      <CardDescription>
                        How customers can reach your business
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number*</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="https://www.example.com" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Clock className="mr-2 h-5 w-5" />
                        Business Hours
                      </CardTitle>
                      <CardDescription>
                        When customers can visit your business
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder={`Monday-Friday: 7:00 AM - 10:00 PM\nSaturday: 8:00 AM - 9:00 PM\nSunday: 8:00 AM - 8:00 PM`}
                                className="min-h-[100px]"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Enter your operating hours for each day
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                  
                  <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 text-sm">
                      By submitting this form, you confirm that you have the authority to add this business and that all information provided is accurate.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={addBusinessMutation.isPending}
                      className="w-full md:w-auto"
                    >
                      {addBusinessMutation.isPending ? (
                        <>
                          <span className="animate-spin mr-2">⟳</span>
                          Adding Business...
                        </>
                      ) : (
                        'Add Business'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddBusinessPage;