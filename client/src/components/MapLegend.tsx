import React from 'react';

interface MapLegendProps {
  className?: string;
  showTitle?: boolean;
}

const MapLegend: React.FC<MapLegendProps> = ({ 
  className = '', 
  showTitle = true
}) => {
  return (
    <div className={`map-legend bg-white p-3 rounded-md shadow-sm ${className}`}>
      {showTitle && (
        <h4 className="text-sm font-medium mb-2">Map Legend</h4>
      )}
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></div>
          <span>4.5+ Rating</span>
        </div>
        
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-1.5"></div>
          <span>3.5-4.4 Rating</span>
        </div>
        
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-1.5"></div>
          <span>2.5-3.4 Rating</span>
        </div>
        
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-1.5"></div>
          <span>0-2.4 Rating</span>
        </div>
        
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-gray-400 mr-1.5"></div>
          <span>No Rating</span>
        </div>
        
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-orange-500 mr-1.5"></div>
          <span>Your Location</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;