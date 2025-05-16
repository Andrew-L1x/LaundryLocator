import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AdContainer from '@/components/AdContainer';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import MetaTags from '@/components/MetaTags';
import { LaundryTip } from '@/types/laundromat';

const LaundryTipsPage = () => {
  // Fetch laundry tips
  const { 
    data: tips = [],
    isLoading,
    error,
    refetch
  } = useQuery<LaundryTip[]>({
    queryKey: ['/api/laundry-tips'],
  });

  const laundryTipCategories = [
    { id: 'stain-removal', name: 'Stain Removal' },
    { id: 'washing-techniques', name: 'Washing Techniques' },
    { id: 'fabric-care', name: 'Fabric Care' },
    { id: 'equipment-guides', name: 'Equipment Guides' },
    { id: 'eco-friendly', name: 'Eco-Friendly Laundry' },
    { id: 'money-saving', name: 'Money Saving Tips' },
  ];

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="service"
        title="Laundry Tips & Resources | Expert Advice For Better Laundry"
        description="Discover expert tips for stain removal, fabric care, and laundry techniques. Learn how to save money and time with our comprehensive laundry resources."
        service="Laundry Tips"
        canonicalUrl="/laundry-tips"
      />
      
      <Header />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <div className="mb-4 text-sm">
          <Link href="/" className="text-primary hover:underline">Home</Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-700">Laundry Tips & Resources</span>
        </div>
        
        {/* SEO-optimized header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Laundry Tips & Resources</h1>
          <p className="text-gray-600">
            Discover expert tips, guides, and resources to help you with all your laundry needs,
            from tough stain removal to fabric care and money-saving techniques.
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/4">
            {/* Categories */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {laundryTipCategories.map(category => (
                  <Link 
                    key={category.id}
                    href={`/laundry-tips/category/${category.id}`}
                    className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
                  >
                    <h3 className="font-semibold text-primary">{category.name}</h3>
                  </Link>
                ))}
              </div>
            </section>
            
            {/* Latest Tips */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Latest Laundry Tips</h2>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="bg-white rounded-lg p-6 mb-4">
                  <ApiErrorDisplay 
                    error={error as Error}
                    resetError={() => refetch()}
                    message="We couldn't load the latest laundry tips. Please try again."
                  />
                </div>
              ) : tips.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <p className="text-gray-600">No tips available at the moment. Please check back later.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {tips.map(tip => (
                    <div key={tip.id} className="bg-white rounded-lg overflow-hidden border hover:shadow-md transition-shadow">
                      {tip.imageUrl && (
                        <img 
                          src={tip.imageUrl} 
                          alt={tip.title} 
                          className="w-full h-48 object-cover"
                        />
                      )}
                      <div className="p-4">
                        <span className="inline-block bg-blue-100 text-primary text-xs px-2 py-1 rounded mb-2">
                          {tip.category}
                        </span>
                        <h3 className="font-semibold text-lg mb-2">{tip.title}</h3>
                        <p className="text-gray-600 text-sm mb-3">{tip.excerpt || tip.content.substring(0, 120)}...</p>
                        <Link href={`/laundry-tips/${tip.slug}`} className="text-primary font-medium hover:underline">
                          Read More →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {tips.length > 0 && (
                <div className="flex justify-center mt-8">
                  <Link href="/laundry-tips/all" className="bg-primary text-white font-medium px-6 py-3 rounded-lg hover:bg-primary/90 shadow-sm">
                    View All Tips
                  </Link>
                </div>
              )}
            </section>
            
            {/* Featured Content */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Featured Resource</h2>
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-3">Ultimate Guide to Removing Common Stains</h3>
                  <p className="text-gray-600 mb-4">
                    From red wine to grass stains, our comprehensive guide covers the most effective
                    techniques to tackle the toughest laundry challenges you'll face.
                  </p>
                  <Link href="/laundry-tips/ultimate-stain-removal-guide" className="inline-block bg-primary text-white font-medium px-4 py-2 rounded hover:bg-primary/90">
                    Download Guide
                  </Link>
                </div>
              </div>
            </section>
            
            {/* Newsletter Signup */}
            <section className="bg-blue-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-3">Subscribe to Laundry Tips</h2>
              <p className="text-gray-600 mb-4">
                Get the latest laundry tips, guides, and resources delivered straight to your inbox.
              </p>
              <form className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="email" 
                  placeholder="Your email address" 
                  className="flex-grow px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <button 
                  type="submit" 
                  className="bg-primary text-white font-medium px-6 py-2 rounded-lg hover:bg-primary/90"
                >
                  Subscribe
                </button>
              </form>
            </section>
          </div>
          
          <div className="w-full lg:w-1/4 space-y-6">
            {/* Sticky sidebar ad */}
            <div className="hidden lg:block">
              <AdContainer format="vertical" className="sticky top-24" />
            </div>
            
            {/* Popular Categories */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Popular Categories</h3>
              <ul className="space-y-2">
                {laundryTipCategories.slice(0, 5).map(category => (
                  <li key={category.id}>
                    <Link 
                      href={`/laundry-tips/category/${category.id}`} 
                      className="flex items-center p-2 hover:bg-gray-50 rounded"
                    >
                      <i className="fas fa-angle-right text-primary mr-2"></i>
                      <span>{category.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Recent Posts */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Recent Posts</h3>
              <ul className="space-y-3">
                {tips.slice(0, 5).map(tip => (
                  <li key={tip.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <Link href={`/laundry-tips/${tip.slug}`} className="hover:text-primary">
                      <h4 className="font-medium">{tip.title}</h4>
                      <span className="text-xs text-gray-500">{tip.category}</span>
                    </Link>
                  </li>
                ))}
                {tips.length === 0 && (
                  <li className="text-gray-500 text-sm">
                    No recent posts available
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default LaundryTipsPage;