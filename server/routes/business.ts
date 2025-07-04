import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { storage } from '../storage';
import { eq, ilike, or, and } from 'drizzle-orm';
import { laundromats, users, subscriptions, adminNotifications } from '@shared/schema';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const router = Router();

// Function to generate a slug from business name, city and state
function generateSlug(name: string, city: string, state: string): string {
  // Convert to lowercase and remove any non-alphanumeric characters except spaces
  const cleanName = name.toLowerCase().replace(/[^\w\s]/g, '');
  const cleanCity = city.toLowerCase().replace(/[^\w\s]/g, '');
  const cleanState = state.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Replace spaces with hyphens
  const formattedName = cleanName.replace(/\s+/g, '-');
  const formattedCity = cleanCity.replace(/\s+/g, '-');
  const formattedState = cleanState.replace(/\s+/g, '-');
  
  // Combine parts to create the final slug
  return `${formattedName}-${formattedCity}-${formattedState}`;
}

// Validation schemas
const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

const addBusinessSchema = z.object({
  name: z.string().min(3, 'Business name must be at least 3 characters'),
  address: z.string().min(5, 'Please enter a valid street address'),
  city: z.string().min(2, 'City is required'),
  state: z.string().length(2, 'Please use 2-letter state code (e.g., TX)'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'),
  phone: z.string().min(7, 'Valid phone number is required'),
  website: z.string().url('Please enter a valid URL').optional().nullable(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  hours: z.string().min(5, 'Please enter business hours'),
});

const claimBusinessSchema = z.object({
  laundryId: z.string().or(z.number()),
  verificationData: z.object({
    method: z.enum(['document', 'utility', 'phone', 'mail']),
    files: z.array(z.any()).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    email: z.string().email('Please enter a valid email address'),
  }),
  profileData: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    services: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    paymentOptions: z.array(z.string()).optional(),
    hours: z.string().optional(),
    machineCount: z.object({
      washers: z.number().optional(),
      dryers: z.number().optional(),
    }).optional(),
  }),
  selectedPlan: z.enum(['basic', 'premium']),
});

const startSubscriptionSchema = z.object({
  laundryId: z.string().or(z.number()),
  paymentMethodId: z.string().optional(),
});

// Routes
// Search for businesses
router.get('/search', async (req, res) => {
  try {
    const { q } = searchSchema.parse(req.query);
    
    // Search for businesses by name, address, city, state, or phone
    const results = await db.select()
      .from(laundromats)
      .where(
        or(
          ilike(laundromats.name, `%${q}%`),
          ilike(laundromats.address, `%${q}%`),
          ilike(laundromats.city, `%${q}%`),
          ilike(laundromats.state, `%${q}%`),
          ilike(laundromats.phone, `%${q}%`)
        )
      )
      .limit(20);
    
    res.json(results);
  } catch (error) {
    console.error('Business search error:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid search query' });
  }
});

// Add a new business
router.post('/add', async (req, res) => {
  try {
    const businessData = addBusinessSchema.parse(req.body);
    
    // Generate slug from business name, city and state
    const slug = generateSlug(businessData.name, businessData.city, businessData.state);
    
    // Add placeholder coordinates (these would be updated with a geocoding service in production)
    const laundromat = {
      ...businessData,
      slug,
      latitude: '0',
      longitude: '0',
      rating: '0',
      reviewCount: 0,
      isFeatured: false,
      isPremium: false,
      services: [] as string[],
      verified: false,
    };
    
    // Insert the new laundromat
    const [newLaundromat] = await db.insert(laundromats)
      .values(laundromat)
      .returning();
    
    res.status(201).json({ id: newLaundromat.id, slug: newLaundromat.slug });
  } catch (error) {
    console.error('Add business error:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to add business' });
  }
});

