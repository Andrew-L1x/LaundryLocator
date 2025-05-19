import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface PlanSelectionStepProps {
  selectedPlan: 'basic' | 'premium';
  onSelectPlan: (plan: 'basic' | 'premium') => void;
  onSubmit: () => void;
}

const PlanSelectionStep: React.FC<PlanSelectionStepProps> = ({
  selectedPlan,
  onSelectPlan,
  onSubmit,
}) => {
  return (
    <div>
      <h3 className="text-2xl font-bold mb-2">Choose Your Plan</h3>
      <p className="text-gray-600 mb-6">
        Select a plan that best fits your business needs. You can upgrade at any time.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Basic Plan */}
        <Card className={`overflow-hidden ${selectedPlan === 'basic' ? 'ring-2 ring-primary' : 'border'}`}>
          <CardHeader className="bg-gray-50 dark:bg-gray-800">
            <CardTitle className="flex justify-between items-center">
              Basic Plan
              <Badge variant="outline" className="ml-2">Free</Badge>
            </CardTitle>
            <CardDescription>
              Standard business presence
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Standard business listing</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Basic business information</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Limited photos (3 max)</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Standard search visibility</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Owner-verified badge</span>
              </li>
              <li className="flex items-center">
                <X className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-gray-500">Priority placement in search</span>
              </li>
              <li className="flex items-center">
                <X className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-gray-500">Promotional offers display</span>
              </li>
              <li className="flex items-center">
                <X className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-gray-500">Customer analytics dashboard</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-4">
            <Button
              variant={selectedPlan === 'basic' ? 'default' : 'outline'}
              onClick={() => onSelectPlan('basic')}
              className="w-full"
            >
              {selectedPlan === 'basic' ? 'Selected' : 'Select Basic Plan'}
            </Button>
          </CardFooter>
        </Card>
        
        {/* Premium Plan */}
        <Card className={`overflow-hidden ${selectedPlan === 'premium' ? 'ring-2 ring-amber-500' : 'border'}`}>
          <CardHeader className="bg-amber-50 dark:bg-amber-900">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                Premium Plan
                <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                  Free 30-day trial
                </Badge>
              </CardTitle>
            </div>
            <CardDescription>
              Enhanced business presence & analytics
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-2">
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>All Basic Plan features</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Priority placement in search results</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Unlimited photos</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Special "Premium" badge</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Promotional offers display</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Customer analytics dashboard</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Enhanced business profile</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>$19.99/month after trial</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-4">
            <Button
              variant={selectedPlan === 'premium' ? 'default' : 'outline'}
              onClick={() => onSelectPlan('premium')}
              className={`w-full ${selectedPlan === 'premium' ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-600 border-amber-600 hover:bg-amber-50'}`}
            >
              {selectedPlan === 'premium' ? 'Selected' : 'Start 30-Day Free Trial'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="bg-gray-50 border rounded-lg p-6 mb-6">
        <h4 className="text-lg font-medium mb-2">Plan Details</h4>
        {selectedPlan === 'basic' ? (
          <div>
            <p className="mb-2">You've selected the <strong>Basic Plan</strong> which is completely free and includes:</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Standard business listing with basic information</li>
              <li>Up to 3 photos of your business</li>
              <li>Owner-verified badge</li>
              <li>Response to customer reviews</li>
            </ul>
            <p>You can upgrade to Premium at any time from your business dashboard.</p>
          </div>
        ) : (
          <div>
            <p className="mb-2">You've selected the <strong>Premium Plan</strong> which includes:</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>30-day free trial (no credit card required)</li>
              <li>$19.99/month after trial period</li>
              <li>Priority placement in search results</li>
              <li>Unlimited photos</li>
              <li>Promotional offers display</li>
              <li>Customer analytics dashboard</li>
            </ul>
            <p className="text-amber-700 font-medium">A reminder will be sent 7 days before your trial ends.</p>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          You can change your subscription at any time from your dashboard.
        </p>
        <Button
          onClick={onSubmit}
          className={selectedPlan === 'premium' ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          {selectedPlan === 'basic' ? 'Confirm Basic Plan' : 'Start Premium Trial'}
        </Button>
      </div>
    </div>
  );
};

export default PlanSelectionStep;