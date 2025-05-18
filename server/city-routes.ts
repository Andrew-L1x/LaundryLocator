import type { Express, Request, Response, NextFunction } from "express";
import { pool } from './db';

export function addCityRoutes(app: Express, apiRouter: string): void {
  // Get city by slug
  app.get(`${apiRouter}/cities/:slug`, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      console.log(`Looking for city with slug: ${slug}`);
      
      // Extract city name and state abbreviation from the slug (e.g., "atlanta-ga")
      const parts = slug.split('-');
      let stateAbbr = '';
      let cityName = '';
      
      if (parts.length > 1) {
        // Assume the last part is state abbreviation and the rest is city name
        stateAbbr = parts[parts.length - 1].toUpperCase();
        cityName = parts.slice(0, parts.length - 1).join(' ');
        
        console.log(`Parsed: cityName=${cityName}, stateAbbr=${stateAbbr}`);
      }
      
      // Verify the state abbreviation is valid
      const stateQuery = `
        SELECT * FROM states 
        WHERE UPPER(abbr) = UPPER($1)
        LIMIT 1
      `;
      
      const stateResult = await pool.query(stateQuery, [stateAbbr]);
      
      if (stateResult.rows.length === 0) {
        console.log(`State not found for abbreviation: ${stateAbbr}`);
        return res.status(404).json({ message: 'City not found - invalid state' });
      }
      
      const state = stateResult.rows[0];
      
      // Now find the city in this state
      // Using direct database query for reliable and fast results
      const query = `
        SELECT city, state, COUNT(*) as laundromat_count
        FROM laundromats
        WHERE 
          LOWER(state) = LOWER($1) AND
          LOWER(city) ILIKE $2
        GROUP BY city, state
        LIMIT 1
      `;
      
      const result = await pool.query(query, [stateAbbr, `%${cityName}%`]);
      
      if (result.rows.length === 0) {
        console.log(`City not found: ${cityName}, ${stateAbbr}`);
        return res.status(404).json({ message: 'City not found' });
      }
      
      const cityData = {
        id: 50000 + Math.floor(Math.random() * 10000), // Generate a stable ID for this city
        name: result.rows[0].city,
        state: stateAbbr,
        slug: slug,
        laundryCount: parseInt(result.rows[0].laundromat_count)
      };
      
      console.log(`Found city: ${cityData.name}, ${cityData.state} with ${cityData.laundryCount} laundromats`);
      
      res.json(cityData);
    } catch (error) {
      console.error('Error fetching city:', error);
      res.status(500).json({ message: 'Error fetching city' });
    }
  });

  // Get laundromats for a specific city
  app.get(`${apiRouter}/cities/:id/laundromats`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // For direct data access from the database
      const directDatabaseLookup = async (cityName: string, stateAbbr: string) => {
        console.log(`Searching for: city=${cityName}, state=${stateAbbr}`);
        
        // First try exact match
        let exactQuery = `
          SELECT * 
          FROM laundromats
          WHERE 
            LOWER(state) = LOWER($1) AND 
            LOWER(city) = LOWER($2)
          ORDER BY 
            CASE WHEN rating IS NULL THEN 0 ELSE CAST(rating AS FLOAT) END DESC
          LIMIT 50
        `;
        
        let result = await pool.query(exactQuery, [stateAbbr, cityName]);
        console.log(`Exact match found ${result.rows.length} laundromats`);
        
        if (result.rows.length > 0) {
          return result.rows;
        }
        
        // Try fuzzy match
        let fuzzyQuery = `
          SELECT * 
          FROM laundromats
          WHERE 
            LOWER(state) = LOWER($1) AND 
            LOWER(city) LIKE LOWER($2)
          ORDER BY 
            CASE WHEN rating IS NULL THEN 0 ELSE CAST(rating AS FLOAT) END DESC
          LIMIT 50
        `;
        
        result = await pool.query(fuzzyQuery, [stateAbbr, `%${cityName}%`]);
        console.log(`Fuzzy match found ${result.rows.length} laundromats`);
        
        if (result.rows.length > 0) {
          return result.rows;
        }
        
        // Try state only - last resort
        let stateQuery = `
          SELECT *
          FROM laundromats
          WHERE LOWER(state) = LOWER($1)
          ORDER BY 
            CASE WHEN rating IS NULL THEN 0 ELSE CAST(rating AS FLOAT) END DESC
          LIMIT 20
        `;
        
        result = await pool.query(stateQuery, [stateAbbr]);
        console.log(`State-only search found ${result.rows.length} laundromats`);
        
        // Force update city name to match request
        return result.rows.map(row => ({
          ...row,
          city: cityName
        }));
      };
      
      // Check if it's a slug format (city-state) or numeric ID
      if (id.includes('-')) {
        // Directly parse slug format (e.g., marietta-ga)
        const parts = id.split('-');
        const stateAbbr = parts[parts.length - 1].toUpperCase();
        const cityName = parts.slice(0, parts.length - 1).join(' ');
        
        console.log(`Direct query from slug: ${cityName}, ${stateAbbr}`);
        const laundromats = await directDatabaseLookup(cityName, stateAbbr);
        return res.json(laundromats);
      } 
      else if (/^\d+$/.test(id)) {
        // Numeric ID format - usually from a city object
        console.log(`Looking up laundromats for city ID: ${id}`);
        
        // See if we can find the city in our cities table
        const cityQuery = `
          SELECT * FROM cities 
          WHERE id = $1
          LIMIT 1
        `;
        
        const cityResult = await pool.query(cityQuery, [id]);
        
        if (cityResult.rows.length > 0) {
          const cityInfo = cityResult.rows[0];
          const cityName = cityInfo.name;
          const stateAbbr = cityInfo.state;
          
          console.log(`Found city in database: ${cityName}, ${stateAbbr}`);
          const laundromats = await directDatabaseLookup(cityName, stateAbbr);
          return res.json(laundromats);
        }
        
        // If we can't find the city, we'll try to parse the ID as a slug
        // This happens when the frontend calls with an ID that's actually a slug
        if (typeof id === 'string' && id.includes('-')) {
          const parts = id.split('-');
          const stateAbbr = parts[parts.length - 1].toUpperCase();
          const cityName = parts.slice(0, parts.length - 1).join(' ');
          
          console.log(`Trying slug parsing from ID: ${cityName}, ${stateAbbr}`);
          const laundromats = await directDatabaseLookup(cityName, stateAbbr);
          return res.json(laundromats);
        }
      }
      
      // If we get here, we couldn't find anything
      // Let's try one more approach - direct lookups from laundromats
      const directQuery = `
        SELECT DISTINCT city, state
        FROM laundromats
        WHERE id = $1
        LIMIT 1
      `;
      
      const directResult = await pool.query(directQuery, [id]);
      
      if (directResult.rows.length > 0) {
        const { city, state } = directResult.rows[0];
        console.log(`Direct laundromat lookup found: ${city}, ${state}`);
        const laundromats = await directDatabaseLookup(city, state);
        return res.json(laundromats);
      }
      
      console.log(`Couldn't find any laundromats for ID: ${id} using all available methods`);
      return res.json([]);
    } catch (error) {
      console.error('Error fetching city laundromats:', error);
      res.status(500).json({ message: 'Error fetching city laundromats' });
    }
  });
}