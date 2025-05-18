import { Link } from 'wouter';
import { Laundromat } from '@/types/laundromat';

interface LaundryCardProps {
  laundromat: Laundromat;
}

const LaundryCard = ({ laundromat }: LaundryCardProps) => {
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
    <article className="laundromat-card border rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow bg-white">
      <div className="md:flex">
        <div className="md:w-1/4 mb-3 md:mb-0 md:mr-4">
          {/* Check if we have a valid image URL directly from the laundromat */}
          {(laundromat.imageUrl || (laundromat.photos && Array.isArray(laundromat.photos) && laundromat.photos.length > 0)) ? (
            <img 
              src={
                // First try direct imageUrl
                laundromat.imageUrl || 
                // Then try the first photo in the photos array if available
                (laundromat.photos && Array.isArray(laundromat.photos) && laundromat.photos.length > 0 
                  ? laundromat.photos[0] 
                  // This fallback shouldn't be reached due to the conditional, but keeping it for safety
                  : ""
                )
              } 
              alt={`${laundromat.name} laundromat`}
              className="w-full h-32 object-cover rounded-lg"
              onError={(e) => {
                // If the image fails to load, try to show Google Street View instead
                if (laundromat.latitude && laundromat.longitude) {
                  e.currentTarget.src = `https://maps.googleapis.com/maps/api/streetview?size=300x200&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
                } else {
                  // If no coordinates, fallback to laundromat-specific image
                  e.currentTarget.src = "https://images.unsplash.com/photo-1596194757945-9e0b62c929e6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200";
                }
              }}
            />
          ) : (
            // If no image is available, use Google Street View based on coordinates
            laundromat.latitude && laundromat.longitude ? (
              <img 
                src={`https://maps.googleapis.com/maps/api/streetview?size=300x200&location=${laundromat.latitude},${laundromat.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                alt={`Street view of ${laundromat.name}`}
                className="w-full h-32 object-cover rounded-lg"
                onError={(e) => {
                  // Fall back to laundromat-specific image if Street View fails
                  e.currentTarget.src = "https://images.unsplash.com/photo-1596194757945-9e0b62c929e6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200";
                }}
              />
            ) : (
              // If no coordinates available, use default laundromat image
              <img 
                src="https://images.unsplash.com/photo-1596194757945-9e0b62c929e6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200"
                alt={`${laundromat.name} laundromat`}
                className="w-full h-32 object-cover rounded-lg"
              />
            )
          )}
        </div>
        <div className="md:w-3/4">
          <h2 className="text-xl font-semibold mb-2">
            <Link href={`/laundromat/${laundromat.slug}`} className="text-primary hover:text-primary/80">
              {laundromat.name}
            </Link>
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs bg-blue-50 text-primary px-2 py-1 rounded-full">
              Self-Service
            </span>
            <span className="text-xs bg-blue-50 text-primary px-2 py-1 rounded-full">
              Coin-Operated
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
        </div>
      </div>
    </article>
  );
};

export default LaundryCard;
