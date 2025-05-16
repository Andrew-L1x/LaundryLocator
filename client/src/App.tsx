import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import SearchResults from "@/pages/SearchResults";
import LaundryDetail from "@/pages/LaundryDetail";
import CityPage from "@/pages/CityPage";
import StatePage from "@/pages/StatePage";
import LaundryTipsPage from "@/pages/LaundryTipsPage";
import LaundryTipDetail from "@/pages/LaundryTipDetail";
import AllStatesPage from "@/pages/AllStatesPage";
import BusinessDashboard from "@/pages/BusinessDashboard";
import ForOwnersPage from "@/pages/ForOwnersPage";
import LoginPage from "@/pages/LoginPage";
import { useEffect } from "react";

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/src/components/ServiceWorker.ts')
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

function Router() {
  // Handle URL parameters for deep linking
  useEffect(() => {
    const handleLocationChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const locationParam = urlParams.get('location');
      
      if (locationParam) {
        localStorage.setItem('lastSearchLocation', locationParam);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);
  
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchResults} />
      <Route path="/laundromat/:slug" component={LaundryDetail} />
      <Route path="/laundromats/:city" component={CityPage} />
      <Route path="/laundry-tips" component={LaundryTipsPage} />
      <Route path="/laundry-tips/:slug" component={LaundryTipDetail} />
      <Route path="/states" component={AllStatesPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/business/:id" component={BusinessDashboard} />
      <Route path="/for-owners" component={ForOwnersPage} />
      <Route path="/:state" component={StatePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
