import { db } from './db';
import { IStorage } from './storage';
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
import { eq, and, or, like, ilike, sql, desc, lt, gt, not } from "drizzle-orm";

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
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
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
    let conditions = [];
    
    // Add search condition if query is provided
    if (query) {
      conditions.push(
        or(
          ilike(laundromats.name, `%${query}%`),
          ilike(laundromats.city, `%${query}%`),
          ilike(laundromats.state, `%${query}%`),
          ilike(laundromats.address, `%${query}%`)
        )
      );
    }
    
    // Add additional filters
    if (filters.openNow) {
      // Implement checking for current time against hours
      // This is a placeholder as parsing hours is complex
      // In a real app, you'd store hours in a structured format
    }
    
    if (filters.services && filters.services.length) {
      // Check if any of the required services are in the laundromat's services array
      // This is a placeholder as JSON array containment is database-specific
    }
    
    if (filters.rating) {
      conditions.push(gt(laundromats.rating, String(filters.rating - 1)));
    }
    
    let query_builder = db.select().from(laundromats);
    
    if (conditions.length > 0) {
      query_builder = query_builder.where(and(...conditions));
    }
    
    return query_builder.limit(50);
  }

  async getLaundromatsNearby(lat: string, lng: string, radius: number = 10): Promise<Laundromat[]> {
    // Using Haversine formula via raw SQL to calculate distance
    // This implementation will depend on the specific database used
    // For simplicity, we'll return all laundromats ordered by proximity
    // In a real app, you'd implement a proper geospatial query
    
    const rawQuery = sql`
      SELECT * FROM laundromats
      ORDER BY (
        (ACOS(SIN(${lat}::float * PI()/180) * SIN(latitude::float * PI()/180) + 
         COS(${lat}::float * PI()/180) * COS(latitude::float * PI()/180) * 
         COS((${lng}::float - longitude::float) * PI()/180)) * 180/PI()) * 60 * 1.1515 * 1.609344
      ) ASC
      LIMIT 20
    `;
    
    try {
      return db.execute(rawQuery);
    } catch (error) {
      console.error("Error in getLaundromatsNearby:", error);
      // Fallback: simply return some laundromats 
      return this.getFeaturedLaundromats();
    }
  }

  async getFeaturedLaundromats(): Promise<Laundromat[]> {
    return db.select().from(laundromats)
      .where(eq(laundromats.isFeatured, true))
      .orderBy(laundromats.featuredRank)
      .limit(5);
  }
  
  async getPremiumLaundromats(): Promise<Laundromat[]> {
    return db.select().from(laundromats)
      .where(eq(laundromats.isPremium, true))
      .orderBy(desc(laundromats.createdAt))
      .limit(20);
  }

  async createLaundromat(insertLaundry: InsertLaundromat): Promise<Laundromat> {
    const [laundry] = await db.insert(laundromats).values(insertLaundry).returning();
    return laundry;
  }

  async updateLaundromat(id: number, data: Partial<InsertLaundromat>): Promise<Laundromat | undefined> {
    const [laundromat] = await db.update(laundromats).set(data).where(eq(laundromats.id, id)).returning();
    return laundromat;
  }

  // Review operations
  async getReviews(laundryId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.laundryId, laundryId)).orderBy(desc(reviews.createdAt));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db.transaction(async (tx) => {
      // Insert the review
      const [newReview] = await tx.insert(reviews).values(insertReview).returning();
      
      // Update the laundromat's rating and review count
      await this.updateLaundryRating(tx, insertReview.laundryId);
      
      return [newReview];
    });
    
    return review;
  }

  // Favorite operations
  async getUserFavorites(userId: number): Promise<Laundromat[]> {
    const favoriteLaundromats = await db
      .select({
        laundromat: laundromats
      })
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .innerJoin(laundromats, eq(favorites.laundryId, laundromats.id));
    
    return favoriteLaundromats.map(f => f.laundromat);
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const [favorite] = await db.insert(favorites).values(insertFavorite).returning();
    return favorite;
  }

  async removeFavorite(userId: number, laundryId: number): Promise<boolean> {
    const result = await db.delete(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.laundryId, laundryId)
      ));
    
    return result.rowCount > 0;
  }

  // Subscription operations
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    return db.transaction(async (tx) => {
      // Create the subscription
      const [newSubscription] = await tx.insert(subscriptions).values(subscription).returning();
      
      // Update the laundromat with subscription information
      await tx.update(laundromats)
        .set({
          isPremium: subscription.tier === 'premium' || subscription.tier === 'featured',
          isFeatured: subscription.tier === 'featured',
          subscriptionActive: true,
          subscriptionExpiry: subscription.endDate
        })
        .where(eq(laundromats.id, subscription.laundryId));
      
      return newSubscription;
    });
  }

  async getSubscription(id: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription;
  }

  async getUserSubscriptions(userId: number): Promise<{ subscription: Subscription, laundromat: Partial<Laundromat> }[]> {
    const results = await db
      .select({
        subscription: subscriptions,
        laundromat: {
          id: laundromats.id,
          name: laundromats.name,
          slug: laundromats.slug,
          city: laundromats.city,
          state: laundromats.state
        }
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .innerJoin(laundromats, eq(subscriptions.laundryId, laundromats.id))
      .orderBy(desc(subscriptions.createdAt));
    
    return results;
  }

  async cancelSubscription(id: number): Promise<Subscription | undefined> {
    return db.transaction(async (tx) => {
      // Get the subscription
      const [subscription] = await tx.select().from(subscriptions).where(eq(subscriptions.id, id));
      
      if (!subscription) {
        return undefined;
      }
      
      // Update the subscription status
      const [updatedSubscription] = await tx.update(subscriptions)
        .set({ status: 'cancelled', autoRenew: false })
        .where(eq(subscriptions.id, id))
        .returning();
      
      // Check if there are other active subscriptions for this laundromat
      const activeSubscriptions = await tx.select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.laundryId, subscription.laundryId),
            not(eq(subscriptions.id, id)),
            eq(subscriptions.status, 'active')
          )
        );
      
      // If no other active subscriptions, update the laundromat
      if (activeSubscriptions.length === 0) {
        await tx.update(laundromats)
          .set({
            isPremium: false,
            isFeatured: false,
            subscriptionActive: false,
            featuredRank: null
          })
          .where(eq(laundromats.id, subscription.laundryId));
      }
      
      return updatedSubscription;
    });
  }

  async checkExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    
    // Find expired subscriptions that are still active
    const expiredSubscriptions = await db.select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          lt(subscriptions.endDate, now)
        )
      );
    
    // Update each expired subscription
    for (const subscription of expiredSubscriptions) {
      await this.cancelSubscription(subscription.id);
    }
  }

  // Premium Features operations
  async getLaundryPremiumFeatures(laundryId: number): Promise<any> {
    const [laundromat] = await db.select({
      id: laundromats.id,
      isPremium: laundromats.isPremium,
      isFeatured: laundromats.isFeatured,
      promotionalText: laundromats.promotionalText,
      amenities: laundromats.amenities,
      machineCount: laundromats.machineCount,
      photos: laundromats.photos,
      specialOffers: laundromats.specialOffers
    }).from(laundromats).where(eq(laundromats.id, laundryId));
    
    return laundromat || {};
  }

  async updatePremiumFeatures(laundryId: number, features: any): Promise<boolean> {
    const result = await db.update(laundromats)
      .set(features)
      .where(eq(laundromats.id, laundryId));
    
    return result.rowCount > 0;
  }

  // Location operations
  async getCities(stateAbbr?: string): Promise<City[]> {
    if (stateAbbr) {
      return db.select().from(cities).where(eq(cities.state, stateAbbr)).orderBy(cities.name);
    }
    return db.select().from(cities).orderBy(cities.name);
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
    const [city] = await db.select().from(cities).where(eq(cities.slug, slug));
    return city;
  }

  async getLaundromatsInCity(cityId: number): Promise<Laundromat[]> {
    const city = await this.getCityBySlug(String(cityId));
    if (!city) return [];
    
    return db.select().from(laundromats)
      .where(
        and(
          eq(laundromats.city, city.name),
          eq(laundromats.state, city.state)
        )
      )
      .orderBy(desc(laundromats.isPremium));
  }

  async getStates(): Promise<State[]> {
    return db.select().from(states).orderBy(states.name);
  }

  async getStateBySlug(slug: string): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.slug, slug));
    return state;
  }

  async getStateByAbbr(abbr: string): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.abbr, abbr));
    return state;
  }

  async getPopularCities(limit: number = 5): Promise<City[]> {
    return db.select().from(cities)
      .orderBy(desc(cities.laundryCount))
      .limit(limit);
  }

  // Laundry Tips operations
  async getLaundryTips(): Promise<LaundryTip[]> {
    return db.select().from(laundryTips).orderBy(desc(laundryTips.createdAt));
  }

  async getLaundryTipBySlug(slug: string): Promise<LaundryTip | undefined> {
    const [tip] = await db.select().from(laundryTips).where(eq(laundryTips.slug, slug));
    return tip;
  }

  async createLaundryTip(insertTip: InsertLaundryTip): Promise<LaundryTip> {
    const [tip] = await db.insert(laundryTips).values(insertTip).returning();
    return tip;
  }

  async getRelatedLaundryTips(tipId: number, limit: number = 3): Promise<LaundryTip[]> {
    const [currentTip] = await db.select().from(laundryTips).where(eq(laundryTips.id, tipId));
    
    if (!currentTip) {
      return [];
    }
    
    return db.select().from(laundryTips)
      .where(
        and(
          not(eq(laundryTips.id, tipId)),
          eq(laundryTips.category, currentTip.category)
        )
      )
      .limit(limit);
  }

  // Helper methods
  private async updateLaundryRating(tx: any, laundryId: number): Promise<void> {
    // Get all reviews for the laundromat
    const reviewsForLaundry = await tx.select().from(reviews).where(eq(reviews.laundryId, laundryId));
    
    if (reviewsForLaundry.length === 0) {
      return;
    }
    
    // Calculate the average rating
    const totalRating = reviewsForLaundry.reduce((sum: number, review: Review) => sum + review.rating, 0);
    const averageRating = (totalRating / reviewsForLaundry.length).toFixed(1);
    
    // Update the laundromat's rating and review count
    await tx.update(laundromats)
      .set({ 
        rating: averageRating,
        reviewCount: reviewsForLaundry.length
      })
      .where(eq(laundromats.id, laundryId));
  }

  private async updateLocationCounts(tx: any, cityName: string, stateAbbr: string): Promise<void> {
    // Update city count
    const [city] = await tx.select().from(cities)
      .where(
        and(
          eq(cities.name, cityName),
          eq(cities.state, stateAbbr)
        )
      );
    
    if (city) {
      // Get count of laundromats in this city
      const cityLaundromats = await tx.select().from(laundromats)
        .where(
          and(
            eq(laundromats.city, cityName),
            eq(laundromats.state, stateAbbr)
          )
        );
      
      await tx.update(cities)
        .set({ laundryCount: cityLaundromats.length })
        .where(eq(cities.id, city.id));
    }
    
    // Update state count
    const [state] = await tx.select().from(states).where(eq(states.abbr, stateAbbr));
    
    if (state) {
      // Get count of laundromats in this state
      const stateLaundromats = await tx.select().from(laundromats)
        .where(eq(laundromats.state, stateAbbr));
      
      await tx.update(states)
        .set({ laundryCount: stateLaundromats.length })
        .where(eq(states.id, state.id));
    }
  }
}