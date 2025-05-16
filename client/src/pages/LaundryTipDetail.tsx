import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { LaundryTip } from '../types/laundromat';
import ApiErrorDisplay from '../components/ApiErrorDisplay';
import Footer from '../components/Footer';
import Header from '../components/Header';
import MetaTags from '../components/MetaTags';
import SchemaMarkup from '../components/SchemaMarkup';

const LaundryTipDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: tip, error, isLoading } = useQuery<LaundryTip>({
    queryKey: [`/api/laundry-tips/${slug}`],
  });
  
  const { data: relatedTips, isLoading: isLoadingRelated } = useQuery<LaundryTip[]>({
    queryKey: [`/api/laundry-tips/related/${tip?.id}`],
    enabled: !!tip?.id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-12">
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  if (error || !tip) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-12">
          <ApiErrorDisplay 
            error={error as Error || new Error('Laundry tip not found')} 
            message="We couldn't find the laundry tip you're looking for."
            resetError={() => window.location.href = '/laundry-tips'}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MetaTags
        pageType="tip-detail"
        title={`${tip.title} | Laundry Tips & Resources`}
        description={tip.description}
        canonicalUrl={`/laundry-tips/${tip.slug}`}
        imageUrl={tip.imageUrl || ''}
      />
      
      <SchemaMarkup
        type="Article"
        data={{
          headline: tip.title,
          description: tip.description,
          image: tip.imageUrl || '',
          author: "Laundry Expert",
          datePublished: tip.createdAt.toString(),
          articleSection: tip.category,
          keywords: tip.tags?.join(', ') || '',
        }}
      />

      <Header />
      
      <main className="flex-grow">
        {/* Hero section with image */}
        {tip.imageUrl && (
          <div className="w-full h-64 md:h-96 relative">
            <img 
              src={tip.imageUrl} 
              alt={tip.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <div className="text-center text-white px-4">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{tip.title}</h1>
                <div className="flex justify-center items-center gap-2 text-sm">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full">
                    {tip.category}
                  </span>
                  <span>•</span>
                  <span>{new Date(tip.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Content section */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm text-gray-500 mb-8">
              <Link href="/" className="hover:text-blue-600">Home</Link>
              <span className="mx-2">›</span>
              <Link href="/laundry-tips" className="hover:text-blue-600">Laundry Tips</Link>
              <span className="mx-2">›</span>
              <span className="text-gray-700">{tip.title}</span>
            </div>
            
            {!tip.imageUrl && (
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{tip.title}</h1>
            )}
            
            <p className="text-gray-600 text-lg mb-8">{tip.description}</p>
            
            {/* Main content */}
            <div className="prose prose-lg max-w-none">
              {tip.content.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            
            {/* Tags */}
            {tip.tags && tip.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {tip.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Related tips */}
          {relatedTips && relatedTips.length > 0 && (
            <div className="max-w-4xl mx-auto mt-16">
              <h2 className="text-2xl font-bold mb-6">Related Laundry Tips</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {relatedTips.map(relatedTip => (
                  <div key={relatedTip.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex">
                    {relatedTip.imageUrl && (
                      <div className="w-1/3">
                        <img 
                          src={relatedTip.imageUrl} 
                          alt={relatedTip.title} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <span className="inline-block px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full mb-2">
                        {relatedTip.category}
                      </span>
                      <h3 className="text-lg font-bold mb-2">
                        <Link href={`/laundry-tips/${relatedTip.slug}`} className="text-gray-800 hover:text-blue-600">
                          {relatedTip.title}
                        </Link>
                      </h3>
                      <Link 
                        href={`/laundry-tips/${relatedTip.slug}`}
                        className="text-blue-600 text-sm font-medium hover:text-blue-800"
                      >
                        Read More →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* CTA section */}
          <div className="max-w-4xl mx-auto mt-16 p-8 bg-blue-50 rounded-lg">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Looking for a Laundromat Near You?</h2>
              <p className="text-gray-600 mb-6">Find the closest laundromats with our location-based directory. Search by ZIP code or use your current location.</p>
              <Link 
                href="/"
                className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Find a Laundromat
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default LaundryTipDetail;