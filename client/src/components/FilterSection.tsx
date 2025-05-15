import { useState } from 'react';
import { Filter } from '@/types/laundromat';

interface FilterSectionProps {
  onFilterChange: (filters: Filter) => void;
  currentLocation: string;
}

const FilterSection = ({ onFilterChange, currentLocation }: FilterSectionProps) => {
  const [filters, setFilters] = useState<Filter>({});
  
  const toggleFilter = (filterType: keyof Filter, value: any) => {
    const newFilters = { ...filters };
    
    if (filterType === 'services') {
      const services = newFilters.services || [];
      if (services.includes(value)) {
        newFilters.services = services.filter(s => s !== value);
      } else {
        newFilters.services = [...services, value];
      }
    } else if (newFilters[filterType] === value) {
      delete newFilters[filterType];
    } else {
      newFilters[filterType] = value;
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  const isActive = (filterType: keyof Filter, value?: any) => {
    if (filterType === 'services' && value) {
      return filters.services?.includes(value);
    }
    return filters[filterType] === value;
  };
  
  return (
    <section className="mb-8">
      {/* Current location display */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Laundromats Near You</h2>
        <p id="current-location" className="text-gray-600">
          <i className="fas fa-map-marker-alt text-primary mr-1"></i>
          <span>{currentLocation}</span>
        </p>
      </div>

      {/* Filter options */}
      <div className="filter-section mb-6 overflow-x-auto pb-2">
        <div className="flex gap-2">
          <button 
            className={`filter-btn ${isActive('allFilters') ? 'bg-primary text-white' : 'bg-white'} border border-gray-300 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 min-w-max`}
            onClick={() => {
              setFilters({});
              onFilterChange({});
            }}
          >
            <i className="fas fa-filter mr-1 text-primary"></i> All Filters
          </button>
          <button 
            className={`filter-btn ${isActive('openNow', true) ? 'bg-primary text-white' : 'bg-white'} border border-gray-300 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 flex items-center min-w-max`}
            onClick={() => toggleFilter('openNow', true)}
          >
            <i className="fas fa-clock mr-1 text-primary"></i> Open Now
          </button>
          <button 
            className={`filter-btn ${isActive('services', 'Coin-Operated') ? 'bg-primary text-white' : 'bg-white'} border border-gray-300 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 min-w-max`}
            onClick={() => toggleFilter('services', 'Coin-Operated')}
          >
            <i className="fas fa-coins mr-1 text-primary"></i> Coin-Operated
          </button>
          <button 
            className={`filter-btn ${isActive('services', '24 Hours') ? 'bg-primary text-white' : 'bg-white'} border border-gray-300 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 min-w-max`}
            onClick={() => toggleFilter('services', '24 Hours')}
          >
            <i className="fas fa-moon mr-1 text-primary"></i> 24 Hours
          </button>
          <button 
            className={`filter-btn ${isActive('services', 'Card Payment') ? 'bg-primary text-white' : 'bg-white'} border border-gray-300 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 min-w-max`}
            onClick={() => toggleFilter('services', 'Card Payment')}
          >
            <i className="fas fa-credit-card mr-1 text-primary"></i> Card Payment
          </button>
          <button 
            className={`filter-btn ${isActive('rating', 4) ? 'bg-primary text-white' : 'bg-white'} border border-gray-300 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 active:bg-gray-100 min-w-max`}
            onClick={() => toggleFilter('rating', 4)}
          >
            <i className="fas fa-star mr-1 text-primary"></i> 4.0+
          </button>
        </div>
      </div>
    </section>
  );
};

export default FilterSection;
