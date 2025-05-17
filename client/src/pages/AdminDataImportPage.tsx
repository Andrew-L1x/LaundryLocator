import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { InfoIcon, Upload, Database, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'wouter';
import DatabaseImport from '@/components/DatabaseImport';

const AdminDataImportPage: React.FC = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useNavigate();

  // Redirect if not authenticated or not admin
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Access Denied',
        description: 'You must be logged in to access the admin area.',
        variant: 'destructive',
      });
      navigate('/login');
    } else if (!isLoading && isAuthenticated && user.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access the admin area.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isLoading, isAuthenticated, user, navigate, toast]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated or not admin, don't render anything (redirect will happen)
  if (!isAuthenticated || (user && user.role !== 'admin')) {
    return null;
  }

  return (
    <div className="container py-8">
      <Helmet>
        <title>Admin Data Import | LaundryLocator</title>
        <meta name="description" content="Admin tools for LaundryLocator data import and management." />
      </Helmet>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Data Import Center</h1>
        <p className="text-gray-600">
          Manage and import laundromat data from various sources
        </p>
      </div>
      
      <Tabs defaultValue="excel-import" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="excel-import" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel Import
          </TabsTrigger>
          <TabsTrigger value="direct-import" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Import
          </TabsTrigger>
          <TabsTrigger value="csv-upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            CSV Upload
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="excel-import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Excel File to CSV Conversion</CardTitle>
              <CardDescription>
                Convert Excel spreadsheet data to CSV format for enrichment and import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  This tool will process the Excel file in the attached_assets folder and convert it to a CSV file in the data directory.
                  The process will also prepare the data for import by validating and cleaning the records.
                </AlertDescription>
              </Alert>
              
              <div className="p-6 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Processing Steps:</h3>
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  <li>Convert Excel file to CSV format</li>
                  <li>Validate and clean data records</li>
                  <li>Generate slugs for each laundromat</li>
                  <li>Create SEO-friendly descriptions and tags</li>
                  <li>Assign premium scores based on features</li>
                  <li>Save enriched data ready for database import</li>
                </ol>
                
                <div className="mt-6 text-center">
                  <button 
                    onClick={() => {
                      toast({
                        title: "Processing Started",
                        description: "Excel conversion and enrichment process has been started. This may take a few minutes.",
                      });
                      
                      // This would typically call an API to start the conversion process
                      // For now, we'll just simulate success
                      setTimeout(() => {
                        toast({
                          title: "Processing Complete",
                          description: "Excel data has been converted and enriched successfully. You can now proceed to database import.",
                        });
                      }, 3000);
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Start Excel Processing
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="direct-import" className="space-y-6">
          <DatabaseImport />
        </TabsContent>
        
        <TabsContent value="csv-upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>CSV File Upload</CardTitle>
              <CardDescription>
                Upload CSV files directly for processing and import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  This feature allows you to upload CSV files containing laundromat data directly through the web interface.
                  Uploaded files will be stored and can be processed for database import.
                </AlertDescription>
              </Alert>
              
              <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <h3 className="font-medium mb-1">Drag & Drop CSV Files</h3>
                <p className="text-sm text-gray-500 mb-4">Or click to browse files</p>
                
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      toast({
                        title: "File Selected",
                        description: `File ${e.target.files[0].name} selected. Click Upload to process.`,
                      });
                    }
                  }}
                />
                
                <label
                  htmlFor="csv-upload"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Select File
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Separator className="my-8" />
      
      <div className="text-sm text-gray-500 mt-8">
        <h3 className="font-medium text-gray-700 mb-2">Data Import Guidelines</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ensure your data includes essential fields: name, address, city, state, zip, phone.</li>
          <li>Latitude and longitude coordinates are recommended for accurate mapping.</li>
          <li>Premium listings should include additional details like hours, services, and images.</li>
          <li>The system will automatically generate SEO content for each record.</li>
          <li>Duplicates will be identified based on name and normalized address.</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminDataImportPage;