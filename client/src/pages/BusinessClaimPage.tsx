import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import VerificationStep from '@/components/business/VerificationStep';
import BusinessProfileStep from '@/components/business/BusinessProfileStep';
import PlanSelectionStep from '@/components/business/PlanSelectionStep';
import { CheckCircle, AlertTriangle, Info, ArrowLeft } from 'lucide-react';

type ClaimStep = 'verification' | 'profile' | 'plan';

const BusinessClaimPage = () => {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<ClaimStep>('verification');
  const [verificationData, setVerificationData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch laundromat details
  const { data: laundromat, isLoading, error } = useQuery({
    queryKey: ['/api/laundromats', id],
    retry: false,
  });
  
  // Claim business mutation
  const claimMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/business/claim', data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      
      toast({
        title: 'Business Claimed Successfully!',
        description: 'You now have access to manage your business listing.',
        variant: 'default',
      });
      
      // Redirect to dashboard
      setTimeout(() => {
        setLocation('/business/dashboard');
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Claiming Business',
        description: error.message || 'An error occurred while claiming the business.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    },
  });
  
  // Handle verification step completion
  const handleVerificationComplete = (data: any) => {
    setVerificationData(data);
    setCurrentStep('profile');
    window.scrollTo(0, 0);
  };
  
  // Handle profile step completion
  const handleProfileComplete = (data: any) => {
    setProfileData(data);
    setCurrentStep('plan');
    window.scrollTo(0, 0);
  };
  
  // Handle plan selection and final submission
  const handlePlanComplete = async (data: { selectedPlan: string }) => {
    setSelectedPlan(data.selectedPlan as 'basic' | 'premium');
    await handleSubmit();
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!verificationData || !profileData || !selectedPlan) {
      toast({
        title: 'Missing Information',
        description: 'Please complete all steps before submitting.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Prepare data for submission
    const submissionData = {
      laundryId: id,
      verificationData,
      profileData,
      selectedPlan,
    };
    
    // Submit data
    claimMutation.mutate(submissionData);
  };
  
  // Handle back button
  const handleBack = () => {
    if (currentStep === 'profile') {
      setCurrentStep('verification');
    } else if (currentStep === 'plan') {
      setCurrentStep('profile');
    } else {
      setLocation('/business/search');
    }
    window.scrollTo(0, 0);
  };
  
  // Generate a slug from business name, city and state
  const generateSlug = (name: string, city: string, state: string) => {
    const cleanName = name.toLowerCase().replace(/[^\w\s]/g, '');
    const cleanCity = city.toLowerCase().replace(/[^\w\s]/g, '');
    const cleanState = state.toLowerCase().replace(/[^\w\s]/g, '');
    
    const formattedName = cleanName.replace(/\s+/g, '-');
    const formattedCity = cleanCity.replace(/\s+/g, '-');
    const formattedState = cleanState.replace(/\s+/g, '-');
    
    return `${formattedName}-${formattedCity}-${formattedState}`;
  };
  
  // Handling loading and error states
  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }
  
  if (error || !laundromat) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sorry, we couldn't find the business you're looking for. Please try searching again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => setLocation('/business/search')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Search
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 md:py-12">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={handleBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Claim Your Business</h1>
            <p className="text-gray-500 mt-1">
              Complete the steps below to verify and claim ownership of your business
            </p>
          </div>
          
          {/* Business info card */}
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{laundromat.name}</CardTitle>
                  <CardDescription>
                    {laundromat.address}, {laundromat.city}, {laundromat.state} {laundromat.zip}
                  </CardDescription>
                </div>
                <Badge variant="outline">Unclaimed</Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm">
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">Phone:</span>
                  <span>{laundromat.phone || 'Not available'}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">Rating:</span>
                  <span>{laundromat.rating ? `${laundromat.rating}★` : 'No ratings'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Progress tracker */}
          <div className="mb-8">
            <Tabs value={currentStep} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="verification" className="cursor-default">
                  <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-${currentStep === 'verification' ? 'primary' : currentStep === 'profile' || currentStep === 'plan' ? 'green-500' : 'gray-200'} text-white text-xs`}>
                    {currentStep === 'profile' || currentStep === 'plan' ? '✓' : '1'}
                  </span>
                  Verification
                </TabsTrigger>
                <TabsTrigger value="profile" className="cursor-default">
                  <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-${currentStep === 'profile' ? 'primary' : currentStep === 'plan' ? 'green-500' : 'gray-200'} text-white text-xs`}>
                    {currentStep === 'plan' ? '✓' : '2'}
                  </span>
                  Profile
                </TabsTrigger>
                <TabsTrigger value="plan" className="cursor-default">
                  <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-${currentStep === 'plan' ? 'primary' : 'gray-200'} text-white text-xs`}>
                    3
                  </span>
                  Plan
                </TabsTrigger>
              </TabsList>
              
              <Separator className="my-8" />
              
              <TabsContent value="verification">
                <VerificationStep 
                  onComplete={handleVerificationComplete} 
                  laundromat={laundromat}
                  isLoading={isSubmitting}
                />
              </TabsContent>
              
              <TabsContent value="profile">
                <BusinessProfileStep 
                  onComplete={handleProfileComplete} 
                  laundromat={laundromat}
                  isLoading={isSubmitting}
                />
              </TabsContent>
              
              <TabsContent value="plan">
                <PlanSelectionStep 
                  onComplete={handlePlanComplete}
                  isLoading={isSubmitting}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessClaimPage;