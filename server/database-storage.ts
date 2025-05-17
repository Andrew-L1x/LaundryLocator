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
import { db } from "./db";
import { eq, and, or, gte, lte, desc, asc, ilike, like, sql } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
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
    const [laundromat] = await db.select().from(laundromats).where(eq(laundromats.id, id));
    return laundromat;
  }

  async getLaundryBySlug(slug: string): Promise<Laundromat | undefined> {
    const [laundromat] = await db.select().from(laundromats).where(eq(laundromats.slug, slug));
    return laundromat;
  }

  async getLaundromatsForUser(userId: number): Promise<Laundromat[]> {
    return db.select().from(laundromats).where(eq(laundromats.ownerId, userId));
  }

  async searchLaundromats(query: string, filters: any = {}): Promise<Laundromat[]> {
    let whereConditions = [];
    
    // Search by name, city, zip, or address
    if (query) {
      whereConditions.push(
        or(
          like(laundromats.name, `%${query}%`),
          like(laundromats.city, `%${query}%`),
          like(laundromats.zip, `%${query}%`),
          like(laundromats.address, `%${query}%`),
          like(laundromats.state, `%${query}%`)
        )
      );
    }
    
    // Filter by rating
    if (filters.rating) {
      whereConditions.push(gte(sql`cast(${laundromats.rating} as float)`, filters.rating));
    }
    
    // If no conditions, return all laundromats
    const query_result = whereConditions.length > 0
      ? await db.select().from(laundromats).where(and(...whereConditions)).limit(20)
      : await db.select().from(laundromats).limit(20);
    
    return query_result;
  }

  async getLaundromatsNearby(lat: string, lng: string, radius: number = 5): Promise<Laundromat[]> {
    // Using a simplified distance calculation
    const laundromats_results = await db.select().from(laundromats).limit(20);
    
    // Calculate distances and filter by radius
    const nearbyLaundromats = laundromats_results.map(l => {
      // Simple distance calculation
      const distance = this.calculateDistance(
        parseFloat(lat), 
        parseFloat(lng), 
        parseFloat(l.latitude), 
        parseFloat(l.longitude)
      );
      
      return { ...l, distance };
    })
    .filter(l => l.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
    
    return nearbyLaundromats;
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
    return db.select()
      .from(laundromats)
      .where(eq(laundromats.isFeatured, true))
      .orderBy(asc(laundromats.featuredRank))
      .limit(10);
  }
  
  async getPremiumLaundromats(): Promise<Laundromat[]> {
    return db.select()
      .from(laundromats)
      .where(
        or(
          eq(laundromats.listingType, 'premium'),
          eq(laundromats.listingType, 'featured')
        )
      )
      .limit(10);
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
      return db
        .select()
        .from(cities)
        .where(eq(cities.state, stateAbbr))
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
  
  async getLaundromatsInCity(cityId: number): Promise<Laundromat[]> {
    const [city] = await db
      .select()
      .from(cities)
      .where(eq(cities.id, cityId));
      
    if (!city) return [];
    
    return db
      .select()
      .from(laundromats)
      .where(
        and(
          eq(laundromats.city, city.name),
          eq(laundromats.state, city.state)
        )
      );
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