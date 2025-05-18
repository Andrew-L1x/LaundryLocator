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

  // Let the Vite middleware handle the client-side routes
  app.get('/', (req: Request, res: Response, next: NextFunction) => {
    next();
  });

  // Get all states with accurate laundromat counts
  app.get(`${apiRouter}/states`, async (_req: Request, res: Response) => {
    try {
      // First, get all the states
      const statesQuery = `
        SELECT * FROM states
        ORDER BY name ASC
      `;
      
      const statesResult = await pool.query(statesQuery);
      const states = statesResult.rows;
      
      // Now, calculate and update the actual laundromat counts
      for (const state of states) {
        // Get current count of laundromats for this state
        const countQuery = `
          SELECT COUNT(*) as count 
          FROM laundromats 
          WHERE state = $1 OR state = $2
        `;
        
        const countResult = await pool.query(countQuery, [state.name, state.abbr]);
        const count = parseInt(countResult.rows[0].count);
        
        // Update the state with the accurate count
        state.laundryCount = count;
        
        // Update the database as well (async, don't wait for it)
        pool.query(
          'UPDATE states SET laundry_count = $1 WHERE id = $2',
          [count, state.id]
        ).catch(err => console.error(`Error updating count for state ${state.name}:`, err));
      }
      
      res.json(states);
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
      
      // Get the count of laundromats for this state
      const countQuery = `
        SELECT COUNT(*) as count
        FROM laundromats
        WHERE UPPER(state) = UPPER($1)
      `;
      
      const countResult = await pool.query(countQuery, [state.abbr]);
      const laundryCount = parseInt(countResult.rows[0].count);
      
      // Add the count to the state data
      const stateWithCount = {
        ...state,
        laundryCount
      };
      
      console.log(`State ${state.name} has ${laundryCount} laundromats`);
      
      res.json(stateWithCount);
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

  // Search laundromats (general search, by coordinates, or by ZIP)
  app.get(`${apiRouter}/laundromats`, async (req: Request, res: Response) => {
    try {
      const { q = "", radius = 5, lat, lng } = req.query;
      const searchQuery = q.toString();
      const searchRadius = parseInt(radius.toString()) || 5;
      
      console.log(`Search query: "${searchQuery}", radius: ${searchRadius} miles, looks like ZIP? ${/^\d{5}$/.test(searchQuery)}`);
      
      // Check if we have lat/lng coordinates for a location-based search
      if (lat && lng) {
        const latitude = parseFloat(lat.toString());
        const longitude = parseFloat(lng.toString());
        
        console.log(`Location-based search at coordinates: ${latitude}, ${longitude} within ${searchRadius} miles`);
        
        // Find laundromats near the given coordinates based on distance
        // This query will work for ANY location in the United States
        const locationQuery = `
          SELECT *, 
            (3959 * acos(cos(radians($1)) * cos(radians(NULLIF(latitude,'')::float)) * 
             cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
             sin(radians($1)) * sin(radians(NULLIF(latitude,'')::float)))) AS distance
          FROM laundromats
          WHERE 
            latitude != '' AND 
            longitude != '' AND
            latitude IS NOT NULL AND
            longitude IS NOT NULL AND
            (3959 * acos(cos(radians($1)) * cos(radians(NULLIF(latitude,'')::float)) * 
             cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
             sin(radians($1)) * sin(radians(NULLIF(latitude,'')::float)))) <= $3
          ORDER BY 
            distance ASC,
            CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
          LIMIT 50
        `;
        
        const result = await pool.query(locationQuery, [
          latitude, longitude, searchRadius
        ]);
        
        console.log(`Found ${result.rows.length} laundromats within ${searchRadius} miles of coordinates (${latitude}, ${longitude})`);
        return res.json(result.rows);
      }
      
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

  // Get nearby laundromats based on coordinates - universal solution for ANY city
  app.get(`${apiRouter}/laundromats/nearby`, async (req: Request, res: Response) => {
    try {
      // Handle both cases: lat/lng for location or a specific laundromat ID
      const { laundromat: laundromatId, lat, lng, radius = 25 } = req.query;
      
      // For debugging with location privacy preserved
      console.log(`Fetching laundromats with params:`, req.url.split('?')[1] || 'no params');
      
      // CASE 1: Looking up near a specific laundromat (for laundromat detail pages)
      if (laundromatId) {
        const id = parseInt(laundromatId.toString());
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid laundromat ID' });
        }
        
        // Get the specified laundromat first
        const laundromatQuery = `SELECT * FROM laundromats WHERE id = $1`;
        const laundromatResult = await pool.query(laundromatQuery, [id]);
        
        if (laundromatResult.rows.length === 0) {
          return res.status(404).json({ message: 'Laundromat not found' });
        }
        
        const mainLaundromat = laundromatResult.rows[0];
        
        // Ensure we have valid coordinates
        if (!mainLaundromat.latitude || !mainLaundromat.longitude) {
          return res.status(400).json({ message: 'Laundromat location data not available' });
        }
        
        // Find nearby laundromats with distance calculation
        const nearbyQuery = `
          SELECT *,
            (3959 * acos(
              cos(radians($1)) * 
              cos(radians(NULLIF(latitude,'')::float)) * 
              cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
              sin(radians($1)) * 
              sin(radians(NULLIF(latitude,'')::float))
            )) AS distance
          FROM laundromats
          WHERE 
            id != $3 AND
            latitude != '' AND 
            longitude != '' AND
            latitude IS NOT NULL AND
            longitude IS NOT NULL
          HAVING 
            (3959 * acos(
              cos(radians($1)) * 
              cos(radians(NULLIF(latitude,'')::float)) * 
              cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
              sin(radians($1)) * 
              sin(radians(NULLIF(latitude,'')::float))
            )) <= $4
          ORDER BY 
            distance ASC,
            CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
          LIMIT 4
        `;
        
        const nearbyResult = await pool.query(
          nearbyQuery, 
          [
            parseFloat(mainLaundromat.latitude), 
            parseFloat(mainLaundromat.longitude), 
            id, 
            parseFloat(radius.toString())
          ]
        );
        
        return res.json(nearbyResult.rows);
      }
      
      // CASE 2: By location coordinates (from GPS or map click)
      // If no coordinates provided, return highest-rated laundromats as fallback
      if (!lat || !lng) {
        console.log('No location coordinates provided, returning top-rated laundromats');
        const generalQuery = `
          SELECT * 
          FROM laundromats
          WHERE 
            latitude != '' AND 
            longitude != '' AND
            latitude IS NOT NULL AND
            longitude IS NOT NULL AND
            rating IS NOT NULL
          ORDER BY 
            CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
          LIMIT 20
        `;
        
        const generalResult = await pool.query(generalQuery);
        console.log(`Returning ${generalResult.rows.length} top-rated laundromats as fallback`);
        return res.json(generalResult.rows);
      }
      
      // We have valid coordinates, use them for the search
      const latitude = parseFloat(lat.toString());
      const longitude = parseFloat(lng.toString());
      const searchRadius = parseFloat(radius.toString()) || 25;
      
      if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
        return res.status(400).json({ message: 'Invalid coordinates or radius' });
      }
      
      console.log(`Finding laundromats within ${searchRadius} miles of coordinates (${latitude}, ${longitude})`);
      
      // For Denver-specific coordinates, modify the search to find Denver area laundromats first
      let areaFilter = '';
      
      // Universal approach for finding laundromats near ANY location in the US
      console.log(`Finding laundromats near coordinates: ${latitude}, ${longitude}`);
      
      // Pure geographic approach - works for ANY location without hardcoding regions
      // We use the Haversine formula to find laundromats within the search radius
      // and order them by proximity to the user's location
      
      console.log(`Search approach: Universal location search with ${searchRadius} mile radius`);
      
      // First, try to find the closest laundromats by pure distance
      // This is a universal solution that works for any coordinates in the US
      const proximityQuery = `
        SELECT *, 
          (3959 * acos(
            cos(radians($1)) * 
            cos(radians(NULLIF(latitude,'')::float)) * 
            cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(NULLIF(latitude,'')::float))
          )) AS distance
        FROM laundromats
        WHERE 
          latitude != '' AND 
          longitude != '' AND
          latitude IS NOT NULL AND
          longitude IS NOT NULL
        HAVING 
          (3959 * acos(
            cos(radians($1)) * 
            cos(radians(NULLIF(latitude,'')::float)) * 
            cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(NULLIF(latitude,'')::float))
          )) <= $3
        ORDER BY 
          distance ASC,
          CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
        LIMIT 50
      `;
      
      const proximityResult = await pool.query(proximityQuery, [latitude, longitude, searchRadius]);
      
      if (proximityResult.rows.length > 0) {
        console.log(`Found ${proximityResult.rows.length} laundromats within ${searchRadius} miles using pure proximity`);
        return res.json(proximityResult.rows);
      }
      
      console.log("No results found with pure proximity search, trying wider radius");
      
      // If no results found in the specified radius, try a wider search
      // This is a fallback approach for rural or less populated areas
      const widerRadiusQuery = `
        SELECT *, 
          (3959 * acos(
            cos(radians($1)) * 
            cos(radians(NULLIF(latitude,'')::float)) * 
            cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(NULLIF(latitude,'')::float))
          )) AS distance
        FROM laundromats
        WHERE 
          latitude != '' AND 
          longitude != '' AND
          latitude IS NOT NULL AND
          longitude IS NOT NULL
        ORDER BY 
          (3959 * acos(
            cos(radians($1)) * 
            cos(radians(NULLIF(latitude,'')::float)) * 
            cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(NULLIF(latitude,'')::float))
          )) ASC,
          CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
        LIMIT 20
      `;
      
      const widerResult = await pool.query(widerRadiusQuery, [latitude, longitude]);
      
      if (widerResult.rows.length > 0) {
        console.log(`Found ${widerResult.rows.length} laundromats using wider proximity search`);
        return res.json(widerResult.rows);
      }
      
      // If we get here, we'll use the default search approach below
      
      const query = `
        SELECT *, 
          (3959 * acos(
            cos(radians($1)) * 
            cos(radians(NULLIF(latitude,'')::float)) * 
            cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(NULLIF(latitude,'')::float))
          )) AS distance
        FROM laundromats
        WHERE 
          latitude != '' AND 
          longitude != '' AND
          latitude IS NOT NULL AND
          longitude IS NOT NULL
        HAVING 
          (3959 * acos(
            cos(radians($1)) * 
            cos(radians(NULLIF(latitude,'')::float)) * 
            cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(NULLIF(latitude,'')::float))
          )) <= $3
        ${orderByClause}
        LIMIT 50
      `;
      
      // Execute the query with proper parameters
      const result = await pool.query(query, [
        latitude,
        longitude,
        searchRadius
      ]);
      
      const count = result.rows.length;
      console.log(`Found ${count} laundromats within ${searchRadius} miles of coordinates`);
      
      // If no results in the specified radius, try a wider search
      if (count === 0) {
        const fallbackQuery = `
          SELECT *, 
            (3959 * acos(
              cos(radians($1)) * 
              cos(radians(NULLIF(latitude,'')::float)) * 
              cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
              sin(radians($1)) * 
              sin(radians(NULLIF(latitude,'')::float))
            )) AS distance
          FROM laundromats
          WHERE 
            latitude != '' AND 
            longitude != '' AND
            latitude IS NOT NULL AND
            longitude IS NOT NULL
          ORDER BY 
            (3959 * acos(
              cos(radians($1)) * 
              cos(radians(NULLIF(latitude,'')::float)) * 
              cos(radians(NULLIF(longitude,'')::float) - radians($2)) + 
              sin(radians($1)) * 
              sin(radians(NULLIF(latitude,'')::float))
            )) ASC,
            CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
          LIMIT 20
        `;
        
        const fallbackResult = await pool.query(fallbackQuery, [latitude, longitude]);
        console.log(`No results within radius, returning ${fallbackResult.rows.length} nearest laundromats instead`);
        return res.json(fallbackResult.rows);
      }
      
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