/**
 * Premium Laundromat Management
 * 
 * This module handles the management of premium laundromat listings,
 * allowing specific laundromats to be featured in the Premium section.
 */
import { db, pool } from './db';
import { laundromats, type Laundromat } from '@shared/schema';
import { eq } from 'drizzle-orm';

// IDs of laundromats chosen to display as premium
const PREMIUM_LAUNDROMAT_IDS = [101, 103, 342, 515];

// Custom premium offers for specific laundromats
const PREMIUM_OFFERS = {
  101: "SPECIAL OFFER: 20% off on all wash loads on Tuesdays! Modern machines, free WiFi.",
  103: "MONTHLY MEMBERSHIP: Join our Wash Club for unlimited washes at $49.99/month.",
  342: "PREMIUM AMENITIES: Free detergent on your first visit! Clean facility with security.",
  515: "NEWLY RENOVATED! Comfortable waiting area with free coffee and fast WiFi."
};

/**
 * Get premium laundromats for display
 * This function retrieves specifically chosen laundromats to display as premium
 */
export async function getPremiumLaundromats(): Promise<Laundromat[]> {
  try {
    // Query for specific laundromats by ID
    const query = `
      SELECT id, name, slug, address, city, state, zip, phone, 
             website, latitude, longitude, rating, image_url, 
             hours, description, services, photos, review_count
      FROM laundromats
      WHERE id IN (${PREMIUM_LAUNDROMAT_IDS.join(', ')})
    `;
    
    const result = await pool.query(query);
    console.log("Premium laundromats found:", result.rows.length);
    
    // If no results, return empty array
    if (!result.rows || result.rows.length === 0) {
      return [];
    }
    
    // Add premium attributes to each laundromat
    const premiumLaundromats = result.rows.map(laundry => {
      const id = laundry.id as number;
      
      return {
        ...laundry,
        promotional_text: PREMIUM_OFFERS[id as keyof typeof PREMIUM_OFFERS] || 
                         `Top-rated laundromat in ${laundry.city}, ${laundry.state}!`,
        listing_type: "premium",
        is_premium: true,
        verified: true,
        subscription_active: true,
        subscription_status: "active",
        premium_score: 95
      };
    });
    
    return premiumLaundromats as Laundromat[];
  } catch (error) {
    console.error("Error retrieving premium laundromats:", error);
    return [];
  }
}

/**
 * Get a specific premium laundromat by ID
 */
export async function getPremiumLaundromat(id: number): Promise<Laundromat | undefined> {
  if (!PREMIUM_LAUNDROMAT_IDS.includes(id)) {
    return undefined;
  }
  
  try {
    const query = `
      SELECT id, name, slug, address, city, state, zip, phone, 
             website, latitude, longitude, rating, image_url, 
             hours, description, services, photos, review_count
      FROM laundromats
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (!result.rows || result.rows.length === 0) {
      return undefined;
    }
    
    // Add premium attributes
    const laundry = result.rows[0];
    return {
      ...laundry,
      promotional_text: PREMIUM_OFFERS[id as keyof typeof PREMIUM_OFFERS] || 
                       `Top-rated laundromat in ${laundry.city}, ${laundry.state}!`,
      listing_type: "premium",
      is_premium: true,
      verified: true,
      subscription_active: true,
      subscription_status: "active",
      premium_score: 95
    } as Laundromat;
  } catch (error) {
    console.error(`Error retrieving premium laundromat ${id}:`, error);
    return undefined;
  }
}