import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, Database, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Direct database import component that uses the enriched data
const DatabaseImport = () => {
  const { toast } = useToast();
  const [importType, setImportType] = useState<'sample' | 'full'>('sample');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  const handleImport = async () => {
    try {
      setIsImporting(true);
      setProgress(10);
      
      // Execute the direct import script
      const response = await apiRequest('POST', '/api/admin/direct-import', {
        type: importType
      });
      
      setProgress(50);
      
      const data = await response.json();
      setResult(data);
      setProgress(100);
      
      if (data.success) {
        toast({
          title: 'Import Successful',
          description: `Successfully imported ${data.imported} laundromats to the database.`,
        });
      } else {
        toast({
          title: 'Import Failed',
          description: data.message || 'There was an error during the import process.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'There was an error during the import process.'
      });
      toast({
        title: 'Import Failed',
        description: error.message || 'There was an error during the import process.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Direct Database Import</CardTitle>
        <CardDescription>
          Import the enriched laundromat data directly into the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={importType} onValueChange={(v) => setImportType(v as 'sample' | 'full')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sample">Sample Data (500 records)</TabsTrigger>
            <TabsTrigger value="full">Full Dataset (26,000+ records)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sample">
            <Alert className="mt-4">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>Sample Import</AlertTitle>
              <AlertDescription>
                This will import approximately 500 enriched laundromat records into the database. 
                Perfect for testing or a smaller launch.
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          <TabsContent value="full">
            <Alert className="mt-4">
              <Database className="h-4 w-4" />
              <AlertTitle>Full Dataset Import</AlertTitle>
              <AlertDescription>
                This will import the entire enriched dataset of over 26,000 laundromats. 
                This process may take several minutes and will require significant database resources.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
        
        {isImporting && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Importing data...</span>
              <span className="text-sm">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {result && (
          <Alert 
            className="mt-6" 
            variant={result.success ? 'default' : 'destructive'}
          >
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? 'Import Successful' : 'Import Failed'}
            </AlertTitle>
            <AlertDescription>
              {result.message}
              {result.success && (
                <p className="mt-2">
                  Imported: {result.imported || 0} records<br/>
                  Skipped: {result.skipped || 0} records<br/>
                  Errors: {result.errors || 0} records
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleImport} 
          disabled={isImporting}
          className="w-full"
        >
          {isImporting ? (
            <span className="flex items-center">
              Processing <ArrowRight className="ml-2 h-4 w-4 animate-pulse" />
            </span>
          ) : (
            <span className="flex items-center">
              Start Import <Database className="ml-2 h-4 w-4" />
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DatabaseImport;