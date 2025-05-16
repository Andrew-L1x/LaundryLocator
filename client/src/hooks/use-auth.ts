import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Types for auth responses
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  isBusinessOwner: boolean;
  role: string;
}

export interface Laundromat {
  id: number;
  name: string;
  slug: string;
  [key: string]: any; // For other properties
}

export interface AuthResponse {
  success: boolean;
  user: AuthUser;
  laundromats?: Laundromat[];
}

// Check if the user is currently authenticated
export function useCurrentUser() {
  return useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

// Login function
export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      return response.json() as Promise<AuthResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });
}

// Register function
export function useRegister() {
  return useMutation({
    mutationFn: async (userData: { 
      username: string; 
      email: string; 
      password: string; 
      isBusinessOwner: boolean;
      role: string;
    }) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }
      
      return response.json() as Promise<{ success: boolean; user: AuthUser }>;
    }
  });
}

// Logout function
export function useLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      // Clear any user-specific cache data
      queryClient.clear();
    },
  });
}

// Demo login for testing
export function useDemoLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userType: 'user' | 'owner') => {
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userType }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Demo login failed');
      }
      
      return response.json() as Promise<AuthResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });
}