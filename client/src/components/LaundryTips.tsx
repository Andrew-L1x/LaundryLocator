import { LaundryTip } from '@/types/laundromat';

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

interface LaundryTipsProps {
  tips: LaundryTip[];
}

const LaundryTips = ({ tips }: LaundryTipsProps) => {
  return (
    <section className="mt-12 bg-white rounded-lg border p-6 shadow-sm">
      <h2 className="text-2xl font-bold mb-4">Laundry Tips & Resources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tips.map((tip) => (
          <div key={tip.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-48 overflow-hidden">
              <img 
                src={tip.image_url || getCategoryImage(tip.category)} 
                alt={tip.title} 
                className="w-full h-full object-cover transition-transform hover:scale-105"
              />
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2 text-primary">{tip.title}</h3>
              <p className="text-gray-600 mb-3">{tip.description}</p>
              <a href={tip.url || `/laundry-tips/${tip.slug}`} className="text-primary font-medium hover:underline inline-flex items-center">
                Read More 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LaundryTips;
