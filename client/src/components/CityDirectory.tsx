import { Link } from 'wouter';

interface StateDirectoryData {
  [key: string]: {
    name: string;
    cities: Array<{
      name: string;
      slug: string;
      count: number;
    }>;
  };
}

interface CityDirectoryProps {
  stateDirectory: StateDirectoryData;
}

const CityDirectory = ({ stateDirectory }: CityDirectoryProps) => {
  const stateAbbrs = Object.keys(stateDirectory);

  return (
    <section className="bg-gray-50 py-10 border-t">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-6">Browse Laundromats by Location</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {stateAbbrs.map((abbr) => (
            <div key={abbr}>
              <h3 className="text-lg font-semibold mb-2">{stateDirectory[abbr].name}</h3>
              <ul className="space-y-1">
                {stateDirectory[abbr].cities.map((city) => (
                  <li key={city.slug}>
                    <Link 
                      href={`/laundromats/${city.slug}`} 
                      className="text-primary hover:underline"
                    >
                      {city.name} ({city.count})
                    </Link>
                  </li>
                ))}
                <li>
                  <Link 
                    href={`/${abbr.toLowerCase()}`} 
                    className="text-sm text-gray-600 hover:underline"
                  >
                    View all {stateDirectory[abbr].name} cities →
                  </Link>
                </li>
              </ul>
            </div>
          ))}
        </div>
        
        <div className="text-center">
          <Link 
            href="/states" 
            className="bg-white border border-gray-300 rounded-lg px-6 py-3 font-medium hover:bg-gray-50 inline-block"
          >
            View All States
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CityDirectory;
