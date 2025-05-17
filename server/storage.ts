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
import { eq, and, or, gte, lte, desc, asc, ilike, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Laundromat operations
  getLaundromat(id: number): Promise<Laundromat | undefined>;
  getLaundryBySlug(slug: string): Promise<Laundromat | undefined>;
  getLaundromatsForUser(userId: number): Promise<Laundromat[]>;
  searchLaundromats(query: string, filters?: any): Promise<Laundromat[]>;
  getLaundromatsNearby(lat: string, lng: string, radius?: number): Promise<Laundromat[]>;
  getNearbyLaundromats(currentId: number, lat: number, lng: number, radius?: number): Promise<Laundromat[]>;
  getFeaturedLaundromats(): Promise<Laundromat[]>;
  getPremiumLaundromats(): Promise<Laundromat[]>;
  createLaundromat(laundry: InsertLaundromat): Promise<Laundromat>;
  updateLaundromat(id: number, data: Partial<InsertLaundromat>): Promise<Laundromat | undefined>;
  
  // Review operations
  getReviews(laundryId: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Favorite operations
  getUserFavorites(userId: number): Promise<Laundromat[]>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: number, laundryId: number): Promise<boolean>;
  
  // Subscription operations
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(id: number): Promise<Subscription | undefined>;
  getUserSubscriptions(userId: number): Promise<{ subscription: Subscription, laundromat: Partial<Laundromat> }[]>;
  cancelSubscription(id: number): Promise<Subscription | undefined>;
  checkExpiredSubscriptions(): Promise<void>;
  
  // Premium Features operations
  getLaundryPremiumFeatures(laundryId: number): Promise<any>;
  updatePremiumFeatures(laundryId: number, features: any): Promise<boolean>;
  
  // Location operations
  getCities(stateAbbr?: string): Promise<City[]>;
  getCityBySlug(slug: string): Promise<City | undefined>;
  getCityById(id: number): Promise<City | undefined>;
  getLaundromatsInCity(cityId: number): Promise<Laundromat[]>;
  getStates(): Promise<State[]>;
  getStateBySlug(slug: string): Promise<State | undefined>;
  getStateByAbbr(abbr: string): Promise<State | undefined>;
  getPopularCities(limit?: number): Promise<City[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private laundromats: Map<number, Laundromat>;
  private reviews: Map<number, Review>;
  private favorites: Map<number, Favorite>;
  private cities: Map<number, City>;
  private states: Map<number, State>;
  private subscriptions: Map<number, Subscription>;
  private laundryTips: Map<number, LaundryTip>;
  private currentId: {
    users: number;
    laundromats: number;
    reviews: number;
    favorites: number;
    cities: number;
    states: number;
    subscriptions: number;
    laundryTips: number;
  };

  constructor() {
    // Initialize storage
    this.users = new Map();
    this.laundromats = new Map();
    this.reviews = new Map();
    this.favorites = new Map();
    this.cities = new Map();
    this.states = new Map();
    this.subscriptions = new Map();
    this.laundryTips = new Map();
    
    // Initialize IDs
    this.currentId = {
      users: 1,
      laundromats: 1,
      reviews: 1,
      favorites: 1,
      cities: 1,
      states: 1,
      subscriptions: 1,
      laundryTips: 1
    };
    
    // Initialize with sample data
    this.initSampleData();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Laundromat operations
  async getLaundromat(id: number): Promise<Laundromat | undefined> {
    return this.laundromats.get(id);
  }

  async getLaundryBySlug(slug: string): Promise<Laundromat | undefined> {
    return Array.from(this.laundromats.values()).find(laundry => laundry.slug === slug);
  }

  async searchLaundromats(query: string, filters: any = {}): Promise<Laundromat[]> {
    let results = Array.from(this.laundromats.values());
    
    // Filter by query (name, city, state, zip)
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(laundry => 
        laundry.name.toLowerCase().includes(lowerQuery) ||
        laundry.city.toLowerCase().includes(lowerQuery) ||
        laundry.state.toLowerCase().includes(lowerQuery) ||
        laundry.zip.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Apply filters
    if (filters.openNow) {
      // Simple implementation - just return laundromats marked as 24 hours
      results = results.filter(laundry => laundry.hours.includes('24 Hours'));
    }
    
    if (filters.services && filters.services.length) {
      results = results.filter(laundry => 
        filters.services.every((service: string) => 
          laundry.services.includes(service)
        )
      );
    }
    
    if (filters.rating) {
      results = results.filter(laundry => 
        parseFloat(laundry.rating) >= filters.rating
      );
    }
    
    return results;
  }

  async getLaundromatsNearby(lat: string, lng: string, radius: number = 10): Promise<Laundromat[]> {
    // In a real implementation, this would use the Haversine formula to calculate distance
    // For our demo, we'll return all laundromats sorted randomly to simulate distance
    const results = Array.from(this.laundromats.values());
    
    // Sort by "distance" (random for demo)
    return results.sort(() => Math.random() - 0.5);
  }

  async getFeaturedLaundromats(): Promise<Laundromat[]> {
    return Array.from(this.laundromats.values())
      .filter(laundry => laundry.isFeatured);
  }
  
  async getPremiumLaundromats(): Promise<Laundromat[]> {
    return Array.from(this.laundromats.values())
      .filter(laundry => laundry.isPremium === true);
  }

  async createLaundromat(insertLaundry: InsertLaundromat): Promise<Laundromat> {
    const id = this.currentId.laundromats++;
    const laundry: Laundromat = { ...insertLaundry, id, createdAt: new Date() };
    this.laundromats.set(id, laundry);
    
    // Update city and state count
    this.updateLocationCounts(laundry.city, laundry.state);
    
    return laundry;
  }

  async updateLaundromat(id: number, data: Partial<InsertLaundromat>): Promise<Laundromat | undefined> {
    const laundry = this.laundromats.get(id);
    if (!laundry) return undefined;
    
    const updatedLaundry = { ...laundry, ...data };
    this.laundromats.set(id, updatedLaundry);
    return updatedLaundry;
  }
  
  async getLaundromatsForUser(userId: number): Promise<Laundromat[]> {
    return Array.from(this.laundromats.values())
      .filter(laundry => laundry.ownerId === userId);
  }

  // Review operations
  async getReviews(laundryId: number): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.laundryId === laundryId);
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = this.currentId.reviews++;
    const review: Review = { ...insertReview, id, createdAt: new Date() };
    this.reviews.set(id, review);
    
    // Update laundromat rating
    this.updateLaundryRating(review.laundryId);
    
    return review;
  }

  // Favorite operations
  async getUserFavorites(userId: number): Promise<Laundromat[]> {
    const favoriteIds = Array.from(this.favorites.values())
      .filter(fav => fav.userId === userId)
      .map(fav => fav.laundryId);
    
    return Array.from(this.laundromats.values())
      .filter(laundry => favoriteIds.includes(laundry.id));
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const id = this.currentId.favorites++;
    const favorite: Favorite = { ...insertFavorite, id, createdAt: new Date() };
    this.favorites.set(id, favorite);
    return favorite;
  }

  async removeFavorite(userId: number, laundryId: number): Promise<boolean> {
    const favorite = Array.from(this.favorites.values())
      .find(fav => fav.userId === userId && fav.laundryId === laundryId);
    
    if (!favorite) return false;
    
    this.favorites.delete(favorite.id);
    return true;
  }
  
  // Subscription operations
  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const id = this.currentId.subscriptions++;
    const subscription: Subscription = { ...insertSubscription, id, createdAt: new Date() };
    this.subscriptions.set(id, subscription);
    
    // Update laundromat premium status
    const laundry = this.laundromats.get(subscription.laundryId);
    if (laundry) {
      const isPremium = subscription.tier === 'premium' || subscription.tier === 'featured';
      const isFeatured = subscription.tier === 'featured';
      
      this.laundromats.set(laundry.id, {
        ...laundry,
        isPremium,
        isFeatured,
        subscriptionActive: true,
        subscriptionExpiry: subscription.endDate,
        listingType: subscription.tier
      });
    }
    
    return subscription;
  }
  
  async getSubscription(id: number): Promise<Subscription | undefined> {
    return this.subscriptions.get(id);
  }
  
  async getUserSubscriptions(userId: number): Promise<{ subscription: Subscription, laundromat: Partial<Laundromat> }[]> {
    const userSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.userId === userId);
    
    return userSubscriptions.map(subscription => {
      const laundromat = this.laundromats.get(subscription.laundryId);
      return {
        subscription,
        laundromat: laundromat ? {
          id: laundromat.id,
          name: laundromat.name,
          slug: laundromat.slug,
          address: laundromat.address,
          city: laundromat.city,
          state: laundromat.state
        } : {}
      };
    });
  }
  
  async cancelSubscription(id: number): Promise<Subscription | undefined> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return undefined;
    
    // Update subscription status
    const updatedSubscription = { 
      ...subscription, 
      status: 'cancelled',
      autoRenew: false 
    };
    this.subscriptions.set(id, updatedSubscription);
    
    // Update laundromat premium status
    const laundry = this.laundromats.get(subscription.laundryId);
    if (laundry) {
      this.laundromats.set(laundry.id, {
        ...laundry,
        subscriptionActive: false,
        isPremium: false,
        isFeatured: false,
        listingType: 'basic'
      });
    }
    
    return updatedSubscription;
  }
  
  async checkExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    const expiredSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'active' && sub.endDate < now);
    
    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      this.subscriptions.set(subscription.id, {
        ...subscription,
        status: 'expired'
      });
      
      // Update laundromat premium status
      const laundry = this.laundromats.get(subscription.laundryId);
      if (laundry) {
        this.laundromats.set(laundry.id, {
          ...laundry,
          subscriptionActive: false,
          isPremium: false,
          isFeatured: false,
          listingType: 'basic'
        });
      }
    }
  }
  
  // Premium features operations
  async getLaundryPremiumFeatures(laundryId: number): Promise<any> {
    const laundry = this.laundromats.get(laundryId);
    if (!laundry) return {};
    
    // Return premium features for the laundromat
    return {
      isPremium: laundry.isPremium,
      isFeatured: laundry.isFeatured,
      listingType: laundry.listingType,
      subscriptionActive: laundry.subscriptionActive,
      subscriptionExpiry: laundry.subscriptionExpiry,
      featuredRank: laundry.featuredRank,
      promotionalText: laundry.promotionalText,
      amenities: laundry.amenities,
      machineCount: laundry.machineCount,
      photos: laundry.photos,
      specialOffers: laundry.specialOffers
    };
  }
  
  async updatePremiumFeatures(laundryId: number, features: any): Promise<boolean> {
    const laundry = this.laundromats.get(laundryId);
    if (!laundry) return false;
    
    // Only allow updating premium features if the laundromat has an active premium subscription
    if (!laundry.subscriptionActive) return false;
    
    // Update the premium features
    this.laundromats.set(laundryId, {
      ...laundry,
      promotionalText: features.promotionalText || laundry.promotionalText,
      amenities: features.amenities || laundry.amenities,
      machineCount: features.machineCount || laundry.machineCount,
      photos: features.photos || laundry.photos,
      specialOffers: features.specialOffers || laundry.specialOffers
    });
    
    return true;
  }
  
  // Laundry Tips operations
  async getLaundryTips(): Promise<LaundryTip[]> {
    return Array.from(this.laundryTips.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getLaundryTipBySlug(slug: string): Promise<LaundryTip | undefined> {
    return Array.from(this.laundryTips.values())
      .find(tip => tip.slug === slug);
  }
  
  async createLaundryTip(insertTip: InsertLaundryTip): Promise<LaundryTip> {
    const id = this.currentId.laundryTips++;
    const tip: LaundryTip = { ...insertTip, id, createdAt: new Date() };
    this.laundryTips.set(id, tip);
    return tip;
  }
  
  async getRelatedLaundryTips(tipId: number, limit: number = 3): Promise<LaundryTip[]> {
    const tip = this.laundryTips.get(tipId);
    if (!tip) return [];
    
    // Find tips in the same category or with similar tags
    return Array.from(this.laundryTips.values())
      .filter(t => t.id !== tipId && (
        t.category === tip.category || 
        (t.tags && tip.tags && t.tags.some(tag => tip.tags.includes(tag)))
      ))
      .sort(() => Math.random() - 0.5) // Simple random sort for demo
      .slice(0, limit);
  }

  // Location operations
  async getCities(stateAbbr?: string): Promise<City[]> {
    let cities = Array.from(this.cities.values());
    
    if (stateAbbr) {
      cities = cities.filter(city => city.state === stateAbbr);
    }
    
    return cities.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCityBySlug(slug: string): Promise<City | undefined> {
    return Array.from(this.cities.values())
      .find(city => city.slug === slug);
  }
  
  async getCityById(id: number): Promise<City | undefined> {
    return this.cities.get(id);
  }

  async getLaundromatsInCity(cityId: number): Promise<Laundromat[]> {
    const city = this.cities.get(cityId);
    if (!city) return [];
    
    return Array.from(this.laundromats.values())
      .filter(laundry => laundry.city === city.name && laundry.state === city.state);
  }

  async getStates(): Promise<State[]> {
    return Array.from(this.states.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getStateBySlug(slug: string): Promise<State | undefined> {
    return Array.from(this.states.values())
      .find(state => state.slug === slug);
  }

  async getStateByAbbr(abbr: string): Promise<State | undefined> {
    return Array.from(this.states.values())
      .find(state => state.abbr === abbr);
  }

  async getPopularCities(limit: number = 5): Promise<City[]> {
    return Array.from(this.cities.values())
      .sort((a, b) => b.laundryCount - a.laundryCount)
      .slice(0, limit);
  }

  // Helper methods
  private updateLaundryRating(laundryId: number): void {
    const laundry = this.laundromats.get(laundryId);
    if (!laundry) return;
    
    const reviews = Array.from(this.reviews.values())
      .filter(review => review.laundryId === laundryId);
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = reviews.length ? (totalRating / reviews.length).toFixed(1) : "0";
    
    this.laundromats.set(laundryId, {
      ...laundry,
      rating: avgRating,
      reviewCount: reviews.length
    });
  }

  private updateLocationCounts(cityName: string, stateAbbr: string): void {
    // Update city count
    const city = Array.from(this.cities.values())
      .find(c => c.name === cityName && c.state === stateAbbr);
    
    if (city) {
      this.cities.set(city.id, {
        ...city,
        laundryCount: city.laundryCount + 1
      });
    }
    
    // Update state count
    const state = Array.from(this.states.values())
      .find(s => s.abbr === stateAbbr);
    
    if (state) {
      this.states.set(state.id, {
        ...state,
        laundryCount: state.laundryCount + 1
      });
    }
  }

  // Sample data initialization
  private initSampleData(): void {
    // Initialize users
    this.initSampleUsers();
    
    // Initialize states
    this.initSampleStates();
    
    // Initialize cities
    this.initSampleCities();
    
    // Initialize laundromats
    this.initSampleLaundromats();
    
    // Initialize reviews
    this.initSampleReviews();
    
    // Initialize laundry tips
    this.initSampleLaundryTips();
  }
  
  private initSampleUsers(): void {
    const users: InsertUser[] = [
      {
        username: 'user',
        password: '$2b$10$8OOugIwm/Crq4KTY7HgIXeeTeJqTYcQiVY0QoMkC3oG/EHQ3qO82q', // 'password'
        email: 'user@example.com',
        isBusinessOwner: false,
        role: 'user'
      },
      {
        username: 'owner',
        password: '$2b$10$8OOugIwm/Crq4KTY7HgIXeeTeJqTYcQiVY0QoMkC3oG/EHQ3qO82q', // 'password'
        email: 'owner@example.com',
        isBusinessOwner: true,
        role: 'business_owner'
      },
      {
        username: 'admin',
        password: '$2b$10$8OOugIwm/Crq4KTY7HgIXeeTeJqTYcQiVY0QoMkC3oG/EHQ3qO82q', // 'password'
        email: 'admin@example.com',
        isBusinessOwner: true,
        role: 'admin'
      }
    ];
    
    users.forEach(user => {
      const id = this.currentId.users++;
      this.users.set(id, { ...user, id, createdAt: new Date() });
    });
    
    // Associate owner with a laundromat
    this.laundromats.set(1, {
      ...this.laundromats.get(1)!,
      ownerId: 2 // owner user
    });
  }
  
  private initSampleLaundryTips(): void {
    const tips: InsertLaundryTip[] = [
      {
        title: 'How to Remove Common Stains',
        slug: 'remove-common-stains',
        description: 'A comprehensive guide to removing the most common types of stains from your clothes.',
        content: `<h2>Stain Removal Guide</h2>
                <p>Stains happen to everyone, but with the right approach, you can save your favorite clothes.</p>
                <h3>Coffee Stains</h3>
                <p>Run cold water through the back of the stain. Apply liquid laundry detergent and let it sit for 3-5 minutes before washing.</p>
                <h3>Red Wine</h3>
                <p>Blot with paper towels, then cover with salt to absorb moisture. Rinse with cold water and pretreat with stain remover.</p>
                <h3>Grease</h3>
                <p>Apply dish soap directly to the stain, gently rub in, and wash in the hottest water safe for the fabric.</p>`,
        category: 'stain-removal',
        tags: ['stains', 'cleaning', 'laundry-tips']
      },
      {
        title: 'Energy-Efficient Laundry Practices',
        slug: 'energy-efficient-laundry',
        description: 'Save money and reduce your environmental impact with these energy-saving laundry tips.',
        content: `<h2>Save Energy While Doing Laundry</h2>
                <p>Making small changes to your laundry routine can significantly reduce energy consumption.</p>
                <h3>Wash with Cold Water</h3>
                <p>Up to 90% of the energy used by washing machines goes to heating water. Cold water is effective for most loads.</p>
                <h3>Full Loads Only</h3>
                <p>Washing full loads maximizes efficiency. However, don't overload the machine as it reduces cleaning effectiveness.</p>
                <h3>Air Dry When Possible</h3>
                <p>Line drying clothes outdoors or on indoor racks can eliminate the need for energy-intensive dryers.</p>`,
        category: 'eco-friendly',
        tags: ['energy-saving', 'eco-friendly', 'sustainability']
      },
      {
        title: 'Understanding Fabric Care Labels',
        slug: 'fabric-care-labels',
        description: 'Learn how to decode those mysterious symbols on clothing care labels.',
        content: `<h2>Decoding Fabric Care Labels</h2>
                <p>Those tiny symbols on your clothing tags contain important washing instructions.</p>
                <h3>Water Temperature Symbols</h3>
                <p>The tub with water symbol indicates washing. The number of dots inside (0-3) indicates temperature: no dots for cold, one for warm, two for hot, and three for very hot.</p>
                <h3>Ironing Symbols</h3>
                <p>An iron icon means the garment can be ironed. Dots indicate temperature settings, with more dots meaning higher heat.</p>
                <h3>Bleaching Symbols</h3>
                <p>A triangle symbol relates to bleaching. A crossed-out triangle means no bleach, while one with diagonal lines allows non-chlorine bleach only.</p>`,
        category: 'clothing-care',
        tags: ['clothing-care', 'symbols', 'laundry-guide']
      },
      {
        title: 'How to Choose the Right Laundromat',
        slug: 'choose-right-laundromat',
        description: 'Tips for finding the perfect laundromat for your needs and preferences.',
        content: `<h2>Finding Your Ideal Laundromat</h2>
                <p>Not all laundromats are created equal. Here's how to find the best one for your needs.</p>
                <h3>Machine Maintenance</h3>
                <p>Well-maintained machines clean better and are less likely to damage clothes. Check for clean lint traps and smooth operation.</p>
                <h3>Amenities Matter</h3>
                <p>Consider facilities with amenities that matter to you: WiFi, folding stations, vending machines, or attendant service.</p>
                <h3>Location and Hours</h3>
                <p>Choose a location that's convenient to your routine. 24-hour laundromats offer flexibility for busy schedules.</p>`,
        category: 'laundromat-guide',
        tags: ['laundromat-tips', 'guide', 'facilities']
      }
    ];
    
    tips.forEach(tip => {
      const id = this.currentId.laundryTips++;
      this.laundryTips.set(id, { ...tip, id, createdAt: new Date() });
    });
  }

  private initSampleStates(): void {
    const states: InsertState[] = [
      { name: 'California', abbr: 'CA', slug: 'california', laundryCount: 0 },
      { name: 'New York', abbr: 'NY', slug: 'new-york', laundryCount: 0 },
      { name: 'Texas', abbr: 'TX', slug: 'texas', laundryCount: 0 }
    ];
    
    states.forEach(state => {
      const id = this.currentId.states++;
      this.states.set(id, { ...state, id });
    });
  }

  private initSampleCities(): void {
    const cities: { name: string; state: string; slug: string }[] = [
      { name: 'San Francisco', state: 'CA', slug: 'san-francisco-ca' },
      { name: 'Oakland', state: 'CA', slug: 'oakland-ca' },
      { name: 'San Jose', state: 'CA', slug: 'san-jose-ca' },
      { name: 'Berkeley', state: 'CA', slug: 'berkeley-ca' },
      { name: 'Daly City', state: 'CA', slug: 'daly-city-ca' },
      { name: 'New York City', state: 'NY', slug: 'new-york-ny' },
      { name: 'Brooklyn', state: 'NY', slug: 'brooklyn-ny' },
      { name: 'Queens', state: 'NY', slug: 'queens-ny' },
      { name: 'Buffalo', state: 'NY', slug: 'buffalo-ny' },
      { name: 'Rochester', state: 'NY', slug: 'rochester-ny' },
      { name: 'Houston', state: 'TX', slug: 'houston-tx' },
      { name: 'Dallas', state: 'TX', slug: 'dallas-tx' },
      { name: 'Austin', state: 'TX', slug: 'austin-tx' },
      { name: 'San Antonio', state: 'TX', slug: 'san-antonio-tx' },
      { name: 'Fort Worth', state: 'TX', slug: 'fort-worth-tx' }
    ];
    
    cities.forEach(city => {
      const id = this.currentId.cities++;
      this.cities.set(id, { ...city, id, laundryCount: 0 });
    });
  }

  private initSampleLaundromats(): void {
    const laundromats: InsertLaundromat[] = [
      {
        name: 'Bright Wash Laundromat',
        slug: 'bright-wash',
        address: '1234 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
        phone: '415-555-1234',
        website: 'https://brightwash.example.com',
        latitude: '37.7749',
        longitude: '-122.4194',
        rating: '4.8',
        reviewCount: 124,
        hours: '24 Hours',
        services: ['24 Hours', 'Card Payment', 'Coin-Operated'],
        isFeatured: true,
        isPremium: true,
        imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300',
        description: 'A bright, modern laundromat with the latest high-efficiency machines.',
      },
      {
        name: 'SpinCycle Laundry',
        slug: 'spincycle',
        address: '789 Valencia St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94110',
        phone: '415-555-6789',
        website: 'https://spincycle.example.com',
        latitude: '37.7625',
        longitude: '-122.4219',
        rating: '4.6',
        reviewCount: 98,
        hours: '6AM-10PM',
        services: ['Drop-off Service', 'Free WiFi', 'Card Payment'],
        isFeatured: true,
        isPremium: true,
        imageUrl: 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300',
        description: 'Full-service laundromat offering both self-service and drop-off options.',
      },
      {
        name: 'Wash & Fold Laundry',
        slug: 'wash-and-fold',
        address: '567 Folsom St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '415-555-2345',
        latitude: '37.7855',
        longitude: '-122.3964',
        rating: '4.2',
        reviewCount: 78,
        hours: '7AM-11PM',
        services: ['Coin-Operated', 'Card Payment', 'Wash & Fold'],
        isFeatured: false,
        isPremium: false,
        imageUrl: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200',
        description: 'Affordable self-service laundry with professional wash and fold services.',
      },
      {
        name: 'Clean Spin Laundromat',
        slug: 'clean-spin',
        address: '890 Bryant St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
        phone: '415-555-3456',
        latitude: '37.7746',
        longitude: '-122.4034',
        rating: '4.5',
        reviewCount: 112,
        hours: '24 Hours',
        services: ['24 Hours', 'Free WiFi', 'Coin-Operated'],
        isFeatured: false,
        isPremium: false,
        imageUrl: 'https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200',
        description: 'Clean, safe 24-hour laundromat with free WiFi and plenty of machines.',
      },
      {
        name: 'Budget Suds Laundromat',
        slug: 'budget-suds',
        address: '456 Mission St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '415-555-4567',
        latitude: '37.7877',
        longitude: '-122.4000',
        rating: '3.9',
        reviewCount: 56,
        hours: '6AM-11PM',
        services: ['Coin-Operated', 'Self-Service', 'Budget-Friendly'],
        isFeatured: false,
        isPremium: false,
        imageUrl: 'https://pixabay.com/get/g9a882d975aa967952430a32fda770e018f002de4bbb6976f276fc9b666acb3ccbbc4f33d4eeea5315ef331a14a3871c8c34956b9048ce4617abaa05fa3ad962d_1280.jpg',
        description: 'No-frills, budget-friendly laundromat for quick and affordable washes.',
      },
      {
        name: 'Suds & Bubbles',
        slug: 'suds-and-bubbles',
        address: '223 Fillmore St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94117',
        phone: '415-555-5678',
        website: 'https://sudsandbubbles.example.com',
        latitude: '37.7712',
        longitude: '-122.4305',
        rating: '4.7',
        reviewCount: 89,
        hours: '8AM-8PM',
        services: ['Card Payment', 'Dry Cleaning', 'Wash & Fold'],
        isFeatured: false,
        isPremium: true,
        imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200',
        description: 'Full-service laundry facility with dry cleaning and professional staff.',
      },
      {
        name: 'Fresh Press Laundry',
        slug: 'fresh-press',
        address: '555 Hayes St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        phone: '415-555-7890',
        latitude: '37.7766',
        longitude: '-122.4248',
        rating: '4.4',
        reviewCount: 67,
        hours: '7AM-9PM',
        services: ['Wash & Fold', 'Dry Cleaning', 'Delivery'],
        isFeatured: false,
        isPremium: true,
        imageUrl: 'https://images.unsplash.com/photo-1567113463300-102a7eb3cb26?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200',
        description: 'Premium laundry service with pickup and delivery options.',
      },
      {
        name: 'Laundry Express',
        slug: 'laundry-express',
        address: '1501 Irving St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94122',
        phone: '415-555-8901',
        latitude: '37.7639',
        longitude: '-122.4730',
        rating: '4.1',
        reviewCount: 45,
        hours: '6AM-12AM',
        services: ['Coin-Operated', 'Card Payment'],
        isFeatured: false,
        isPremium: false,
        imageUrl: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200',
        description: 'Convenient neighborhood laundromat with extended hours.',
      },
      {
        name: 'Soap & Suds',
        slug: 'soap-and-suds',
        address: '801 Divisadero St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94117',
        phone: '415-555-9012',
        latitude: '37.7766',
        longitude: '-122.4383',
        rating: '3.8',
        reviewCount: 34,
        hours: '7AM-10PM',
        services: ['Coin-Operated', 'Self-Service'],
        isFeatured: false,
        isPremium: false,
        imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200',
        description: 'Basic self-service laundry facility with plenty of machines.',
      },
      {
        name: 'Spotless Laundry Center',
        slug: 'spotless-laundry',
        address: '2300 16th St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
        phone: '415-555-0123',
        website: 'https://spotlesslaundry.example.com',
        latitude: '37.7651',
        longitude: '-122.4143',
        rating: '4.9',
        reviewCount: 152,
        hours: '24 Hours',
        services: ['24 Hours', 'Card Payment', 'Free WiFi', 'Wash & Fold'],
        isFeatured: false,
        isPremium: true,
        imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300',
        description: 'State-of-the-art 24-hour laundry center with all amenities.',
      }
    ];
    
    laundromats.forEach(laundry => {
      const id = this.currentId.laundromats++;
      this.laundromats.set(id, { ...laundry, id, createdAt: new Date() });
      
      // Update city and state counts
      this.updateLocationCounts(laundry.city, laundry.state);
    });
  }

  private initSampleReviews(): void {
    // Generate some reviews for each laundromat
    Array.from(this.laundromats.values()).forEach(laundry => {
      const reviewCount = Math.min(laundry.reviewCount, 5); // Generate up to 5 sample reviews
      
      for (let i = 0; i < reviewCount; i++) {
        const id = this.currentId.reviews++;
        const rating = Math.round(parseFloat(laundry.rating));
        
        this.reviews.set(id, {
          id,
          laundryId: laundry.id,
          userId: 1, // Sample user ID
          rating,
          comment: `Sample review ${i + 1} for ${laundry.name}`,
          createdAt: new Date()
        });
      }
    });
  }
}

// Choose which storage implementation to use
// For development with sample data, use MemStorage
// For production with database, use DatabaseStorage
// Import our database storage implementation
import { DatabaseStorage } from "./database-storage";

// Use the DatabaseStorage instead of MemStorage to access real data
export const storage = new DatabaseStorage();
