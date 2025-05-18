import { Request, Response } from 'express';
import { pool } from '../db';

export async function getLaundromatsNearby(req: Request, res: Response) {
  try {
    const { 
      lat, 
      lng, 
      radius = 10
    } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    // Convert to numbers and validate
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const searchRadius = parseFloat(radius as string);
    
    if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
      return res.status(400).json({ message: 'Invalid coordinates or radius' });
    }
    
    console.log(`Searching for laundromats near (${latitude}, ${longitude}) within ${searchRadius} miles`);
    
    // Using the Haversine formula to calculate distances
    const query = `
      SELECT *, 
      (
        3959 * acos(
          cos(radians($1)) * 
          cos(radians(CAST(latitude AS FLOAT))) * 
          cos(radians(CAST(longitude AS FLOAT)) - radians($2)) + 
          sin(radians($1)) * 
          sin(radians(CAST(latitude AS FLOAT)))
        )
      ) AS distance 
      FROM laundromats
      WHERE 
        latitude IS NOT NULL AND latitude != '' AND 
        longitude IS NOT NULL AND longitude != ''
      HAVING distance < $3
      ORDER BY distance
      LIMIT 20
    `;
    
    const result = await pool.query(query, [latitude, longitude, searchRadius]);
    
    if (result.rows.length === 0) {
      console.log(`No laundromats found within ${searchRadius} miles of coordinates (${latitude}, ${longitude})`);
      
      // If no results, try a wider radius
      const expandedQuery = `
        SELECT *, 
        (
          3959 * acos(
            cos(radians($1)) * 
            cos(radians(CAST(latitude AS FLOAT))) * 
            cos(radians(CAST(longitude AS FLOAT)) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(CAST(latitude AS FLOAT)))
          )
        ) AS distance 
        FROM laundromats
        WHERE 
          latitude IS NOT NULL AND latitude != '' AND 
          longitude IS NOT NULL AND longitude != ''
        HAVING distance < $3
        ORDER BY distance
        LIMIT 20
      `;
      
      const expandedResult = await pool.query(expandedQuery, [latitude, longitude, searchRadius * 3]);
      
      if (expandedResult.rows.length === 0) {
        // If still no results, fall back to getting closest laundromats overall regardless of distance
        const fallbackQuery = `
          SELECT *, 
          (
            3959 * acos(
              cos(radians($1)) * 
              cos(radians(CAST(latitude AS FLOAT))) * 
              cos(radians(CAST(longitude AS FLOAT)) - radians($2)) + 
              sin(radians($1)) * 
              sin(radians(CAST(latitude AS FLOAT)))
            )
          ) AS distance 
          FROM laundromats
          WHERE 
            latitude IS NOT NULL AND latitude != '' AND 
            longitude IS NOT NULL AND longitude != ''
          ORDER BY distance
          LIMIT 20
        `;
        
        const fallbackResult = await pool.query(fallbackQuery, [latitude, longitude]);
        console.log(`Found ${fallbackResult.rows.length} fallback laundromats sorted by distance`);
        return res.json(fallbackResult.rows);
      }
      
      console.log(`Found ${expandedResult.rows.length} laundromats with expanded radius search`);
      return res.json(expandedResult.rows);
    }
    
    console.log(`Found ${result.rows.length} laundromats near (${latitude}, ${longitude}) within ${searchRadius} miles`);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error in /api/laundromats/nearby:', error);
    res.status(500).json({ message: 'Failed to find nearby laundromats' });
  }
}