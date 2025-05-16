/**
 * Create a URL-friendly slug from a string
 */
export function createSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')          // Replace spaces with -
    .replace(/[^\w\-]+/g, '')      // Remove all non-word chars
    .replace(/\-\-+/g, '-')        // Replace multiple - with single -
    .replace(/^-+/, '')            // Trim - from start of text
    .replace(/-+$/, '');           // Trim - from end of text
}

/**
 * Format a price string (e.g. "$2.00")
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Calculate distance between two points in miles
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in miles
  return Math.round(distance * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}