import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useLogin, useRegister, useDemoLogin, useCurrentUser } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

// Form schemas
const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional()
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
  isBusinessOwner: z.boolean().default(false)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const { toast } = useToast();
  const { data: userData } = useCurrentUser();
  
  // React Query mutations
  const login = useLogin();
  const register = useRegister();
  const demoLogin = useDemoLogin();
  
  // Get loading states from mutations
  const isLoading = login.isPending || register.isPending || demoLogin.isPending;

  // Check URL for tab parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'register') {
      setActiveTab('register');
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (userData?.user) {
      if (userData.user.isBusinessOwner) {
        navigate('/business/dashboard');
      } else {
        navigate('/');
      }
    }
  }, [userData, navigate]);

  // Login form setup
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false
    }
  });

  // Register form setup
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      isBusinessOwner: false
    }
  });

  // Handle login submit
  const onLogin = async (data: LoginFormValues) => {
    try {
      const response = await login.mutateAsync({
        username: data.username,
        password: data.password
      });

      toast({
        title: "Login Successful",
        description: "Welcome back! You've been logged in successfully.",
      });
      
      // Redirect based on user role
      if (response.user.isBusinessOwner) {
        navigate('/business/dashboard');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle registration submit
  const onRegister = async (data: RegisterFormValues) => {
    try {
      await register.mutateAsync({
        username: data.username,
        email: data.email,
        password: data.password,
        isBusinessOwner: data.isBusinessOwner,
        role: data.isBusinessOwner ? 'business_owner' : 'user'
      });

      toast({
        title: "Registration Successful",
        description: "Your account has been created successfully. You may now login.",
      });
      setActiveTab('login');
      loginForm.setValue('username', data.username);
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "There was an error creating your account. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Demo login for testing purposes
  const handleDemoLogin = async (type: 'user' | 'owner') => {
    try {
      const response = await demoLogin.mutateAsync(type);

      toast({
        title: "Demo Login Successful",
        description: `You are now logged in as a demo ${type}.`,
      });
      
      if (type === 'owner') {
        navigate('/business/dashboard');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      toast({
        title: "Demo Login Failed",
        description: error.message || "Could not login with demo account. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">LaundryLocator</CardTitle>
          <CardDescription className="text-center">Login or create an account to manage your laundromat listings</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter your password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Remember me</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {login.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6">
                <p className="text-sm text-center text-gray-500 mb-2">Try demo accounts:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDemoLogin('user')} disabled={isLoading}>
                    Demo User
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDemoLogin('owner')} disabled={isLoading}>
                    Demo Owner
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Choose a username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter your email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Choose a password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm your password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={registerForm.control}
                    name="isBusinessOwner"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>I am a laundromat owner</FormLabel>
                          <FormDescription>
                            Enable owner features to manage your listings
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <p className="text-sm text-gray-500">
            <Link href="/for-owners" className="text-primary hover:underline">
              Learn more about business owner features
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}