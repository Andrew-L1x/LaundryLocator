import { Link } from 'wouter';
import { City } from '@/types/laundromat';

interface PopularCitiesProps {
  cities: City[];
}

const PopularCities = ({ cities }: PopularCitiesProps) => {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Popular Cities</h3>
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
      <Link href="/cities" className="text-primary font-medium text-sm block mt-3 hover:underline">
        View All Cities →
      </Link>
    </div>
  );
};

export default PopularCities;
