import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckIcon, XIcon, CreditCard, Check } from 'lucide-react';

// Form validation schema
const planSchema = z.object({
  plan: z.enum(['basic', 'premium'], {
    required_error: 'Please select a plan',
  }),
});

type PlanSelectionFormValues = z.infer<typeof planSchema>;

interface PlanSelectionStepProps {
  onComplete: (data: { selectedPlan: string }) => void;
  isLoading?: boolean;
}

const PlanSelectionStep: React.FC<PlanSelectionStepProps> = ({ onComplete, isLoading = false }) => {
  // Initialize form
  const form = useForm<PlanSelectionFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      plan: undefined,
    },
  });
  
  // Handle form submission
  const onSubmit = (data: PlanSelectionFormValues) => {
    onComplete({ selectedPlan: data.plan });
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Choose Your Plan</h2>
        <p className="text-gray-500 mt-2">
          Select the plan that best fits your business needs
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="plan"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid md:grid-cols-2 gap-6"
                  >
                    {/* Basic Plan */}
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="basic" className="sr-only" />
                      </FormControl>
                      <Card className={`cursor-pointer transition-all ${field.value === 'basic' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-gray-300'}`}>
                        <CardHeader className="pb-3">
                          <CardTitle>Basic Listing</CardTitle>
                          <CardDescription>Free</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-6">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm">Basic business profile</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm">Address & contact information</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm">Business hours</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm">Manage customer reviews</span>
                            </div>
                            <div className="flex items-center">
                              <XIcon className="h-4 w-4 text-gray-300 mr-2" />
                              <span className="text-sm text-gray-400">Analytics & insights</span>
                            </div>
                            <div className="flex items-center">
                              <XIcon className="h-4 w-4 text-gray-300 mr-2" />
                              <span className="text-sm text-gray-400">Promotional offers</span>
                            </div>
                            <div className="flex items-center">
                              <XIcon className="h-4 w-4 text-gray-300 mr-2" />
                              <span className="text-sm text-gray-400">Featured placement</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-4 border-t">
                          <p className="text-xs text-gray-500">
                            Basic plan is perfect for small businesses looking to establish an online presence.
                          </p>
                        </CardFooter>
                      </Card>
                    </FormItem>
                    
                    {/* Premium Plan */}
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="premium" className="sr-only" />
                      </FormControl>
                      <Card className={`cursor-pointer transition-all ${field.value === 'premium' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-gray-300'}`}>
                        <CardHeader className="pb-3 relative">
                          <div className="absolute -top-1 -right-1 bg-primary text-white text-xs px-2 py-1 rounded-full">
                            Recommended
                          </div>
                          <CardTitle>Premium Listing</CardTitle>
                          <CardDescription>$19.99/month</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-6">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Enhanced business profile</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Address & contact information</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Business hours</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Manage customer reviews</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Detailed analytics & insights</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Create promotional offers</span>
                            </div>
                            <div className="flex items-center">
                              <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                              <span className="text-sm font-medium">Priority placement in search</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-4 border-t">
                          <p className="text-xs text-gray-500">
                            30-day free trial! Cancel anytime. Premium is ideal for businesses looking to maximize visibility and engagement.
                          </p>
                        </CardFooter>
                      </Card>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
          
          <div className="border-t pt-6">
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={!form.watch('plan') || isLoading}
                className="w-full md:w-auto"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    {form.watch('plan') === 'premium' ? (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Continue to Payment
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Confirm Selection
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default PlanSelectionStep;