import { Request, Response } from "express";

export const getPremiumLaundromats = async (_req: Request, res: Response) => {
  try {
    // Return an empty array - no premium laundromats
    const premiumLaundromats = [];
    
    console.log("Premium laundromats found:", premiumLaundromats.length);
    res.json(premiumLaundromats);
  } catch (error) {
    console.error("Error fetching premium laundromats:", error);
    res.status(500).json({ message: 'Error fetching premium laundromats' });
  }
};