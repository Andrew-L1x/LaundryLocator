import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  isBusinessOwner: boolean;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

/**
 * Hook to fetch the current authenticated user
 */
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ['/api/auth/me'],
    refetchOnWindowFocus: false,
    retry: false,
    onError: () => {
      // Silently fail as the user might not be logged in
    }
  });
}

/**
 * Hook to handle user login
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  
  const mutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      try {
        const response = await apiRequest('/api/auth/login', {
          method: 'POST',
          data: credentials
        });
        setError(null);
        return response as User;
      } catch (err: any) {
        setError(new Error(err.message || 'Login failed'));
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    }
  });
  
  return { 
    ...mutation,
    error
  };
}

/**
 * Hook to handle user registration
 */
export function useRegister() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  
  const mutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      try {
        const response = await apiRequest('/api/auth/register', {
          method: 'POST',
          data
        });
        setError(null);
        return response as User;
      } catch (err: any) {
        setError(new Error(err.message || 'Registration failed'));
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    }
  });
  
  return { 
    ...mutation,
    error
  };
}

/**
 * Hook to handle demo login for testing
 */
export function useDemoLogin() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  
  const mutation = useMutation({
    mutationFn: async (userType: 'user' | 'owner' | 'admin' = 'user') => {
      try {
        const response = await apiRequest('/api/auth/demo-login', {
          method: 'POST',
          data: { userType }
        });
        setError(null);
        return response as User;
      } catch (err: any) {
        setError(new Error(err.message || 'Demo login failed'));
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    }
  });
  
  return { 
    ...mutation,
    error
  };
}

/**
 * Hook to handle user logout
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  
  const mutation = useMutation({
    mutationFn: async () => {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST'
        });
        setError(null);
      } catch (err: any) {
        setError(new Error(err.message || 'Logout failed'));
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    }
  });
  
  return { 
    ...mutation,
    error
  };
}

/**
 * Original all-in-one hook for backward compatibility
 */
export function useAuth() {
  const { data: user, isLoading } = useCurrentUser();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const demoLoginMutation = useDemoLogin();
  
  const login = async (username: string, password: string): Promise<User> => {
    return await loginMutation.mutateAsync({ username, password });
  };
  
  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };
  
  const demoLogin = async (): Promise<User> => {
    return await demoLoginMutation.mutateAsync();
  };
  
  return {
    user: user || null,
    isLoading,
    error: loginMutation.error || logoutMutation.error || demoLoginMutation.error,
    login,
    logout,
    demoLogin
  };
}