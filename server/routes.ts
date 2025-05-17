import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import Stripe from "stripe";
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
  getFileInfo, 
  getImportStats, 
  processBatch 
} from "./routes/adminImport";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  demoLogin,
  authenticate
} from "./auth";
import cookieParser from "cookie-parser";
import { importCsvFile, listCsvFiles, uploadCsvFile, deleteCsvFile } from "./routes/csvImport";
import { importLaundromatData, getImportStatus } from "./routes/laundryDataImport";
import { enrichLaundryFile, startBatchEnrichment, getBatchEnrichmentStatus } from "./routes/laundryDataEnrichment";
import { startDatabaseImport, getDatabaseImportStatus, resetDatabaseImportStatus } from "./routes/databaseImport";
import { downloadFile } from "./routes/fileDownload";

// Initialize Stripe if secret key is available
const stripe = process.env.STRIPE_SECRET_KEY ? 
  new Stripe(process.env.STRIPE_SECRET_KEY) : 
  null;

// Utility function to get the next featured rank for a featured listing
async function getNextFeaturedRank(): Promise<number> {
  try {
    const featuredLaundromats = await storage.getFeaturedLaundromats();
    const ranks = featuredLaundromats
      .map(l => l.featuredRank)
      .filter(r => r !== null) as number[];
    
    return ranks.length ? Math.max(...ranks) + 1 : 1;
  } catch (error) {
    console.error('Error getting next featured rank:', error);
    return 1; // Default to 1 if there's an error
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = '/api';
  
  // Authentication routes
  app.post(`${apiRouter}/auth/register`, registerUser);
  app.post(`${apiRouter}/auth/login`, loginUser);
  app.post(`${apiRouter}/auth/logout`, logoutUser);
  app.post(`${apiRouter}/auth/demo-login`, demoLogin);
  app.get(`${apiRouter}/auth/me`, authenticate, getCurrentUser);

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
  
  // Get premium laundromats
  app.get(`${apiRouter}/premium-laundromats`, async (_req: Request, res: Response) => {
    try {
      const premium = await storage.getPremiumLaundromats();
      res.json(premium);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching premium laundromats' });
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

  // Get state by slug or abbreviation
  app.get(`${apiRouter}/states/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      console.log(`Looking for state with slug: ${slug}`);
      
      let state = null;
      
      // Try direct match on slug first (like "texas")
      state = await storage.getStateBySlug(slug.toLowerCase());
      
      // If not found and it's 2 letters, try as an abbreviation (like "tx")
      if (!state && slug.length === 2) {
        console.log(`Trying as abbreviation: ${slug.toUpperCase()}`);
        state = await storage.getStateByAbbr(slug.toUpperCase());
      }
      
      // Last try - get all states and fuzzy match
      if (!state) {
        console.log(`Trying fuzzy match for: ${slug}`);
        const states = await storage.getStates();
        
        // Try different matching strategies
        state = states.find(s => 
          s.name.toLowerCase() === slug.toLowerCase() || 
          s.slug.toLowerCase() === slug.toLowerCase() ||
          s.abbr.toLowerCase() === slug.toLowerCase()
        );
      }
      
      if (!state) {
        console.log(`State not found for slug: ${slug}`);
        return res.status(404).json({ message: 'State not found' });
      }
      
      console.log(`Found state: ${state.name}, ${state.abbr}, ${state.slug}`);
      res.json(state);
    } catch (error) {
      console.error('Error fetching state:', error);
      res.status(500).json({ message: 'Error fetching state' });
    }
  });

  // Get city by slug - handle both full slugs (city-name-st) and city-state slugs
  app.get(`${apiRouter}/cities/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      let city = await storage.getCityBySlug(slug);
      
      // If city not found, try parsing as city-state format
      if (!city && slug.includes('-')) {
        // Try to extract state abbreviation from the end of the slug (e.g., "austin-tx")
        const parts = slug.split('-');
        const potentialStateAbbr = parts[parts.length - 1].toUpperCase();
        
        // If the last part looks like a state abbreviation (2 letters)
        if (potentialStateAbbr.length === 2) {
          // Check if state exists
          const state = await storage.getStateByAbbr(potentialStateAbbr);
          
          if (state) {
            // Rebuild city name from remaining parts
            const cityNameParts = parts.slice(0, parts.length - 1);
            const cityName = cityNameParts.join(' ');
            
            // Find city by name and state
            const cities = await storage.getCities(state.abbr);
            city = cities.find(c => 
              c.name.toLowerCase() === cityName.toLowerCase() || 
              c.name.toLowerCase().replace(/\s+/g, '-') === cityNameParts.join('-').toLowerCase()
            );
          }
        }
      }
      
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
      console.log(`Fetching laundromats for city ID: ${id}`);
      
      if (isNaN(parseInt(id))) {
        return res.status(400).json({ message: 'Invalid city ID format' });
      }
      
      // First, get the city data to check if it exists
      try {
        const cityId = parseInt(id);
        
        // Get city information
        const city = await storage.getCityById(cityId);
        
        if (!city) {
          console.log(`City with ID ${cityId} not found`);
          return res.status(404).json({ message: 'City not found' });
        }
        
        console.log(`Looking for laundromats in ${city.name}, ${city.state}`);
        
        // Get all laundromats
        const allLaundromats = await storage.searchLaundromats('');
        console.log(`Total laundromats in database: ${allLaundromats.length}`);
        
        // Filter manually by city and state (both abbreviation and full name)
        const stateName = storage.getStateNameFromAbbr ? 
                          storage.getStateNameFromAbbr(city.state) : null;
                          
        const matches = allLaundromats.filter(l => {
          const matchesCity = l.city?.toLowerCase() === city.name.toLowerCase();
          const matchesState = l.state?.toLowerCase() === city.state.toLowerCase() || 
                              (stateName && l.state?.toLowerCase() === stateName.toLowerCase());
          return matchesCity && matchesState;
        });
        
        console.log(`Found ${matches.length} matching laundromats for ${city.name}, ${city.state}`);
        
        // If no matches found, still return empty array (not an error)
        return res.json(matches);
      } catch (innerError) {
        console.error('Inner error in laundromats fetch:', innerError);
        
        // Fallback - just return empty array rather than error
        return res.json([]);
      }
    } catch (error) {
      console.error('Error fetching laundromats in city:', error);
      // Return empty array instead of error to prevent UI breakage
      return res.json([]);
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
  
  // Admin data import routes
  app.get(`${apiRouter}/admin/import/file-info`, authenticate, getFileInfo);
  app.get(`${apiRouter}/admin/import/stats`, authenticate, getImportStats);
  app.post(`${apiRouter}/admin/import/batch`, authenticate, processBatch);
  
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
  // Premium listing payment endpoints
  app.post(`${apiRouter}/create-subscription`, async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: 'Stripe is not configured' });
      }

      const { laundryId, userId, tier, amount, billingCycle } = req.body;
      
      if (!laundryId || !userId || !tier || !amount) {
        return res.status(400).json({ message: 'Missing required parameters' });
      }
      
      // Get the laundromat and user
      const laundromat = await storage.getLaundromat(laundryId);
      const user = await storage.getUser(userId);
      
      if (!laundromat || !user) {
        return res.status(404).json({ message: 'Laundromat or user not found' });
      }
      
      // Create or retrieve a customer
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
          metadata: {
            userId: user.id.toString()
          }
        });
        
        customerId = customer.id;
        
        // Update user with Stripe customer ID
        // This would ideally be in a transaction, but for simplicity:
        // await storage.updateUser(userId, { stripeCustomerId: customerId });
      }
      
      // Create a payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          laundryId: laundryId.toString(),
          userId: userId.toString(),
          tier,
          billingCycle
        }
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret
      });
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ message: 'Error creating subscription' });
    }
  });
  
  // Stripe webhook handler for subscription events (e.g., payment succeeded, subscription updated)
  app.post(`${apiRouter}/stripe-webhook`, async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: 'Stripe is not configured' });
      }
      
      // This would typically verify the webhook signature, but for simplicity:
      const event = req.body;
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          const { laundryId, userId, tier, billingCycle } = paymentIntent.metadata;
          
          // Calculate subscription duration
          const now = new Date();
          const endDate = new Date();
          if (billingCycle === 'monthly') {
            endDate.setMonth(endDate.getMonth() + 1);
          } else {
            endDate.setFullYear(endDate.getFullYear() + 1);
          }
          
          // Create subscription record
          const subscription = await storage.createSubscription({
            laundryId: parseInt(laundryId),
            userId: parseInt(userId),
            tier,
            startDate: now,
            endDate,
            amount: paymentIntent.amount,
            status: 'active',
            billingCycle,
            autoRenew: true,
            paymentId: paymentIntent.id,
            stripePaymentIntentId: paymentIntent.id
          });
          
          // Update laundromat with premium status
          const isFeatured = tier === 'featured';
          
          await storage.updateLaundromat(parseInt(laundryId), {
            listingType: tier,
            isFeatured,
            subscriptionStatus: 'active',
            subscriptionId: String(subscription.id),
            featuredUntil: isFeatured ? endDate : null,
            featuredRank: isFeatured ? await getNextFeaturedRank() : null
          });
          
          break;
          
        case 'payment_intent.payment_failed':
          // Handle payment failure
          // This could notify the user, log the failure, etc.
          break;
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).json({ message: 'Error handling webhook' });
    }
  });
  
  // CSV Import API Endpoints
  app.get(`${apiRouter}/csv/list`, listCsvFiles);
  app.post(`${apiRouter}/csv/upload`, uploadCsvFile);
  app.post(`${apiRouter}/csv/import`, importCsvFile);
  app.post(`${apiRouter}/csv/delete`, deleteCsvFile);
  
  // Laundromat Data Enrichment API Endpoints
  app.post(`${apiRouter}/laundry/enrich`, enrichLaundryFile);
  app.post(`${apiRouter}/laundry/batch-enrich`, startBatchEnrichment);
  app.get(`${apiRouter}/laundry/batch-status/:jobId`, getBatchEnrichmentStatus);
  
  // File Download Endpoint
  app.get(`${apiRouter}/files/download`, downloadFile);
  
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
  
  // Admin routes for database import
  app.post(`${apiRouter}/admin/database-import`, authenticate, startDatabaseImport);
  app.get(`${apiRouter}/admin/import-status`, authenticate, getDatabaseImportStatus);
  app.post(`${apiRouter}/admin/reset-import`, authenticate, resetDatabaseImportStatus);

  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}