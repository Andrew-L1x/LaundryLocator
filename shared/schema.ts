import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define ListingType for type safety
export type ListingType = 'basic' | 'premium' | 'featured';

// User table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  isBusinessOwner: boolean("is_business_owner").default(false),
  role: text("role").notNull().default('user'), // 'user', 'owner', 'admin'
  stripeCustomerId: text("stripe_customer_id"), // For Stripe integration
  createdAt: timestamp("created_at").defaultNow(),
});

// Laundromat table for storing laundromat information
export const laundromats = pgTable("laundromats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  rating: text("rating").default("0"),
  reviewCount: integer("review_count").default(0),
  hours: text("hours").notNull(),
  services: jsonb("services").notNull().$type<string[]>(),
  
  // Premium listing fields
  listingType: text("listing_type").default("basic"), // 'basic', 'premium', 'featured'
  isFeatured: boolean("is_featured").default(false),
  isPremium: boolean("is_premium").default(false), // Added to match database structure
  subscriptionActive: boolean("subscription_active").default(false), // Added to match database structure
  subscriptionExpiry: timestamp("subscription_expiry"), // Added to match database structure
  featuredUntil: timestamp("featured_until"),
  subscriptionId: text("subscription_id"),
  subscriptionStatus: text("subscription_status"), // 'active', 'past_due', 'canceled', 'unpaid', null
  featuredRank: integer("featured_rank"),
  promotionalText: text("promotional_text"),
  amenities: jsonb("amenities").$type<string[]>(),
  machineCount: jsonb("machine_count").$type<{ washers: number, dryers: number }>(),
  photos: jsonb("photos").$type<string[]>(),
  specialOffers: jsonb("special_offers").$type<string[]>(),
  nearbyPlaces: jsonb("nearby_places").$type<{
    restaurants?: Array<{
      name: string;
      vicinity?: string;
      category: string;
      priceLevel: string;
      rating?: number;
      walkingDistance: string;
    }>;
    activities?: Array<{
      name: string;
      vicinity?: string;
      category: string;
      priceLevel?: string;
      rating?: number;
      walkingDistance: string;
    }>;
    transit?: Array<{
      name: string;
      vicinity?: string;
      category: string;
      priceLevel?: string;
      rating?: number;
      walkingDistance: string;
    }>;
  }>(),
  paymentOptions: jsonb("payment_options").$type<string[]>(),
  busyTimes: jsonb("busy_times").$type<{ mostBusy?: string; leastBusy?: string }>(),
  
  // Analytics data
  viewCount: integer("view_count").default(0),
  clickCount: integer("click_count").default(0),
  lastViewed: timestamp("last_viewed"),
  
  // Verification status
  verified: boolean("verified").default(false),
  verificationDate: timestamp("verification_date"),
  
  imageUrl: text("image_url"),
  description: text("description"),
  googleData: jsonb("google_data"),
  createdAt: timestamp("created_at").defaultNow(),
  ownerId: integer("owner_id").references(() => users.id),
});

// Review table for storing reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  laundryId: integer("laundry_id").notNull().references(() => laundromats.id),
  userId: integer("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Favorites table for storing user favorites
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  laundryId: integer("laundry_id").notNull().references(() => laundromats.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cities table for storing city information
export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  slug: text("slug").notNull().unique(),
  laundryCount: integer("laundry_count").default(0),
});

// States table for storing state information
export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  abbr: text("abbr").notNull().unique(),
  slug: text("slug").notNull().unique(),
  laundryCount: integer("laundry_count").default(0),
  comprehensive_content: jsonb("comprehensive_content"), // Rich state content with demographcis, services, trends, etc.
});

// Create insert schemas
// Subscriptions table for premium listing payments
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  laundryId: integer("laundry_id").notNull().references(() => laundromats.id),
  userId: integer("user_id").notNull().references(() => users.id),
  tier: text("tier").notNull(), // 'premium' or 'featured'
  amount: integer("amount").notNull(), // in cents
  paymentId: text("payment_id"), // reference to payment processor ID
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe payment intent ID
  billingCycle: text("billing_cycle").notNull(), // 'monthly' or 'annually'
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull(), // 'active', 'cancelled', 'expired'
  autoRenew: boolean("auto_renew").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Laundry Tips table
export const laundryTips = pgTable("laundry_tips", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  tags: jsonb("tags").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ZIP code coordinates table for location-based searches
export const zipCoordinates = pgTable("zip_coordinates", {
  id: serial("id").primaryKey(),
  zip: text("zip").notNull().unique(),
  city: text("city"),
  state: text("state"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
});

// Admin notifications table to track business claim submissions
export const adminNotifications = pgTable("admin_notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'business_claim', 'subscription', etc.
  status: text("status").notNull().default('unread'), // 'unread', 'read', 'contacted'
  userId: integer("user_id").notNull(),
  laundryId: integer("laundry_id").notNull(),
  email: text("email"),
  phone: text("phone"),
  data: jsonb("data"), // Store additional form data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLaundrySchema = createInsertSchema(laundromats).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export const insertCitySchema = createInsertSchema(cities).omit({ id: true });
export const insertStateSchema = createInsertSchema(states).omit({ id: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true });
export const insertLaundryTipSchema = createInsertSchema(laundryTips).omit({ id: true, createdAt: true });
export const insertZipCoordinateSchema = createInsertSchema(zipCoordinates).omit({ id: true });
export const insertAdminNotificationSchema = createInsertSchema(adminNotifications).omit({ id: true, createdAt: true, updatedAt: true });

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertZipCoordinate = z.infer<typeof insertZipCoordinateSchema>;
export type ZipCoordinate = typeof zipCoordinates.$inferSelect;

export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;
export type AdminNotification = typeof adminNotifications.$inferSelect;

export type InsertLaundromat = z.infer<typeof insertLaundrySchema>;
export type Laundromat = typeof laundromats.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

export type InsertState = z.infer<typeof insertStateSchema>;
export type State = typeof states.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertLaundryTip = z.infer<typeof insertLaundryTipSchema>;
export type LaundryTip = typeof laundryTips.$inferSelect;