// Claim a business
router.post('/claim', async (req, res) => {
  try {
    const { laundryId, verificationData, profileData, selectedPlan } = claimBusinessSchema.parse(req.body);
    
    // In a real implementation, we would verify ownership using the provided method
    
    // Check if the user is logged in
    if (!req.user) {
      return res.status(401).json({ message: 'You must be logged in to claim a business' });
    }
    
    // Get the user ID
    const userId = req.user.id;
    
    // Prepare update data
    const updateData: any = { 
      ownerId: userId,
      verified: true,
      verificationDate: new Date(),
    };
    
    // Add profile data if provided
    if (profileData.name) updateData.name = profileData.name;
    if (profileData.phone) updateData.phone = profileData.phone;
    if (profileData.website) updateData.website = profileData.website;
    if (profileData.description) updateData.description = profileData.description;
    if (profileData.hours) updateData.hours = profileData.hours;
    if (profileData.services) updateData.services = profileData.services;
    if (profileData.amenities) updateData.amenities = profileData.amenities;
    if (profileData.paymentOptions) updateData.paymentOptions = profileData.paymentOptions;
    
    // For premium plan, set subscription status
    if (selectedPlan === 'premium') {
      updateData.isPremium = true;
      updateData.listingType = 'premium';
      updateData.subscriptionActive = true;
    }
    
    // Set machine count if provided (safely)
    if (profileData.machineCount) {
      const machineCount = {
        washers: profileData.machineCount.washers || 0,
        dryers: profileData.machineCount.dryers || 0
      };
      updateData.machineCount = machineCount;
    }
    
    // Update the laundromat with owner ID and profile data
    const [updatedLaundromat] = await db.update(laundromats)
      .set(updateData)
      .where(eq(laundromats.id, +laundryId))
      .returning();
      
    // Get user information for admin notification
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    // Create admin notification for business claim
    await db.insert(adminNotifications).values({
      type: 'business_claim',
      status: 'unread',
      userId: userId,
      laundryId: +laundryId,
      email: verificationData.email || user?.email || '',
      phone: profileData.phone || '',
      data: {
        businessName: updatedLaundromat.name,
        address: updatedLaundromat.address,
        city: updatedLaundromat.city,
        state: updatedLaundromat.state,
        zip: updatedLaundromat.zip,
        selectedPlan,
        verificationMethod: verificationData.method,
        email: verificationData.email,
        submittedAt: new Date().toISOString()
      }
    });
    
    // If premium plan was selected, create a subscription record
    if (selectedPlan === 'premium') {
      // Set up 30-day trial subscription
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      await db.insert(subscriptions)
        .values({
          laundryId: +laundryId,
          userId,
          tier: 'premium',
          amount: 1999, // $19.99 in cents
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: thirtyDaysFromNow,
          status: 'active',
          autoRenew: true,
        });
      
      // Update the laundromat with subscription expiry date
      await db.update(laundromats)
        .set({ 
          subscriptionExpiry: thirtyDaysFromNow
        })
        .where(eq(laundromats.id, +laundryId));
        
      // Return with flag to redirect to payment setup
      return res.json({ 
        message: 'Business claimed successfully',
        premium: true,
        redirectToPayment: true
      });
    }
    
    // Regular response for basic plan
    res.json({ 
      message: 'Business claimed successfully',
      premium: false
    });
  } catch (error) {
    console.error('Claim business error:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to claim business' });
  }
});

// Create subscription payment intent
router.post('/start-subscription', async (req, res) => {
  try {
    const { laundryId, paymentMethodId } = startSubscriptionSchema.parse(req.body);
    
    // Check if the user is logged in
    if (!req.user) {
      return res.status(401).json({ message: 'You must be logged in to start a subscription' });
    }
    
    // Get the user ID
    const userId = req.user.id;
    
    // Get the laundromat
    const [laundromat] = await db.select()
      .from(laundromats)
      .where(eq(laundromats.id, +laundryId));
    
    if (!laundromat) {
      return res.status(404).json({ message: 'Laundromat not found' });
    }
    
    // Check if the user owns the laundromat
    if (laundromat.ownerId !== userId) {
      return res.status(403).json({ message: 'You do not own this business' });
    }
    
    // Get the current active subscription for this laundromat
    const [existingSubscription] = await db.select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.laundryId, +laundryId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);
    
    // Create or get a Stripe customer
    let stripeCustomerId = existingSubscription?.stripeCustomerId;
    
    // Get user information
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email || 'unknown@example.com',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
        metadata: {
          userId: userId,
          laundryId: laundryId.toString()
        }
      });
      
      stripeCustomerId = customer.id;
    }
    
    // Calculate trial end date (either from existing subscription or 30 days from now)
    const trialEndDate = existingSubscription?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // Set the price ID - generally you would store this in an environment variable
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    
    if (!priceId) {
      return res.status(500).json({ message: 'Stripe price configuration is missing' });
    }
    
    // Create a Stripe subscription with trial
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{
        price: priceId,
      }],
      trial_end: Math.floor(trialEndDate.getTime() / 1000), // Convert to unix timestamp
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    
    // Create or update the subscription record
    let subscriptionRecord;
    
    if (existingSubscription) {
      // Update existing subscription
      [subscriptionRecord] = await db.update(subscriptions)
        .set({
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          tier: 'premium',
          amount: 1999, // $19.99 in cents
          billingCycle: 'monthly',
          endDate: new Date(stripeSubscription.trial_end * 1000),
          status: 'active',
          autoRenew: true,
        })
        .where(eq(subscriptions.id, existingSubscription.id))
        .returning();
    } else {
      // Create new subscription
      [subscriptionRecord] = await db.insert(subscriptions)
        .values({
          laundryId: +laundryId,
          userId,
          tier: 'premium',
          amount: 1999, // $19.99 in cents
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: new Date(stripeSubscription.trial_end * 1000),
          status: 'active',
          autoRenew: true,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
        })
        .returning();
    }
    
    // Update the laundromat with premium status
    await db.update(laundromats)
      .set({ 
        isPremium: true,
        listingType: 'premium',
        subscriptionActive: true,
        subscriptionExpiry: new Date(stripeSubscription.trial_end * 1000),
        subscriptionId: subscriptionRecord.id.toString(),
      })
      .where(eq(laundromats.id, +laundryId));
    
    // Return the client secret for the payment intent
    res.json({
      subscriptionId: stripeSubscription.id,
      clientSecret: stripeSubscription.latest_invoice.payment_intent.client_secret,
      expiryDate: new Date(stripeSubscription.trial_end * 1000)
    });
  } catch (error) {
    console.error('Start subscription error:', error);
    res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to start subscription' });
  }
});

