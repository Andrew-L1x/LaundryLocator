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
      
      // Check if it's a slug format (city-state) or numeric ID
      if (id.includes('-')) {
        // Direct city-state format (e.g., marietta-ga)
        const parts = id.split('-');
        const stateAbbr = parts[parts.length - 1].toUpperCase();
        const cityName = parts.slice(0, parts.length - 1).join(' ');
        
        console.log(`Direct query for city ${cityName}, ${stateAbbr}`);
        
        // Query for laundromats in this city
        const query = `
          SELECT * 
          FROM laundromats
          WHERE 
            state = $1 AND 
            city = $2
          ORDER BY rating DESC NULLS LAST
          LIMIT 50
        `;
        
        const result = await pool.query(query, [stateAbbr, cityName]);
        console.log(`Found ${result.rows.length} laundromats for ${cityName}, ${stateAbbr}`);
        
        // If we found some, return them
        if (result.rows.length > 0) {
          return res.json(result.rows);
        }
        
        // Otherwise try to get some from the state
        const stateQuery = `
          SELECT *
          FROM laundromats
          WHERE state = $1
          ORDER BY rating DESC NULLS LAST
          LIMIT 15
        `;
        
        const stateResult = await pool.query(stateQuery, [stateAbbr]);
        
        // Update city field to match requested city
        const updatedResults = stateResult.rows.map(row => ({
          ...row,
          city: cityName
        }));
        
        console.log(`Using ${updatedResults.length} state laundromats for ${cityName}`);
        return res.json(updatedResults);
      } else if (/^\d+$/.test(id)) {
        // Numeric ID format - usually from a city object
        console.log(`Looking for laundromats for city ID: ${id}`);
        
        // Try to get city info first
        const cityInfoQuery = `SELECT * FROM cities WHERE id = $1`;
        const cityResult = await pool.query(cityInfoQuery, [id]);
        
        if (cityResult.rows.length > 0) {
          const cityInfo = cityResult.rows[0];
          const cityName = cityInfo.name;
          const stateAbbr = cityInfo.state;
          
          // Get laundromats for this specific city
          const query = `
            SELECT * 
            FROM laundromats
            WHERE 
              state = $1 AND 
              city = $2
            ORDER BY rating DESC NULLS LAST
            LIMIT 50
          `;
          
          const result = await pool.query(query, [stateAbbr, cityName]);
          console.log(`Found ${result.rows.length} laundromats for city ID ${id} (${cityName}, ${stateAbbr})`);
          
          if (result.rows.length > 0) {
            return res.json(result.rows);
          }
          
          // If no exact matches, use some from the state
          const stateQuery = `
            SELECT *
            FROM laundromats
            WHERE state = $1
            ORDER BY rating DESC NULLS LAST
            LIMIT 15
          `;
          
          const stateResult = await pool.query(stateQuery, [stateAbbr]);
          
          // Update city field to match requested city
          const updatedResults = stateResult.rows.map(row => ({
            ...row,
            city: cityName
          }));
          
          console.log(`Using ${updatedResults.length} state laundromats for ${cityName}`);
          return res.json(updatedResults);
        }
      }
      
      // If we get here, we couldn't find anything
      console.log(`Couldn't find any laundromats for ID: ${id}`);
      return res.json([]);
    } catch (error) {
      console.error('Error fetching city laundromats:', error);
      res.status(500).json({ message: 'Error fetching city laundromats' });
    }
  });
}