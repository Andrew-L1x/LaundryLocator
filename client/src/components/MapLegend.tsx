import React from 'react';

interface MapLegendProps {
  className?: string;
  showTitle?: boolean;
}

export default function MapLegend({ className = '', showTitle = true }: MapLegendProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 mt-2 ${className}`}>
      {showTitle && <h3 className="text-lg font-medium mb-2">Map Legend</h3>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
          <span className="text-sm">Your Location</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span className="text-sm">Excellent (4.5+)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
          <span className="text-sm">Good (3.5-4.4)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
          <span className="text-sm">Average (2.5-3.4)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span className="text-sm">Below Average</span>
        </div>
      </div>
    </div>
  );
}