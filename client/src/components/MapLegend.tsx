import React from 'react';

interface MapLegendProps {
  className?: string;
}

export default function MapLegend({ className = '' }: MapLegendProps) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 bg-white rounded-md shadow-sm p-3 mt-2 ${className}`}>
      <div className="flex items-center">
        <div className="h-5 w-5 rounded-full bg-red-500 mr-2"></div>
        <span className="text-sm">Standard</span>
      </div>
      <div className="flex items-center">
        <div className="h-5 w-5 rounded-full bg-blue-500 mr-2"></div>
        <span className="text-sm">Premium</span>
      </div>
      <div className="flex items-center">
        <div className="h-5 w-5 rounded-full bg-purple-500 mr-2"></div>
        <span className="text-sm">Featured</span>
      </div>
      <div className="flex items-center">
        <div className="h-5 w-5 rounded-full bg-amber-500 mr-2"></div>
        <span className="text-sm">Highly Rated (4+)</span>
      </div>
    </div>
  );
}