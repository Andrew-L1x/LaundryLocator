import { Request, Response } from "express";

export const getPremiumLaundromats = async (_req: Request, res: Response) => {
  try {
    // Hardcoded premium laundromats for display
    const premiumLaundromats = [
      {
        id: 101,
        name: "K C Coin Laundry",
        slug: "k-c-coin-laundry-killeen-tx",
        address: "512 W Rancier Ave",
        city: "Killeen",
        state: "Texas",
        zip: "76541",
        phone: "(254) 526-8975",
        rating: "4.2",
        image_url: "https://maps.googleapis.com/maps/api/streetview?size=600x400&location=512+W+Rancier+Ave,Killeen,TX&key=" + process.env.GOOGLE_MAPS_API_KEY,
        hours: "Monday-Sunday: 8:00AM-8:00PM",
        promotional_text: "SPECIAL OFFER: 20% off on all wash loads on Tuesdays! Modern machines, free WiFi.",
        services: ["Self-service laundry", "Coin-operated washing machines", "High-capacity dryers", "Vending machines", "Change machine"],
        is_premium: true,
        listing_type: "premium",
        verified: true,
        subscription_active: true,
        subscription_status: "active",
        website: "https://kclaundry.com",
        latitude: "31.0982",
        longitude: "-97.7392"
      },
      {
        id: 103,
        name: "Coin Laundry",
        slug: "coin-laundry-killeen-tx",
        address: "4001 Watercrest Rd",
        city: "Killeen",
        state: "Texas",
        zip: "76543",
        phone: "(254) 220-4031",
        rating: "4.3",
        image_url: "https://maps.googleapis.com/maps/api/streetview?size=600x400&location=4001+Watercrest+Rd,Killeen,TX&key=" + process.env.GOOGLE_MAPS_API_KEY,
        hours: "Monday-Sunday: 8:00AM-8:00PM",
        promotional_text: "MONTHLY MEMBERSHIP: Join our Wash Club for unlimited washes at $49.99/month.",
        services: ["Self-service laundry", "Coin-operated washing machines", "High-capacity dryers", "Vending machines", "Change machine"],
        is_premium: true,
        listing_type: "premium",
        verified: true,
        subscription_active: true,
        subscription_status: "active",
        website: "https://coinlaundry.com",
        latitude: "31.0654",
        longitude: "-97.7218"
      },
      {
        id: 342,
        name: "Wash & Press",
        slug: "wash-press-killeen-tx",
        address: "4202 Westcliff Rd",
        city: "Killeen",
        state: "Texas",
        zip: "76541",
        phone: "(254) 415-7433",
        rating: "4.5",
        image_url: "https://maps.googleapis.com/maps/api/streetview?size=600x400&location=4202+Westcliff+Rd,Killeen,TX&key=" + process.env.GOOGLE_MAPS_API_KEY,
        hours: "Monday-Sunday: 8:00AM-8:00PM",
        promotional_text: "PREMIUM AMENITIES: Free detergent on your first visit! Clean facility with security.",
        services: ["Self-service laundry", "Coin-operated washing machines", "High-capacity dryers", "Vending machines", "Change machine"],
        is_premium: true,
        listing_type: "premium",
        verified: true,
        subscription_active: true,
        subscription_status: "active",
        website: "https://washandpress.com",
        latitude: "31.1156",
        longitude: "-97.7326"
      },
      {
        id: 515,
        name: "Joy Wash & Dry",
        slug: "joy-wash-dry-euless-tx",
        address: "123 Main St",
        city: "Euless",
        state: "Texas",
        zip: "76039",
        phone: "(817) 555-1234",
        rating: "4.4",
        image_url: "https://maps.googleapis.com/maps/api/streetview?size=600x400&location=123+Main+St,Euless,TX&key=" + process.env.GOOGLE_MAPS_API_KEY,
        hours: "Monday-Sunday: 7:00AM-9:00PM",
        promotional_text: "NEWLY RENOVATED! Comfortable waiting area with free coffee and fast WiFi.",
        services: ["Self-service laundry", "Coin-operated washing machines", "High-capacity dryers", "Vending machines", "Change machine", "Free WiFi"],
        is_premium: true,
        listing_type: "premium",
        verified: true,
        subscription_active: true,
        subscription_status: "active",
        website: "https://joywashanddry.com",
        latitude: "32.8373",
        longitude: "-97.0860"
      }
    ];
    
    console.log("Premium laundromats found:", premiumLaundromats.length);
    res.json(premiumLaundromats);
  } catch (error) {
    console.error("Error fetching premium laundromats:", error);
    res.status(500).json({ message: 'Error fetching premium laundromats' });
  }
};