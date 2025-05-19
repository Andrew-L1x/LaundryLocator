import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, CreditCard, Check, Info, ArrowLeft } from 'lucide-react';

// Make sure to call loadStripe outside of a component's render to avoid recreating the Stripe object on every render
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ laundryId, onSuccess }: { laundryId: string; onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/business/dashboard',
        },
      });

      if (error) {
        setErrorMessage(error.message || 'An unexpected error occurred');
        toast({
          title: 'Payment Failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Payment succeeded
        onSuccess();
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An unexpected error occurred');
      toast({
        title: 'Payment Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      
      {errorMessage && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <div className="mt-6">
        <Button 
          type="submit" 
          disabled={!stripe || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Confirm Payment Method
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

const BusinessSubscriptionPage = () => {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch laundromat details
  const { data: laundromat, isLoading: laundryLoading } = useQuery({
    queryKey: ['/api/laundromats', id],
    retry: false,
  });

  // Start subscription mutation
  const startSubscriptionMutation = useMutation({
    mutationFn: () => {
      return apiRequest('POST', '/api/business/start-subscription', { laundryId: id });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setClientSecret(data.clientSecret);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Setting Up Subscription',
        description: error.message || 'An error occurred while setting up your subscription',
        variant: 'destructive',
      });
    },
  });

  // Fetch payment intent when component loads
  useEffect(() => {
    if (id && !clientSecret && !paymentSuccess) {
      startSubscriptionMutation.mutate();
    }
  }, [id, clientSecret, paymentSuccess]);

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    toast({
      title: 'Payment Method Added Successfully!',
      description: 'Your Premium subscription is now active.',
      variant: 'default',
    });
    
    // Redirect to dashboard after successful payment
    setTimeout(() => {
      setLocation('/business/dashboard');
    }, 2000);
  };

  if (laundryLoading || startSubscriptionMutation.isPending) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:py-12">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => setLocation('/business/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Premium Subscription</h1>
            <p className="text-gray-500 mt-1">
              Set up your payment method for your Premium subscription
            </p>
          </div>
          
          {paymentSuccess ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-green-100 p-3 mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Payment Successful!</h2>
                  <p className="text-gray-500 mb-6">
                    Your premium subscription is now active. Redirecting to your dashboard...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Business info card */}
              {laundromat && (
                <Card className="mb-8">
                  <CardHeader className="pb-3">
                    <CardTitle>{laundromat.name}</CardTitle>
                    <CardDescription>
                      Premium Subscription Details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between border-b pb-2">
                      <span>Plan</span>
                      <span className="font-medium">Premium</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span>Price</span>
                      <span className="font-medium">$19.99/month</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span>Free Trial</span>
                      <span className="font-medium">30 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>First Payment</span>
                      <span className="font-medium">After 30 days</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Alert className="mb-6">
                <Info className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  Your card won't be charged until after your 30-day free trial. You can cancel anytime before then.
                </AlertDescription>
              </Alert>
              
              {/* Payment form */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>
                    Add your payment method to continue with your Premium subscription
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <CheckoutForm 
                        laundryId={id as string} 
                        onSuccess={handlePaymentSuccess} 
                      />
                    </Elements>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessSubscriptionPage;