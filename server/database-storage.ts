import { 
  users, 
  laundromats, 
  reviews, 
  favorites, 
  cities, 
  states,
  subscriptions,
  laundryTips,
  type User, 
  type InsertUser, 
  type Laundromat, 
  type InsertLaundromat,
  type Review,
  type InsertReview,
  type Favorite,
  type InsertFavorite,
  type City,
  type InsertCity,
  type State,
  type InsertState,
  type Subscription,
  type InsertSubscription,
  type LaundryTip,
  type InsertLaundryTip
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, or, gte, lte, desc, asc, ilike, like, sql } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  
  // Get a limited number of laundromats
  async getLaundromats(limit: number = 20): Promise<Laundromat[]> {
    try {
      const results = await db.select().from(laundromats).orderBy(desc(laundromats.id)).limit(limit);
      return results;
    } catch (error) {
      console.error('Error in getLaundromats:', error);
      return [];
    }
  }
  // Helper method to convert state abbreviation to full name
  getStateNameFromAbbr(abbr: string): string | null {
    const stateMap: Record<string, string> = {
      'AL': 'Alabama',
      'AK': 'Alaska',
      'AZ': 'Arizona',
      'AR': 'Arkansas',
      'CA': 'California',
      'CO': 'Colorado',
      'CT': 'Connecticut',
      'DE': 'Delaware',
      'FL': 'Florida',
      'GA': 'Georgia',
      'HI': 'Hawaii',
      'ID': 'Idaho',
      'IL': 'Illinois',
      'IN': 'Indiana',
      'IA': 'Iowa',
      'KS': 'Kansas',
      'KY': 'Kentucky',
      'LA': 'Louisiana',
      'ME': 'Maine',
      'MD': 'Maryland',
      'MA': 'Massachusetts',
      'MI': 'Michigan',
      'MN': 'Minnesota',
      'MS': 'Mississippi',
      'MO': 'Missouri',
      'MT': 'Montana',
      'NE': 'Nebraska',
      'NV': 'Nevada',
      'NH': 'New Hampshire',
      'NJ': 'New Jersey',
      'NM': 'New Mexico',
      'NY': 'New York',
      'NC': 'North Carolina',
      'ND': 'North Dakota',
      'OH': 'Ohio',
      'OK': 'Oklahoma',
      'OR': 'Oregon',
      'PA': 'Pennsylvania',
      'RI': 'Rhode Island',
      'SC': 'South Carolina',
      'SD': 'South Dakota',
      'TN': 'Tennessee',
      'TX': 'Texas',
      'UT': 'Utah',
      'VT': 'Vermont',
      'VA': 'Virginia',
      'WA': 'Washington',
      'WV': 'West Virginia',
      'WI': 'Wisconsin',
      'WY': 'Wyoming',
      'DC': 'District of Columbia'
    };
    
    return stateMap[abbr] || null;
  }
  
  // Helper method to convert state full name to abbreviation
  getStateAbbrFromName(name: string): string | null {
    const stateMap: Record<string, string> = {
      'Alabama': 'AL',
      'Alaska': 'AK',
      'Arizona': 'AZ',
      'Arkansas': 'AR',
      'California': 'CA',
      'Colorado': 'CO',
      'Connecticut': 'CT',
      'Delaware': 'DE',
      'Florida': 'FL',
      'Georgia': 'GA',
      'Hawaii': 'HI',
      'Idaho': 'ID',
      'Illinois': 'IL',
      'Indiana': 'IN',
      'Iowa': 'IA',
      'Kansas': 'KS',
      'Kentucky': 'KY',
      'Louisiana': 'LA',
      'Maine': 'ME',
      'Maryland': 'MD',
      'Massachusetts': 'MA',
      'Michigan': 'MI',
      'Minnesota': 'MN',
      'Mississippi': 'MS',
      'Missouri': 'MO',
      'Montana': 'MT',
      'Nebraska': 'NE',
      'Nevada': 'NV',
      'New Hampshire': 'NH',
      'New Jersey': 'NJ',
      'New Mexico': 'NM',
      'New York': 'NY',
      'North Carolina': 'NC',
      'North Dakota': 'ND',
      'Ohio': 'OH',
      'Oklahoma': 'OK',
      'Oregon': 'OR',
      'Pennsylvania': 'PA',
      'Rhode Island': 'RI',
      'South Carolina': 'SC',
      'South Dakota': 'SD',
      'Tennessee': 'TN',
      'Texas': 'TX',
      'Utah': 'UT',
      'Vermont': 'VT',
      'Virginia': 'VA',
      'Washington': 'WA',
      'West Virginia': 'WV',
      'Wisconsin': 'WI',
      'Wyoming': 'WY',
      'District of Columbia': 'DC'
    };
    
    return stateMap[name] || null;
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Laundromat operations
  async getLaundromat(id: number): Promise<Laundromat | undefined> {
    try {
      const query = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count, photos, seo_tags, seo_description, seo_title,
               services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
               self_service, full_service, dry_cleaning
        FROM laundromats
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [id]);
      return result.rows.length ? result.rows[0] as Laundromat : undefined;
    } catch (error) {
      console.error("Error in getLaundromat:", error);
      return undefined;
    }
  }

  async getLaundryBySlug(slug: string): Promise<Laundromat | undefined> {
    try {
      const query = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count, photos, seo_tags, seo_description, seo_title,
               services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
               self_service, full_service, dry_cleaning
        FROM laundromats
        WHERE slug = $1
      `;
      
      const result = await pool.query(query, [slug]);
      return result.rows.length ? result.rows[0] as Laundromat : undefined;
    } catch (error) {
      console.error("Error in getLaundryBySlug:", error);
      return undefined;
    }
  }

  async getLaundromatsForUser(userId: number): Promise<Laundromat[]> {
    try {
      const userLaundromatQuery = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count, photos, photo_urls, seo_tags, seo_description, seo_title,
               services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
               self_service, full_service, dry_cleaning
        FROM laundromats
        WHERE owner_id = $1
        LIMIT 20
      `;
      
      const result = await pool.query(userLaundromatQuery, [userId]);
      return result.rows as Laundromat[];
    } catch (error) {
      console.error("Error in getLaundromatsForUser:", error);
      return [];
    }
  }

  async searchLaundromats(query: string, filters: any = {}): Promise<Laundromat[]> {
    try {
      let simplifiedQuery;
      let params: any[] = [];
      
      if (query && query.trim()) {
        // Check if query looks like a ZIP code (5 digits)
        const isZipCode = /^\d{5}$/.test(query.trim());
        
        if (isZipCode) {
          console.log(`Searching for ZIP code: ${query.trim()}`);
          // For ZIP codes, use exact matching
          simplifiedQuery = `
            SELECT id, name, slug, address, city, state, zip, phone, 
                   website, latitude, longitude, rating, image_url, 
                   hours, description, is_featured, is_premium, 
                   listing_type, review_count, photos, photo_urls, seo_tags, seo_description, seo_title,
                   services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
                   self_service, full_service, dry_cleaning
            FROM laundromats
            WHERE zip = $1
            LIMIT 20
          `;
          
          params = [query.trim()];
        } else {
          console.log(`Searching with general query: ${query.trim()}`);
          // For other queries, use fuzzy matching
          simplifiedQuery = `
            SELECT id, name, slug, address, city, state, zip, phone, 
                   website, latitude, longitude, rating, image_url, 
                   hours, description, is_featured, is_premium, 
                   listing_type, review_count, photos, photo_urls, seo_tags, seo_description, seo_title,
                   services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
                   self_service, full_service, dry_cleaning
            FROM laundromats
            WHERE name ILIKE $1 OR city ILIKE $1 OR state ILIKE $1 OR zip ILIKE $1
            LIMIT 20
          `;
          
          const searchPattern = `%${query || ''}%`;
          params = [searchPattern];
        }
      } else {
        // If no query, just return all laundromats
        simplifiedQuery = `
          SELECT id, name, slug, address, city, state, zip, phone, 
                 website, latitude, longitude, rating, image_url, 
                 hours, description, is_featured, is_premium, 
                 listing_type, review_count, photos, photo_urls, seo_tags, seo_description, seo_title,
                 services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
                 self_service, full_service, dry_cleaning
          FROM laundromats
          LIMIT 20
        `;
      }
      
      const query_result = await pool.query(simplifiedQuery, params);
      
      console.log("Laundromats search found:", query_result.rows.length);
      return query_result.rows as Laundromat[];
    } catch (error) {
      console.error("Error in searchLaundromats:", error);
      
      // Use an even simpler fallback
      try {
        const fallbackQuery = `
          SELECT id, name, slug, address, city, state, zip, phone, 
                 website, latitude, longitude, rating, image_url, 
                 hours, description, is_featured, is_premium,
                 listing_type, review_count, photos
          FROM laundromats
          LIMIT 10
        `;
        const fallbackResult = await pool.query(fallbackQuery);
        console.log("Fallback - found laundromats:", fallbackResult.rows.length);
        return fallbackResult.rows as Laundromat[];
      } catch (fallbackError) {
        console.error("Failed to fetch any laundromats:", fallbackError);
        return [];
      }
    }
  }

  async getLaundromatsNearby(lat: string, lng: string, radius: number = 5): Promise<Laundromat[]> {
    try {
      // Get laundromats from database
      const nearbyQuery = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count, photos, photo_urls, seo_tags, seo_description, seo_title,
               services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
               self_service, full_service, dry_cleaning
        FROM laundromats
        LIMIT 50
      `;
      
      const result = await pool.query(nearbyQuery);
      console.log("Laundromats nearby query found:", result.rows.length, "laundromats");
      
      // Calculate distance for each laundromat
      const latFloat = parseFloat(lat);
      const lngFloat = parseFloat(lng);
      
      // Calculate distances and filter by radius
      const nearbyLaundromats = result.rows
        .map(l => {
          // Simple distance calculation
          const distance = this.calculateDistance(
            latFloat, 
            lngFloat, 
            parseFloat(l.latitude || "0"), 
            parseFloat(l.longitude || "0")
          );
          
          return { ...l, distance };
        })
        .filter(l => l.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
      
      console.log("After filtering by radius:", nearbyLaundromats.length, "laundromats");
      return nearbyLaundromats;
    } catch (error) {
      console.error("Error in getLaundromatsNearby:", error);
      
      // As a fallback, just return some laundromats without filtering by distance
      try {
        const fallbackQuery = `
          SELECT id, name, slug, address, city, state, zip, phone, 
                 website, latitude, longitude, rating, image_url, 
                 hours, description
          FROM laundromats
          LIMIT 10
        `;
        
        const fallbackResult = await pool.query(fallbackQuery);
        console.log("Fallback - returning laundromats without distance filtering");
        
        // Add a distance value
        return fallbackResult.rows.map(l => ({
          ...l,
          distance: Math.random() * 5 // Random distance between 0-5 miles
        })) as Laundromat[];
      } catch (fallbackError) {
        console.error("Failed to fetch any laundromats for nearby search:", fallbackError);
        return [];
      }
    }
  }
  
  // Get nearby laundromats for a specific laundromat
  async getNearbyLaundromats(currentId: number, lat: number, lng: number, radius = 5): Promise<Laundromat[]> {
    try {
      // Get nearby laundromats excluding the current one
      const nearbyQuery = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count, photos, photo_urls, services,
               seo_tags, seo_description, seo_title, features,
               payment_methods, parking, wifi, delivery, pickup, drop_off,
               self_service, full_service, dry_cleaning
        FROM laundromats
        WHERE id != $1
        LIMIT 50
      `;
      
      const result = await pool.query(nearbyQuery, [currentId]);
      console.log(`Looking for nearby laundromats around ID ${currentId} - found ${result.rows.length} candidates`);
      
      // Calculate distance for each laundromat
      const nearbyLaundromats = result.rows
        .map(l => {
          // Simple distance calculation
          const distance = this.calculateDistance(
            lat, 
            lng, 
            parseFloat(l.latitude || "0"), 
            parseFloat(l.longitude || "0")
          );
          
          return { ...l, distance };
        })
        .filter(l => l.distance <= radius)
        .sort((a, b) => {
          // Sort by premium status first, then by distance
          if (a.is_premium && !b.is_premium) return -1;
          if (!a.is_premium && b.is_premium) return 1;
          
          // Then by distance
          return a.distance - b.distance;
        })
        .slice(0, 3); // Just return the top 3 for display
      
      console.log(`Found ${nearbyLaundromats.length} nearby laundromats within ${radius} miles`);
      return nearbyLaundromats as Laundromat[];
    } catch (error) {
      console.error("Error in getNearbyLaundromats:", error);
      return [];
    }
  }
  
  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in miles
    return distance;
  }
  
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  async getFeaturedLaundromats(): Promise<Laundromat[]> {
    try {
      // Use a simple SQL query with column names we know exist
      const featuredQuery = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count, photos, photo_urls, seo_tags, seo_description, seo_title,
               services, features, payment_methods, parking, wifi, delivery, pickup, drop_off, 
               self_service, full_service, dry_cleaning
        FROM laundromats
        WHERE is_featured = true
        ORDER BY featured_rank ASC NULLS LAST
        LIMIT 10
      `;
      
      const result = await pool.query(featuredQuery);
      console.log("Featured laundromats found:", result.rows.length);
      return result.rows as Laundromat[];
    } catch (error) {
      console.error("Error in getFeaturedLaundromats:", error);
      
      // Simple fallback - just return any 10 laundromats
      try {
        const fallbackQuery = `
          SELECT id, name, slug, address, city, state, zip, phone, 
                 website, latitude, longitude, rating, image_url, 
                 hours, description
          FROM laundromats
          LIMIT 10
        `;
        const fallbackResult = await db.execute(fallbackQuery);
        console.log("Fallback used - returning any laundromats:", fallbackResult.rows.length);
        return fallbackResult.rows;
      } catch (fallbackError) {
        console.error("Complete fallback error - can't query database:", fallbackError);
        return [];
      }
    }
  }
  
  async getPremiumLaundromats(): Promise<Laundromat[]> {
    try {
      // Use a simple SQL query with column names we know exist
      const premiumQuery = `
        SELECT id, name, slug, address, city, state, zip, phone, 
               website, latitude, longitude, rating, image_url, 
               hours, description, is_featured, is_premium, 
               listing_type, review_count
        FROM laundromats
        WHERE listing_type = 'premium' OR listing_type = 'featured'
        LIMIT 10
      `;
      
      const result = await db.execute(premiumQuery);
      console.log("Premium laundromats found:", result.rows.length);
      return result.rows;
    } catch (error) {
      console.error("Error in getPremiumLaundromats:", error);
      
      // Simple fallback
      try {
        const fallbackQuery = `
          SELECT id, name, slug, address, city, state, zip, phone, 
                 website, latitude, longitude, rating, image_url, 
                 hours, description
          FROM laundromats
          LIMIT 10
        `;
        const fallbackResult = await db.execute(fallbackQuery);
        console.log("Fallback used - returning any laundromats:", fallbackResult.rows.length);
        return fallbackResult.rows;
      } catch (fallbackError) {
        console.error("Complete fallback error - can't query database:", fallbackError);
        return [];
      }
    }
  }

  async createLaundromat(insertLaundry: InsertLaundromat): Promise<Laundromat> {
    const [laundromat] = await db
      .insert(laundromats)
      .values(insertLaundry)
      .returning();
    return laundromat;
  }

  async updateLaundromat(id: number, data: Partial<InsertLaundromat>): Promise<Laundromat | undefined> {
    const [laundromat] = await db
      .update(laundromats)
      .set(data)
      .where(eq(laundromats.id, id))
      .returning();
    return laundromat;
  }

  // Review operations
  async getReviews(laundryId: number): Promise<Review[]> {
    return db.select()
      .from(reviews)
      .where(eq(reviews.laundryId, laundryId))
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
      
    // Update laundromat's rating
    await this.updateLaundryRating(review.laundryId);
    
    return review;
  }

  // Favorite operations
  async getUserFavorites(userId: number): Promise<Laundromat[]> {
    const favoritesResult = await db.select({
      laundryId: favorites.laundryId
    })
    .from(favorites)
    .where(eq(favorites.userId, userId));
    
    if (favoritesResult.length === 0) return [];
    
    const laundryIds = favoritesResult.map(f => f.laundryId);
    
    return db.select()
      .from(laundromats)
      .where(
        laundryIds.map(id => eq(laundromats.id, id)).reduce((a, b) => or(a, b))
      );
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const [favorite] = await db
      .insert(favorites)
      .values(insertFavorite)
      .returning();
    return favorite;
  }

  async removeFavorite(userId: number, laundryId: number): Promise<boolean> {
    const result = await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.laundryId, laundryId)
        )
      );
    return !!result;
  }

  // Subscription operations
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
      
    // Update laundromat listing type
    if (newSubscription.tier === 'premium' || newSubscription.tier === 'featured') {
      await db
        .update(laundromats)
        .set({ 
          listingType: newSubscription.tier,
          isPremium: true,
          isFeatured: newSubscription.tier === 'featured',
          featuredRank: newSubscription.tier === 'featured' ? await this.getNextFeaturedRank() : null
        })
        .where(eq(laundromats.id, newSubscription.laundryId));
    }
    
    return newSubscription;
  }
  
  async getSubscription(id: number): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id));
    return subscription;
  }
  
  async getUserSubscriptions(userId: number): Promise<{ subscription: Subscription, laundromat: Partial<Laundromat> }[]> {
    const userSubs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
      
    const result = [];
    
    for (const sub of userSubs) {
      const [laundromat] = await db
        .select({
          id: laundromats.id,
          name: laundromats.name,
          slug: laundromats.slug,
          address: laundromats.address,
          city: laundromats.city,
          state: laundromats.state
        })
        .from(laundromats)
        .where(eq(laundromats.id, sub.laundryId));
        
      result.push({
        subscription: sub,
        laundromat
      });
    }
    
    return result;
  }
  
  async cancelSubscription(id: number): Promise<Subscription | undefined> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ 
        status: 'cancelled',
        autoRenew: false
      })
      .where(eq(subscriptions.id, id))
      .returning();
      
    if (subscription) {
      // Downgrade the laundromat if this was the only active subscription
      const activeSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.laundryId, subscription.laundryId),
            eq(subscriptions.status, 'active')
          )
        );
        
      if (activeSubscriptions.length === 0) {
        await db
          .update(laundromats)
          .set({ 
            listingType: 'basic',
            isPremium: false,
            isFeatured: false,
            featuredRank: null
          })
          .where(eq(laundromats.id, subscription.laundryId));
      }
    }
    
    return subscription;
  }
  
  async checkExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    
    // Find expired subscriptions
    const expiredSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          lte(subscriptions.endDate, now)
        )
      );
      
    // Update status and downgrade laundromats if needed
    for (const sub of expiredSubscriptions) {
      // Update subscription status
      await db
        .update(subscriptions)
        .set({ status: 'expired' })
        .where(eq(subscriptions.id, sub.id));
        
      // Check if laundromat has other active subscriptions
      const activeSubscriptions = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.laundryId, sub.laundryId),
            eq(subscriptions.status, 'active')
          )
        );
        
      // Downgrade if no active subscriptions remain
      if (activeSubscriptions.length === 0) {
        await db
          .update(laundromats)
          .set({ 
            listingType: 'basic',
            isPremium: false,
            isFeatured: false,
            featuredRank: null
          })
          .where(eq(laundromats.id, sub.laundryId));
      }
    }
  }
  
  // City operations
  async getCities(stateAbbr?: string): Promise<City[]> {
    if (stateAbbr) {
      // First try to find the state to get both abbreviation and full name
      const [stateData] = await db
        .select()
        .from(states)
        .where(
          or(
            eq(states.abbr, stateAbbr.toUpperCase()),
            eq(states.name, stateAbbr)
          )
        );
      
      if (stateData) {
        // Try to find cities matching either the state abbreviation or the full state name
        return db
          .select()
          .from(cities)
          .where(
            or(
              eq(cities.state, stateData.abbr),
              eq(cities.state, stateData.name)
            )
          )
          .orderBy(asc(cities.name));
      }
      
      // Fallback to the original behavior
      return db
        .select()
        .from(cities)
        .where(
          or(
            eq(cities.state, stateAbbr),
            eq(cities.state, stateAbbr.toUpperCase())
          )
        )
        .orderBy(asc(cities.name));
    }
    
    return db
      .select()
      .from(cities)
      .orderBy(asc(cities.name));
  }
  
  async getCityBySlug(slug: string): Promise<City | undefined> {
    const [city] = await db
      .select()
      .from(cities)
      .where(eq(cities.slug, slug));
    return city;
  }
  
  async getCityById(id: number): Promise<City | undefined> {
    const [city] = await db
      .select()
      .from(cities)
      .where(eq(cities.id, id));
    return city;
  }
  
  async getLaundromatsInCity(cityId: number): Promise<Laundromat[]> {
    try {
      // First, get the city information
      const [city] = await db
        .select()
        .from(cities)
        .where(eq(cities.id, cityId));
        
      if (!city) {
        console.log(`City with ID ${cityId} not found`);
        return [];
      }
      
      console.log(`Found city: ${city.name}, ${city.state}`);
      
      // Let's try a simpler approach first - get all laundromats and filter for this city
      try {
        // Use the simplest possible query that's most likely to succeed
        const simpleQuery = `
          SELECT * FROM laundromats
          LIMIT 1000
        `;
        
        const result = await db.execute(simpleQuery);
        
        // Filter the results for our city after fetching them
        const cityNameLower = city.name.toLowerCase();
        const stateAbbrLower = city.state.toLowerCase();
        const stateFullLower = this.getStateNameFromAbbr(city.state)?.toLowerCase() || '';
        
        // Filter the results manually to handle case-insensitive matching
        const laundromats = result.rows.filter(item => {
          const itemCity = (item.city || '').toLowerCase();
          const itemState = (item.state || '').toLowerCase();
          
          return itemCity === cityNameLower && 
                 (itemState === stateAbbrLower || itemState === stateFullLower);
        });
        
        console.log(`Found ${laundromats.length} laundromats in ${city.name}, ${city.state}`);
        
        // Safely process services
        return laundromats.map(item => {
          let services = [];
          
          try {
            if (Array.isArray(item.services)) {
              services = item.services;
            } else if (typeof item.services === 'string' && item.services) {
              try {
                services = JSON.parse(item.services);
              } catch (e) {
                services = [];
              }
            }
          } catch (e) {
            console.error('Error parsing services:', e);
          }
          
          return {
            ...item,
            services
          };
        });
      } catch (err) {
        console.error('First attempt failed:', err);
        
        // Fallback: try an even simpler approach - direct SQL
        const fallbackQuery = `
          SELECT id, name, slug, address, city, state, zip, phone, 
                 website, latitude, longitude, rating, image_url, 
                 hours, description, is_featured, is_premium, 
                 listing_type, review_count
          FROM laundromats
          LIMIT 50
        `;
        
        const fallbackResult = await db.execute(fallbackQuery);
        console.log('Fallback query returned:', fallbackResult.rows.length, 'results');
        
        return fallbackResult.rows.map(item => ({
          ...item,
          services: []
        }));
      }
    } catch (error) {
      console.error('Error in getLaundromatsInCity:', error);
      // Return empty array instead of throwing to avoid breaking the UI
      return [];
    }
  }
  
  // State operations
  async getStates(): Promise<State[]> {
    return db
      .select()
      .from(states)
      .orderBy(asc(states.name));
  }
  
  async getStateBySlug(slug: string): Promise<State | undefined> {
    const [state] = await db
      .select()
      .from(states)
      .where(eq(states.slug, slug));
    return state;
  }
  
  async getStateByAbbr(abbr: string): Promise<State | undefined> {
    const [state] = await db
      .select()
      .from(states)
      .where(eq(states.abbr, abbr));
    return state;
  }
  
  async getPopularCities(limit: number = 5): Promise<City[]> {
    return db
      .select()
      .from(cities)
      .orderBy(desc(cities.laundryCount))
      .limit(limit);
  }
  
  // Laundry tips operations
  async getLaundryTips(): Promise<LaundryTip[]> {
    return db
      .select()
      .from(laundryTips)
      .orderBy(desc(laundryTips.createdAt));
  }
  
  async getLaundryTipBySlug(slug: string): Promise<LaundryTip | undefined> {
    const [tip] = await db
      .select()
      .from(laundryTips)
      .where(eq(laundryTips.slug, slug));
    return tip;
  }
  
  async createLaundryTip(insertTip: InsertLaundryTip): Promise<LaundryTip> {
    const [tip] = await db
      .insert(laundryTips)
      .values(insertTip)
      .returning();
    return tip;
  }
  
  async getRelatedLaundryTips(tipId: number, limit: number = 3): Promise<LaundryTip[]> {
    const [currentTip] = await db
      .select()
      .from(laundryTips)
      .where(eq(laundryTips.id, tipId));
      
    if (!currentTip) return [];
    
    // Find tips with the same category
    return db
      .select()
      .from(laundryTips)
      .where(
        and(
          eq(laundryTips.category, currentTip.category),
          sql`${laundryTips.id} != ${tipId}`
        )
      )
      .limit(limit);
  }
  
  // Premium Features operations
  async getLaundryPremiumFeatures(laundryId: number): Promise<any> {
    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, laundryId));
      
    if (!laundromat) return {};
    
    // Return premium features for the laundromat
    return {
      isPremium: laundromat.isPremium,
      isFeatured: laundromat.isFeatured,
      listingType: laundromat.listingType,
      subscriptionActive: laundromat.subscriptionActive,
      subscriptionExpiry: laundromat.subscriptionExpiry,
      featuredRank: laundromat.featuredRank,
      promotionalText: laundromat.promotionalText,
      amenities: laundromat.amenities,
      machineCount: laundromat.machineCount,
      photos: laundromat.photos,
      specialOffers: laundromat.specialOffers
    };
  }
  
  async updatePremiumFeatures(laundryId: number, features: any): Promise<boolean> {
    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, laundryId));
      
    if (!laundromat) return false;
    
    // Only allow updating premium features if the laundromat has an active premium subscription
    if (!laundromat.subscriptionActive) return false;
    
    // Update the premium features
    await db
      .update(laundromats)
      .set({
        promotionalText: features.promotionalText || laundromat.promotionalText,
        amenities: features.amenities || laundromat.amenities,
        machineCount: features.machineCount || laundromat.machineCount,
        photos: features.photos || laundromat.photos,
        specialOffers: features.specialOffers || laundromat.specialOffers
      })
      .where(eq(laundromats.id, laundryId));
    
    return true;
  }
  
  // Helper methods
  private async updateLaundryRating(laundryId: number): Promise<void> {
    // Get all reviews for the laundromat
    const reviewsForLaundry = await db
      .select()
      .from(reviews)
      .where(eq(reviews.laundryId, laundryId));
      
    if (reviewsForLaundry.length === 0) return;
    
    // Calculate average rating
    const totalRating = reviewsForLaundry.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = (totalRating / reviewsForLaundry.length).toFixed(1);
    
    // Update laundromat rating
    await db
      .update(laundromats)
      .set({ 
        rating: averageRating,
        reviewCount: reviewsForLaundry.length
      })
      .where(eq(laundromats.id, laundryId));
  }
  
  private async getNextFeaturedRank(): Promise<number> {
    const featuredLaundromats = await db
      .select({
        rank: laundromats.featuredRank
      })
      .from(laundromats)
      .where(eq(laundromats.isFeatured, true))
      .orderBy(desc(laundromats.featuredRank));
      
    if (featuredLaundromats.length === 0) return 1;
    
    const maxRank = Math.max(...featuredLaundromats.map(l => l.rank || 0));
    return maxRank + 1;
  }
}