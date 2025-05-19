/**
 * LazyMapLoader Component
 * 
 * This component optimizes Google Maps API costs by:
 * 1. Only loading the Maps JavaScript API when a map is actually visible in the viewport
 * 2. Supporting static image placeholder until interaction is required
 * 3. Implementing debounced loading to prevent unnecessary API loads during fast scrolling
 * 
 * This can significantly reduce Maps JavaScript API costs which are billed per page load.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import LaundryMap from './LaundryMap';
import { Laundromat } from '@/types/laundromat';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyMapLoaderProps {
  laundromats: Laundromat[];
  center?: { lat: number, lng: number };
  zoom?: number;
  height?: string;
  width?: string;
  containerClassName?: string;
  showLegend?: boolean;
  staticImageUrl?: string;
  loadImmediately?: boolean;
}

/**
 * LazyMapLoader will only load the Google Maps JavaScript API
 * when the map container is visible in the viewport. This helps reduce
 * API costs by not loading maps that are never viewed.
 */
const LazyMapLoader: React.FC<LazyMapLoaderProps> = ({
  laundromats,
  center,
  zoom,
  height = '500px',
  width = '100%',
  containerClassName = '',
  showLegend = true,
  staticImageUrl,
  loadImmediately = false
}) => {
  // Track if the map should be loaded
  const [shouldLoadMap, setShouldLoadMap] = useState(loadImmediately);
  
  // Track if user has interacted with the static image
  const [userInteracted, setUserInteracted] = useState(false);
  
  // Detect when map container is visible in viewport
  const { ref: inViewRef, inView } = useInView({
    threshold: 0.1, // 10% of the element needs to be visible
    triggerOnce: true // Only trigger once
  });
  
  // Debounce timer ref to avoid loading during fast scrolling
  const debouncedLoadTimeout = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (inView) {
      // Debounce the map loading to avoid unnecessary loads during fast scrolling
      if (debouncedLoadTimeout.current) {
        clearTimeout(debouncedLoadTimeout.current);
      }
      
      debouncedLoadTimeout.current = setTimeout(() => {
        setShouldLoadMap(true);
      }, 1000); // 1 second delay before loading the map
    }
    
    return () => {
      if (debouncedLoadTimeout.current) {
        clearTimeout(debouncedLoadTimeout.current);
      }
    };
  }, [inView]);
  
  // Handle user interaction with the static image
  const handleImageClick = () => {
    setShouldLoadMap(true);
    setUserInteracted(true);
  };
  
  return (
    <div 
      ref={inViewRef}
      className={containerClassName} 
      style={{ height, width }}
    >
      {shouldLoadMap || userInteracted ? (
        // Render the actual map when it should be loaded
        <LaundryMap
          laundromats={laundromats}
          center={center}
          zoom={zoom}
          height={height}
          width={width}
          containerClassName=""
          showLegend={showLegend}
        />
      ) : (
        // Render a placeholder with optional static image until map should be loaded
        <div 
          className="w-full h-full relative cursor-pointer bg-gray-100 rounded-lg overflow-hidden"
          onClick={handleImageClick}
        >
          {staticImageUrl ? (
            // Show static map image if provided
            <div className="relative w-full h-full">
              <img 
                src={staticImageUrl} 
                alt="Map location" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg">
                  Click to load interactive map
                </div>
              </div>
            </div>
          ) : (
            // Show a skeleton loading state if no static image
            <div className="w-full h-full flex flex-col items-center justify-center">
              <Skeleton className="w-full h-full absolute" />
              <div className="z-10 bg-white/80 rounded-lg p-3 shadow-lg">
                <p className="text-sm text-gray-700 font-medium">Map loading when scrolled into view...</p>
                <p className="text-xs text-gray-500 mt-1">Click to load immediately</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LazyMapLoader;