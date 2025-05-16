import { useEffect, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AdContainer from '@/components/AdContainer';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';
import MetaTags from '@/components/MetaTags';
import { LaundryTip } from '@/types/laundromat';

const LaundryTipDetail = () => {
  const { slug } = useParams();
  const [tipData, setTipData] = useState<LaundryTip | null>(null);
  
  // Fetch tip info
  const { 
    data: tipInfo, 
    isLoading: isTipLoading,
    error: tipError,
    refetch: refetchTip
  } = useQuery<LaundryTip>({
    queryKey: [`/api/laundry-tips/${slug}`],
  });
  
  // Fetch related tips
  const { 
    data: relatedTips = [], 
    isLoading: isRelatedLoading,
    error: relatedError
  } = useQuery<LaundryTip[]>({
    queryKey: [tipData ? `/api/laundry-tips/related/${tipData.id}` : null],
    enabled: !!tipData,
  });
  
  useEffect(() => {
    if (tipInfo) {
      setTipData(tipInfo);
    }
  }, [tipInfo]);
  
  const isLoading = isTipLoading || isRelatedLoading;
  
  if (isLoading && !tipData) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  if (tipError) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-6 mb-4">
            <ApiErrorDisplay 
              error={tipError as Error}
              resetError={() => refetchTip()}
              message={`We couldn't load the laundry tip "${slug}". Please try again.`}
            />
            <div className="mt-4 text-center">
              <Link href="/laundry-tips" className="bg-primary text-white px-6 py-2 rounded-lg font-medium inline-block">
                Back to All Tips
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  if (!tipData && !isTipLoading) {
    return (
      <div className="bg-gray-50 text-gray-800 min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <div className="bg-white rounded-lg p-8 text-center">
            <i className="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
            <h1 className="text-2xl font-semibold mb-2">Tip Not Found</h1>
            <p className="text-gray-600 mb-4">The laundry tip you're looking for doesn't exist in our database.</p>
            <Link href="/laundry-tips" className="bg-primary text-white px-6 py-2 rounded-lg font-medium">
              Back to All Tips
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  // Use placeholder data while fetching
  const title = tipData?.title || 'Laundry Tip';
  const content = tipData?.content || '';
  const category = tipData?.category || '';
  const publishDate = tipData?.createdAt ? new Date(tipData.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Recently published';
  
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      {/* SEO Meta Tags */}
      <MetaTags 
        pageType="service"
        title={`${title} | Laundry Tips & Resources`}
        description={content.substring(0, 160)}
        service={category}
        canonicalUrl={`/laundry-tips/${slug}`}
      />
      
      <Header />
      
      {/* Above the fold leaderboard ad */}
      <AdContainer format="horizontal" className="py-2 text-center" />
      
      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <div className="mb-4 text-sm">
          <Link href="/" className="text-primary hover:underline">Home</Link>
          <span className="mx-2 text-gray-500">/</span>
          <Link href="/laundry-tips" className="text-primary hover:underline">Laundry Tips</Link>
          <span className="mx-2 text-gray-500">/</span>
          <span className="text-gray-700">{title}</span>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/4">
            <article className="bg-white rounded-lg shadow-sm overflow-hidden">
              {tipData?.imageUrl && (
                <img 
                  src={tipData.imageUrl} 
                  alt={title} 
                  className="w-full h-64 md:h-96 object-cover"
                />
              )}
              
              <div className="p-6 md:p-8">
                <div className="flex items-center mb-4">
                  <span className="bg-blue-100 text-primary px-3 py-1 rounded-full text-sm">{category}</span>
                  <span className="mx-2 text-gray-400">•</span>
                  <span className="text-gray-500 text-sm">{publishDate}</span>
                </div>
                
                <h1 className="text-3xl font-bold mb-6">{title}</h1>
                
                <div className="prose prose-lg max-w-none">
                  {content.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4">{paragraph}</p>
                  ))}
                </div>
                
                {/* Tags */}
                <div className="mt-8 pt-6 border-t">
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Laundry', 'Cleaning', category, 'Tips', 'Home Care'].map(tag => (
                      <Link 
                        key={tag}
                        href={`/laundry-tips/tag/${tag.toLowerCase().replace(' ', '-')}`}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm hover:bg-gray-200"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>
                
                {/* Social sharing */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-3">Share This Tip</h3>
                  <div className="flex gap-2">
                    <button className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700">
                      <i className="fab fa-facebook-f w-5 h-5 flex items-center justify-center"></i>
                    </button>
                    <button className="bg-blue-400 text-white p-2 rounded-full hover:bg-blue-500">
                      <i className="fab fa-twitter w-5 h-5 flex items-center justify-center"></i>
                    </button>
                    <button className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700">
                      <i className="fab fa-pinterest w-5 h-5 flex items-center justify-center"></i>
                    </button>
                    <button className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600">
                      <i className="far fa-envelope w-5 h-5 flex items-center justify-center"></i>
                    </button>
                  </div>
                </div>
              </div>
            </article>
            
            {/* Related articles */}
            <section className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Related Tips</h2>
              
              {isRelatedLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-lg border animate-pulse h-48"></div>
                  ))}
                </div>
              ) : relatedError ? (
                <div className="bg-white rounded-lg p-6 mb-4">
                  <p className="text-gray-500">Unable to load related tips</p>
                </div>
              ) : relatedTips.length === 0 ? (
                <div className="bg-white rounded-lg p-6 text-center">
                  <p className="text-gray-500">No related tips available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {relatedTips.map(tip => (
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
            </section>
          </div>
          
          <div className="w-full lg:w-1/4 space-y-6">
            {/* Sticky sidebar ad */}
            <div className="hidden lg:block">
              <AdContainer format="vertical" className="sticky top-24" />
            </div>
            
            {/* Author info */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">About the Author</h3>
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full mr-3"></div>
                <div>
                  <div className="font-medium">Laundry Expert</div>
                  <div className="text-sm text-gray-500">Cleaning Specialist</div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Our laundry experts have years of experience in fabric care and stain removal techniques.
              </p>
            </div>
            
            {/* Newsletter */}
            <div className="bg-blue-50 border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Subscribe for More Tips</h3>
              <p className="text-sm text-gray-600 mb-3">
                Get weekly laundry tips and exclusive content delivered straight to your inbox.
              </p>
              <form className="space-y-2">
                <input 
                  type="email" 
                  placeholder="Your email" 
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button 
                  type="submit" 
                  className="w-full bg-primary text-white font-medium py-2 rounded-lg hover:bg-primary/90"
                >
                  Subscribe
                </button>
              </form>
            </div>
            
            {/* Popular categories */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Popular Categories</h3>
              <ul className="space-y-2">
                {['Stain Removal', 'Washing Techniques', 'Fabric Care', 'Equipment Guides', 'Eco-Friendly Laundry'].map(cat => (
                  <li key={cat}>
                    <Link 
                      href={`/laundry-tips/category/${cat.toLowerCase().replace(' ', '-')}`} 
                      className="flex items-center p-2 hover:bg-gray-50 rounded"
                    >
                      <i className="fas fa-angle-right text-primary mr-2"></i>
                      <span>{cat}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default LaundryTipDetail;