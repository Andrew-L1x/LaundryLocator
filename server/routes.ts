import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertLaundrySchema, 
  insertReviewSchema, 
  insertFavoriteSchema,
  insertUserSchema,
  insertSubscriptionSchema 
} from "@shared/schema";
import { 
  createSubscription, 
  getUserSubscriptions, 
  cancelSubscription, 
  getLaundryPremiumFeatures, 
  updatePremiumFeatures,
  checkExpiredSubscriptions
} from "./premium";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  demoLogin,
  authenticate
} from "./auth";
import cookieParser from "cookie-parser";

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
  
  // Premium Listing API Endpoints
  // Create a new subscription for a laundromat
  app.post(`${apiRouter}/subscriptions`, createSubscription);
  
  // Get all active subscriptions for the current user
  app.get(`${apiRouter}/subscriptions`, getUserSubscriptions);
  
  // Cancel a subscription
  app.post(`${apiRouter}/subscriptions/:subscriptionId/cancel`, cancelSubscription);
  
  // Get premium features for a laundromat
  app.get(`${apiRouter}/laundromats/:laundryId/premium-features`, getLaundryPremiumFeatures);
  
  // Update premium features for a laundromat
  app.put(`${apiRouter}/laundromats/:laundryId/premium-features`, updatePremiumFeatures);
  
  // Schedule a daily job to check for expired subscriptions
  // This would typically be done with a cron job, but for simplicity:
  setInterval(checkExpiredSubscriptions, 24 * 60 * 60 * 1000); // Run once a day
  
  // Authentication routes
  app.use(cookieParser());
  
  // Register a new user
  app.post(`${apiRouter}/auth/register`, registerUser);
  
  // Login a user
  app.post(`${apiRouter}/auth/login`, loginUser);
  
  // Demo login for development
  app.post(`${apiRouter}/auth/demo-login`, demoLogin);
  
  // Logout a user
  app.post(`${apiRouter}/auth/logout`, logoutUser);
  
  // Get current user
  app.get(`${apiRouter}/auth/me`, getCurrentUser);
  
  // Laundry Tips API Endpoints
  app.get(`${apiRouter}/laundry-tips`, async (_req: Request, res: Response) => {
    try {
      // Create some sample laundry tips
      const tips = [
        {
          id: 1,
          title: 'How to Remove Red Wine Stains',
          description: 'Learn the best techniques for removing red wine stains from different fabrics',
          url: '/laundry-tips/remove-red-wine-stains',
          slug: 'remove-red-wine-stains',
          content: 'Red wine stains can be challenging, but with these techniques, you\'ll be able to remove them effectively.',
          category: 'Stain Removal',
          imageUrl: 'https://images.unsplash.com/photo-1567073969272-858a1a664e18?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['stains', 'wine', 'cleaning'],
          createdAt: new Date('2023-08-15')
        },
        {
          id: 2,
          title: 'Best Settings for Washing Different Fabrics',
          description: 'A comprehensive guide to selecting the right washing settings for various fabric types',
          url: '/laundry-tips/fabric-washing-settings',
          slug: 'fabric-washing-settings',
          content: 'Different fabrics require different washing settings to maintain their quality and longevity.',
          category: 'Washing Techniques',
          imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['fabrics', 'washing', 'settings'],
          createdAt: new Date('2023-09-22')
        },
        {
          id: 3,
          title: 'Energy-Saving Laundry Tips',
          description: 'Reduce your energy consumption with these eco-friendly laundry practices',
          url: '/laundry-tips/energy-saving',
          slug: 'energy-saving',
          content: 'Saving energy while doing laundry is not only good for the environment but also for your wallet.',
          category: 'Eco-Friendly Laundry',
          imageUrl: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['eco-friendly', 'energy saving', 'sustainability'],
          createdAt: new Date('2023-10-05')
        },
        {
          id: 4,
          title: 'How to Care for Delicate Fabrics',
          description: 'Tips for washing and maintaining delicate fabrics like silk, lace, and cashmere',
          url: '/laundry-tips/delicate-fabric-care',
          slug: 'delicate-fabric-care',
          content: 'Delicate fabrics require special care to maintain their quality.',
          category: 'Fabric Care',
          imageUrl: 'https://images.unsplash.com/photo-1556905200-279565513a2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['delicates', 'silk', 'cashmere', 'lace'],
          createdAt: new Date('2023-10-18')
        }
      ];
      
      res.json(tips);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching laundry tips' });
    }
  });
  
  // Get a specific laundry tip by slug
  app.get(`${apiRouter}/laundry-tips/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Create sample tips
      const tips = [
        {
          id: 1,
          title: 'How to Remove Red Wine Stains',
          description: 'Learn the best techniques for removing red wine stains from different fabrics',
          url: '/laundry-tips/remove-red-wine-stains',
          slug: 'remove-red-wine-stains',
          content: 'Red wine stains can be challenging, but with these techniques, you\'ll be able to remove them effectively. First, blot the stain with a clean cloth to absorb as much wine as possible. Avoid rubbing, as this can spread the stain. Next, apply a mixture of dish soap and hydrogen peroxide to the stain, let it sit for 5-10 minutes, then wash as usual. For delicate fabrics, try using club soda or salt to absorb the wine before washing.',
          category: 'Stain Removal',
          imageUrl: 'https://images.unsplash.com/photo-1567073969272-858a1a664e18?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['stains', 'wine', 'cleaning'],
          createdAt: new Date('2023-08-15')
        },
        {
          id: 2,
          title: 'Best Settings for Washing Different Fabrics',
          description: 'A comprehensive guide to selecting the right washing settings for various fabric types',
          url: '/laundry-tips/fabric-washing-settings',
          slug: 'fabric-washing-settings',
          content: 'Different fabrics require different washing settings to maintain their quality and longevity. For cottons, use warm water and a regular cycle. For synthetics, use cool water and a permanent press cycle. Delicates should be washed in cold water on a gentle cycle. Wool and cashmere should be hand-washed or use a wool-specific cycle if your machine has one. Always check clothing labels for specific instructions.',
          category: 'Washing Techniques',
          imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['fabrics', 'washing', 'settings'],
          createdAt: new Date('2023-09-22')
        },
        {
          id: 3,
          title: 'Energy-Saving Laundry Tips',
          description: 'Reduce your energy consumption with these eco-friendly laundry practices',
          url: '/laundry-tips/energy-saving',
          slug: 'energy-saving',
          content: 'Saving energy while doing laundry is not only good for the environment but also for your wallet. Wash clothes in cold water whenever possible, as heating water accounts for about 90% of the energy used in washing clothes. Wash full loads instead of multiple small loads. Use dryer balls to reduce drying time. Consider air-drying clothes when weather permits. Choose energy-efficient washers and dryers when upgrading your appliances.',
          category: 'Eco-Friendly Laundry',
          imageUrl: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['eco-friendly', 'energy saving', 'sustainability'],
          createdAt: new Date('2023-10-05')
        },
        {
          id: 4,
          title: 'How to Care for Delicate Fabrics',
          description: 'Tips for washing and maintaining delicate fabrics like silk, lace, and cashmere',
          url: '/laundry-tips/delicate-fabric-care',
          slug: 'delicate-fabric-care',
          content: 'Delicate fabrics require special care to maintain their quality. For silk, hand wash in cold water with a mild detergent specifically designed for delicates. Never wring silk; instead, press out excess water and lay flat to dry. For cashmere and wool, also hand wash in cold water and lay flat to dry to prevent stretching. Lace should be placed in a mesh laundry bag if machine washing on a gentle cycle, or preferably hand washed. Always avoid bleach on delicate fabrics.',
          category: 'Fabric Care',
          imageUrl: 'https://images.unsplash.com/photo-1556905200-279565513a2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          tags: ['delicates', 'silk', 'cashmere', 'lace'],
          createdAt: new Date('2023-10-18')
        }
      ];
      
      const tip = tips.find(t => t.slug === slug);
      
      if (!tip) {
        return res.status(404).json({ message: 'Laundry tip not found' });
      }
      
      res.json(tip);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching laundry tip' });
    }
  });
  
  // Get related laundry tips
  app.get(`${apiRouter}/laundry-tips/related/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Sample related tips (excluding the current tip)
      const allTips = [
        {
          id: 1,
          title: 'How to Remove Red Wine Stains',
          description: 'Learn the best techniques for removing red wine stains from different fabrics',
          slug: 'remove-red-wine-stains',
          category: 'Stain Removal',
          imageUrl: 'https://images.unsplash.com/photo-1567073969272-858a1a664e18?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          createdAt: new Date('2023-08-15')
        },
        {
          id: 2,
          title: 'Best Settings for Washing Different Fabrics',
          description: 'A comprehensive guide to selecting the right washing settings for various fabric types',
          slug: 'fabric-washing-settings',
          category: 'Washing Techniques',
          imageUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          createdAt: new Date('2023-09-22')
        },
        {
          id: 3,
          title: 'Energy-Saving Laundry Tips',
          description: 'Reduce your energy consumption with these eco-friendly laundry practices',
          slug: 'energy-saving',
          category: 'Eco-Friendly Laundry',
          imageUrl: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          createdAt: new Date('2023-10-05')
        },
        {
          id: 4,
          title: 'How to Care for Delicate Fabrics',
          description: 'Tips for washing and maintaining delicate fabrics like silk, lace, and cashmere',
          slug: 'delicate-fabric-care',
          category: 'Fabric Care',
          imageUrl: 'https://images.unsplash.com/photo-1556905200-279565513a2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
          createdAt: new Date('2023-10-18')
        }
      ];
      
      const relatedTips = allTips.filter(tip => tip.id !== parseInt(id)).slice(0, 2);
      
      res.json(relatedTips);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching related laundry tips' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}