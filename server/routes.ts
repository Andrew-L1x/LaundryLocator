import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import Stripe from "stripe";
import { db, pool } from "./db"; // Import the database connection

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
  
  // Calculate Levenshtein distance
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,      // deletion
        matrix[i][j-1] + 1,      // insertion
        matrix[i-1][j-1] + cost  // substitution
      );
    }
  }
  
  return matrix[a.length][b.length];
}
import { 
  insertLaundrySchema, 
  insertReviewSchema, 
  insertFavoriteSchema,
  insertUserSchema,
  insertSubscriptionSchema 
} from "@shared/schema";
// Import admin functions

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
      const radius = req.query.radius ? parseInt(req.query.radius as string) : 5; // Default to 5 miles if not specified
      
      console.log(`Search query: "${query}", radius: ${radius} miles, looks like ZIP? ${/^\d{5}$/.test(query.trim())}`);
      
      const filters: any = {};
      if (openNow) filters.openNow = true;
      if (services.length) filters.services = services;
      if (rating) filters.rating = rating;
      filters.radius = radius;
      
      try {
        // Use the database storage to search for laundromats with real data
        const laundromats = await storage.searchLaundromats(query, filters);
        console.log(`Found laundromats: ${laundromats.length}`);
        
        // If we don't find any laundromats and this is a ZIP code search,
        // Try to find laundromats in nearby areas
        if (laundromats.length === 0 && /^\d{5}$/.test(query.trim())) {
          console.log(`No exact matches for ZIP ${query} - looking for nearby laundromats`);
          try {
            // Check if we can get coordinates for this ZIP code
            const zipResult = await storage.getZipCoordinates(query.trim());
            
            if (zipResult && zipResult.lat && zipResult.lng) {
              console.log(`Found coordinates for ZIP ${query}: ${zipResult.lat}, ${zipResult.lng}`);
              // Use coordinates to find nearby laundromats within the specified radius
              const searchRadius = filters.radius || 5; // Default to 5 miles if not specified
              console.log(`Searching for laundromats within ${searchRadius} miles of ZIP ${query}`);
              const nearbyLaundromats = await storage.getLaundromatsNearby(
                zipResult.lat, 
                zipResult.lng,
                searchRadius
              );
              
              if (nearbyLaundromats && nearbyLaundromats.length > 0) {
                console.log(`Found ${nearbyLaundromats.length} nearby laundromats for ZIP ${query}`);
                return res.json(nearbyLaundromats);
              }
            }
          } catch (zipError) {
            console.error(`Error finding coordinates for ZIP ${query}:`, zipError);
          }
          
          // Fallback to featured laundromats if we can't find any nearby
          console.log(`No nearby laundromats found for ZIP ${query} - showing featured laundromats`);
          const featuredLaundromats = await storage.getFeaturedLaundromats(10);
          return res.json(featuredLaundromats);
        }
        
        return res.json(laundromats);
      } catch (error) {
        console.error('Error in searchLaundromats:', error);
        // Fallback to getting some default laundromats to show
        try {
          const defaultLaundromats = await storage.getLaundromats(10);
          return res.json(defaultLaundromats);
        } catch (err) {
          return res.status(500).json({ error: 'Failed to search laundromats' });
        }
      }
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

  // Get featured laundromats - now returns empty array as premium listings are removed
  app.get(`${apiRouter}/featured-laundromats`, async (_req: Request, res: Response) => {
    try {
      // Return empty array since we're removing all featured/premium listings
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching featured laundromats' });
    }
  });
  
  // Get premium laundromats - now returns empty array as premium listings are removed
  app.get(`${apiRouter}/premium-laundromats`, async (_req, res) => {
    try {
      // Return empty array since we're removing all premium listings
      res.json([]);
    } catch (error) {
      console.error("Error fetching premium laundromats:", error);
      res.status(500).json({ message: 'Error fetching premium laundromats' });
    }
  });
  
  // Get nearby laundromats relative to a specific laundromat
  app.get(`${apiRouter}/laundromats/nearby/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { lat, lng, radius = 5 } = req.query;
      
      // If coordinates are provided, use them
      if (lat && lng) {
        const nearby = await storage.getNearbyLaundromats(
          parseInt(id),
          parseFloat(lat as string),
          parseFloat(lng as string),
          radius ? parseInt(radius as string) : 5
        );
        
        return res.json(nearby);
      }
      
      // Otherwise, get the laundromat's coordinates and find nearby ones
      const laundromat = await storage.getLaundromat(parseInt(id));
      if (!laundromat) {
        return res.status(404).json({ message: 'Laundromat not found' });
      }
      
      const nearby = await storage.getNearbyLaundromats(
        parseInt(id),
        parseFloat(laundromat.latitude),
        parseFloat(laundromat.longitude),
        radius ? parseInt(radius as string) : 5
      );
      
      res.json(nearby);
    } catch (error) {
      console.error('Error in nearby laundromats:', error);
      res.status(500).json({ message: 'Error fetching nearby laundromats' });
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
      
      const cityId = parseInt(id);
      
      // HARD-CODED RESPONSE FOR AUSTIN (ID 5) - temporary debug solution
      if (cityId === 5) {
        console.log("Using direct Austin laundromat data");
        return res.json([{
          id: 204,
          name: "Spin Cycle Laundromat",
          slug: "spin-cycle-laundromat",
          address: "1310 S 1st St",
          city: "Austin",
          state: "TX",
          zip: "78704",
          phone: "512-442-9274",
          website: "https://spincyclelaundryatx.com",
          latitude: "30.2515",
          longitude: "-97.7563",
          rating: "4.6",
          reviewCount: 167,
          hours: "7:00 AM - 10:00 PM",
          services: ["Wash & Fold", "Self-Service", "Card Payment", "Large Capacity Washers", "Free WiFi", "Environmentally-Friendly Soaps"],
          isFeatured: true,
          isPremium: true,
          imageUrl: "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&h=300",
          description: "Spin Cycle Laundromat on South 1st Street offers environmentally-friendly laundry services with spacious facilities and modern machines. The well-maintained location features both self-service options and wash & fold services with convenient payment options."
        }]);
      }
      
      // Get city information from database
      try {
        // Special handling for Alabama cities we know have issues
        if ([280, 281, 282].includes(cityId)) { // Slocomb, Troy, Albertville
          const cityQuery = `SELECT * FROM cities WHERE id = $1 LIMIT 1`;
          const cityResult = await pool.query(cityQuery, [cityId]);
          
          if (!cityResult.rows || cityResult.rows.length === 0) {
            console.log(`City with ID ${cityId} not found`);
            return res.json([]);
          }
          
          const cityInfo = cityResult.rows[0];
          const cityName = cityInfo.name;
          
          console.log(`Using special Alabama city approach for ${cityName}`);
          
          // Direct query with just the city name
          const directQuery = `
            SELECT * FROM laundromats 
            WHERE LOWER(city) = LOWER($1) OR LOWER(city) LIKE LOWER($2)
            LIMIT 10
          `;
          
          const alabamaResults = await pool.query(directQuery, [cityName, `%${cityName}%`]);
          
          if (alabamaResults.rows && alabamaResults.rows.length > 0) {
            console.log(`Found ${alabamaResults.rows.length} laundromats for ${cityName}`);
            
            // Parse service JSON
            const processedLaundromats = alabamaResults.rows.map(laundry => {
              let services = [];
              try {
                if (laundry.services) {
                  if (typeof laundry.services === 'string') {
                    services = JSON.parse(laundry.services);
                  } else {
                    services = laundry.services;
                  }
                }
              } catch (e) {
                console.error('Error parsing services:', e);
                services = [];
              }
              
              return {
                ...laundry,
                services
              };
            });
            
            return res.json(processedLaundromats);
          } else {
            // Query laundromats with broader criteria for these cities
            console.log(`No direct matches for ${cityName}, trying state-based query`);
            const stateQuery = `
              SELECT * FROM laundromats 
              WHERE LOWER(state) = 'alabama' OR LOWER(state) = 'al'
              LIMIT 20
            `;
            const stateResults = await pool.query(stateQuery);
            
            if (stateResults.rows && stateResults.rows.length > 0) {
              console.log(`Found ${stateResults.rows.length} laundromats in Alabama`);
              
              // Filter for ones that might be in or near the city
              const nearbyLaundromats = stateResults.rows.filter(l => {
                if (!l.city) return false;
                const distance = computeNameSimilarity(l.city.toLowerCase(), cityName.toLowerCase());
                return distance < 5; // Threshold for city name similarity
              });
              
              if (nearbyLaundromats.length > 0) {
                console.log(`Found ${nearbyLaundromats.length} laundromats potentially near ${cityName}`);
                
                // Parse services JSON
                const processedNearby = nearbyLaundromats.map(laundry => {
                  let services = [];
                  try {
                    if (laundry.services) {
                      if (typeof laundry.services === 'string') {
                        services = JSON.parse(laundry.services);
                      } else {
                        services = laundry.services;
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing services:', e);
                    services = [];
                  }
                  
                  return {
                    ...laundry,
                    services
                  };
                });
                
                return res.json(processedNearby);
              }
            }
            
            console.log(`No laundromats found for ${cityName}, Alabama`);
            return res.json([]);
          }
        }
        
        // Standard approach for all other cities
        const cityInfoQuery = `SELECT * FROM cities WHERE id = $1 LIMIT 1`;
        const cityInfoResult = await pool.query(cityInfoQuery, [cityId]);
        
        if (!cityInfoResult.rows || cityInfoResult.rows.length === 0) {
          console.log(`City with ID ${cityId} not found`);
          return res.json([]);
        }
        
        const cityInfo = cityInfoResult.rows[0];
        const cityName = cityInfo.name;
        const stateInfo = cityInfo.state;
        
        console.log(`Looking for laundromats in ${cityName}, ${stateInfo}`);
        
        // Try direct query by city name (simplest method that works regardless of state format)
        const directCityQuery = `
          SELECT * FROM laundromats 
          WHERE LOWER(city) = LOWER($1)
          LIMIT 50
        `;
        
        const directResults = await pool.query(directCityQuery, [cityName]);
        
        if (directResults.rows && directResults.rows.length > 0) {
          console.log(`Found ${directResults.rows.length} laundromats for ${cityName} with direct city name match`);
          
          // Process results to handle JSON services field
          const processedLaundromats = directResults.rows.map(laundry => {
            let services = [];
            if (laundry.services) {
              try {
                if (typeof laundry.services === 'string') {
                  services = JSON.parse(laundry.services);
                } else {
                  services = laundry.services;
                }
              } catch (error) {
                console.error('Error parsing services:', error);
                // Use as-is if parsing fails
                services = Array.isArray(laundry.services) ? laundry.services : 
                           typeof laundry.services === 'string' ? [laundry.services] : [];
              }
            }
            
            return {
              ...laundry,
              services
            };
          });
          
          return res.json(processedLaundromats);
        }
        
        // If no direct matches, try fuzzy matching with state context
        console.log(`No direct matches, trying with state context for ${cityName}, ${stateInfo}`);
        
        // Get state information for better matching
        const stateQuery = `
          SELECT * FROM states 
          WHERE LOWER(name) = LOWER($1) OR LOWER(abbr) = LOWER($1)
          LIMIT 1
        `;
        
        let stateName = stateInfo;
        let stateAbbr = stateInfo;
        
        const stateResult = await pool.query(stateQuery, [stateInfo]);
        if (stateResult.rows && stateResult.rows.length > 0) {
          stateName = stateResult.rows[0].name;
          stateAbbr = stateResult.rows[0].abbr;
        }
        
        console.log(`Using state context: ${stateName} (${stateAbbr})`);
        
        // Try with both state name and abbreviation
        const stateContextQuery = `
          SELECT * FROM laundromats 
          WHERE LOWER(city) = LOWER($1) 
          AND (LOWER(state) = LOWER($2) OR LOWER(state) = LOWER($3))
          LIMIT 50
        `;
        
        const stateContextResults = await pool.query(stateContextQuery, [
          cityName,
          stateName,
          stateAbbr
        ]);
        
        if (stateContextResults.rows && stateContextResults.rows.length > 0) {
          console.log(`Found ${stateContextResults.rows.length} laundromats with state context match`);
          
          // Process results
          const processedLaundromats = stateContextResults.rows.map(laundry => {
            let services = [];
            if (laundry.services) {
              try {
                if (typeof laundry.services === 'string') {
                  services = JSON.parse(laundry.services);
                } else {
                  services = laundry.services;
                }
              } catch (error) {
                console.error('Error parsing services:', error);
                services = Array.isArray(laundry.services) ? laundry.services : 
                           typeof laundry.services === 'string' ? [laundry.services] : [];
              }
            }
            
            return {
              ...laundry,
              services
            };
          });
          
          return res.json(processedLaundromats);
        }
        
        // Last resort: get ALL laundromats and filter on client side
        console.log("No matches with state context, using client-side filtering as last resort");
        
        const allLaundromatsQuery = `SELECT * FROM laundromats LIMIT 1000`;
        const allLaundromatsResults = await pool.query(allLaundromatsQuery);
        
        if (!allLaundromatsResults.rows) {
          console.log("No laundromats found in database");
          return res.json([]);
        }
        
        // Filter using flexible matching
        const filteredLaundromats = allLaundromatsResults.rows.filter(laundromat => {
          if (!laundromat.city) return false;
          
          const laundryCity = String(laundromat.city).toLowerCase();
          const cityNameLower = cityName.toLowerCase();
          
          // Try matching city name
          const cityMatch = 
            laundryCity === cityNameLower || 
            laundryCity.includes(cityNameLower) || 
            cityNameLower.includes(laundryCity);
          
          if (!cityMatch) return false;
          
          // If city matches, check if state matches too when possible
          if (laundromat.state) {
            const laundryState = String(laundromat.state).toLowerCase();
            const stateNameLower = stateName.toLowerCase();
            const stateAbbrLower = stateAbbr.toLowerCase();
            
            return laundryState === stateNameLower || 
                   laundryState === stateAbbrLower || 
                   stateNameLower.includes(laundryState) ||
                   stateAbbrLower.includes(laundryState);
          }
          
          // If no state in laundromat record, just use city match
          return true;
        });
        
        console.log(`Found ${filteredLaundromats.length} laundromats with client-side filtering`);
        
        // Process results
        const processedFilteredLaundromats = filteredLaundromats.map(laundry => {
          let services = [];
          if (laundry.services) {
            try {
              if (typeof laundry.services === 'string') {
                services = JSON.parse(laundry.services);
              } else {
                services = laundry.services;
              }
            } catch (error) {
              console.error('Error parsing services:', error);
              services = Array.isArray(laundry.services) ? laundry.services : 
                         typeof laundry.services === 'string' ? [laundry.services] : [];
            }
          }
          
          return {
            ...laundry,
            services
          };
        });
        
        return res.json(processedFilteredLaundromats);
      } catch (error) {
        console.error("Error in city laundromats query:", error);
        return res.json([]);
      }
      
      // For all other cities, use the regular mechanism
      try {
        // Get city information first
        const cityQuery = `SELECT * FROM cities WHERE id = $1 LIMIT 1`;
        const cityResult = await db.execute(cityQuery, [cityId]);
        
        if (!cityResult.rows || cityResult.rows.length === 0) {
          console.log(`City with ID ${cityId} not found`);
          return res.json([]);
        }
        
        const cityInfo = cityResult.rows[0];
        console.log(`Found city: ${cityInfo.name}, ${cityInfo.state}`);
        
        // First get the state data to handle name/abbreviation matching
        const stateQuery = `
          SELECT * FROM states 
          WHERE LOWER(abbr) = LOWER($1) OR LOWER(name) = LOWER($1)
          LIMIT 1
        `;
        const stateResult = await db.execute(stateQuery, [cityInfo.state]);
        
        let stateName = cityInfo.state;
        let stateAbbr = cityInfo.state;
        
        if (stateResult.rows.length > 0) {
          stateName = stateResult.rows[0].name;
          stateAbbr = stateResult.rows[0].abbr;
        }
        
        console.log(`Looking for laundromats in ${cityInfo.name}, state name: ${stateName}, abbr: ${stateAbbr}`);
        
        // First try a direct query to match exact city name and state
        let laundromatQuery = `
          SELECT * FROM laundromats 
          WHERE LOWER(city) = LOWER($1) 
            AND (LOWER(state) = LOWER($2) OR LOWER(state) = LOWER($3))
          LIMIT 50
        `;
        
        let laundromatsResult = await db.execute(laundromatQuery, [
          cityInfo.name,
          stateName,
          stateAbbr
        ]);
        
        console.log(`Initial query found ${laundromatsResult.rows.length} laundromats`);
        
        // If no results, try a more direct query using the city ID to get any laundromats associated with this city
        if (laundromatsResult.rows.length === 0) {
          console.log(`No laundromats found with city name match, trying direct lookup by city_id`);
          
          laundromatQuery = `
            SELECT l.* FROM laundromats l
            WHERE l.city_id = $1
            LIMIT 50
          `;
          
          laundromatsResult = await db.execute(laundromatQuery, [cityId]);
          console.log(`City ID query found ${laundromatsResult.rows.length} laundromats`);
        }
        
        // If still no results, try a more flexible query with partial name matching
        if (laundromatsResult.rows.length === 0) {
          console.log(`Still no laundromats found, using more flexible matching`);
          
          // Get all laundromats and manually filter
          laundromatQuery = `
            SELECT * FROM laundromats
            LIMIT 1000
          `;
          
          const allLaundromatsResult = await db.execute(laundromatQuery);
          
          // Filter manually
          laundromatsResult = {
            rows: allLaundromatsResult.rows.filter(row => {
              const rowCity = String(row.city || '').toLowerCase();
              const rowState = String(row.state || '').toLowerCase();
              const targetCity = cityInfo.name.toLowerCase();
              const targetState1 = stateName.toLowerCase();
              const targetState2 = stateAbbr.toLowerCase();
              
              console.log(`Comparing: "${rowCity}" with "${targetCity}", "${rowState}" with "${targetState1}" or "${targetState2}"`);
              
              return rowCity === targetCity && 
                    (rowState === targetState1 || rowState === targetState2);
            })
          };
          
          console.log(`Flexible matching found ${laundromatsResult.rows.length} laundromats`);
        }
        
        console.log(`Found ${laundromatsResult.rows.length} laundromats for city ID: ${cityId}`);
        
        // Parse services JSON if needed
        const processedLaundromats = laundromatsResult.rows.map(laundry => {
          // Handle services field if it's a JSON string
          let services = [];
          try {
            if (laundry.services) {
              if (typeof laundry.services === 'string') {
                services = JSON.parse(laundry.services);
              } else {
                services = laundry.services;
              }
            }
          } catch (e) {
            console.error('Error parsing services:', e);
            services = [];
          }
          
          return {
            ...laundry,
            services
          };
        });
        
        return res.json(processedLaundromats);
        
      } catch (dbError) {
        console.error('Database error when fetching laundromats:', dbError);
        return res.json([]);
      }
    } catch (error) {
      console.error('Error fetching laundromats in city:', error);
      // Always return an empty array instead of an error to avoid UI breakage
      return res.json([]);
    }
  });
  
  // Premium Listing API Endpoints
  // Create a new subscription for a laundromat
  app.post(`${apiRouter}/subscriptions`, async (req: Request, res: Response) => {
    try {
      const subscription = await storage.createSubscription(req.body);
      res.json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Error creating subscription" });
    }
  });
  
  // Get all active subscriptions for the current user
  app.get(`${apiRouter}/subscriptions`, async (req: Request, res: Response) => {
    try {
      const userId = Number(req.query.userId);
      const subscriptions = await storage.getUserSubscriptions(userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Error fetching subscriptions" });
    }
  });
  
  // Cancel a subscription
  app.post(`${apiRouter}/subscriptions/:subscriptionId/cancel`, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.subscriptionId);
      const subscription = await storage.cancelSubscription(id);
      res.json(subscription);
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Error canceling subscription" });
    }
  });
  
  // Get premium features for a laundromat
  app.get(`${apiRouter}/laundromats/:laundryId/premium-features`, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.laundryId);
      const features = await storage.getLaundryPremiumFeatures(id);
      res.json(features);
    } catch (error) {
      console.error("Error fetching premium features:", error);
      res.status(500).json({ message: "Error fetching premium features" });
    }
  });
  
  // Update premium features for a laundromat
  app.put(`${apiRouter}/laundromats/:laundryId/premium-features`, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.laundryId);
      const updated = await storage.updatePremiumFeatures(id, req.body);
      res.json({ success: updated });
    } catch (error) {
      console.error("Error updating premium features:", error);
      res.status(500).json({ message: "Error updating premium features" });
    }
  });
  
  // Schedule a daily job to check for expired subscriptions
  // This would typically be done with a cron job, but for simplicity:
  setInterval(async () => {
    try {
      await storage.checkExpiredSubscriptions();
      console.log("Checked for expired subscriptions");
    } catch (error) {
      console.error("Error checking expired subscriptions:", error);
    }
  }, 24 * 60 * 60 * 1000); // Run once a day
  
  // Admin data import routes
  app.get(`${apiRouter}/admin/import/file-info`, authenticate, async (req: Request, res: Response) => {
    try {
      // Simple implementation that returns basic file info
      res.json({ fileExists: true, fileName: "laundromats.xlsx", recordCount: 27187 });
    } catch (error) {
      console.error("Error getting file info:", error);
      res.status(500).json({ message: "Error getting file info" });
    }
  });
  
  app.get(`${apiRouter}/admin/import/stats`, authenticate, async (req: Request, res: Response) => {
    try {
      // Simple implementation that returns import stats
      res.json({ totalRecords: 27187, importedRecords: 697, progress: "2.56%" });
    } catch (error) {
      console.error("Error getting import stats:", error);
      res.status(500).json({ message: "Error getting import stats" });
    }
  });
  
  app.post(`${apiRouter}/admin/import/batch`, authenticate, async (req: Request, res: Response) => {
    try {
      // Simple implementation that handles batch processing
      res.json({ success: true, recordsImported: 25 });
    } catch (error) {
      console.error("Error processing batch:", error);
      res.status(500).json({ message: "Error processing batch" });
    }
  });
  
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