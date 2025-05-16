import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from './db';
import { subscriptions, laundromats } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

// Pricing tiers in cents
const PRICING = {
  premium: 2500, // $25/month
  featured: 5000, // $50/month
};

// Route handler to create a new subscription
export async function createSubscription(req: Request, res: Response) {
  try {
    const { laundryId, tier, paymentMethodId } = req.body;
    
    if (!laundryId || !tier || !paymentMethodId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: laundryId, tier, or paymentMethodId' 
      });
    }
    
    // Verify tier is valid
    if (!['premium', 'featured'].includes(tier)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tier. Must be "premium" or "featured"' 
      });
    }
    
    // Find the laundromat
    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, laundryId));
    
    if (!laundromat) {
      return res.status(404).json({ 
        success: false, 
        message: 'Laundromat not found' 
      });
    }
    
    // Verify ownership (assuming user ID is in req.user.id)
    // This requires authentication middleware to be set up
    if (req.user && laundromat.ownerId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized. You do not own this laundromat listing.' 
      });
    }
    
    // Get amount based on tier
    const amount = PRICING[tier as keyof typeof PRICING];
    
    // Process payment with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true
    });
    
    // Calculate subscription end date (1 month from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
    // Create subscription record
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        laundryId,
        userId: req.user?.id || laundromat.ownerId,
        tier,
        amount,
        paymentId: paymentIntent.id,
        startDate: new Date(),
        endDate,
        status: 'active',
        autoRenew: true,
      })
      .returning();
    
    // Update laundromat record with premium status
    await db
      .update(laundromats)
      .set({
        listingType: tier,
        subscriptionActive: true,
        subscriptionExpiry: endDate,
        isPremium: tier === 'premium' || tier === 'featured',
        isFeatured: tier === 'featured',
        featuredRank: tier === 'featured' ? await getNextFeaturedRank() : null,
      })
      .where(eq(laundromats.id, laundryId));
    
    return res.status(201).json({ 
      success: true,
      message: `Subscription created successfully for ${tier} tier`,
      subscription 
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create subscription',
      error: error.message
    });
  }
}

// Get active subscriptions for a user
export async function getUserSubscriptions(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const userSubscriptions = await db
      .select({
        subscription: subscriptions,
        laundromat: {
          id: laundromats.id,
          name: laundromats.name,
          slug: laundromats.slug,
        }
      })
      .from(subscriptions)
      .innerJoin(laundromats, eq(subscriptions.laundryId, laundromats.id))
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active')
      ));
    
    return res.status(200).json({ 
      success: true,
      subscriptions: userSubscriptions
    });
  } catch (error: any) {
    console.error('Error fetching user subscriptions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
}

// Cancel a subscription
export async function cancelSubscription(req: Request, res: Response) {
  try {
    const { subscriptionId } = req.params;
    
    // Find the subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, parseInt(subscriptionId)));
    
    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscription not found' 
      });
    }
    
    // Verify ownership
    if (req.user && subscription.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized. This subscription does not belong to you.' 
      });
    }
    
    // If subscription has a Stripe payment ID, cancel it with Stripe
    if (subscription.paymentId) {
      // This would typically involve cancelling a recurring subscription in Stripe
      // But for simplicity, we're just marking it as cancelled in our database
    }
    
    // Update subscription status
    await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        autoRenew: false
      })
      .where(eq(subscriptions.id, parseInt(subscriptionId)));
    
    // Update laundromat record
    await db
      .update(laundromats)
      .set({
        subscriptionActive: false
      })
      .where(eq(laundromats.id, subscription.laundryId));
    
    return res.status(200).json({ 
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
}

// Get premium features for a laundromat
export async function getLaundryPremiumFeatures(req: Request, res: Response) {
  try {
    const { laundryId } = req.params;
    
    // Find the laundromat
    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, parseInt(laundryId)));
    
    if (!laundromat) {
      return res.status(404).json({ 
        success: false, 
        message: 'Laundromat not found' 
      });
    }
    
    const premiumFeatures = {
      listingType: laundromat.listingType,
      isPremium: laundromat.isPremium,
      isFeatured: laundromat.isFeatured,
      subscriptionActive: laundromat.subscriptionActive,
      subscriptionExpiry: laundromat.subscriptionExpiry,
      promotionalText: laundromat.promotionalText,
      amenities: laundromat.amenities,
      machineCount: laundromat.machineCount,
      photos: laundromat.photos,
      specialOffers: laundromat.specialOffers,
    };
    
    return res.status(200).json({ 
      success: true,
      features: premiumFeatures
    });
  } catch (error: any) {
    console.error('Error fetching premium features:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch premium features',
      error: error.message
    });
  }
}

// Update premium features for a laundromat
export async function updatePremiumFeatures(req: Request, res: Response) {
  try {
    const { laundryId } = req.params;
    const {
      promotionalText,
      amenities,
      machineCount,
      photos,
      specialOffers
    } = req.body;
    
    // Find the laundromat
    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, parseInt(laundryId)));
    
    if (!laundromat) {
      return res.status(404).json({ 
        success: false, 
        message: 'Laundromat not found' 
      });
    }
    
    // Verify ownership
    if (req.user && laundromat.ownerId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized. You do not own this laundromat listing.' 
      });
    }
    
    // Verify it's a premium listing
    if (!laundromat.isPremium) {
      return res.status(403).json({ 
        success: false, 
        message: 'This listing must be upgraded to premium first' 
      });
    }
    
    // Update premium features
    await db
      .update(laundromats)
      .set({
        promotionalText: promotionalText || laundromat.promotionalText,
        amenities: amenities || laundromat.amenities,
        machineCount: machineCount || laundromat.machineCount,
        photos: photos || laundromat.photos,
        specialOffers: specialOffers || laundromat.specialOffers,
      })
      .where(eq(laundromats.id, parseInt(laundryId)));
    
    return res.status(200).json({ 
      success: true,
      message: 'Premium features updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating premium features:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update premium features',
      error: error.message
    });
  }
}

// Check for expired subscriptions and update their status
export async function checkExpiredSubscriptions() {
  try {
    console.log('Checking for expired subscriptions...');
    
    // Find laundromats with expired subscriptions
    const now = new Date();
    const expiredListings = await db
      .select()
      .from(laundromats)
      .where(and(
        eq(laundromats.subscriptionActive, true),
        laundromats.subscriptionExpiry < now
      ));
    
    console.log(`Found ${expiredListings.length} expired listings`);
    
    // Update each expired listing
    for (const listing of expiredListings) {
      await db
        .update(laundromats)
        .set({
          listingType: 'basic',
          subscriptionActive: false,
          isPremium: false,
          isFeatured: false,
          featuredRank: null,
        })
        .where(eq(laundromats.id, listing.id));
      
      // Find and update subscription records
      await db
        .update(subscriptions)
        .set({
          status: 'expired',
          autoRenew: false,
        })
        .where(and(
          eq(subscriptions.laundryId, listing.id),
          eq(subscriptions.status, 'active')
        ));
      
      // Here we could also send notification emails to owners
    }
    
    console.log('Finished processing expired subscriptions');
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
  }
}

// Utility function to get the next featured rank
async function getNextFeaturedRank(): Promise<number> {
  const featuredLaundromats = await db
    .select()
    .from(laundromats)
    .where(eq(laundromats.isFeatured, true))
    .orderBy(laundromats.featuredRank);
  
  if (featuredLaundromats.length === 0) {
    return 100; // Start with rank 100
  }
  
  // Find the lowest rank
  const lowestRank = featuredLaundromats.reduce((min, laundromat) => {
    return laundromat.featuredRank !== null && laundromat.featuredRank < min
      ? laundromat.featuredRank
      : min;
  }, Number.MAX_SAFE_INTEGER);
  
  return lowestRank !== Number.MAX_SAFE_INTEGER 
    ? lowestRank - 1 // Go one lower than the current lowest
    : 100; // Default if no valid ranks found
}