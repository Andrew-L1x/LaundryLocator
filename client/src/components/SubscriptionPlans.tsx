import { useState } from 'react';
import { Shield, Sparkles, CheckCircle } from 'lucide-react';
import { SubscriptionPlan } from '@/types/laundromat';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface SubscriptionPlansProps {
  onSelectPlan: (plan: SubscriptionPlan) => void;
  currentTier?: string;
}

const SubscriptionPlans = ({ onSelectPlan, currentTier = 'basic' }: SubscriptionPlansProps) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');

  const plans: SubscriptionPlan[] = [
    {
      id: 'basic',
      name: 'Basic',
      price: 0,
      billingCycle: 'monthly',
      features: [
        'Standard listing',
        'Basic details display',
        'Regular search results position',
        'Contact information'
      ]
    },
    {
      id: 'premium',
      name: 'Premium',
      price: billingCycle === 'monthly' ? 19.99 : 199.99,
      billingCycle,
      features: [
        'Enhanced visibility',
        'Special badge',
        'Promotional text',
        'Priority in search results',
        'Add up to 10 photos',
        'Custom amenities list',
        'Business hour highlights'
      ],
      isPopular: true,
      discount: billingCycle === 'annually' ? 17 : 0
    },
    {
      id: 'featured',
      name: 'Featured',
      price: billingCycle === 'monthly' ? 39.99 : 399.99,
      billingCycle,
      features: [
        'All Premium features',
        'Featured in home page carousel',
        'Top position in search results',
        'Add special offers and promotions',
        'Add up to 20 photos',
        'Analytics dashboard',
        'Premium badge with gold accent',
        'Preferred customer service'
      ],
      discount: billingCycle === 'annually' ? 17 : 0
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Tabs
          defaultValue="monthly"
          value={billingCycle}
          onValueChange={(value) => setBillingCycle(value as 'monthly' | 'annually')}
          className="w-full max-w-md"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annually">
              Annually
              <Badge className="ml-2 bg-green-600 hover:bg-green-700">Save 17%</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = currentTier === plan.id;
          
          return (
            <Card
              key={plan.id}
              className={`relative transition-all duration-200 ${
                plan.isPopular ? 'ring-2 ring-primary/50 shadow-lg' : ''
              } ${isCurrentPlan ? 'bg-primary/5' : ''}`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center">
                  <Badge className="bg-primary hover:bg-primary px-3 py-1">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="pt-6">
                <div className="flex items-center gap-2">
                  {plan.id === 'premium' ? (
                    <Shield className="h-5 w-5 text-primary" />
                  ) : plan.id === 'featured' ? (
                    <Sparkles className="h-5 w-5 text-amber-500" />
                  ) : (
                    <div className="h-5 w-5" />
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                </div>
                
                <div className="mt-2 flex items-baseline text-gray-900">
                  <span className="text-3xl font-bold tracking-tight">
                    ${plan.price.toFixed(2)}
                  </span>
                  <span className="ml-1 text-sm font-medium text-gray-500">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                
                {plan.discount > 0 && (
                  <div className="mt-1 text-sm text-green-600">
                    You save {plan.discount}% with annual billing
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <CheckCircle className="mr-2 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                {isCurrentPlan ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      plan.id === 'featured'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : plan.id === 'premium'
                        ? ''
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                    onClick={() => onSelectPlan(plan)}
                    variant={plan.id === 'basic' ? 'outline' : 'default'}
                  >
                    {plan.id === 'basic' ? 'Current Plan' : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionPlans;