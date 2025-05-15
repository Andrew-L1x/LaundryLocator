import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertLaundrySchema, 
  insertReviewSchema, 
  insertFavoriteSchema,
  insertUserSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = '/api';

  // Get all laundromats
  app.get(`${apiRouter}/laundromats`, async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string || '';
      const openNow = req.query.openNow === 'true';
      const services = req.query.services ? (req.query.services as string).split(',') : [];
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      
      const filters: any = {};
      if (openNow) filters.openNow = true;
      if (services.length) filters.services = services;
      if (rating) filters.rating = rating;
      
      const laundromats = await storage.searchLaundromats(query, filters);
      res.json(laundromats);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching laundromats' });
    }
  });

  // Get laundromat by slug
  app.get(`${apiRouter}/laundromats/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const laundromat = await storage.getLaundryBySlug(slug);
      
      if (!laundromat) {
        return res.status(404).json({ message: 'Laundromat not found' });
      }
      
      res.json(laundromat);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching laundromat' });
    }
  });

  // Get featured laundromats
  app.get(`${apiRouter}/featured-laundromats`, async (_req: Request, res: Response) => {
    try {
      const featured = await storage.getFeaturedLaundromats();
      res.json(featured);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching featured laundromats' });
    }
  });

  // Get laundromats by location
  app.get(`${apiRouter}/nearby-laundromats`, async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: 'Latitude and longitude are required' });
      }
      
      const nearby = await storage.getLaundromatsNearby(
        lat as string, 
        lng as string, 
        radius ? parseInt(radius as string) : undefined
      );
      
      res.json(nearby);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching nearby laundromats' });
    }
  });

  // Get reviews for a laundromat
  app.get(`${apiRouter}/laundromats/:id/reviews`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reviews = await storage.getReviews(parseInt(id));
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching reviews' });
    }
  });

  // Create a review
  app.post(`${apiRouter}/reviews`, async (req: Request, res: Response) => {
    try {
      const reviewData = insertReviewSchema.parse(req.body);
      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid review data', errors: error.errors });
      }
      res.status(500).json({ message: 'Error creating review' });
    }
  });

  // Get popular cities
  app.get(`${apiRouter}/popular-cities`, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const cities = await storage.getPopularCities(limit);
      res.json(cities);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching popular cities' });
    }
  });

  // Get all states
  app.get(`${apiRouter}/states`, async (_req: Request, res: Response) => {
    try {
      const states = await storage.getStates();
      res.json(states);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching states' });
    }
  });

  // Get cities by state
  app.get(`${apiRouter}/states/:abbr/cities`, async (req: Request, res: Response) => {
    try {
      const { abbr } = req.params;
      const cities = await storage.getCities(abbr);
      res.json(cities);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching cities' });
    }
  });

  // Get state by slug
  app.get(`${apiRouter}/states/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const state = await storage.getStateBySlug(slug);
      
      if (!state) {
        return res.status(404).json({ message: 'State not found' });
      }
      
      res.json(state);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching state' });
    }
  });

  // Get city by slug
  app.get(`${apiRouter}/cities/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const city = await storage.getCityBySlug(slug);
      
      if (!city) {
        return res.status(404).json({ message: 'City not found' });
      }
      
      res.json(city);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching city' });
    }
  });

  // Get laundromats in city
  app.get(`${apiRouter}/cities/:id/laundromats`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const laundromats = await storage.getLaundromatsInCity(parseInt(id));
      res.json(laundromats);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching laundromats in city' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
