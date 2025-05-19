/**
 * MarkerClusterer Component for Google Maps
 * 
 * This component serves as a wrapper for Google Maps markers, implementing
 * a clustering approach that significantly reduces the number of active markers
 * rendered on the map, especially in dense areas.
 * 
 * Benefits:
 * - Reduces overall Google Maps API usage
 * - Improves map performance and reduces rendering loads
 * - Provides a cleaner user interface for areas with many laundromats
 */

import React, { useEffect, useState } from 'react';
import { Marker } from '@react-google-maps/api';
import { Laundromat } from '@/types/laundromat';

interface MarkerClustererProps {
  map: google.maps.Map | null;
  laundromats: Laundromat[];
  selectedMarker: number | null;
  onMarkerClick: (id: number) => void;
  currentUserLocation?: { lat: number, lng: number } | null;
  highlightedId?: number | null;
  iconUrl?: string;
}

const MarkerClusterer: React.FC<MarkerClustererProps> = ({
  map,
  laundromats,
  selectedMarker,
  onMarkerClick,
  currentUserLocation,
  highlightedId,
  iconUrl
}) => {
  const [visibleMarkers, setVisibleMarkers] = useState<Laundromat[]>([]);
  const [clusteredMarkers, setClusteredMarkers] = useState<any[]>([]);
  
  useEffect(() => {
    if (!map || laundromats.length === 0) return;
    
    // Create a listener for map bounds changes
    const boundsChangedListener = map.addListener('bounds_changed', () => {
      updateVisibleMarkers();
    });
    
    // Create a listener for zoom changes
    const zoomChangedListener = map.addListener('zoom_changed', () => {
      updateVisibleMarkers();
    });
    
    // Initial update
    updateVisibleMarkers();
    
    return () => {
      // Clean up listeners
      if (boundsChangedListener) google.maps.event.removeListener(boundsChangedListener);
      if (zoomChangedListener) google.maps.event.removeListener(zoomChangedListener);
    };
  }, [map, laundromats]);
  
  // Update which markers should be visible based on current map bounds and zoom
  const updateVisibleMarkers = () => {
    if (!map) return;
    
    // Get current bounds and zoom level
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    if (!bounds) return;
    
    // Filter laundromats to those in the current viewport
    const markersInView = laundromats.filter(laundromat => {
      if (!laundromat.latitude || !laundromat.longitude) return false;
      
      const position = new google.maps.LatLng(
        parseFloat(laundromat.latitude),
        parseFloat(laundromat.longitude)
      );
      
      return bounds.contains(position);
    });
    
    // Apply clustering based on zoom level
    if (zoom && zoom < 14 && markersInView.length > 30) {
      // Create clusters for dense areas at lower zoom levels
      const clusters = createClusters(markersInView);
      setVisibleMarkers([]); // No individual markers
      setClusteredMarkers(clusters);
    } else {
      // At higher zoom levels, display individual markers
      setVisibleMarkers(markersInView);
      setClusteredMarkers([]);
    }
  };
  
  // Create marker clusters based on proximity
  const createClusters = (markers: Laundromat[]) => {
    if (markers.length === 0) return [];
    
    const gridSize = 0.01; // Approximately 1km at the equator
    const clusters: any = {};
    
    // Group markers by grid cells
    markers.forEach(marker => {
      if (!marker.latitude || !marker.longitude) return;
      
      const lat = parseFloat(marker.latitude);
      const lng = parseFloat(marker.longitude);
      
      // Calculate grid cell
      const gridLat = Math.floor(lat / gridSize) * gridSize;
      const gridLng = Math.floor(lng / gridSize) * gridSize;
      const gridKey = `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`;
      
      if (!clusters[gridKey]) {
        clusters[gridKey] = {
          position: { lat: gridLat + gridSize/2, lng: gridLng + gridSize/2 },
          count: 0,
          markers: []
        };
      }
      
      clusters[gridKey].count++;
      clusters[gridKey].markers.push(marker);
    });
    
    // Convert clusters object to array
    return Object.values(clusters);
  };
  
  return (
    <>
      {/* Render individual markers when not clustered */}
      {visibleMarkers.map(laundromat => {
        if (!laundromat.latitude || !laundromat.longitude) return null;
        
        const position = {
          lat: parseFloat(laundromat.latitude),
          lng: parseFloat(laundromat.longitude)
        };
        
        // Determine if marker should be highlighted
        const isHighlighted = laundromat.id === highlightedId;
        const isSelected = laundromat.id === selectedMarker;
        
        return (
          <Marker
            key={`marker-${laundromat.id}`}
            position={position}
            onClick={() => onMarkerClick(laundromat.id)}
            icon={{
              url: isHighlighted || isSelected 
                ? '/images/marker-highlighted.png' 
                : (iconUrl || '/images/marker-default.png'),
              scaledSize: new google.maps.Size(
                isHighlighted || isSelected ? 34 : 24, 
                isHighlighted || isSelected ? 34 : 24
              )
            }}
            zIndex={isHighlighted || isSelected ? 1000 : 1}
            animation={isHighlighted ? google.maps.Animation.BOUNCE : undefined}
          />
        );
      })}
      
      {/* Render cluster markers */}
      {clusteredMarkers.map((cluster, index) => (
        <Marker
          key={`cluster-${index}`}
          position={cluster.position}
          onClick={() => {
            // When clicking a cluster, zoom in to see individual markers
            if (map) {
              map.setCenter(cluster.position);
              map.setZoom((map.getZoom() || 10) + 2);
            }
          }}
          icon={{
            url: '/images/marker-cluster.png',
            scaledSize: new google.maps.Size(40, 40),
            labelOrigin: new google.maps.Point(20, 20)
          }}
          label={{
            text: cluster.count.toString(),
            color: '#FFFFFF',
            fontWeight: 'bold'
          }}
        />
      ))}
      
      {/* Show user location marker if available */}
      {currentUserLocation && (
        <Marker
          position={currentUserLocation}
          icon={{
            url: '/images/user-location.png',
            scaledSize: new google.maps.Size(24, 24)
          }}
          zIndex={2000}
        />
      )}
    </>
  );
};

export default MarkerClusterer;