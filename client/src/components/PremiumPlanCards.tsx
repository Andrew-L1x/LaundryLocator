import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { PREMIUM_PRICING } from '@shared/premium-features';
import { ListingType } from '@shared/schema';

interface PremiumPlanCardsProps {
  onSelectPlan: (plan: ListingType, cycle: 'monthly' | 'annually') => void;
  selectedPlan: ListingType | null;
  selectedCycle: 'monthly' | 'annually';
  currentPlan?: ListingType;
  isLoading?: boolean;
}

const formatPrice = (price: number, cycle: 'monthly' | 'annually'): string => {
  const dollars = Math.floor(price / 100);
  const cents = price % 100;
  return `$${dollars}.${cents < 10 ? '0' : ''}${cents}${cycle === 'monthly' ? '/mo' : '/yr'}`;
};

const PremiumPlanCards: React.FC<PremiumPlanCardsProps> = ({
  onSelectPlan,
  selectedPlan,
  selectedCycle,
  currentPlan = 'basic',
  isLoading = false
}) => {
  const plans: ListingType[] = ['premium', 'featured'];
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4">
        <Button
          variant={selectedCycle === 'monthly' ? 'default' : 'outline'}
          onClick={() => selectedPlan && onSelectPlan(selectedPlan, 'monthly')}
          className="w-full sm:w-auto"
        >
          Monthly Billing
        </Button>
        <Button
          variant={selectedCycle === 'annually' ? 'default' : 'outline'}
          onClick={() => selectedPlan && onSelectPlan(selectedPlan, 'annually')}
          className="w-full sm:w-auto"
        >
          Annual Billing (Save 17%)
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const planInfo = PREMIUM_PRICING[plan];
          const price = selectedCycle === 'monthly' ? planInfo.monthlyPrice : planInfo.annualPrice;
          const isCurrentPlan = currentPlan === plan;
          const isSelected = selectedPlan === plan;
          
          return (
            <Card 
              key={plan} 
              className={`border-2 ${isSelected ? 'border-primary' : 'border-border'} ${isCurrentPlan ? 'bg-muted/50' : ''}`}
            >
              <CardHeader>
                <CardTitle>{planInfo.name}</CardTitle>
                <CardDescription>{planInfo.description}</CardDescription>
                <div className="text-3xl font-bold mt-2">
                  {formatPrice(price, selectedCycle)}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {planInfo.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isSelected ? "default" : "outline"}
                  disabled={isCurrentPlan || isLoading}
                  onClick={() => onSelectPlan(plan, selectedCycle)}
                >
                  {isCurrentPlan 
                    ? 'Current Plan' 
                    : isSelected 
                      ? 'Selected' 
                      : isLoading 
                        ? 'Loading...' 
                        : `Select ${planInfo.name}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PremiumPlanCards;