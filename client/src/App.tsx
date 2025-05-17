import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import Navbar from "@/components/Navbar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import SearchResults from "@/pages/SearchResults";
import NearbySearchResults from "@/pages/NearbySearchResults";
import MapSearchPage from "@/pages/MapSearchPage";
import LaundryDetail from "@/pages/LaundryDetail";
import CityPage from "@/pages/CityPage";
import StatePage from "@/pages/StatePage";
import LaundryTipsPage from "@/pages/LaundryTipsPage";
import LaundryTipDetail from "@/pages/LaundryTipDetail";
import AllStatesPage from "@/pages/AllStatesPage";
import BusinessDashboard from "@/pages/BusinessDashboard";
import ForOwnersPage from "@/pages/ForOwnersPage";
import LoginPage from "@/pages/LoginPage";
import AdminToolsPage from "@/pages/AdminToolsPage";
import AdminDataEnrichmentPage from "@/pages/AdminDataEnrichmentPage";
import AdminDataImportPage from "@/pages/AdminDataImportPage";
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
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/search" component={SearchResults} />
          <Route path="/nearby" component={NearbySearchResults} />
          <Route path="/map-search" component={MapSearchPage} />
          <Route path="/laundromat/:slug" component={LaundryDetail} />
          <Route path="/laundromats/:city" component={CityPage} />
          <Route path="/laundry-tips" component={LaundryTipsPage} />
          <Route path="/laundry-tips/:slug" component={LaundryTipDetail} />
          <Route path="/states" component={AllStatesPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/business/dashboard" component={BusinessDashboard} />
          <Route path="/for-owners" component={ForOwnersPage} />
          <Route path="/admin" component={AdminToolsPage} />
          <Route path="/admin/data-enrichment" component={AdminDataEnrichmentPage} />
          <Route path="/admin/data-import" component={AdminDataImportPage} />
          <Route path="/:state" component={StatePage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <footer className="bg-gray-50 border-t py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} LaundryLocator. All rights reserved.</p>
        </div>
      </footer>
    </div>
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
