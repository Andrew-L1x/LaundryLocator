import { Request, Response } from 'express';
import { storage } from './storage';
import { hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';

// In a real app, this would be in an environment variable
const JWT_SECRET = 'laundry-locator-jwt-secret';

// Register a new user
export async function registerUser(req: Request, res: Response) {
  try {
    const { username, email, password } = req.body;
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }
    
    // Hash the password
    const hashedPassword = await hash(password, 10);
    
    // Create the user
    const user = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      role: 'owner', // Default role for new users
    });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(201).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration'
    });
  }
}

// Login a user
export async function loginUser(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    
    // Find the user
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Verify password
    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Create JWT token
    const token = sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Fetch user's laundromats
    const userLaundromats = await storage.getLaundromatsForUser(user.id);
    
    return res.status(200).json({
      success: true,
      user: userWithoutPassword,
      laundromats: userLaundromats
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
}

// Demo login (for development purposes)
export async function demoLogin(req: Request, res: Response) {
  try {
    const { role } = req.body;
    
    // Create a demo user if it doesn't exist
    let user = await storage.getUserByUsername('demo');
    
    if (!user) {
      const hashedPassword = await hash('demopassword', 10);
      user = await storage.createUser({
        username: 'demo',
        email: 'demo@example.com',
        password: hashedPassword,
        role: role || 'owner',
      });

      // Create a demo laundromat for the user
      const laundromat = await storage.createLaundromat({
        name: 'Demo Laundromat',
        slug: 'demo-laundromat',
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '(415) 555-1234',
        website: 'https://demo-laundromat.com',
        latitude: '37.7749',
        longitude: '-122.4194',
        hours: 'Mon-Sun: 7am-10pm',
        services: ['Wash & Fold', 'Dry Cleaning', 'Self-Service'],
        description: 'A demo laundromat for testing purposes',
        imageUrl: null,
        reviewCount: 0,
        rating: null,
        isPremium: false,
        isFeatured: false,
        ownerId: user.id,
      });
    }
    
    // Create JWT token
    const token = sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Fetch user's laundromats
    const userLaundromats = await storage.getLaundromatsForUser(user.id);
    
    return res.status(200).json({
      success: true,
      user: userWithoutPassword,
      laundromats: userLaundromats,
      message: 'Demo login successful'
    });
  } catch (error) {
    console.error('Demo login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during demo login'
    });
  }
}

// Logout a user
export async function logoutUser(req: Request, res: Response) {
  res.clearCookie('token');
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}

// Get current user
export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    const user = await storage.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    // Fetch user's laundromats
    const userLaundromats = await storage.getLaundromatsForUser(user.id);
    
    return res.status(200).json({
      success: true,
      user: userWithoutPassword,
      laundromats: userLaundromats
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while getting current user'
    });
  }
}

// Authentication middleware
export function authenticate(req: Request, res: Response, next: Function) {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  try {
    const decoded = verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// Verify JWT token
function verify(token: string, secret: string): any {
  // Simple implementation for demo purposes
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}