import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, BadgeCheck, CreditCard, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Subscription, SubscriptionPlan } from '@/types/laundromat';
import SubscriptionPlans from './SubscriptionPlans';
import { apiRequest } from '@/lib/queryClient';

interface PremiumUpgradeProps {
  laundryId: number;
  userId: number;
  currentTier?: string;
  onSuccess?: () => void;
}

const PremiumUpgrade = ({ laundryId, userId, currentTier = 'basic', onSuccess }: PremiumUpgradeProps) => {
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current subscription if any
  const { data: subscriptionData } = useQuery({
    queryKey: [`/api/subscriptions/laundry/${laundryId}`],
    enabled: !!laundryId,
  });

  const subscription = subscriptionData?.subscription;

  // Mutation to create a subscription
  const createSubscriptionMutation = useMutation({
    mutationFn: async (plan: SubscriptionPlan) => {
      setIsProcessing(true);
      
      try {
        const response = await apiRequest(`/api/subscriptions`, {
          method: 'POST',
          data: {
            laundryId,
            userId,
            tier: plan.id,
            amount: plan.price,
            billingCycle: plan.billingCycle,
          }
        });
        
        return response;
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Subscription created!',
        description: 'Your listing has been upgraded successfully.',
        variant: 'default',
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/subscriptions/laundry/${laundryId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/laundromats/${laundryId}`] });
      
      setIsUpgradeOpen(false);
      setSelectedPlan(null);
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: 'Error creating subscription',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  });

  // Mutation to cancel a subscription
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      
      try {
        const response = await apiRequest(`/api/subscriptions/${subscription?.id}`, {
          method: 'DELETE',
        });
        
        return response;
      } finally {
        setIsProcessing(false);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Subscription cancelled',
        description: 'Your subscription has been cancelled. Your benefits will remain active until the end of the current billing period.',
        variant: 'default',
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/subscriptions/laundry/${laundryId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/laundromats/${laundryId}`] });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: 'Error cancelling subscription',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  });

  const handleUpgrade = () => {
    if (!selectedPlan) return;
    createSubscriptionMutation.mutate(selectedPlan);
  };

  const handleCancel = () => {
    if (!subscription) return;
    cancelSubscriptionMutation.mutate();
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Check if there's an active subscription
  const hasActiveSubscription = subscription && subscription.status === 'active';
  const activeSubscription = subscriptionData?.subscription;

  return (
    <>
      {hasActiveSubscription ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              {activeSubscription.tier === 'premium' ? (
                <Shield className="h-5 w-5 text-primary" />
              ) : (
                <BadgeCheck className="h-5 w-5 text-amber-500" />
              )}
              <CardTitle>
                {activeSubscription.tier === 'premium' ? 'Premium' : 'Featured'} Listing Active
              </CardTitle>
            </div>
            <CardDescription>
              Your listing is currently enhanced with {activeSubscription.tier} features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-gray-500" />
              <span>
                ${activeSubscription.amount.toFixed(2)} / 
                {activeSubscription.billingCycle === 'monthly' ? 'month' : 'year'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>
                Next billing date: {formatDate(activeSubscription.endDate)}
              </span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Cancel Subscription</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel your subscription?</DialogTitle>
                  <DialogDescription>
                    Your subscription benefits will remain active until {formatDate(activeSubscription.endDate)}. 
                    After that, your listing will revert to the basic tier.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {}}>Keep Subscription</Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleCancel}
                    disabled={cancelSubscriptionMutation.isPending}
                  >
                    {cancelSubscriptionMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-1">
                  Change Plan <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Upgrade Your Listing</DialogTitle>
                  <DialogDescription>
                    Choose a plan to enhance your listing's visibility and features
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  <SubscriptionPlans 
                    onSelectPlan={setSelectedPlan} 
                    currentTier={currentTier}
                  />
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsUpgradeOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpgrade}
                    disabled={!selectedPlan || selectedPlan.id === currentTier || isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Upgrade Now'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-gray-200">
          <CardHeader>
            <CardTitle>Enhance Your Listing</CardTitle>
            <CardDescription>
              Upgrade to a premium listing to increase visibility and attract more customers
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <Shield className="h-16 w-16 text-primary/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Stand Out from the Competition</h3>
            <p className="text-sm text-gray-500 mb-6">
              Premium listings get up to 5x more views and appear at the top of search results
            </p>
          </CardContent>
          <CardFooter>
            <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">Upgrade Listing</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Upgrade Your Listing</DialogTitle>
                  <DialogDescription>
                    Choose a plan to enhance your listing's visibility and features
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  <SubscriptionPlans 
                    onSelectPlan={setSelectedPlan} 
                    currentTier={currentTier}
                  />
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsUpgradeOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpgrade}
                    disabled={!selectedPlan || selectedPlan.id === currentTier || isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Upgrade Now'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      )}
    </>
  );
};

export default PremiumUpgrade;