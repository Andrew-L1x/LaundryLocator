import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { 
  useStripe, 
  useElements, 
  Elements, 
  PaymentElement 
} from '@stripe/react-stripe-js';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, CreditCard, CheckCircle } from 'lucide-react';
import PremiumPlanCards from './PremiumPlanCards';
import { ListingType } from '@shared/schema';
import { PREMIUM_PRICING } from '@shared/premium-features';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PremiumUpgradeProps {
  laundryId: number;
  userId: number;
  onSuccess: () => void;
  currentPlan?: ListingType;
}

interface CheckoutFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ clientSecret, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin, // For redirect flow, not used in this case
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: 'Payment Failed',
          description: error.message || 'An error occurred during payment.',
          variant: 'destructive',
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast({
          title: 'Payment Successful',
          description: 'Your subscription has been activated!',
        });
        onSuccess();
      }
    } catch (err: any) {
      toast({
        title: 'Payment Error',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onCancel} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Plans
      </Button>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <PaymentElement />
        
        <div className="flex flex-col space-y-2">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={!stripe || !elements || isProcessing}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center">
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Now
              </span>
            )}
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

const SuccessMessage: React.FC<{ plan: ListingType, onClose: () => void }> = ({ plan, onClose }) => {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold">Subscription Activated!</h2>
      <p className="text-muted-foreground">
        Your {PREMIUM_PRICING[plan].name} has been successfully activated. 
        Your listing will now receive enhanced visibility and premium features.
      </p>
      <Button onClick={onClose} className="mt-4">
        Done
      </Button>
    </div>
  );
};

const PremiumUpgradeForm = ({ laundryId, userId, onSuccess, currentPlan = 'basic' }: PremiumUpgradeProps) => {
  const [selectedPlan, setSelectedPlan] = useState<ListingType | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSelectPlan = async (plan: ListingType, cycle: 'monthly' | 'annually') => {
    setSelectedPlan(plan);
    setBillingCycle(cycle);
  };

  const handleProceedToCheckout = async () => {
    if (!selectedPlan) return;
    
    setIsLoading(true);
    
    try {
      const amount = billingCycle === 'monthly' 
        ? PREMIUM_PRICING[selectedPlan].monthlyPrice 
        : PREMIUM_PRICING[selectedPlan].annualPrice;
      
      const response = await apiRequest('POST', '/api/create-subscription', {
        laundryId,
        userId,
        tier: selectedPlan,
        amount,
        billingCycle
      });
      
      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        throw new Error('Failed to initiate payment process');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred while creating subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setClientSecret(null);
    setSelectedPlan(null);
  };
  
  const handleSuccess = () => {
    setIsSuccess(true);
  };
  
  const handleClose = () => {
    setIsSuccess(false);
    onSuccess();
  };

  if (isSuccess && selectedPlan) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="pt-6">
          <SuccessMessage plan={selectedPlan} onClose={handleClose} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Upgrade Your Listing</CardTitle>
        <CardDescription>
          Choose a premium plan to enhance your business visibility and unlock additional features
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm 
              clientSecret={clientSecret} 
              onSuccess={handleSuccess}
              onCancel={handleReset}
            />
          </Elements>
        ) : (
          <PremiumPlanCards 
            onSelectPlan={handleSelectPlan}
            selectedPlan={selectedPlan}
            selectedCycle={billingCycle}
            currentPlan={currentPlan}
            isLoading={isLoading}
          />
        )}
      </CardContent>
      {!clientSecret && (
        <CardFooter className="flex justify-end">
          <Button
            onClick={handleProceedToCheckout}
            disabled={!selectedPlan || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center">
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Processing...
              </span>
            ) : (
              'Proceed to Checkout'
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

const PremiumUpgrade = (props: PremiumUpgradeProps) => {
  return <PremiumUpgradeForm {...props} />;
};

export default PremiumUpgrade;