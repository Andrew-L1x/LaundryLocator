import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const BeverlyHills90210: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // This is a special redirect page that forces a specific view for 90210
  useEffect(() => {
    // We specifically want to force a hard navigation
    toast({
      title: 'Searching Beverly Hills',
      description: 'Showing laundromats in Beverly Hills, CA (90210)',
    });
    
    setTimeout(() => {
      // Redirect to hardcoded Beverly Hills search view
      window.location.href = '/beverly-hills-90210-view';
    }, 500);
  }, [toast]);

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h2 className="text-xl font-medium">Loading Beverly Hills Laundromats...</h2>
      <p className="text-gray-500 mt-2">Redirecting to show laundromats in 90210</p>
    </div>
  );
};

export default BeverlyHills90210;