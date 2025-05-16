import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PREMIUM_PLANS, ListingType, formatPrice } from '@shared/premium-features';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import PremiumPlanCards from './PremiumPlanCards';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PremiumUpgradeProps {
  laundryId: number;
  userId: number;
  onSuccess: () => void;
  currentPlan?: ListingType;
}

const PremiumUpgradeForm = ({ laundryId, userId, onSuccess, currentPlan = 'basic' }: PremiumUpgradeProps) => {
  const [selectedPlan, setSelectedPlan] = useState<ListingType | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [clientSecret, setClientSecret] = useState('');
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const { toast } = useToast();
  
  // Step 1: User selects a plan
  const handleSelectPlan = async (plan: ListingType, cycle: 'monthly' | 'annually') => {
    if (plan === 'basic') return; // Can't upgrade to basic
    
    setSelectedPlan(plan);
    setBillingCycle(cycle);
    setIsCreatingIntent(true);
    
    try {
      // Get the price from our premium plans config
      const amount = cycle === 'monthly' 
        ? PREMIUM_PLANS[plan].monthlyPrice 
        : PREMIUM_PLANS[plan].annualPrice;
      
      // Create payment intent on the server
      const response = await apiRequest('POST', '/api/create-subscription', {
        laundryId,
        userId,
        tier: plan,
        amount,
        billingCycle: cycle
      });
      
      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setShowPaymentForm(true);
      } else {
        throw new Error('Failed to create payment intent');
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      toast({
        title: 'Payment setup failed',
        description: 'There was an error setting up the payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingIntent(false);
    }
  };
  
  const handleCancelUpgrade = () => {
    setSelectedPlan(null);
    setShowPaymentForm(false);
  };
  
  if (isPaymentComplete) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">Upgrade Complete!</h3>
        <p className="text-muted-foreground mb-4">Your listing has been successfully upgraded.</p>
        <Button onClick={() => {
          setIsPaymentComplete(false);
          setShowPaymentForm(false);
          setSelectedPlan(null);
          onSuccess();
        }}>
          Return to Dashboard
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      {/* Step 1: Show plan options */}
      {!showPaymentForm && (
        <div>
          <p className="text-muted-foreground mb-4">
            Choose a premium plan to enhance your laundromat listing's visibility and features
          </p>
          
          <PremiumPlanCards 
            onSelectPlan={handleSelectPlan} 
            currentPlan={currentPlan} 
          />
          
          {isCreatingIntent && (
            <div className="fixed inset-0 bg-background/80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Setting up payment...</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Step 2: Payment form */}
      {showPaymentForm && clientSecret && (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">
              {selectedPlan === 'premium' ? 'Premium Plan' : 'Featured Plan'} - {billingCycle === 'monthly' ? 'Monthly' : 'Annual'} Subscription
            </h3>
            <p className="text-muted-foreground">
              {billingCycle === 'monthly' 
                ? `${formatPrice(PREMIUM_PLANS[selectedPlan!].monthlyPrice)}/month`
                : `${formatPrice(PREMIUM_PLANS[selectedPlan!].annualPrice)}/year`}
            </p>
          </div>
          
          <CheckoutForm 
            clientSecret={clientSecret}
            onSuccess={() => setIsPaymentComplete(true)}
            onCancel={handleCancelUpgrade}
          />
        </div>
      )}
    </div>
  );
};

interface CheckoutFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutForm = ({ clientSecret, onSuccess, onCancel }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin, // Redirect is handled manually
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'An error occurred during payment processing');
        toast({
          title: 'Payment failed',
          description: error.message || 'There was an issue processing your payment',
          variant: 'destructive',
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast({
          title: 'Payment successful',
          description: 'Your subscription has been activated',
        });
        onSuccess();
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {errorMessage && (
        <div className="text-red-500 text-sm mt-2">{errorMessage}</div>
      )}
      
      <div className="flex justify-between mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Back
        </Button>
        
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="min-w-[120px]"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            'Pay Now'
          )}
        </Button>
      </div>
    </form>
  );
};

const PremiumUpgrade = (props: PremiumUpgradeProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)} 
        className="w-full"
      >
        Upgrade Listing
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upgrade Your Listing</DialogTitle>
            <DialogDescription>
              Choose a premium plan to enhance your visibility and attract more customers
            </DialogDescription>
          </DialogHeader>
          
          {import.meta.env.VITE_STRIPE_PUBLIC_KEY ? (
            <Elements stripe={stripePromise} options={{ clientSecret: '' }}>
              <PremiumUpgradeForm 
                {...props} 
                onSuccess={() => {
                  props.onSuccess();
                  setIsOpen(false);
                }}
              />
            </Elements>
          ) : (
            <div className="p-4 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-md">
              <p>Payment system is currently unavailable. Please try again later.</p>
            </div>
          )}
          
          <DialogFooter className="sm:justify-start">
            <div className="w-full text-xs text-muted-foreground">
              <p>Payments are securely processed by Stripe. You can cancel your subscription at any time.</p>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PremiumUpgrade;