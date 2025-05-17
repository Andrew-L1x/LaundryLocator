import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { InfoIcon, Check, AlertTriangle, FileText, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ImportStatus {
  stage: 'idle' | 'uploading' | 'validating' | 'importing' | 'complete' | 'error';
  progress: number;
  message: string;
  records?: {
    total: number;
    imported: number;
    skipped: number;
  };
  error?: string;
}

const DatabaseImport: React.FC = () => {
  const [status, setStatus] = useState<ImportStatus>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to import laundromat data'
  });
  const { toast } = useToast();

  // Function to start database import from enriched data
  const handleDatabaseImport = async () => {
    try {
      setStatus({
        stage: 'uploading',
        progress: 10,
        message: 'Starting database import process...'
      });

      // Start the import process
      const response = await apiRequest('POST', '/api/admin/database-import', {
        source: 'enriched_data'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStatus({
          stage: 'validating',
          progress: 30,
          message: 'Processing data...'
        });
        
        // Poll for status updates
        const intervalId = setInterval(async () => {
          try {
            const statusResponse = await apiRequest('GET', '/api/admin/import-status');
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'processing') {
              setStatus({
                stage: 'importing',
                progress: 30 + (statusData.progress || 0) * 0.6,
                message: statusData.message,
                records: statusData.records
              });
            } else if (statusData.status === 'complete') {
              clearInterval(intervalId);
              setStatus({
                stage: 'complete',
                progress: 100,
                message: 'Import completed successfully!',
                records: statusData.records
              });
              
              toast({
                title: 'Import Successful',
                description: `Imported ${statusData.records?.imported || 0} records to the database.`,
              });
            } else if (statusData.status === 'error') {
              clearInterval(intervalId);
              setStatus({
                stage: 'error',
                progress: 0,
                message: 'Import process failed',
                error: statusData.error
              });
              
              toast({
                title: 'Import Failed',
                description: statusData.error || 'An unknown error occurred',
                variant: 'destructive'
              });
            }
          } catch (error) {
            console.error('Error checking import status:', error);
          }
        }, 2000);
        
        // Clean up interval
        return () => clearInterval(intervalId);
      } else {
        setStatus({
          stage: 'error',
          progress: 0,
          message: 'Failed to start import process',
          error: data.message
        });
        
        toast({
          title: 'Import Failed',
          description: data.message || 'Failed to start the import process',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setStatus({
        stage: 'error',
        progress: 0,
        message: 'Error during import process',
        error: error.message
      });
      
      toast({
        title: 'Import Error',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };
  
  // Reset import status
  const resetStatus = () => {
    setStatus({
      stage: 'idle',
      progress: 0,
      message: 'Ready to import laundromat data'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Direct Database Import
        </CardTitle>
        <CardDescription>
          Import enriched laundromat data directly to the database for best performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.stage === 'idle' && (
          <Alert className="mb-4">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This process will directly import the enriched laundromat data to the database.
              Make sure you have run the data enrichment script first.
            </AlertDescription>
          </Alert>
        )}
        
        {['uploading', 'validating', 'importing'].includes(status.stage) && (
          <div className="space-y-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Import Progress</span>
              <span className="text-sm text-gray-500">{Math.round(status.progress)}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
            <p className="text-sm text-gray-600 mt-2">{status.message}</p>
            {status.records && (
              <div className="mt-4 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-gray-100 p-2">
                    <p className="font-semibold">{status.records.total}</p>
                    <p className="text-xs text-gray-500">Total Records</p>
                  </div>
                  <div className="rounded-md bg-green-50 p-2">
                    <p className="font-semibold text-green-700">{status.records.imported}</p>
                    <p className="text-xs text-gray-500">Imported</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-2">
                    <p className="font-semibold text-amber-700">{status.records.skipped}</p>
                    <p className="text-xs text-gray-500">Skipped</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {status.stage === 'complete' && (
          <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle>Import Complete</AlertTitle>
            <AlertDescription>
              Successfully imported {status.records?.imported} laundromat records to the database.
              {status.records?.skipped ? ` ${status.records.skipped} records were skipped.` : ''}
            </AlertDescription>
          </Alert>
        )}
        
        {status.stage === 'error' && (
          <Alert className="mb-4 bg-red-50 text-red-900 border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle>Import Failed</AlertTitle>
            <AlertDescription>
              {status.error || 'An unknown error occurred during the import process.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {status.stage === 'idle' && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1">
              <FileText className="h-4 w-4" />
              View Data Summary
            </Button>
            <Button onClick={handleDatabaseImport} className="gap-1">
              <Database className="h-4 w-4" />
              Start Database Import
            </Button>
          </div>
        )}
        
        {['uploading', 'validating', 'importing'].includes(status.stage) && (
          <div className="w-full flex justify-center">
            <p className="text-sm text-gray-500 italic">Please wait while the import process completes...</p>
          </div>
        )}
        
        {['complete', 'error'].includes(status.stage) && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetStatus}>
              Reset
            </Button>
            {status.stage === 'error' && (
              <Button variant="secondary" onClick={handleDatabaseImport}>
                Retry Import
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default DatabaseImport;