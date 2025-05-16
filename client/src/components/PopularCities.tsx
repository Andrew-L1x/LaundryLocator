import { Link } from 'wouter';
import { City } from '@/types/laundromat';
import ApiErrorDisplay from '@/components/ApiErrorDisplay';

interface PopularCitiesProps {
  cities: City[];
  error?: Error | null;
  onRetry?: () => void;
}

const PopularCities = ({ cities, error, onRetry }: PopularCitiesProps) => {
  if (error) {
    return (
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">Popular Cities</h3>
        <ApiErrorDisplay 
          error={error}
          resetError={onRetry}
          message="Unable to load popular cities. Please try again."
        />
      </div>
    );
  }
  
  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Popular Cities</h3>
      {cities.length === 0 ? (
        <p className="text-gray-500 text-sm p-2">No cities available at the moment.</p>
      ) : (
        <ul className="space-y-2">
          {cities.map((city) => (
            <li key={city.id}>
              <Link 
                href={`/laundromats/${city.slug}`} 
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
              >
                <span>{city.name}, {city.state}</span>
                <span className="text-sm text-gray-500">{city.laundryCount} laundromats</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/cities" className="text-primary font-medium text-sm block mt-3 hover:underline">
        View All Cities →
      </Link>
    </div>
  );
};

export default PopularCities;
