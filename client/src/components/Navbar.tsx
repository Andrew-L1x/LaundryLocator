import { Link, useLocation } from 'wouter';
import { useCurrentUser, useLogout } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  MapPin, 
  User, 
  LogOut, 
  Building, 
  LogIn, 
  UserPlus,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function Navbar() {
  const [, navigate] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { toast } = useToast();
  const { data: userData, isLoading } = useCurrentUser();
  const logout = useLogout();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error logging out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-primary flex items-center">
            <MapPin className="mr-1" />
            LaundryLocator
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/search" className="text-gray-600 hover:text-primary flex items-center">
              <Search className="w-4 h-4 mr-1" />
              Find Laundromats
            </Link>
            <Link href="/states" className="text-gray-600 hover:text-primary">
              Browse by State
            </Link>
            <Link href="/laundry-tips" className="text-gray-600 hover:text-primary">
              Laundry Tips
            </Link>
            <Link href="/for-owners" className="text-gray-600 hover:text-primary">
              For Owners
            </Link>
          </nav>

          {/* User Section */}
          <div className="hidden md:block">
            {isLoading ? (
              <div className="h-9 w-20 bg-gray-100 rounded-md animate-pulse"></div>
            ) : userData && userData.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    {userData.user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {userData.user.isBusinessOwner && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/business/dashboard')}>
                        <Building className="w-4 h-4 mr-2" />
                        Business Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {userData.user.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Building className="w-4 h-4 mr-2" />
                        Admin Tools
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  <LogIn className="w-4 h-4 mr-1" />
                  Login
                </Button>
                <Button onClick={() => navigate('/login?tab=register')} size="sm">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Sign Up
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-gray-500 hover:text-primary" 
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pt-4 pb-2">
            <nav className="flex flex-col space-y-3">
              <Link 
                href="/map-search" 
                className="text-gray-600 hover:text-primary flex items-center py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Map Search
              </Link>
              <Link 
                href="/search" 
                className="text-gray-600 hover:text-primary flex items-center py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <Search className="w-4 h-4 mr-2" />
                Find Laundromats
              </Link>
              <Link 
                href="/states" 
                className="text-gray-600 hover:text-primary py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Browse by State
              </Link>
              <Link 
                href="/laundry-tips" 
                className="text-gray-600 hover:text-primary py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Laundry Tips
              </Link>
              <Link 
                href="/for-owners" 
                className="text-gray-600 hover:text-primary py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                For Owners
              </Link>
              
              <div className="border-t pt-2 mt-2">
                {isLoading ? (
                  <div className="h-9 w-20 bg-gray-100 rounded-md animate-pulse"></div>
                ) : userData && userData.user ? (
                  <div className="space-y-2">
                    <div className="font-medium text-sm text-gray-500 px-1">
                      Signed in as {userData.user.username}
                    </div>
                    {userData.user.isBusinessOwner && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => {
                          navigate('/business/dashboard');
                          setIsMenuOpen(false);
                        }}
                      >
                        <Building className="w-4 h-4 mr-2" />
                        Business Dashboard
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => {
                        navigate('/login');
                        setIsMenuOpen(false);
                      }}
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Login
                    </Button>
                    <Button 
                      className="w-full justify-start"
                      size="sm"
                      onClick={() => {
                        navigate('/login?tab=register');
                        setIsMenuOpen(false);
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Sign Up
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}