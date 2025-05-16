import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PremiumUpgrade from '../components/PremiumUpgrade';
import ApiErrorDisplay from '../components/ApiErrorDisplay';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Laundromat, Subscription } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Edit, Star, Award, ImagePlus, Tag, Package, Clipboard } from 'lucide-react';

const BusinessDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();
  
  // Fetch laundromat data
  const { data: laundromat, isLoading, error } = useQuery<Laundromat>({
    queryKey: [`/api/laundromats/${id}`]
  });
  
  // Fetch premium features
  const { data: premiumFeatures } = useQuery({
    queryKey: [`/api/laundromats/${id}/premium-features`],
    enabled: !!id,
  });
  
  // Fetch subscriptions
  const { data: subscriptions } = useQuery<{ subscriptions: { subscription: Subscription, laundromat: Partial<Laundromat> }[] }>({
    queryKey: ['/api/subscriptions']
  });
  
  // Find active subscription for this laundromat
  const activeSubscription = subscriptions?.subscriptions.find(
    sub => sub.laundromat.id === parseInt(id) && sub.subscription.status === 'active'
  );
  
  // Premium feature update form state
  const [amenities, setAmenities] = useState<string[]>(
    premiumFeatures?.features?.amenities || []
  );
  const [newAmenity, setNewAmenity] = useState('');
  const [promotionalText, setPromotionalText] = useState(
    premiumFeatures?.features?.promotionalText || ''
  );
  const [specialOffers, setSpecialOffers] = useState<string[]>(
    premiumFeatures?.features?.specialOffers || []
  );
  const [newOffer, setNewOffer] = useState('');
  const [machineCount, setMachineCount] = useState({
    washers: premiumFeatures?.features?.machineCount?.washers || 0,
    dryers: premiumFeatures?.features?.machineCount?.dryers || 0
  });
  
  const handleAddAmenity = () => {
    if (newAmenity.trim()) {
      setAmenities([...amenities, newAmenity.trim()]);
      setNewAmenity('');
    }
  };
  
  const handleRemoveAmenity = (index: number) => {
    setAmenities(amenities.filter((_, i) => i !== index));
  };
  
  const handleAddOffer = () => {
    if (newOffer.trim()) {
      setSpecialOffers([...specialOffers, newOffer.trim()]);
      setNewOffer('');
    }
  };
  
  const handleRemoveOffer = (index: number) => {
    setSpecialOffers(specialOffers.filter((_, i) => i !== index));
  };
  
  const handleSavePremiumFeatures = async () => {
    try {
      const response = await apiRequest(`/api/laundromats/${id}/premium-features`, {
        method: 'PUT',
        body: JSON.stringify({
          amenities,
          promotionalText,
          specialOffers,
          machineCount
        })
      });
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Premium features updated successfully',
          variant: 'default'
        });
        setEditOpen(false);
      } else {
        throw new Error(response.message || 'Failed to update premium features');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred while updating premium features',
        variant: 'destructive'
      });
    }
  };
  
  const getPlanBadge = () => {
    const isPremium = laundromat?.isPremium;
    const isFeatured = laundromat?.isFeatured;
    
    if (isFeatured) {
      return <Badge className="bg-yellow-500">Featured</Badge>;
    } else if (isPremium) {
      return <Badge className="bg-blue-500">Premium</Badge>;
    } else {
      return <Badge className="bg-gray-500">Basic</Badge>;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
          <ApiErrorDisplay
            error={error as Error || new Error('Laundromat not found')}
            message="There was an error loading your business information."
          />
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">{laundromat.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-600">{laundromat.address}, {laundromat.city}, {laundromat.state} {laundromat.zip}</p>
              {getPlanBadge()}
            </div>
          </div>
          
          <div>
            <Link href={`/laundromat/${laundromat.slug}`}>
              <Button variant="outline" className="mr-2">View Public Listing</Button>
            </Link>
          </div>
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="premium">Premium Features</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Business Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-gray-700">Phone</p>
                      <p>{laundromat.phone}</p>
                    </div>
                    {laundromat.website && (
                      <div>
                        <p className="font-medium text-gray-700">Website</p>
                        <a href={laundromat.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {laundromat.website}
                        </a>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-700">Hours</p>
                      <p>{laundromat.hours}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Services</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {laundromat.services.map((service, index) => (
                          <Badge key={index} variant="outline">{service}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Listing Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-gray-700">Rating</p>
                      <div className="flex items-center">
                        <p className="text-2xl font-semibold">{laundromat.rating || 'No ratings'}</p>
                        {laundromat.rating && (
                          <p className="ml-2 text-gray-500">({laundromat.reviewCount} {laundromat.reviewCount === 1 ? 'review' : 'reviews'})</p>
                        )}
                      </div>
                    </div>
                    
                    {laundromat.viewCount !== undefined && (
                      <div>
                        <p className="font-medium text-gray-700">Profile Views</p>
                        <p className="text-2xl font-semibold">{laundromat.viewCount}</p>
                      </div>
                    )}
                    
                    {laundromat.clickCount !== undefined && (
                      <div>
                        <p className="font-medium text-gray-700">Contact Clicks</p>
                        <p className="text-2xl font-semibold">{laundromat.clickCount}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="premium">
            {laundromat.isPremium ? (
              <>
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <div className="flex gap-2 items-start">
                    {laundromat.isFeatured ? (
                      <Award className="text-yellow-500 h-6 w-6 mt-1" />
                    ) : (
                      <Star className="text-blue-500 h-6 w-6 mt-1" />
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {laundromat.isFeatured ? 'Featured' : 'Premium'} Listing Active
                      </h3>
                      <p className="text-gray-600">
                        Your listing has enhanced visibility and premium features.
                        {laundromat.subscriptionExpiry && (
                          <span> Expires on {new Date(laundromat.subscriptionExpiry).toLocaleDateString()}.</span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                      <Button className="mt-4">
                        <Edit className="h-4 w-4 mr-2" /> Edit Premium Features
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Edit Premium Features</DialogTitle>
                        <DialogDescription>
                          Customize your premium listing to attract more customers
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 mt-4">
                        <div>
                          <label className="block text-gray-700 font-medium mb-2">
                            Promotional Text
                          </label>
                          <Textarea
                            value={promotionalText}
                            onChange={(e) => setPromotionalText(e.target.value)}
                            placeholder="Add a special promotional message for your listing"
                            className="h-24"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 font-medium mb-2">
                            <Package className="inline-block h-4 w-4 mr-1" />
                            Machine Count
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Washers</label>
                              <Input
                                type="number"
                                value={machineCount.washers}
                                onChange={(e) => setMachineCount({...machineCount, washers: parseInt(e.target.value) || 0})}
                                min="0"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Dryers</label>
                              <Input
                                type="number"
                                value={machineCount.dryers}
                                onChange={(e) => setMachineCount({...machineCount, dryers: parseInt(e.target.value) || 0})}
                                min="0"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 font-medium mb-2">
                            <Tag className="inline-block h-4 w-4 mr-1" />
                            Amenities
                          </label>
                          <div className="flex gap-2 mb-2">
                            <Input
                              value={newAmenity}
                              onChange={(e) => setNewAmenity(e.target.value)}
                              placeholder="Add amenity..."
                              className="flex-grow"
                            />
                            <Button type="button" onClick={handleAddAmenity}>Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {amenities.map((amenity, index) => (
                              <Badge 
                                key={index} 
                                variant="secondary"
                                className="p-2"
                              >
                                {amenity}
                                <button 
                                  onClick={() => handleRemoveAmenity(index)}
                                  className="ml-2 text-red-500 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 font-medium mb-2">
                            <Clipboard className="inline-block h-4 w-4 mr-1" />
                            Special Offers
                          </label>
                          <div className="flex gap-2 mb-2">
                            <Input
                              value={newOffer}
                              onChange={(e) => setNewOffer(e.target.value)}
                              placeholder="Add special offer..."
                              className="flex-grow"
                            />
                            <Button type="button" onClick={handleAddOffer}>Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {specialOffers.map((offer, index) => (
                              <Badge 
                                key={index} 
                                variant="secondary"
                                className="p-2"
                              >
                                {offer}
                                <button 
                                  onClick={() => handleRemoveOffer(index)}
                                  className="ml-2 text-red-500 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 font-medium mb-2">
                            <ImagePlus className="inline-block h-4 w-4 mr-1" />
                            Photo Gallery
                          </label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <p>Photo upload feature coming soon!</p>
                            <Button disabled className="mt-2">Upload Photos</Button>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                          <Button onClick={handleSavePremiumFeatures}>Save Changes</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Premium Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {promotionalText && (
                          <div>
                            <p className="font-medium text-gray-700">Promotional Text</p>
                            <p className="text-gray-600">{promotionalText}</p>
                          </div>
                        )}
                        
                        {amenities.length > 0 && (
                          <div>
                            <p className="font-medium text-gray-700">Amenities</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {amenities.map((amenity, index) => (
                                <Badge key={index} variant="outline">{amenity}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {specialOffers.length > 0 && (
                          <div>
                            <p className="font-medium text-gray-700">Special Offers</p>
                            <div className="space-y-1 mt-1">
                              {specialOffers.map((offer, index) => (
                                <p key={index} className="text-gray-600">• {offer}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {(machineCount.washers > 0 || machineCount.dryers > 0) && (
                          <div>
                            <p className="font-medium text-gray-700">Machine Count</p>
                            <div className="flex gap-4 mt-1">
                              <p className="text-gray-600">Washers: {machineCount.washers}</p>
                              <p className="text-gray-600">Dryers: {machineCount.dryers}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Visibility Benefits</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {laundromat.isFeatured ? (
                          <>
                            <div className="flex items-start gap-2">
                              <Star className="text-yellow-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Top placement in search results</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-yellow-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Featured on the homepage rotation</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-yellow-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Premium badge on your listing</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-yellow-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Up to 10 photos in your gallery</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-yellow-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Detailed analytics dashboard</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              <Star className="text-blue-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Enhanced visibility in search results</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-blue-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Premium badge on your listing</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-blue-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Up to 5 photos in your gallery</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Star className="text-blue-500 h-5 w-5 mt-1 shrink-0" />
                              <p className="text-gray-600">Extended description and promotions</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold mb-4">Upgrade Your Listing</h2>
                <p className="text-gray-600 max-w-2xl mx-auto mb-6">
                  Get more visibility and attract more customers by upgrading to a Premium or Featured listing.
                  Showcase your laundromat's amenities, special offers, and more!
                </p>
                
                <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg">Upgrade Now</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                      <DialogTitle>Upgrade Your Listing</DialogTitle>
                      <DialogDescription>
                        Choose a plan that fits your business needs
                      </DialogDescription>
                    </DialogHeader>
                    
                    <PremiumUpgrade 
                      laundryId={parseInt(id)} 
                      onSuccess={() => setUpgradeOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>
                  Manage your premium listing subscription
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeSubscription ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium text-gray-700">Current Plan</p>
                      <div className="flex items-center">
                        {activeSubscription.subscription.tier === 'featured' ? (
                          <Badge className="bg-yellow-500">Featured</Badge>
                        ) : (
                          <Badge className="bg-blue-500">Premium</Badge>
                        )}
                        <p className="ml-2">
                          ${activeSubscription.subscription.amount / 100}/month
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-700">Status</p>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-700">Renewal Date</p>
                      <p>
                        {new Date(activeSubscription.subscription.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-700">Auto-Renew</p>
                      <p>
                        {activeSubscription.subscription.autoRenew ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-600 mb-4">
                      You don't have an active subscription.
                    </p>
                    
                    <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
                      <DialogTrigger asChild>
                        <Button>Upgrade Now</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[700px]">
                        <DialogHeader>
                          <DialogTitle>Upgrade Your Listing</DialogTitle>
                          <DialogDescription>
                            Choose a plan that fits your business needs
                          </DialogDescription>
                        </DialogHeader>
                        
                        <PremiumUpgrade 
                          laundryId={parseInt(id)} 
                          onSuccess={() => setUpgradeOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
              {activeSubscription && (
                <CardFooter className="flex justify-between">
                  <Button variant="outline">Cancel Subscription</Button>
                  <Button variant="outline">Update Payment Method</Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
};

export default BusinessDashboard;