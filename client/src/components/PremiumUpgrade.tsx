import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/queryClient';
import * as z from 'zod';
import { queryClient } from '@/lib/queryClient';
import { Check, Star, CreditCard, Sparkles, Award, Clock } from 'lucide-react';
import { laundromats } from '@shared/schema';

// Card payment form schema
const paymentFormSchema = z.object({
  cardNumber: z.string().min(1, { message: 'Card number is required' }),
  cardExpiry: z.string().min(1, { message: 'Expiry date is required' }),
  cardCvc: z.string().min(1, { message: 'CVC is required' }),
  cardName: z.string().min(1, { message: 'Cardholder name is required' }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PremiumUpgradeProps {
  laundryId: number;
  onSuccess?: () => void;
}

export default function PremiumUpgrade({ laundryId, onSuccess }: PremiumUpgradeProps) {
  const [selectedTier, setSelectedTier] = useState<'premium' | 'featured'>('premium');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      cardNumber: '',
      cardExpiry: '',
      cardCvc: '',
      cardName: '',
    },
  });

  // Simulated payment method creation function
  const createPaymentMethod = async (paymentDetails: PaymentFormValues) => {
    // In a real implementation, this would use the Stripe.js library
    // to create a payment method token securely
    
    // This is a simplified simulation
    console.log('Creating payment method with:', paymentDetails);
    
    // Return a simulated payment method ID
    return { id: `pm_${Math.random().toString(36).substring(2, 15)}` };
  };

  async function onSubmit(values: PaymentFormValues) {
    try {
      setProcessing(true);
      
      // Create a payment method (this would use Stripe.js in a real implementation)
      const paymentMethod = await createPaymentMethod(values);
      
      // Submit to backend
      const response = await apiRequest('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          laundryId,
          tier: selectedTier,
          paymentMethodId: paymentMethod.id,
        }),
      });
      
      if (response.success) {
        toast({
          title: 'Upgrade Successful',
          description: `Your listing has been upgraded to ${selectedTier} status.`,
          variant: 'default',
        });
        
        // Invalidate relevant queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/laundromats/${laundryId}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/laundromats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/featured-laundromats'] });
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(response.message || 'Failed to upgrade listing');
      }
    } catch (error: any) {
      toast({
        title: 'Upgrade Failed',
        description: error.message || 'There was a problem processing your payment.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="premium-upgrade-container">
      <Tabs defaultValue="premium" onValueChange={(value) => setSelectedTier(value as 'premium' | 'featured')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="premium">Premium</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
        </TabsList>
        
        <TabsContent value="premium">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="w-5 h-5 mr-2 text-blue-500" />
                Premium Listing
              </CardTitle>
              <CardDescription>
                Enhanced visibility and features for your laundromat listing
              </CardDescription>
              <div className="text-2xl font-bold">$25<span className="text-sm font-normal text-gray-500">/month</span></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Enhanced visibility in search results</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Photo gallery (up to 5 photos)</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Extended description section</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>List special offers and promotions</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Highlight amenities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="featured">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="w-5 h-5 mr-2 text-yellow-500" />
                Featured Listing
              </CardTitle>
              <CardDescription>
                Maximum visibility and premium features for your laundromat
              </CardDescription>
              <div className="text-2xl font-bold">$50<span className="text-sm font-normal text-gray-500">/month</span></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500 shrink-0" />
                  <p>Top placement in search results</p>
                </div>
                <div className="flex items-start">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500 shrink-0" />
                  <p>Featured on homepage rotation</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>All Premium features included</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Photo gallery (up to 10 photos)</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Promotional badge on listing</p>
                </div>
                <div className="flex items-start">
                  <Check className="w-5 h-5 mr-2 text-green-500 shrink-0" />
                  <p>Analytics dashboard</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="payment-form mt-6">
        <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cardName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cardholder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Number</FormLabel>
                  <FormControl>
                    <Input placeholder="1234 5678 9012 3456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cardExpiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input placeholder="MM/YY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cardCvc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVC</FormLabel>
                    <FormControl>
                      <Input placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex items-start mt-4">
              <Clock className="w-5 h-5 mr-2 text-gray-500 shrink-0" />
              <p className="text-sm text-gray-500">
                Your subscription will automatically renew each month. You can cancel anytime.
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={processing}
            >
              {processing ? 'Processing...' : `Upgrade to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}