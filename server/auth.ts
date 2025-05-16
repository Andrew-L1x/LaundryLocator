import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { type InsertUser } from '@shared/schema';

// Secret for JWT signing - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'laundromat-directory-secret-key';
const JWT_EXPIRY = '7d'; // Token expires in 7 days

/**
 * Register a new user
 */
export async function registerUser(req: Request, res: Response) {
  try {
    const { username, email, password, isBusinessOwner = false, role = 'user' } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, email and password are required' 
      });
    }
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user in database
    const userData: InsertUser = {
      username,
      email,
      password: hashedPassword,
      isBusinessOwner: !!isBusinessOwner,
      role: role || 'user'
    };
    
    const newUser = await storage.createUser(userData);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set JWT as cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Return success with user data (excluding password)
    const { password: _, ...userWithoutPassword } = newUser;
    return res.status(201).json({ 
      success: true, 
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error registering user' 
    });
  }
}

/**
 * Login user
 */
export async function loginUser(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    
    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }
    
    // Find user by username
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set JWT as cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Get user's laundromats if they are a business owner
    let laundromats = [];
    if (user.isBusinessOwner) {
      laundromats = await storage.getLaundromatsForUser(user.id);
    }
    
    // Return success with user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      user: userWithoutPassword,
      laundromats
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error logging in' 
    });
  }
}

/**
 * Demo login - for testing purposes
 */
export async function demoLogin(req: Request, res: Response) {
  try {
    const { userType } = req.body;
    
    // Determine which demo user to login as
    const username = userType === 'owner' ? 'demo_owner' : 'demo_user';
    
    // Check if demo user exists, create if not
    let user = await storage.getUserByUsername(username);
    
    if (!user) {
      // Create demo user
      const password = await bcrypt.hash('demo123', 10);
      const userData: InsertUser = {
        username,
        email: `${username}@example.com`,
        password,
        isBusinessOwner: userType === 'owner',
        role: userType === 'owner' ? 'business_owner' : 'user'
      };
      
      user = await storage.createUser(userData);
      
      // If business owner, create a sample laundromat
      if (userType === 'owner') {
        await storage.createLaundromat({
          name: 'Demo Laundromat',
          slug: 'demo-laundromat',
          address: '123 Demo Street',
          city: 'Demo City',
          state: 'CA',
          zip: '12345',
          phone: '(555) 555-5555',
          latitude: '37.7749',
          longitude: '-122.4194',
          hours: 'Mon-Sun: 6am-10pm',
          services: ['Self-Service', 'Wi-Fi', 'Card Payment'],
          rating: '4.5',
          reviewCount: 10,
          description: 'This is a demo laundromat for testing.',
          imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f',
          website: 'https://demo-laundromat.example.com',
          ownerId: user.id
        });
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    // Set JWT as cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // Get user's laundromats if they are a business owner
    let laundromats = [];
    if (user.isBusinessOwner) {
      laundromats = await storage.getLaundromatsForUser(user.id);
    }
    
    // Return success with user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      user: userWithoutPassword,
      laundromats
    });
  } catch (error) {
    console.error('Error in demoLogin:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error with demo login' 
    });
  }
}

/**
 * Logout user
 */
export async function logoutUser(req: Request, res: Response) {
  // Clear the auth cookie
  res.clearCookie('auth_token');
  
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(req: Request, res: Response) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    // Get full user data
    const user = await storage.getUser(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's laundromats if they are a business owner
    let laundromats = [];
    if (user.isBusinessOwner) {
      laundromats = await storage.getLaundromatsForUser(user.id);
    }
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      user: userWithoutPassword,
      laundromats
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving user data'
    });
  }
}

/**
 * Middleware to authenticate requests
 */
export function authenticate(req: Request, res: Response, next: Function) {
  try {
    // Get token from cookies
    const token = req.cookies.auth_token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Verify the token
    const decoded = verify(token, JWT_SECRET);
    
    // Add the user data to the request object
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

// Helper to verify JWT token
function verify(token: string, secret: string): any {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Extend the Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    }
  }
}