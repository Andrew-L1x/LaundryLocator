import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Building, Star, Award, Search, TrendingUp, Users, CheckCircle, ArrowRight } from 'lucide-react';

const ForOwnersPage: React.FC = () => {
  const [, navigate] = useLocation();
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/2">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">Grow Your Laundromat Business</h1>
                <p className="text-xl mb-6">
                  Reach more customers and boost your visibility with LaundryLocator's premium listing options.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button 
                    size="lg" 
                    onClick={() => navigate('/business/1')}
                    className="bg-white text-blue-700 hover:bg-blue-50"
                  >
                    Upgrade Listing
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="bg-transparent border-white text-white hover:bg-white/10"
                  >
                    Learn More
                  </Button>
                </div>
              </div>
              <div className="md:w-1/2 flex justify-center">
                <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-lg p-6 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <Building className="w-6 h-6 mr-2" />
                      <span className="font-semibold text-lg">Your Laundromat</span>
                    </div>
                    <Award className="w-6 h-6 text-yellow-300" />
                  </div>
                  <div className="rounded-md bg-white/10 p-3 mb-4">
                    <div className="font-medium">Featured Listing</div>
                    <div className="text-sm opacity-80">Top placement in search results</div>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <div>Monthly views: <span className="font-semibold">247</span></div>
                    <div>Ranking: <span className="font-semibold">#1</span></div>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="bg-yellow-300 h-full" style={{ width: '85%' }}></div>
                  </div>
                  <div className="text-xs text-right mt-1">85% more visibility</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Benefits Section */}
        <div className="bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Why Upgrade Your Listing?</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Stand out from the competition and attract more customers with our premium and featured listing options.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Enhanced Visibility</h3>
                <p className="text-gray-600">
                  Premium listings appear higher in search results, making it easier for customers to find your business.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Business Analytics</h3>
                <p className="text-gray-600">
                  Access detailed insights about your listing performance and customer interactions.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">More Customers</h3>
                <p className="text-gray-600">
                  Featured listings get up to 5x more views and 3x more customer inquiries than basic listings.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Pricing Section */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Pricing Plans</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Choose the plan that fits your business needs and budget.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle>Basic</CardTitle>
                  <CardDescription>For new businesses</CardDescription>
                  <div className="mt-4 mb-2">
                    <span className="text-3xl font-bold">$0</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
                      <span>Basic listing information</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
                      <span>Standard search visibility</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
                      <span>Customer reviews</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    Current Plan
                  </Button>
                </CardFooter>
              </Card>
              
              <Card className="border-blue-300 shadow-md">
                <CardHeader className="bg-blue-50 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-blue-700">Premium</CardTitle>
                    <Star className="w-5 h-5 text-blue-500" />
                  </div>
                  <CardDescription>For established businesses</CardDescription>
                  <div className="mt-4 mb-2">
                    <span className="text-3xl font-bold">$25</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                      <span>All basic features</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                      <span>Enhanced search visibility</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                      <span>Photo gallery (up to 5 photos)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                      <span>Special offers & promotions</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                      <span>Detailed amenities list</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate('/business/1')}
                  >
                    Upgrade Now
                  </Button>
                </CardFooter>
              </Card>
              
              <Card className="border-yellow-300 shadow-md">
                <CardHeader className="bg-yellow-50 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-yellow-700">Featured</CardTitle>
                    <Award className="w-5 h-5 text-yellow-500" />
                  </div>
                  <CardDescription>For growth-focused businesses</CardDescription>
                  <div className="mt-4 mb-2">
                    <span className="text-3xl font-bold">$50</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-yellow-500 mr-2 shrink-0" />
                      <span>All premium features</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-yellow-500 mr-2 shrink-0" />
                      <span>Top placement in search results</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-yellow-500 mr-2 shrink-0" />
                      <span>Featured on homepage rotation</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-yellow-500 mr-2 shrink-0" />
                      <span>Photo gallery (up to 10 photos)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-yellow-500 mr-2 shrink-0" />
                      <span>Promotional badge on listing</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-yellow-500 mr-2 shrink-0" />
                      <span>Business analytics dashboard</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                    onClick={() => navigate('/business/1')}
                  >
                    Upgrade Now
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Testimonials */}
        <div className="bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">What Our Customers Say</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Hear from laundromat owners who have upgraded their listings.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-bold">JD</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">John Davis</h4>
                    <p className="text-sm text-gray-500">CleanSpot Laundry, Portland</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-2">
                  "Since upgrading to a Premium listing, my business has seen a 40% increase in new customers. The ability to showcase our amenities has really helped us stand out."
                </p>
                <div className="flex text-yellow-400">
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-bold">SM</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Sarah Martinez</h4>
                    <p className="text-sm text-gray-500">Bright & Clean, Chicago</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-2">
                  "The Featured listing has been a game-changer. Being on the homepage has brought in customers from all over the city. Well worth the investment!"
                </p>
                <div className="flex text-yellow-400">
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-bold">RJ</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Robert Johnson</h4>
                    <p className="text-sm text-gray-500">Suds & Duds, Atlanta</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-2">
                  "I was skeptical at first, but the Premium listing has paid for itself many times over. The analytics have helped me understand when to run promotions for maximum impact."
                </p>
                <div className="flex text-yellow-400">
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="bg-blue-600 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Business?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Upgrade your listing today and start attracting more customers to your laundromat.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate('/business/1')}
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Get answers to common questions about our premium listing options.
              </p>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">How do I upgrade my listing?</h3>
                <p className="text-gray-600">
                  You can upgrade your listing by clicking the "Upgrade Now" button and following the simple payment process. Once your payment is processed, your listing will be upgraded immediately.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Can I cancel my subscription at any time?</h3>
                <p className="text-gray-600">
                  Yes, you can cancel your subscription at any time from your business dashboard. Your premium benefits will continue until the end of your current billing period.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">How much higher will my listing appear in search results?</h3>
                <p className="text-gray-600">
                  Premium listings appear above basic listings in search results. Featured listings appear at the very top and are also showcased on the homepage rotation.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">How do I add photos and special offers to my listing?</h3>
                <p className="text-gray-600">
                  After upgrading, you can manage your premium features from your business dashboard. You'll have access to upload photos, add amenities, and create special offers.
                </p>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Is there a contract or minimum commitment?</h3>
                <p className="text-gray-600">
                  No, our premium listings are month-to-month with no long-term commitment. You can upgrade, downgrade, or cancel at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ForOwnersPage;