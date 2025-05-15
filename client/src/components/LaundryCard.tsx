import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';

interface LaundryCardProps {
  laundromat: Laundromat;
}

const LaundryCard = ({ laundromat }: LaundryCardProps) => {
  // Determine if laundromat is open based on hours
  const isOpen = laundromat.hours === '24 Hours' || true; // In a real app, this would check actual hours

  return (
    <article className="laundromat-card border rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="md:flex">
        <div className="md:w-1/4 mb-3 md:mb-0 md:mr-4">
          <img 
            src={laundromat.imageUrl || "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200"} 
            alt={`${laundromat.name} laundromat`} 
            className="w-full h-32 object-cover rounded-lg"
          />
        </div>
        <div className="md:w-3/4">
          <h2 className="text-xl font-semibold mb-2">
            <Link href={`/laundromat/${laundromat.slug}`} className="text-primary hover:text-primary/80">
              {laundromat.name}
            </Link>
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {laundromat.services.map(service => (
              <span key={service} className="text-xs bg-blue-50 text-primary px-2 py-1 rounded-full">
                {service}
              </span>
            ))}
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
        </div>
      </div>
    </article>
  );
};

export default LaundryCard;
