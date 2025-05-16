import React from 'react';
import { PREMIUM_PLANS, formatPrice, ListingType } from '@shared/premium-features';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Star, Crown } from 'lucide-react';

interface PremiumPlanCardsProps {
  onSelectPlan: (plan: ListingType, billingCycle: 'monthly' | 'annually') => void;
  currentPlan?: ListingType;
}

const PremiumPlanCards: React.FC<PremiumPlanCardsProps> = ({
  onSelectPlan,
  currentPlan = 'basic'
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      {/* Basic plan */}
      <Card className={`overflow-hidden ${currentPlan === 'basic' ? 'border-primary' : ''}`}>
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            Basic Listing
          </CardTitle>
          <CardDescription>
            Free basic listing with limited features
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-3xl font-bold mb-4">
            Free
          </div>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Basic business information</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Single photo upload</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Display business hours</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Standard search placement</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button 
            variant={currentPlan === 'basic' ? 'outline' : 'secondary'} 
            className="w-full"
            disabled={currentPlan === 'basic'}
          >
            {currentPlan === 'basic' ? 'Current Plan' : 'Select Basic Plan'}
          </Button>
        </CardFooter>
      </Card>

      {/* Premium plan */}
      <Card className={`overflow-hidden ${currentPlan === 'premium' ? 'border-primary shadow-md' : ''}`}>
        <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
          <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Star className="h-5 w-5" />
            Premium Listing
          </CardTitle>
          <CardDescription>
            {PREMIUM_PLANS.premium.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col mb-4">
            <div className="text-3xl font-bold flex items-end gap-2">
              {formatPrice(PREMIUM_PLANS.premium.monthlyPrice)}
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </div>
            <div className="text-sm text-muted-foreground">
              or {formatPrice(PREMIUM_PLANS.premium.annualPrice)}/year (save 16%)
            </div>
          </div>
          <ul className="space-y-2">
            {PREMIUM_PLANS.premium.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            variant={currentPlan === 'premium' ? 'outline' : 'default'} 
            className="w-full"
            disabled={currentPlan === 'premium'}
            onClick={() => onSelectPlan('premium', 'monthly')}
          >
            {currentPlan === 'premium' ? 'Current Plan' : 'Subscribe Monthly'}
          </Button>
          <Button 
            variant="secondary"
            className="w-full"
            disabled={currentPlan === 'premium'}
            onClick={() => onSelectPlan('premium', 'annually')}
          >
            Subscribe Yearly (Save 16%)
          </Button>
        </CardFooter>
      </Card>

      {/* Featured plan */}
      <Card className={`overflow-hidden ${currentPlan === 'featured' ? 'border-primary shadow-lg' : ''}`}>
        <div className="absolute -right-6 -top-6 bg-primary text-white text-xs px-8 py-1 rotate-45 transform origin-bottom-right font-medium">
          BEST VALUE
        </div>
        <CardHeader className="bg-primary-50 dark:bg-primary-950/30">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Crown className="h-5 w-5" />
            Featured Listing
          </CardTitle>
          <CardDescription>
            {PREMIUM_PLANS.featured.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col mb-4">
            <div className="text-3xl font-bold flex items-end gap-2">
              {formatPrice(PREMIUM_PLANS.featured.monthlyPrice)}
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </div>
            <div className="text-sm text-muted-foreground">
              or {formatPrice(PREMIUM_PLANS.featured.annualPrice)}/year (save 16%)
            </div>
          </div>
          <ul className="space-y-2">
            {PREMIUM_PLANS.featured.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            variant={currentPlan === 'featured' ? 'outline' : 'default'} 
            className="w-full"
            disabled={currentPlan === 'featured'}
            onClick={() => onSelectPlan('featured', 'monthly')}
          >
            {currentPlan === 'featured' ? 'Current Plan' : 'Subscribe Monthly'}
          </Button>
          <Button 
            variant="secondary"
            className="w-full"
            disabled={currentPlan === 'featured'}
            onClick={() => onSelectPlan('featured', 'annually')}
          >
            Subscribe Yearly (Save 16%)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PremiumPlanCards;