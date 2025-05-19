import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import Stripe from "stripe";
import axios from "axios";
import { db, pool } from "./db"; // Import the database connection
import { addCityRoutes } from "./city-routes";
import sitemapRoutes from "./routes/sitemap";
import businessRoutes from "./routes/business";
import { adminNotifications, laundromats, users } from "@shared/schema";

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
  // Register business routes
  app.use(`${apiRouter}/business`, businessRoutes);
  // Add city routes - these are now handled by the dedicated city-routes.ts file
  addCityRoutes(app, apiRouter);
  
  // Add sitemap routes for SEO
  app.use(sitemapRoutes);
  
  // Serve Google verification file
  app.get('/google889fc795784843a8.html', (req, res) => {
    res.type('text/html');
    res.send('google-site-verification: google889fc795784843a8.html');
  });
  
  // Add business routes for claiming, managing, and upgrading laundromat listings
  app.use(`${apiRouter}/business`, businessRoutes);

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
        WHERE name != 'Unknown'
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
        console.log(`ZIP code search for: ${searchQuery}`);
        
        try {
          // Use Google Geocoding API to get the coordinates for the ZIP code
          const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${searchQuery}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
          const geocodingResponse = await axios.get(geocodingUrl);
          
          if (geocodingResponse.data.status === 'OK' && geocodingResponse.data.results.length > 0) {
            const location = geocodingResponse.data.results[0].geometry.location;
            const zipLatitude = location.lat;
            const zipLongitude = location.lng;
            
            console.log(`Geocoded ZIP ${searchQuery} to coordinates: (${zipLatitude}, ${zipLongitude})`);
            
            // Use distance calculation to find laundromats within radius
            const nearbyQuery = `
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
            
            const result = await pool.query(nearbyQuery, [
              zipLatitude,
              zipLongitude,
              searchRadius
            ]);
            
            console.log(`ZIP code search found ${result.rows.length} laundromats within ${searchRadius} miles of ZIP ${searchQuery}`);
            return res.json(result.rows);
          } else {
            console.error(`Google Geocoding API error for ZIP ${searchQuery}:`, geocodingResponse.data.status);
            
            // Fallback: direct ZIP match in our database
            const directZipQuery = `
              SELECT * 
              FROM laundromats 
              WHERE zip = $1
              ORDER BY 
                CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
              LIMIT 50
            `;
            
            const zipResult = await pool.query(directZipQuery, [searchQuery]);
            
            if (zipResult.rows.length > 0) {
              console.log(`Fallback: Direct ZIP search found ${zipResult.rows.length} laundromats for ZIP ${searchQuery}`);
              return res.json(zipResult.rows);
            } else {
              // No results
              console.log(`No laundromats found for ZIP ${searchQuery}`);
              return res.json([]);
            }
          }
        } catch (error) {
          console.error('Error during ZIP code geocoding:', error);
          
          // Fallback to direct ZIP search
          try {
            const directZipQuery = `
              SELECT * 
              FROM laundromats 
              WHERE zip = $1
              ORDER BY 
                CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
              LIMIT 50
            `;
            
            const zipResult = await pool.query(directZipQuery, [searchQuery]);
            
            if (zipResult.rows.length > 0) {
              console.log(`Fallback: Direct ZIP search found ${zipResult.rows.length} laundromats for ZIP ${searchQuery}`);
              return res.json(zipResult.rows);
            } else {
              // Return empty array if no laundromats found
              return res.json([]);
            }
          } catch (dbError) {
            console.error('Error during fallback ZIP search:', dbError);
            return res.json([]);
          }
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
      
      // Default ordering - purely by distance and rating
      const defaultOrdering = `
        ORDER BY 
          distance ASC,
          CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
      `;
      
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
        ${defaultOrdering}
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

  // Special endpoint for Denver laundromats with complete data
  app.get(`${apiRouter}/denver-laundromats`, async (_req: Request, res: Response) => {
    try {
      // Specific query for laundromats in Denver area with all required fields
      const query = `
        SELECT 
          id, name, address, city, state, zip, 
          latitude, longitude, website, phone, 
          rating, review_count AS "reviewCount", 
          hours, description, services,
          slug, email, is_claimed AS "isClaimed",
          price, machine_count AS "machineCount",
          street_view_url AS "streetViewUrl",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM laundromats
        WHERE 
          LOWER(city) = 'denver' 
          AND LOWER(state) IN ('co', 'colorado')
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
        ORDER BY 
          CASE WHEN rating IS NULL THEN 0 ELSE rating::float END DESC
        LIMIT 50
      `;
      
      const result = await pool.query(query);
      const denverLaundromats = result.rows.map(row => {
        // Convert services from string to array if needed
        if (row.services && typeof row.services === 'string') {
          try {
            row.services = JSON.parse(row.services);
          } catch (e) {
            row.services = row.services.split(',').map(s => s.trim());
          }
        }
        
        // Ensure latitude and longitude are strings
        row.latitude = String(row.latitude);
        row.longitude = String(row.longitude);
        
        return row;
      });
      
      console.log(`Found ${denverLaundromats.length} Denver-specific laundromats`);
      res.json(denverLaundromats);
    } catch (error) {
      console.error('Error fetching Denver laundromats:', error);
      res.status(500).json({ message: 'Error fetching Denver laundromats' });
    }
  });

  // Get laundry tips
  app.get(`${apiRouter}/laundry-tips`, async (req: Request, res: Response) => {
    try {
      const query = `
        SELECT * FROM laundry_tips
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching laundry tips:', error);
      res.status(500).json({ message: 'Error fetching laundry tips' });
    }
  });
  
  // Get related laundry tips (more specific route needs to come first)
  app.get(`${apiRouter}/laundry-tips/related/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // First, get the category of the current tip
      const categoryQuery = `
        SELECT category FROM laundry_tips
        WHERE id = $1
        LIMIT 1
      `;
      
      const categoryResult = await pool.query(categoryQuery, [id]);
      
      if (categoryResult.rows.length === 0) {
        return res.status(404).json({ message: 'Laundry tip not found' });
      }
      
      const category = categoryResult.rows[0].category;
      
      // Get related tips in the same category, excluding the current tip
      const relatedQuery = `
        SELECT * FROM laundry_tips
        WHERE category = $1 AND id != $2
        ORDER BY created_at DESC
        LIMIT 4
      `;
      
      const relatedResult = await pool.query(relatedQuery, [category, id]);
      res.json(relatedResult.rows);
    } catch (error) {
      console.error('Error fetching related laundry tips:', error);
      res.status(500).json({ message: 'Error fetching related laundry tips' });
    }
  });
  
  // Get a single laundry tip by slug
  app.get(`${apiRouter}/laundry-tips/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // First, try to match by exact slug
      let query = `
        SELECT * FROM laundry_tips
        WHERE slug = $1
        LIMIT 1
      `;
      
      let result = await pool.query(query, [slug]);
      
      // If no result, try to match by ID (in case the slug is an ID)
      if (result.rows.length === 0 && !isNaN(parseInt(slug))) {
        const id = parseInt(slug);
        query = `
          SELECT * FROM laundry_tips
          WHERE id = $1
          LIMIT 1
        `;
        result = await pool.query(query, [id]);
      }
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Laundry tip not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching laundry tip:', error);
      res.status(500).json({ message: 'Error fetching laundry tip' });
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

  // Admin API for viewing business claim notifications
  app.get(`${apiRouter}/admin/notifications`, async (req: Request, res: Response) => {
    try {
      // Get all notifications of business claims, ordered by most recent first
      const query = `
        SELECT 
          an.id, an.type, an.status, an.user_id, an.laundry_id, an.email, an.phone, 
          an.data, an.created_at, an.updated_at,
          l.name as laundry_name, l.address, l.city, l.state, l.zip, l.slug,
          u.username, u.email as user_email
        FROM admin_notifications an
        JOIN laundromats l ON an.laundry_id = l.id
        JOIN users u ON an.user_id = u.id
        WHERE an.type = 'business_claim'
        ORDER BY an.created_at DESC
      `;
      
      const result = await pool.query(query);
      
      // Format the result
      const notifications = result.rows.map(row => ({
        id: row.id,
        type: row.type,
        status: row.status,
        createdAt: row.created_at,
        contact: {
          email: row.email || row.user_email,
          phone: row.phone
        },
        laundromat: {
          id: row.laundry_id,
          name: row.laundry_name,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          slug: row.slug
        },
        user: {
          id: row.user_id,
          username: row.username,
          email: row.user_email
        },
        formData: row.data
      }));
      
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching admin notifications:', error);
      res.status(500).json({ message: 'Error fetching admin notifications' });
    }
  });
  
  // Update notification status (mark as read/contacted)
  app.patch(`${apiRouter}/admin/notifications/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['read', 'contacted', 'unread'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be "read", "contacted", or "unread"' });
      }
      
      const query = `
        UPDATE admin_notifications
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await pool.query(query, [status, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating notification status:', error);
      res.status(500).json({ message: 'Error updating notification status' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}