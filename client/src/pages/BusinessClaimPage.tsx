import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import VerificationStep from '@/components/business/VerificationStep';
import PlanSelectionStep from '@/components/business/PlanSelectionStep';
import BusinessProfileStep from '@/components/business/BusinessProfileStep';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MetaTags from '@/components/MetaTags';
import { apiRequest } from '@/lib/queryClient';
import type { Laundromat } from '@shared/schema';

type ClaimingStep = 'verification' | 'profile' | 'plan';

const BusinessClaimPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const laundryId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<ClaimingStep>('verification');
  const [verificationData, setVerificationData] = useState<{
    method: string;
    files?: File[];
    phone?: string;
    address?: string;
  } | null>(null);
  const [profileData, setProfileData] = useState<Partial<Laundromat> | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('basic');
  
  // Fetch laundromat details
  const { data: laundromat, isLoading, error } = useQuery({
    queryKey: [`/api/laundromats/${laundryId}`],
    enabled: !!laundryId,
  });

  // Calculate progress percentage
  const getProgressPercentage = () => {
    switch (currentStep) {
      case 'verification':
        return 33;
      case 'profile':
        return 66;
      case 'plan':
        return 100;
      default:
        return 0;
    }
  };

  // Handle navigation between steps
  const goToNextStep = () => {
    if (currentStep === 'verification') {
      setCurrentStep('profile');
    } else if (currentStep === 'profile') {
      setCurrentStep('plan');
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 'profile') {
      setCurrentStep('verification');
    } else if (currentStep === 'plan') {
      setCurrentStep('profile');
    }
  };

  // Handle verification step completion
  const handleVerificationComplete = (data: any) => {
    setVerificationData(data);
    goToNextStep();
  };

  // Handle profile step completion
  const handleProfileComplete = (data: Partial<Laundromat>) => {
    setProfileData(data);
    goToNextStep();
  };

  // Handle final submission
  const handleSubmitClaim = async () => {
    try {
      // Prepare data for submission
      const claimData = {
        laundryId,
        verificationData,
        profileData,
        selectedPlan,
      };

      // Submit claim to API
      const response = await apiRequest('POST', '/api/business/claim', claimData);
      
      if (!response.ok) {
        throw new Error('Failed to submit business claim');
      }
      
      toast({
        title: 'Business Claimed Successfully',
        description: 'Your business claim has been submitted for review.',
      });
      
      // Redirect to business dashboard
      navigate('/business/dashboard');
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: 'Error',
        description: 'There was a problem submitting your business claim. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !laundromat) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <h1 className="text-2xl font-bold text-center mb-4">Business Not Found</h1>
              <p className="text-center mb-6">The business you're looking for doesn't exist or cannot be claimed.</p>
              <div className="flex justify-center">
                <Button onClick={() => navigate('/business/search')}>Search For Your Business</Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MetaTags 
        title={`Claim ${laundromat.name} | Laundromat Near Me`}
        description={`Claim ownership of ${laundromat.name} in ${laundromat.city}, ${laundromat.state} and manage your laundromat business online.`}
      />
      
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Claim Your Business</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-6">{laundromat.name}</h2>
          
          <div className="mb-8">
            <Progress value={getProgressPercentage()} className="h-2" />
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span className={currentStep === 'verification' ? 'font-bold text-primary' : ''}>Verification</span>
              <span className={currentStep === 'profile' ? 'font-bold text-primary' : ''}>Business Profile</span>
              <span className={currentStep === 'plan' ? 'font-bold text-primary' : ''}>Plan Selection</span>
            </div>
          </div>
          
          <Card className="mb-8">
            <CardContent className="pt-6">
              {currentStep === 'verification' && (
                <VerificationStep 
                  laundromat={laundromat}
                  onComplete={handleVerificationComplete} 
                />
              )}
              
              {currentStep === 'profile' && (
                <BusinessProfileStep 
                  laundromat={laundromat}
                  onComplete={handleProfileComplete} 
                />
              )}
              
              {currentStep === 'plan' && (
                <PlanSelectionStep 
                  selectedPlan={selectedPlan}
                  onSelectPlan={setSelectedPlan}
                  onSubmit={handleSubmitClaim}
                />
              )}
              
              <div className="flex justify-between mt-6">
                {currentStep !== 'verification' && (
                  <Button variant="outline" onClick={goToPreviousStep}>
                    Back
                  </Button>
                )}
                
                <div className="ml-auto">
                  {currentStep !== 'plan' ? (
                    <Button 
                      onClick={goToNextStep}
                      disabled={
                        (currentStep === 'verification' && !verificationData) ||
                        (currentStep === 'profile' && !profileData)
                      }
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSubmitClaim}
                      className={selectedPlan === 'premium' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                    >
                      {selectedPlan === 'basic' ? 'Confirm Basic Plan' : 'Start Premium Trial'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default BusinessClaimPage;