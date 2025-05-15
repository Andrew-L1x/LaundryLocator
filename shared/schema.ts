import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  isBusinessOwner: boolean("is_business_owner").default(false),
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
  isFeatured: boolean("is_featured").default(false),
  isPremium: boolean("is_premium").default(false),
  imageUrl: text("image_url"),
  description: text("description"),
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
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLaundrySchema = createInsertSchema(laundromats).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export const insertCitySchema = createInsertSchema(cities).omit({ id: true });
export const insertStateSchema = createInsertSchema(states).omit({ id: true });

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
