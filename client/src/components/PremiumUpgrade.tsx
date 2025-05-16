import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Shield, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Laundromat, Subscription } from '@/types/laundromat';

interface PremiumUpgradeProps {
  laundryId: number;
  userId: number;
  currentTier?: string;
}

type SubscriptionTier = {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  badge: React.ReactNode;
  color: string;
};

const PremiumUpgrade = ({ laundryId, userId, currentTier = 'basic' }: PremiumUpgradeProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('premium');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current subscription data if any
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['/api/subscriptions', userId],
    enabled: !!userId,
  });

  // Mutation for creating a subscription
  const createSubscription = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/subscriptions', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/laundromats', laundryId] });
      queryClient.invalidateQueries({ queryKey: ['/api/laundromats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/featured-laundromats'] });
      
      toast({
        title: 'Subscription successful!',
        description: `Your listing has been upgraded to ${selectedTier}.`,
        variant: 'default',
      });
      
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Subscription failed',
        description: error.message || 'There was an error processing your subscription.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for canceling a subscription
  const cancelSubscription = useMutation({
    mutationFn: async (subscriptionId: number) => {
      return apiRequest(`/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/laundromats', laundryId] });
      queryClient.invalidateQueries({ queryKey: ['/api/laundromats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/featured-laundromats'] });
      
      toast({
        title: 'Subscription canceled',
        description: 'Your subscription has been canceled successfully.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error canceling subscription',
        description: error.message || 'There was an error canceling your subscription.',
        variant: 'destructive',
      });
    },
  });

  const tiers: SubscriptionTier[] = [
    {
      id: 'premium',
      name: 'Premium',
      price: 19.99,
      duration: 'monthly',
      features: [
        'Enhanced listing visibility',
        'Promotional text',
        'Special badge',
        'Priority in search results',
        'Add up to 10 photos',
        'Custom amenities list',
      ],
      badge: <Shield className="h-5 w-5 text-primary" />,
      color: 'bg-primary',
    },
    {
      id: 'featured',
      name: 'Featured',
      price: 39.99,
      duration: 'monthly',
      features: [
        'All Premium features',
        'Featured in home page carousel',
        'Top position in search results',
        'Add special offers and promotions',
        'Add up to 20 photos',
        'Analytics dashboard',
        'Premium badge with gold accent',
      ],
      badge: <Sparkles className="h-5 w-5 text-amber-500" />,
      color: 'bg-amber-500',
    },
  ];

  const handleUpgrade = () => {
    setIsDialogOpen(true);
  };

  const handleSubscribe = () => {
    const selectedTierData = tiers.find(tier => tier.id === selectedTier);
    if (!selectedTierData) return;

    createSubscription.mutate({
      laundryId,
      userId,
      tier: selectedTier,
      amount: selectedTierData.price * 100, // Convert to cents for Stripe
      status: 'active',
      autoRenew: true,
      // For demo purposes, set end date to 30 days from now
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  };

  const handleCancel = (subscriptionId: number) => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      cancelSubscription.mutate(subscriptionId);
    }
  };

  // Find current subscription if any
  const activeSubscription = subscriptionData?.find(
    (sub: Subscription) => sub.laundryId === laundryId && sub.status === 'active'
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Listing Visibility</CardTitle>
            {currentTier !== 'basic' && (
              <Badge className={currentTier === 'featured' ? 'bg-amber-500' : 'bg-primary'}>
                {currentTier === 'featured' ? (
                  <Sparkles className="mr-1 h-3 w-3" />
                ) : (
                  <Shield className="mr-1 h-3 w-3" />
                )}
                {currentTier.toUpperCase()}
              </Badge>
            )}
          </div>
          <CardDescription>
            Upgrade your listing for increased visibility and special features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSubscription ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 rounded-md border p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    Your listing is upgraded to{' '}
                    <span className="font-bold text-primary">
                      {activeSubscription.tier.charAt(0).toUpperCase() +
                        activeSubscription.tier.slice(1)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Subscription renews on{' '}
                    {new Date(activeSubscription.endDate).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(activeSubscription.id)}
                  disabled={cancelSubscription.isPending}
                >
                  Cancel
                </Button>
              </div>

              <div className="rounded-md bg-amber-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Looking for even more visibility?
                    </h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>
                        {activeSubscription.tier === 'premium'
                          ? 'Upgrade to Featured to appear at the top of search results and on our homepage carousel!'
                          : 'Thank you for being a featured customer! Your listing is receiving maximum visibility.'}
                      </p>
                    </div>
                    {activeSubscription.tier === 'premium' && (
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-600 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          onClick={handleUpgrade}
                        >
                          Upgrade to Featured
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Your listing is currently set to Basic visibility
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Upgrade to Premium or Featured to increase your visibility and attract more
                        customers!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleUpgrade}
                disabled={createSubscription.isPending}
              >
                Upgrade Listing
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upgrade Your Listing</DialogTitle>
            <DialogDescription>
              Choose a plan to increase visibility and attract more customers
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup
              value={selectedTier}
              onValueChange={setSelectedTier}
              className="space-y-4"
            >
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-4 ${
                    selectedTier === tier.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  <RadioGroupItem value={tier.id} id={tier.id} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Label
                        htmlFor={tier.id}
                        className="text-base font-semibold cursor-pointer"
                      >
                        {tier.name}
                      </Label>
                      <Badge
                        className={`ml-2 ${
                          tier.id === 'featured'
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-primary hover:bg-primary/90'
                        }`}
                      >
                        {tier.badge}
                        {tier.id.toUpperCase()}
                      </Badge>
                    </div>

                    <p className="mt-1 text-2xl font-bold">
                      ${tier.price}
                      <span className="text-sm font-normal text-gray-500">/{tier.duration}</span>
                    </p>

                    <div className="mt-3 space-y-2">
                      {tier.features.map((feature, i) => (
                        <div key={i} className="flex items-center">
                          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubscribe}
              disabled={createSubscription.isPending}
              className={
                selectedTier === 'featured'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-primary hover:bg-primary/90'
              }
            >
              {createSubscription.isPending ? 'Processing...' : 'Subscribe Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PremiumUpgrade;