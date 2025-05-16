import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MetaTags from "@/components/MetaTags";
import { useEffect } from "react";

export default function NotFound() {
  // Set HTTP status code to 404
  useEffect(() => {
    // This is a client-side effect and doesn't actually set the HTTP status
    // In a real application with server-side rendering, we would set the status code there
    document.title = "Page Not Found | Laundromat Directory";
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MetaTags 
        pageType="home"
        title="Page Not Found | Laundromat Directory"
        description="Sorry, we couldn't find the page you were looking for. Browse our laundromat directory to find locations near you."
        canonicalUrl="/404"
      />
      
      <Header />
      
      <main className="flex-grow flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-6 px-6 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Page Not Found</h1>
            </div>

            <p className="text-gray-600 mb-8">
              Sorry, the page you're looking for doesn't exist or has been moved.
              Please try one of the options below:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/" className="flex items-center justify-center gap-2 bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                <Home className="h-4 w-4" />
                Return to Home
              </Link>
              
              <Link href="/search" className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                <Search className="h-4 w-4" />
                Search for Laundromats
              </Link>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="font-semibold text-gray-800 mb-3">Popular Pages</h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <li>
                  <Link href="/ca" className="text-primary hover:underline">Laundromats in California</Link>
                </li>
                <li>
                  <Link href="/ny" className="text-primary hover:underline">Laundromats in New York</Link>
                </li>
                <li>
                  <Link href="/tx" className="text-primary hover:underline">Laundromats in Texas</Link>
                </li>
                <li>
                  <Link href="/laundromats/san-francisco-ca" className="text-primary hover:underline">San Francisco Laundromats</Link>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}
