import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import CSVImporter from '@/components/CSVImporter';
import LaundryDataImporter from '@/components/LaundryDataImporter';
import DatabaseImport from '@/components/DatabaseImport';
import MetaTags from '@/components/MetaTags';

const AdminToolsPage = () => {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('data');

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="container max-w-6xl mx-auto p-6">Loading...</div>;
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <MetaTags 
        pageType="admin"
        title="Admin Tools - LaundryLocator"
        description="Administration dashboard for LaundryLocator"
        noIndex={true}
      />
      
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Tools and utilities for site administration
            </p>
          </div>
          
          {user && (
            <div className="flex items-center space-x-2">
              <div className="text-sm text-muted-foreground">
                Logged in as <span className="font-medium">{user.username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation('/login')}>
                Switch Account
              </Button>
            </div>
          )}
        </div>
        
        <Separator />
        
        <Tabs defaultValue="data" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="data">Data Management</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="settings">Site Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="data" className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Data Import</AlertTitle>
              <AlertDescription>
                Use this tool to upload and import laundromat data from CSV files. 
                Make sure your CSV files follow the required format.
              </AlertDescription>
            </Alert>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>CSV Data Import</CardTitle>
                <CardDescription>
                  Import laundromat listings from CSV files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CSVImporter />
              </CardContent>
            </Card>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Import Enriched Laundromat Data</CardTitle>
                <CardDescription>
                  Import our pre-processed laundromat database with SEO optimizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LaundryDataImporter />
              </CardContent>
            </Card>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Direct Database Import</CardTitle>
                <CardDescription>
                  Bypasses API and imports data directly to the database (faster method)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DatabaseImport />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Batch Import Tool</CardTitle>
                <CardDescription>
                  Process large datasets in batches for reliable imports (recommended for 27,000+ records)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p>
                    This tool processes large data files in small batches, providing detailed progress monitoring 
                    and error handling. Ideal for importing the complete dataset.
                  </p>
                  <Button onClick={() => setLocation('/admin/batch-import')}>
                    Open Batch Import Tool
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="users" className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>User Management</AlertTitle>
              <AlertDescription>
                Manage user accounts, roles, and permissions.
              </AlertDescription>
            </Alert>
            
            <Card>
              <CardHeader>
                <CardTitle>User Accounts</CardTitle>
                <CardDescription>
                  View and manage user accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>User management functionality coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Site Settings</AlertTitle>
              <AlertDescription>
                Configure global site settings and features.
              </AlertDescription>
            </Alert>
            
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Adjust site-wide settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Settings management functionality coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminToolsPage;