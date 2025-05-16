import { Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from './db';
import { subscriptions, laundromats } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { PREMIUM_PRICING, PREMIUM_FEATURES, PREMIUM_LIMITS, canAccessFeature, getFeatureLimit, getSearchPriority } from '@shared/premium-features';
import { ListingType } from '@shared/schema';

// Initialize Stripe with the secret key
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY is not set. Premium features will not work properly.');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as any
}) : null;

// Route handler to create a new subscription
export async function createSubscription(req: Request, res: Response) {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Stripe is not configured. Please check server configuration.'
      });
    }

    const { laundryId, tier, paymentMethodId, billingCycle = 'monthly' } = req.body;
    
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
    
    // Get amount based on tier and billing cycle
    const plan = PREMIUM_PRICING[tier as 'premium' | 'featured'];
    const amount = billingCycle === 'annually' ? plan.annualPrice : plan.monthlyPrice;
    
    // Process payment with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      description: `${tier} subscription for ${laundromat.name} (${billingCycle})`,
      metadata: {
        laundryId: laundryId.toString(),
        tier,
        billingCycle
      }
    });
    
    // Calculate subscription end date based on billing cycle
    const endDate = new Date();
    if (billingCycle === 'annually') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    const featuredUntil = tier === 'featured' ? endDate : null;
    
    // Create subscription record
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        laundryId,
        userId: req.user?.id || (laundromat.ownerId as number),
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
        listingType: tier as ListingType,
        isFeatured: tier === 'featured',
        featuredUntil,
        subscriptionId: subscription.id.toString(),
        subscriptionStatus: 'active',
        featuredRank: tier === 'featured' ? await getNextFeaturedRank() : null,
      })
      .where(eq(laundromats.id, laundryId));
    
    return res.status(201).json({ 
      success: true,
      message: `Subscription created successfully for ${tier} tier (${billingCycle})`,
      subscription,
      features: tier === 'premium' || tier === 'featured' ? 
        getPremiumFeatures(tier as ListingType) : 
        {}
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
    if (subscription.paymentId && stripe) {
      // In a real implementation, you would handle Stripe subscription cancellation here
      // For now, we're just updating our local database
      console.log(`Would cancel Stripe subscription for payment ID: ${subscription.paymentId}`);
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
        subscriptionStatus: 'canceled'
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
    
    // Get features from the utility based on listing type
    const features = laundromat.listingType === 'premium' || laundromat.listingType === 'featured' ? 
      getPremiumFeatures(laundromat.listingType as ListingType) : 
      {};
    
    // Add additional listing information
    const listingInfo = {
      listingType: laundromat.listingType,
      isFeatured: laundromat.isFeatured,
      featuredUntil: laundromat.featuredUntil,
      subscriptionStatus: laundromat.subscriptionStatus,
      subscriptionId: laundromat.subscriptionId,
      promotionalText: laundromat.promotionalText,
      amenities: laundromat.amenities,
      machineCount: laundromat.machineCount,
      photos: laundromat.photos,
      specialOffers: laundromat.specialOffers,
    };
    
    return res.status(200).json({ 
      success: true,
      features,
      listingInfo
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
    
    // Verify it's a premium or featured listing
    if (laundromat.listingType === 'basic') {
      return res.status(403).json({ 
        success: false, 
        message: 'This listing must be upgraded to premium or featured first' 
      });
    }
    
    // Get the premium features allowed for this listing type
    const tierFeatures = getPremiumFeatures(laundromat.listingType as ListingType);
    
    // Check photo limit
    if (photos && photos.length > tierFeatures.photoLimit) {
      return res.status(400).json({
        success: false,
        message: `Your ${laundromat.listingType} listing is limited to ${tierFeatures.photoLimit} photos. Please remove some photos or upgrade your listing.`
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
      message: 'Premium features updated successfully',
      features: tierFeatures
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
    
    // Find active subscriptions that have expired (looking at the subscriptions table)
    const now = new Date();
    const expiredSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.status, 'active'),
        subscriptions.endDate < now
      ));
    
    console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);
    
    // Update each expired subscription
    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      await db
        .update(subscriptions)
        .set({
          status: 'expired',
          autoRenew: false,
        })
        .where(eq(subscriptions.id, subscription.id));
      
      // Update the associated laundromat
      const [laundromat] = await db
        .select()
        .from(laundromats)
        .where(eq(laundromats.id, subscription.laundryId));
      
      if (laundromat) {
        await db
          .update(laundromats)
          .set({
            listingType: 'basic',
            isFeatured: false,
            featuredUntil: null,
            subscriptionStatus: 'expired',
            featuredRank: null,
          })
          .where(eq(laundromats.id, subscription.laundryId));
        
        console.log(`Updated expired listing: ${laundromat.name} (ID: ${laundromat.id})`);
        
        // Here we could send notification emails to owners
        // if (laundromat.ownerId) {
        //   const [owner] = await db
        //     .select()
        //     .from(users)
        //     .where(eq(users.id, laundromat.ownerId));
        //   
        //   if (owner && owner.email) {
        //     // Send email notification
        //     console.log(`Would send expiration email to ${owner.email}`);
        //   }
        // }
      }
    }
    
    // Also check for featured listings that have expired but might still have an active subscription
    const expiredFeatured = await db
      .select()
      .from(laundromats)
      .where(and(
        eq(laundromats.isFeatured, true),
        laundromats.featuredUntil < now
      ));
    
    console.log(`Found ${expiredFeatured.length} expired featured listings`);
    
    // Update each expired featured listing
    for (const listing of expiredFeatured) {
      // Downgrade from featured to premium if applicable
      if (listing.listingType === 'featured' && listing.subscriptionStatus === 'active') {
        await db
          .update(laundromats)
          .set({
            listingType: 'premium',
            isFeatured: false,
            featuredUntil: null,
            featuredRank: null,
          })
          .where(eq(laundromats.id, listing.id));
        
        console.log(`Downgraded expired featured listing to premium: ${listing.name} (ID: ${listing.id})`);
      }
    }
    
    console.log('Finished processing expired subscriptions and featured listings');
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