import { 
  users, 
  laundromats, 
  reviews, 
  favorites, 
  cities, 
  states,
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
  type InsertState
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, gte, lte, desc, asc, ilike, sql } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Laundromat operations
  async getLaundromat(id: number): Promise<Laundromat | undefined> {
    const [laundromat] = await db.select().from(laundromats).where(eq(laundromats.id, id));
    return laundromat || undefined;
  }

  async getLaundryBySlug(slug: string): Promise<Laundromat | undefined> {
    const [laundromat] = await db.select().from(laundromats).where(eq(laundromats.slug, slug));
    return laundromat || undefined;
  }

  async searchLaundromats(query: string, filters: any = {}): Promise<Laundromat[]> {
    let baseQuery = db.select().from(laundromats);
    
    // Filter by query (name, city, state, zip)
    if (query) {
      const lowerQuery = `%${query.toLowerCase()}%`;
      baseQuery = baseQuery.where(
        or(
          ilike(laundromats.name, lowerQuery),
          ilike(laundromats.city, lowerQuery),
          ilike(laundromats.state, lowerQuery),
          ilike(laundromats.zip, lowerQuery)
        )
      );
    }
    
    // Apply filters
    if (filters.openNow) {
      // Simple implementation - just return laundromats marked as 24 hours
      baseQuery = baseQuery.where(ilike(laundromats.hours, '%24 Hours%'));
    }
    
    if (filters.services && filters.services.length) {
      // This is a bit complex with JSON arrays in PostgreSQL
      // For each service we want to check if it's in the JSON array
      // We'll combine them with AND logic
      for (const service of filters.services) {
        baseQuery = baseQuery.where(
          sql`${laundromats.services}::jsonb @> ${JSON.stringify([service])}::jsonb`
        );
      }
    }
    
    if (filters.rating) {
      baseQuery = baseQuery.where(
        gte(sql`CAST(${laundromats.rating} AS FLOAT)`, filters.rating)
      );
    }
    
    return baseQuery;
  }

  async getLaundromatsNearby(lat: string, lng: string, radius: number = 10): Promise<Laundromat[]> {
    // Calculate distance using the Haversine formula in PostgreSQL
    const haversineFormula = sql`
      6371 * acos(
        cos(radians(${lat})) * 
        cos(radians(cast(${laundromats.latitude} as float))) * 
        cos(radians(cast(${laundromats.longitude} as float)) - radians(${lng})) + 
        sin(radians(${lat})) * 
        sin(radians(cast(${laundromats.latitude} as float)))
      )
    `;

    return db.select({
      ...laundromats,
      distance: haversineFormula
    })
    .from(laundromats)
    .where(lte(haversineFormula, radius))
    .orderBy(haversineFormula);
  }

  async getFeaturedLaundromats(): Promise<Laundromat[]> {
    return db.select().from(laundromats).where(eq(laundromats.isFeatured, true));
  }

  async createLaundromat(insertLaundry: InsertLaundromat): Promise<Laundromat> {
    // Start a transaction to ensure all operations succeed or fail together
    return await db.transaction(async (tx) => {
      // Insert the laundromat
      const [laundry] = await tx
        .insert(laundromats)
        .values(insertLaundry)
        .returning();
      
      // Get the city and state to update counts
      await this.updateLocationCounts(tx, insertLaundry.city, insertLaundry.state);
      
      return laundry;
    });
  }

  async updateLaundromat(id: number, data: Partial<InsertLaundromat>): Promise<Laundromat | undefined> {
    const [updatedLaundry] = await db
      .update(laundromats)
      .set(data)
      .where(eq(laundromats.id, id))
      .returning();
      
    return updatedLaundry || undefined;
  }

  // Review operations
  async getReviews(laundryId: number): Promise<Review[]> {
    return db
      .select({
        ...reviews,
        username: users.username
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.laundryId, laundryId));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    return await db.transaction(async (tx) => {
      // Insert the review
      const [review] = await tx
        .insert(reviews)
        .values(insertReview)
        .returning();
        
      // Update the laundromat's rating
      await this.updateLaundryRating(tx, insertReview.laundryId);
      
      return review;
    });
  }

  // Favorite operations
  async getUserFavorites(userId: number): Promise<Laundromat[]> {
    return db
      .select({
        ...laundromats
      })
      .from(laundromats)
      .innerJoin(
        favorites,
        and(
          eq(favorites.laundryId, laundromats.id),
          eq(favorites.userId, userId)
        )
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
    
    return result.rowCount > 0;
  }

  // Location operations
  async getCities(stateAbbr?: string): Promise<City[]> {
    let query = db.select().from(cities);
    
    if (stateAbbr) {
      query = query.where(eq(cities.state, stateAbbr));
    }
    
    return query.orderBy(asc(cities.name));
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
    const [city] = await db
      .select()
      .from(cities)
      .where(eq(cities.slug, slug));
      
    return city || undefined;
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
      
    return state || undefined;
  }

  async getStateByAbbr(abbr: string): Promise<State | undefined> {
    const [state] = await db
      .select()
      .from(states)
      .where(eq(states.abbr, abbr));
      
    return state || undefined;
  }

  async getPopularCities(limit: number = 5): Promise<City[]> {
    return db
      .select()
      .from(cities)
      .orderBy(desc(cities.laundryCount))
      .limit(limit);
  }

  // Helper methods
  private async updateLaundryRating(tx: any, laundryId: number): Promise<void> {
    // Get all reviews for this laundromat
    const reviewsForLaundry = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.laundryId, laundryId));
    
    // Calculate average rating
    const totalRating = reviewsForLaundry.reduce((sum: number, review: Review) => sum + review.rating, 0);
    const avgRating = reviewsForLaundry.length ? (totalRating / reviewsForLaundry.length).toFixed(1) : "0";
    
    // Update the laundromat
    await tx
      .update(laundromats)
      .set({
        rating: avgRating,
        reviewCount: reviewsForLaundry.length
      })
      .where(eq(laundromats.id, laundryId));
  }

  private async updateLocationCounts(tx: any, cityName: string, stateAbbr: string): Promise<void> {
    // Update city count
    const [city] = await tx
      .select()
      .from(cities)
      .where(
        and(
          eq(cities.name, cityName),
          eq(cities.state, stateAbbr)
        )
      );
    
    if (city) {
      await tx
        .update(cities)
        .set({
          laundryCount: city.laundryCount + 1
        })
        .where(eq(cities.id, city.id));
    }
    
    // Update state count
    const [state] = await tx
      .select()
      .from(states)
      .where(eq(states.abbr, stateAbbr));
    
    if (state) {
      await tx
        .update(states)
        .set({
          laundryCount: state.laundryCount + 1
        })
        .where(eq(states.id, state.id));
    }
  }
}