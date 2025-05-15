import { AffiliateProduct } from '@/types/laundromat';

interface AffiliateProductsProps {
  products: AffiliateProduct[];
}

const AffiliateProducts = ({ products }: AffiliateProductsProps) => {
  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <span key={i} className={i < Math.round(rating) ? 'text-accent' : 'text-gray-300'}>★</span>
    )).join('');
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Laundry Essentials</h3>
      <div className="space-y-4">
        {products.map((product, index) => (
          <div key={product.id} className={`flex ${index < products.length - 1 ? 'border-b pb-3' : ''}`}>
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="w-16 h-16 object-cover rounded mr-3"
            />
            <div>
              <h4 className="font-medium text-sm">{product.name}</h4>
              <div className="flex items-center mt-1 mb-1">
                <span className="text-accent text-xs">{renderStars(product.rating)}</span>
                <span className="text-xs text-gray-500 ml-1">({product.reviewCount})</span>
              </div>
              <a href={product.url} className="text-primary text-xs font-medium hover:underline">Shop on Amazon →</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AffiliateProducts;
