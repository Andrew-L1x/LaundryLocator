import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { LaundryTip } from '../types/laundromat';
import ApiErrorDisplay from '../components/ApiErrorDisplay';
import Footer from '../components/Footer';
import Header from '../components/Header';
import MetaTags from '../components/MetaTags';
import SchemaMarkup from '../components/SchemaMarkup';
import { generateTipsPageContent } from '../lib/seo';

// Stock images for different laundry tip categories
const getCategoryImage = (category: string) => {
  switch (category) {
    case 'clothing-care':
      return 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'laundromat-guide':
      return 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'stain-removal':
      return 'https://images.unsplash.com/photo-1469037784699-75dcf276d237?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'eco-friendly':
      return 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'organization':
      return 'https://images.unsplash.com/photo-1605117882932-f5ad49c98dc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'productivity':
      return 'https://images.unsplash.com/photo-1551761429-8232f9f5955c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'business':
      return 'https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    case 'education':
      return 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
    default:
      return 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60';
  }
};

const LaundryTipsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const { data: tips, error, isLoading } = useQuery<LaundryTip[]>({
    queryKey: ['/api/laundry-tips'],
  });

  // Filter tips by category if a category is selected
  const filteredTips = activeCategory
    ? tips?.filter(tip => tip.category === activeCategory)
    : tips;

  // Get unique categories from tips
  const categories = tips ? [...new Set(tips.map(tip => tip.category))] : [];

  // Generate dynamic SEO content
  const seoContent = useMemo(() => {
    if (tips && tips.length > 0) {
      return generateTipsPageContent(tips);
    }
    return null;
  }, [tips]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Dynamic SEO Meta Tags */}
      <MetaTags
        pageType="tips"
        title={seoContent?.title || "Laundry Tips & Resources | Expert Advice for Better Laundry"}
        description={seoContent?.description || "Learn expert laundry tips and tricks for stain removal, fabric care, energy-saving methods, and more. Get the most out of your laundry experience with our helpful resources."}
        canonicalUrl="/laundry-tips"
        imageUrl="https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=630"
      />
      
      {/* Dynamic Schema Markup */}
      {seoContent && seoContent.schema ? (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoContent.schema) }}
        />
      ) : (
        <SchemaMarkup
          type="CollectionPage"
          data={{
            headline: "Laundry Tips & Resources",
            description: "Learn expert laundry tips and tricks for stain removal, fabric care, energy-saving methods, and more.",
            url: "/laundry-tips",
            image: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=630"
          }}
        />
      )}

      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Laundry Tips & Resources</h1>
            <p className="text-lg text-gray-600 mb-8">
              Expert advice to help you get the most out of your laundry experience
            </p>
            
            {/* Categories filter */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <button
                className={`px-4 py-2 rounded-full text-sm font-medium 
                  ${activeCategory === null 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                onClick={() => setActiveCategory(null)}
              >
                All Tips
              </button>
              
              {categories.map(category => (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-full text-sm font-medium 
                    ${activeCategory === category 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <ApiErrorDisplay 
              error={error as Error} 
              message="There was an error loading laundry tips. Please try again later."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredTips?.map(tip => (
                <div key={tip.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                  {tip.imageUrl && (
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={tip.imageUrl} 
                        alt={tip.title} 
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full mb-3">
                      {tip.category}
                    </span>
                    <h2 className="text-xl font-bold mb-3">
                      <Link href={`/laundry-tips/${tip.slug}`} className="text-gray-800 hover:text-blue-600">
                        {tip.title}
                      </Link>
                    </h2>
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {tip.description}
                    </p>
                    <Link 
                      href={`/laundry-tips/${tip.slug}`}
                      className="inline-block text-blue-600 font-medium hover:text-blue-800"
                    >
                      Read More →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Newsletter Signup */}
          <div className="bg-blue-50 rounded-lg p-8 mt-16">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Get More Laundry Tips</h2>
              <p className="text-gray-600 mb-6">Sign up for our newsletter to receive the latest laundry tips and tricks straight to your inbox.</p>
              <div className="flex flex-col sm:flex-row max-w-md mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-grow px-4 py-3 mb-2 sm:mb-0 sm:mr-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                  Subscribe
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">We respect your privacy and will never share your information.</p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default LaundryTipsPage;