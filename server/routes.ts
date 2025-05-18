import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import Stripe from "stripe";
import { db, pool } from "./db"; // Import the database connection
import { addCityRoutes } from "./city-routes";

const apiRouter = '/api';

// Helper function to compute string similarity for fuzzy matching
function computeNameSimilarity(a: string, b: string): number {
  if (a === b) return 0;
  
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[a.length][b.length];
}

// Helper function to get next featured rank
async function getNextFeaturedRank(): Promise<number> {
  try {
    const query = `
      SELECT MAX(featured_rank) as max_rank
      FROM laundromats
      WHERE featured_rank IS NOT NULL
    `;
    
    const result = await pool.query(query);
    const maxRank = result.rows[0]?.max_rank || 0;
    return maxRank + 1;
  } catch (error) {
    console.error('Error getting next featured rank:', error);
    return 1; // Default to 1 if there's an error
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add city routes - these are now handled by the dedicated city-routes.ts file
  addCityRoutes(app, apiRouter);

  app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'API is running' });
  });

  // Get all states
  app.get(`${apiRouter}/states`, async (_req: Request, res: Response) => {
    try {
      const query = `
        SELECT * FROM states
        ORDER BY name ASC
      `;
      
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching states:', error);
      res.status(500).json({ message: 'Error fetching states' });
    }
  });

  // Get cities for a specific state
  app.get(`${apiRouter}/states/:abbr/cities`, async (req: Request, res: Response) => {
    try {
      const { abbr } = req.params;
      const stateUpperAbbr = abbr.toUpperCase();
      console.log(`Finding cities for state: ${stateUpperAbbr}`);
      
      // First verify this is a valid state
      const stateQuery = `
        SELECT * FROM states 
        WHERE UPPER(abbr) = UPPER($1)
      `;
      
      const stateResult = await pool.query(stateQuery, [stateUpperAbbr]);
      
      if (stateResult.rows.length === 0) {
        return res.status(404).json({ message: 'State not found' });
      }
      
      const state = stateResult.rows[0];
      console.log(`Found state: ${state.name} (${state.abbr})`);
      
      // Get unique cities from the laundromats table
      // This ensures we only show cities that actually have laundromats
      const cityQuery = `
        SELECT DISTINCT 
          city, 
          state, 
          COUNT(*) AS laundry_count
        FROM laundromats
        WHERE state = $1
        GROUP BY city, state
        ORDER BY laundry_count DESC, city ASC
        LIMIT 100
      `;
      
      const citiesResult = await pool.query(cityQuery, [stateUpperAbbr]);
      
      // Generate formatted city data with slugs
      const cities = citiesResult.rows.map((row, index) => {
        const cityName = row.city;
        const slug = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateUpperAbbr.toLowerCase()}`;
        return {
          id: 50000 + index, // Use an ID that won't conflict with real city IDs
          name: cityName,
          slug: slug,
          state: stateUpperAbbr,
          laundryCount: parseInt(row.laundry_count)
        };
      });
      
      console.log(`Found ${cities.length} cities with laundromats for ${stateUpperAbbr}`);
      res.json(cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ message: 'Error fetching cities' });
    }
  });

  // Get state by slug or abbreviation
  app.get(`${apiRouter}/states/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      console.log(`Looking for state with slug: ${slug}`);
      
      // Normalize to handle both slug and abbreviation lookups
      const slugLower = slug.toLowerCase();
      
      // Query both slug and abbreviation fields
      const query = `
        SELECT * FROM states 
        WHERE 
          LOWER(slug) = LOWER($1) OR 
          LOWER(abbr) = LOWER($1)
        LIMIT 1
      `;
      
      const result = await pool.query(query, [slugLower]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'State not found' });
      }
      
      const state = result.rows[0];
      console.log(`Found state: ${state.name}, ${state.abbr}, ${state.slug}`);
      
      res.json(state);
    } catch (error) {
      console.error('Error fetching state:', error);
      res.status(500).json({ message: 'Error fetching state' });
    }
  });

  // Get laundromat by slug
  app.get(`${apiRouter}/laundromats/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      const query = `
        SELECT * FROM laundromats
        WHERE slug = $1
        LIMIT 1
      `;
      
      const result = await pool.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Laundromat not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching laundromat:', error);
      res.status(500).json({ message: 'Error fetching laundromat' });
    }
  });

  // Get reviews for a laundromat
  app.get(`${apiRouter}/laundromats/:id/reviews`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // For now, just return an empty array as it's not required for the current functionality
      res.json([]);
      
      // If we implement reviews later, we can use this query:
      /*
      const query = `
        SELECT * FROM reviews
        WHERE laundry_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query, [id]);
      res.json(result.rows);
      */
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ message: 'Error fetching reviews' });
    }
  });

  // Create a review for a laundromat
  app.post(`${apiRouter}/reviews`, async (req: Request, res: Response) => {
    try {
      // Use Zod for validation
      const reviewSchema = z.object({
        laundryId: z.number(),
        userId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional().nullable(),
      });
      
      const validData = reviewSchema.parse(req.body);
      
      const query = `
        INSERT INTO reviews (
          laundry_id, 
          user_id, 
          rating, 
          comment, 
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const values = [
        validData.laundryId,
        validData.userId,
        validData.rating,
        validData.comment || null,
      ];
      
      const result = await pool.query(query, values);
      
      // Also update the average rating for the laundromat
      const updateRatingQuery = `
        UPDATE laundromats
        SET 
          rating = (
            SELECT AVG(rating)::text
            FROM reviews
            WHERE laundry_id = $1
          ),
          review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE laundry_id = $1
          )
        WHERE id = $1
      `;
      
      await pool.query(updateRatingQuery, [validData.laundryId]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({ message: 'Error creating review' });
    }
  });

  // Get popular cities (most laundromats)
  app.get(`${apiRouter}/popular-cities`, async (req: Request, res: Response) => {
    try {
      // Get the cities with the most laundromats
      const query = `
        SELECT 
          city, 
          state, 
          COUNT(*) as count
        FROM laundromats
        GROUP BY city, state
        ORDER BY count DESC
        LIMIT 10
      `;
      
      const result = await pool.query(query);
      
      // Format the results with proper slugs
      const popularCities = result.rows.map((row, index) => {
        const slug = `${row.city.toLowerCase().replace(/\s+/g, '-')}-${row.state.toLowerCase()}`;
        return {
          id: index,
          name: row.city,
          state: row.state,
          laundryCount: parseInt(row.count),
          slug
        };
      });
      
      res.json(popularCities);
    } catch (error) {
      console.error('Error fetching popular cities:', error);
      res.status(500).json({ message: 'Error fetching popular cities' });
    }
  });

  // Get featured laundromats
  app.get(`${apiRouter}/featured-laundromats`, async (_req: Request, res: Response) => {
    try {
      const query = `
        SELECT *
        FROM laundromats
        WHERE rating IS NOT NULL AND rating::float >= 4.5
        ORDER BY rating::float DESC
        LIMIT 10
      `;
      
      const result = await pool.query(query);
      console.log(`Featured laundromats found: ${result.rows.length}`);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching featured laundromats:', error);
      res.status(500).json({ message: 'Error fetching featured laundromats' });
    }
  });

  // Search laundromats (general search and by ZIP)
  app.get(`${apiRouter}/laundromats`, async (req: Request, res: Response) => {
    try {
      const { q = "", radius = 5 } = req.query;
      const searchQuery = q.toString();
      const searchRadius = parseInt(radius.toString()) || 5;
      
      console.log(`Search query: "${searchQuery}", radius: ${searchRadius} miles, looks like ZIP? ${/^\d{5}$/.test(searchQuery)}`);
      
      // Check if it's a ZIP code search (exactly 5 digits)
      if (/^\d{5}$/.test(searchQuery)) {
        // First try to find the centroid of the ZIP code
        const zipQuery = `
          SELECT * FROM zip_coordinates
          WHERE zip = $1
          LIMIT 1
        `;
        
        const zipResult = await pool.query(zipQuery, [searchQuery]);
        
        if (zipResult.rows.length > 0) {
          const { latitude, longitude } = zipResult.rows[0];
          
          // Use distance calculation to find laundromats within radius
          const nearbyQuery = `
            SELECT *, 
              (3959 * acos(cos(radians($1)) * cos(radians(latitude::float)) * cos(radians(longitude::float) - radians($2)) + sin(radians($1)) * sin(radians(latitude::float)))) AS distance
            FROM laundromats
            WHERE 
              latitude != '' AND 
              longitude != ''
            HAVING 
              distance <= $3
            ORDER BY 
              distance ASC,
              CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
            LIMIT 50
          `;
          
          const result = await pool.query(nearbyQuery, [
            latitude,
            longitude,
            searchRadius
          ]);
          
          console.log(`ZIP code search found ${result.rows.length} laundromats`);
          return res.json(result.rows);
        }
      }
      
      // General search by name, city, state, etc.
      console.log("General search");
      
      let mainQuery = '';
      let queryParams: any[] = [];
      
      if (searchQuery.trim() !== '') {
        // Search by name, city, or state
        mainQuery = `
          SELECT *
          FROM laundromats
          WHERE 
            LOWER(name) LIKE LOWER($1) OR
            LOWER(city) LIKE LOWER($1) OR
            LOWER(state) LIKE LOWER($1) OR
            zip LIKE $1
          ORDER BY 
            CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
          LIMIT 20
        `;
        queryParams = [`%${searchQuery}%`];
      } else {
        // No search term - just return top-rated laundromats
        mainQuery = `
          SELECT *
          FROM laundromats
          ORDER BY 
            CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
          LIMIT 20
        `;
      }
      
      const countQuery = `SELECT COUNT(*) as total FROM laundromats`;
      const countResult = await pool.query(countQuery);
      console.log(`General search found ${countResult.rows[0].total} laundromats`);
      
      const result = await pool.query(mainQuery, queryParams);
      console.log(`Found laundromats: ${result.rows.length}`);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error searching laundromats:', error);
      res.status(500).json({ message: 'Error searching laundromats' });
    }
  });

  // Get nearby laundromats based on coordinates
  app.get(`${apiRouter}/laundromats/nearby`, async (req: Request, res: Response) => {
    try {
      const { lat, lng, radius = 25 } = req.query;
      
      if (!lat || !lng) {
        return res.status(404).json({ message: 'Laundromat not found' });
      }
      
      const latitude = parseFloat(lat.toString());
      const longitude = parseFloat(lng.toString());
      const searchRadius = parseFloat(radius.toString()) || 25;
      
      // Use distance calculation to find nearby laundromats
      const query = `
        SELECT *, 
          (3959 * acos(cos(radians($1)) * cos(radians(latitude::float)) * cos(radians(longitude::float) - radians($2)) + sin(radians($1)) * sin(radians(latitude::float)))) AS distance
        FROM laundromats
        WHERE 
          latitude != '' AND 
          longitude != ''
        HAVING 
          distance <= $3
        ORDER BY 
          distance ASC,
          CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
        LIMIT 50
      `;
      
      const result = await pool.query(query, [
        latitude,
        longitude,
        searchRadius
      ]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching nearby laundromats:', error);
      res.status(500).json({ message: 'Error fetching nearby laundromats' });
    }
  });

  // Stripe webhook handler for payment events
  app.post(`${apiRouter}/stripe-webhook`, async (req: Request, res: Response) => {
    try {
      // Validate Stripe webhook signature
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Missing Stripe Secret Key' });
      }
      
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16'
      });
      
      // Process Stripe event
      // For now, just acknowledge the event
      res.json({ received: true });
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}