import React from 'react';

export interface BusinessHourPeriod {
  open: {
    day: number;
    time: string;
  };
  close?: {
    day: number;
    time: string;
  } | null;
}

export interface GooglePlaceAmenities {
  hasWifi: boolean | null;
  hasCoinOp: boolean | null;
  hasCardPayment: boolean | null;
  hasAttendant: boolean | null;
  hasLargeLoads: boolean | null;
  hasDryClean: boolean | null;
  hasVendingMachine: boolean | null;
}

export interface GooglePlaceReview {
  author: string;
  rating: number;
  text: string;
  time: number;
}

export interface GooglePlaceDetails {
  placeId?: string;
  formattedAddress?: string;
  formattedPhone?: string;
  website?: string;
  rating?: number;
  businessHours?: BusinessHourPeriod[];
  is24Hours?: boolean;
  reviews?: GooglePlaceReview[];
  photoRefs?: string[];
  amenities?: GooglePlaceAmenities;
  types?: string[];
  businessStatus?: string;
}

/**
 * Format business hours from Google Places API for display
 */
export const formatBusinessHours = (hours: BusinessHourPeriod[] | null | undefined) => {
  if (!hours || !Array.isArray(hours) || hours.length === 0) {
    return null;
  }
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return hours.map((period, index) => {
    if (!period.open) return null;
    
    const openDay = days[period.open.day];
    const openTime = period.open.time ? 
      `${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}` : 
      'Unknown';
    
    const closeInfo = period.close ? 
      `${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}` : 
      'Closed';
    
    return {
      day: openDay,
      hours: `${openTime} - ${closeInfo}`,
      key: `hour-${index}`
    };
  }).filter(Boolean);
};

/**
 * Get photo URL from Google Places photo reference
 */
export const getGooglePhotoUrl = (photoRef: string | undefined, apiKey: string) => {
  if (!photoRef || !apiKey) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${apiKey}`;
};

/**
 * Get map of amenities from Google Places data
 */
export const getAmenitiesFromGoogle = (googleDetails?: GooglePlaceDetails) => {
  if (!googleDetails?.amenities) return {};

  const amenities = googleDetails.amenities;
  
  return {
    hasCoinOp: amenities.hasCoinOp,
    hasCardPayment: amenities.hasCardPayment,
    hasWifi: amenities.hasWifi,
    hasDryClean: amenities.hasDryClean,
    hasAttendant: amenities.hasAttendant,
    hasLargeLoads: amenities.hasLargeLoads,
    hasVendingMachine: amenities.hasVendingMachine,
  };
};