// Get business dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    // Check if the user is logged in
    if (!req.user) {
      return res.status(401).json({ message: 'You must be logged in to access the dashboard' });
    }
    
    // Get the user ID
    const userId = req.user.id;
    
    // Get the user's businesses
    const businesses = await db.select()
      .from(laundromats)
      .where(eq(laundromats.ownerId, userId));
    
    if (businesses.length === 0) {
      return res.status(404).json({ message: 'No businesses found' });
    }
    
    // Get the first business (in a real app, we might handle multiple businesses)
    const business = businesses[0];
    
    // Get the subscription details
    const [subscription] = await db.select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.laundryId, business.id),
          eq(subscriptions.status, 'active')
        )
      )
      .orderBy(subscriptions.startDate, 'desc')
      .limit(1);
    
    // Prepare business dashboard data
    const dashboardData = {
      ...business,
      subscription: subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        trialEnds: subscription.endDate,
        nextBillingDate: subscription.endDate,
      } : {
        tier: 'basic',
        status: 'active',
        trialEnds: null,
        nextBillingDate: null,
      },
      profileCompleteness: calculateProfileCompleteness(business),
      pendingActions: getPendingActions(business),
      views: {
        today: Math.floor(Math.random() * 20),
        thisWeek: Math.floor(Math.random() * 100) + 50,
        thisMonth: Math.floor(Math.random() * 400) + 200,
        trend: "+15%"
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
});

// Get business reviews
router.get('/reviews', async (req, res) => {
  try {
    // Check if the user is logged in
    if (!req.user) {
      return res.status(401).json({ message: 'You must be logged in to access reviews' });
    }
    
    // Get the user ID
    const userId = req.user.id;
    
    // Get the user's businesses
    const businesses = await db.select()
      .from(laundromats)
      .where(eq(laundromats.ownerId, userId));
    
    if (businesses.length === 0) {
      return res.json([]);
    }
    
    // Get the first business (in a real app, we might handle multiple businesses)
    const business = businesses[0];
    
    // In a real implementation, we would fetch reviews from the database
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Reviews error:', error);
    res.status(500).json({ message: 'Failed to load reviews' });
  }
});

// Helper functions
function calculateProfileCompleteness(business: any): number {
  let score = 0;
  const totalFields = 8;
  
  if (business.name) score++;
  if (business.address) score++;
  if (business.phone) score++;
  if (business.website) score++;
  if (business.description && business.description.length >= 50) score++;
  if (business.hours) score++;
  if (business.services && business.services.length > 0) score++;
  if (business.photos && business.photos.length > 0) score++;
  
  return Math.round((score / totalFields) * 100);
}

function getPendingActions(business: any): { id: number, type: string, message: string }[] {
  const actions = [];
  
  if (!business.photos || business.photos.length === 0) {
    actions.push({
      id: 1,
      type: 'photo_upload',
      message: 'Add photos of your business to attract more customers'
    });
  }
  
  if (!business.description || business.description.length < 50) {
    actions.push({
      id: 2,
      type: 'description_update',
      message: 'Improve your business description to help customers find you'
    });
  }
  
  return actions;
}

export default router;