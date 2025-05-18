import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';

interface FeatureLaundryCardProps {
  laundromat: Laundromat;
}

const FeatureLaundryCard = ({ laundromat }: FeatureLaundryCardProps) => {
  // Determine if laundromat is open based on hours
  const determineOpenStatus = (hoursString: string) => {
    if (hoursString === '24 Hours') return true;
    
    // Check if we have the actual hours from Google API
    if (laundromat.googleData?.opening_hours?.open_now !== undefined) {
      return laundromat.googleData.opening_hours.open_now;
    }
    
    // For places without specific hours data, make a reasonable estimation
    // based on common laundromat hours (6am-10pm)
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 is Sunday, 6 is Saturday
    
    // Most laundromats open 6am to 10pm
    // With extended hours on weekends
    if (day === 0 || day === 6) {
      // Weekend hours (often longer)
      return hour >= 6 && hour < 23;
    } else {
      // Weekday hours
      return hour >= 6 && hour < 22;
    }
  };
  
  const isOpen = determineOpenStatus(laundromat.hours);

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
        {laundromat.address || "Unknown"}, {laundromat.city || "Unknown"}, {laundromat.state || "Unknown"} {laundromat.zip || "Unknown"}
      </address>
      <div className="text-sm mb-3">
        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
          isOpen ? 'bg-green-500' : 'bg-red-500'
        }`}></span>
        {isOpen ? 'Open Now' : 'Closed'} · {laundromat.hours || "Unknown hours"}
      </div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t">
        {laundromat.phone ? (
          <a href={`tel:${laundromat.phone}`} className="text-sm font-medium text-primary hover:text-primary/80">
            {laundromat.phone}
          </a>
        ) : (
          <span className="text-sm text-gray-500">Unknown phone</span>
        )}
        <div className="flex items-center">
          <span className="text-yellow-500 mr-1">★</span>
          <span className="text-sm font-medium">{laundromat.rating || "N/A"}</span>
          <span className="text-xs text-gray-500 ml-1">({laundromat.reviewCount || 0})</span>
        </div>
      </div>
    </article>
  );
};

export default FeatureLaundryCard;
