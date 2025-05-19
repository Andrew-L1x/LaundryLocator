import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MetaTags from '@/components/MetaTags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  BarChart3, 
  MessageSquare, 
  Bell, 
  Settings, 
  Calendar, 
  Images, 
  FileText, 
  Users, 
  Star, 
  Percent, 
  Clock, 
  ArrowUpRight 
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const BusinessDashboardPage: React.FC = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState('overview');
  
  // Fetch business data
  const { data: businessData, isLoading, error } = useQuery({
    queryKey: ['/api/business/dashboard'],
  });
  
  // Fetch business reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['/api/business/reviews'],
    enabled: !!businessData,
  });
  
  // Fetch analytics data
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/business/analytics'],
    enabled: businessData?.subscription?.tier === 'premium',
  });
  
  // Handle upgrading to premium
  const handleUpgradeToPremium = () => {
    navigate('/business/upgrade');
  };
  
  // Generate sample data for demo
  const sampleBusiness = {
    id: 1,
    name: "Sunshine Laundromat",
    address: "123 Main St, Denver, CO 80201",
    phone: "(303) 555-1234",
    rating: "4.2",
    reviewCount: 28,
    subscription: {
      tier: "basic", // or "premium"
      status: "active",
      trialEnds: null,
      nextBillingDate: null,
    },
    profileCompleteness: 65,
    pendingActions: [
      { id: 1, type: "review_response", message: "New customer review needs a response" },
      { id: 2, type: "profile_update", message: "Verify your business hours" }
    ],
    views: {
      today: 12,
      thisWeek: 87,
      thisMonth: 342,
      trend: "+15%"
    }
  };

  const sampleData = businessData || sampleBusiness;
  
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
  
  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <h1 className="text-2xl font-bold text-center mb-4">Error Loading Dashboard</h1>
              <p className="text-center mb-6">There was a problem loading your business dashboard. Please try again later.</p>
              <div className="flex justify-center">
                <Button onClick={() => window.location.reload()}>Reload Page</Button>
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
        title="Business Dashboard | Laundromat Near Me"
        description="Manage your laundromat business details, respond to reviews, view analytics and more."
      />
      
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">{sampleData.name}</h1>
            <p className="text-gray-600">{sampleData.address}</p>
          </div>
          <div className="mt-4 md:mt-0">
            {sampleData.subscription.tier === 'basic' ? (
              <Button onClick={handleUpgradeToPremium} className="bg-amber-600 hover:bg-amber-700">
                Upgrade to Premium
              </Button>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 py-1 px-2 text-xs">
                Premium Plan
              </Badge>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="overview" onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profile">Business Profile</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="analytics" disabled={sampleData.subscription.tier !== 'premium'}>
              Analytics
              {sampleData.subscription.tier !== 'premium' && (
                <span className="ml-2 text-amber-600">
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="promotion" disabled={sampleData.subscription.tier !== 'premium'}>
              Promotions
              {sampleData.subscription.tier !== 'premium' && (
                <span className="ml-2 text-amber-600">
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Building2 className="mr-2 h-5 w-5 text-primary" />
                    Profile Completeness
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{sampleData.profileCompleteness}% Complete</span>
                      <span className={sampleData.profileCompleteness >= 80 ? "text-green-600" : "text-amber-600"}>
                        {sampleData.profileCompleteness >= 80 ? "Good" : "Needs Attention"}
                      </span>
                    </div>
                    <Progress value={sampleData.profileCompleteness} />
                    <div className="pt-2">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setCurrentTab('profile')}>
                        Complete Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Star className="mr-2 h-5 w-5 text-yellow-500" />
                    Business Rating
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end">
                    <span className="text-3xl font-bold mr-2">{sampleData.rating}</span>
                    <span className="text-gray-500 text-sm mb-1">/ 5</span>
                    <span className="ml-2 text-gray-500 text-sm mb-1">({sampleData.reviewCount} reviews)</span>
                  </div>
                  <div className="pt-4">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setCurrentTab('reviews')}>
                      Manage Reviews
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Bell className="mr-2 h-5 w-5 text-blue-500" />
                    Pending Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sampleData.pendingActions.length === 0 ? (
                      <p className="text-gray-500 text-sm">No pending actions</p>
                    ) : (
                      sampleData.pendingActions.map(action => (
                        <div key={action.id} className="text-sm bg-gray-50 p-2 rounded">
                          {action.message}
                        </div>
                      ))
                    )}
                    <div className="pt-2">
                      <Button variant="outline" size="sm" className="w-full">
                        View All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5 text-primary" />
                    Visibility Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Today</p>
                      <p className="text-2xl font-bold">{sampleData.views.today}</p>
                      <p className="text-xs text-gray-500">Profile Views</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">This Week</p>
                      <p className="text-2xl font-bold">{sampleData.views.thisWeek}</p>
                      <p className="text-xs text-gray-500">Profile Views</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">This Month</p>
                      <p className="text-2xl font-bold">{sampleData.views.thisMonth}</p>
                      <p className="text-xs text-gray-500">Profile Views</p>
                    </div>
                  </div>
                  {sampleData.subscription.tier === 'basic' && (
                    <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-lg">
                      <div className="flex items-start">
                        <ArrowUpRight className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Upgrade to Premium for detailed analytics</p>
                          <p className="mt-1 text-amber-700">See visitor demographics, search impressions, and conversion metrics</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2 border-amber-600 text-amber-700 hover:bg-amber-100"
                            onClick={handleUpgradeToPremium}
                          >
                            Upgrade Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Settings className="mr-2 h-5 w-5 text-primary" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-auto py-3 justify-start">
                      <Images className="mr-2 h-4 w-4" />
                      <span>Upload Photos</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      <span>Update Hours</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 justify-start">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span>Respond to Reviews</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-3 justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      <span>Edit Description</span>
                    </Button>
                  </div>
                  
                  {sampleData.subscription.tier === 'premium' && (
                    <>
                      <Separator className="my-4" />
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="h-auto py-3 justify-start">
                          <Percent className="mr-2 h-4 w-4" />
                          <span>Create Promo</span>
                        </Button>
                        <Button variant="outline" className="h-auto py-3 justify-start">
                          <Calendar className="mr-2 h-4 w-4" />
                          <span>Special Events</span>
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {sampleData.subscription.tier === 'premium' && sampleData.subscription.trialEnds && (
              <Card className="mt-6 bg-amber-50 border-amber-200">
                <CardContent className="pt-6">
                  <div className="flex items-start">
                    <div className="mr-4 bg-amber-100 p-2 rounded-full">
                      <Calendar className="h-6 w-6 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-900">Your Premium Trial ends in 7 days</h3>
                      <p className="text-amber-800 text-sm mt-1">
                        Your premium benefits will continue with automatic billing on {new Date(sampleData.subscription.trialEnds).toLocaleDateString()}.
                      </p>
                      <div className="flex gap-3 mt-3">
                        <Button size="sm" variant="outline" className="border-amber-600 text-amber-700 hover:bg-amber-100">
                          Manage Subscription
                        </Button>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                          Continue Premium
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Business Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
                <CardDescription>
                  Manage your business information, photos, services and amenities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">The Business Profile content will be implemented here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Reviews Tab */}
          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Customer Reviews</CardTitle>
                <CardDescription>
                  View and respond to customer reviews
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">The Reviews management content will be implemented here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Analytics Tab */}
          <TabsContent value="analytics">
            {sampleData.subscription.tier === 'premium' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Business Analytics</CardTitle>
                  <CardDescription>
                    Track your business performance and customer engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">The Analytics content will be implemented here</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <BarChart3 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Analytics Available with Premium</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                      Upgrade to Premium to access detailed business analytics, customer insights, and performance metrics.
                    </p>
                    <Button onClick={handleUpgradeToPremium} className="bg-amber-600 hover:bg-amber-700">
                      Upgrade to Premium
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Promotion Tab */}
          <TabsContent value="promotion">
            {sampleData.subscription.tier === 'premium' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Promotions & Offers</CardTitle>
                  <CardDescription>
                    Create and manage special promotions for your business
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">The Promotions content will be implemented here</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Percent className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Promotions Available with Premium</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                      Upgrade to Premium to create special offers and promotions to attract new customers and boost business.
                    </p>
                    <Button onClick={handleUpgradeToPremium} className="bg-amber-600 hover:bg-amber-700">
                      Upgrade to Premium
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
};

export default BusinessDashboardPage;