import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import Navbar from "@/components/Navbar";
import ScrollToTop from "@/components/ScrollToTop";
import NotFound from "@/pages/not-found";
import Home from "@/pages/HomeFinal";
import SearchResults from "@/pages/SearchResults";
import NearbySearchResults from "@/pages/NearbySearchResults";
import LaundryDetail from "@/pages/LaundryDetail";
import CityPage from "@/pages/CityPage";
import StatePage from "@/pages/StatePage";
import LaundryTipsPage from "@/pages/LaundryTipsPage";
import LaundryTipDetail from "@/pages/LaundryTipDetail";
import AllStatesPage from "@/pages/AllStatesPage";
import BusinessDashboardPage from "@/pages/BusinessDashboardPage";
import BusinessSearchPage from "@/pages/BusinessSearchPage";
import BusinessClaimPage from "@/pages/BusinessClaimPage";
import BusinessSubscriptionPage from "@/pages/BusinessSubscriptionPage";
import AddBusinessPage from "@/pages/AddBusinessPage";
import ForOwnersPage from "@/pages/ForOwnersPage";
import LoginPage from "@/pages/LoginPage";
import AdminToolsPage from "@/pages/AdminToolsPage";
import AdminDataEnrichmentPage from "@/pages/AdminDataEnrichmentPage";
import AdminDataImportPage from "@/pages/AdminDataImportPage";
import AdminBatchImportPage from "@/pages/AdminBatchImportPage";
import AdminDashboard from "@/pages/AdminDashboard";
import { useEffect } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/useAnalytics";

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
  // Track page views when routes change
  useAnalytics();
  
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
  
  // Redirect any map-search URLs to the search page
  useEffect(() => {
    if (window.location.pathname === '/map-search') {
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get('q');
      
      if (query) {
        window.location.href = `/search?q=${query}`;
      } else {
        window.location.href = '/search';
      }
    }
  }, []);
  
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {/* ScrollToTop component will handle scrolling to top on every route change */}
      <ScrollToTop />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/search" component={SearchResults} />
          <Route path="/nearby" component={NearbySearchResults} />
          <Route path="/laundromat/:slug" component={LaundryDetail} />
          <Route path="/states" component={AllStatesPage} />
          <Route path="/cities/:city" component={CityPage} />
          <Route path="/laundromats/:city" component={CityPage} />
          <Route path="/laundry-tips" component={LaundryTipsPage} />
          <Route path="/laundry-tips/:slug" component={LaundryTipDetail} />
          <Route path="/login" component={LoginPage} />
          <Route path="/business/dashboard" component={BusinessDashboardPage} />
          <Route path="/business/search" component={BusinessSearchPage} />
          <Route path="/business/claim/:id" component={BusinessClaimPage} />
          <Route path="/business/subscription/:id" component={BusinessSubscriptionPage} />
          <Route path="/business/add" component={AddBusinessPage} />
          <Route path="/for-owners" component={ForOwnersPage} />
          <Route path="/admin" component={AdminToolsPage} />
          <Route path="/admin/data-enrichment" component={AdminDataEnrichmentPage} />
          <Route path="/admin/data-import" component={AdminDataImportPage} />
          <Route path="/admin/batch-import" component={AdminBatchImportPage} />
          <Route path="/admin/notifications" component={AdminDashboard} />
          {/* State routes - support both formats */}
          <Route path="/states/:state" component={StatePage} />
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
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

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
