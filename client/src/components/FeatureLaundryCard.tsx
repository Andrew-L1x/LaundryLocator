import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';

interface FeatureLaundryCardProps {
  laundromat: Laundromat;
}

const FeatureLaundryCard = ({ laundromat }: FeatureLaundryCardProps) => {
  // Determine if laundromat is open based on hours
  const isOpen = laundromat.hours === '24 Hours' || true; // In a real app, this would check actual hours

  return (
    <article className="laundromat-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow bg-white relative">
      <div className="absolute top-4 right-4 bg-accent text-white text-xs px-2 py-1 rounded-full">
        Featured
      </div>
      <img 
        src={laundromat.imageUrl || "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300"} 
        alt={`${laundromat.name} interior`} 
        className="w-full h-40 object-cover rounded-lg mb-3"
      />
      <h3 className="text-xl font-semibold mb-2">
        <Link href={`/laundromat/${laundromat.slug}`} className="text-primary hover:text-primary/80">
          {laundromat.name}
        </Link>
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs bg-blue-50 text-primary px-2 py-1 rounded-full">
          Full-Service Laundry
        </span>
        <span className="text-xs bg-blue-50 text-primary px-2 py-1 rounded-full">
          Self-Service
        </span>
      </div>
      <address className="text-sm mb-2 not-italic">
        {laundromat.address}, {laundromat.city}, {laundromat.state} {laundromat.zip}
      </address>
      <div className="text-sm mb-3">
        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
          isOpen ? 'bg-green-500' : 'bg-red-500'
        }`}></span>
        {isOpen ? 'Open Now' : 'Closed'} · {laundromat.hours}
      </div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t">
        <a href={`tel:${laundromat.phone}`} className="text-sm font-medium text-primary hover:text-primary/80">
          {laundromat.phone}
        </a>
        <div className="flex items-center">
          <span className="text-yellow-500 mr-1">★</span>
          <span className="text-sm font-medium">{laundromat.rating}</span>
          <span className="text-xs text-gray-500 ml-1">({laundromat.reviewCount})</span>
        </div>
      </div>
    </article>
  );
};

export default FeatureLaundryCard;
