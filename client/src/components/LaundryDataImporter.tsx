import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ImportStats {
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  successCount: number;
  skippedCount: number;
  errors: string[];
}

interface ImportResponse {
  success: boolean;
  message: string;
  jobId?: string;
  stats?: ImportStats;
}

const LaundryDataImporter: React.FC = () => {
  const { toast } = useToast();
  const [importType, setImportType] = useState<'sample' | 'full'>('sample');
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Start the import process
  const handleImport = async () => {
    try {
      setIsImporting(true);
      setProgress(0);
      setImportStats(null);
      setImportResult(null);

      const response = await apiRequest('POST', '/api/admin/import-laundromats', {
        importType: importType
      });

      const data = await response.json();

      if (data.success) {
        if (data.jobId) {
          // If it's a background job, start polling for status
          startPolling(data.jobId);
          toast({
            title: 'Import Started',
            description: 'The import process has started in the background. You can check the progress here.',
          });
        } else {
          // If it completed immediately
          setImportResult(data);
          setProgress(100);
          setIsImporting(false);
          toast({
            title: 'Import Complete',
            description: data.message,
          });
        }
      } else {
        setIsImporting(false);
        toast({
          title: 'Import Failed',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setIsImporting(false);
      toast({
        title: 'Import Failed',
        description: error.message || 'There was an error importing the data.',
        variant: 'destructive',
      });
    }
  };

  // Poll for job status
  const startPolling = (jobId: string) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    const interval = setInterval(async () => {
      try {
        const response = await apiRequest('GET', `/api/admin/import-status/${jobId}`);
        const data = await response.json();

        if (data.stats) {
          setImportStats(data.stats);
          const progressValue = Math.round((data.stats.processedRecords / data.stats.totalRecords) * 100);
          setProgress(progressValue);
        }

        if (data.status === 'completed') {
          clearInterval(interval);
          setPollInterval(null);
          setImportResult(data);
          setProgress(100);
          setIsImporting(false);
          toast({
            title: 'Import Complete',
            description: data.message,
          });
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPollInterval(null);
          setImportResult(data);
          setIsImporting(false);
          toast({
            title: 'Import Failed',
            description: data.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error polling for import status:', error);
      }
    }, 3000);

    setPollInterval(interval);
  };

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import Laundromat Data</CardTitle>
        <CardDescription>
          Import enriched laundromat data to populate your website. Choose between a sample (500 records) or the full dataset (26,000+ records).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sample" onValueChange={(value) => setImportType(value as 'sample' | 'full')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="sample">Sample Data (500 records)</TabsTrigger>
            <TabsTrigger value="full">Full Dataset (26,000+ records)</TabsTrigger>
          </TabsList>
          <TabsContent value="sample">
            <div className="space-y-2">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Sample Dataset</AlertTitle>
                <AlertDescription>
                  This will import approximately 500 laundromats with complete information. Perfect for testing or a smaller launch.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
          <TabsContent value="full">
            <div className="space-y-2">
              <Alert>
                <Database className="h-4 w-4" />
                <AlertTitle>Full Dataset (26,000+ records)</AlertTitle>
                <AlertDescription>
                  This will import the entire enriched dataset of over 26,000 laundromats. This process may take 10-15 minutes to complete.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

        {!isImporting && !importResult && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleImport}>
              Start Import
            </Button>
          </div>
        )}

        {isImporting && (
          <div className="space-y-4 mt-4">
            <div>
              <div className="flex justify-between mb-1">
                <Label>Import Progress</Label>
                <span className="text-sm">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {importStats && (
              <div className="bg-muted rounded-md p-4 text-sm">
                <h4 className="font-medium mb-2">Processing Statistics</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Total Records: {importStats.totalRecords}</div>
                  <div>Processed: {importStats.processedRecords}</div>
                  <div>Imported: {importStats.successCount}</div>
                  <div>Errors: {importStats.errorCount}</div>
                  <div>Skipped: {importStats.skippedCount}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Importing data, please wait...</span>
            </div>
          </div>
        )}

        {importResult && (
          <div className="space-y-4 mt-4">
            <Alert variant={importResult.success ? "default" : "destructive"}>
              {importResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                {importResult.success ? "Import Complete" : "Import Failed"}
              </AlertTitle>
              <AlertDescription>
                {importResult.message}
              </AlertDescription>
            </Alert>

            {importResult.stats && (
              <div className="bg-muted rounded-md p-4 text-sm">
                <h4 className="font-medium mb-2">Import Results</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Total Records: {importResult.stats.totalRecords}</div>
                  <div>Successfully Imported: {importResult.stats.successCount}</div>
                  <div>Errors: {importResult.stats.errorCount}</div>
                  <div>Skipped (Duplicates): {importResult.stats.skippedCount}</div>
                </div>

                {importResult.stats.errors.length > 0 && (
                  <div className="mt-2">
                    <h5 className="font-medium">First 3 Errors:</h5>
                    <ul className="list-disc pl-5 text-xs">
                      {importResult.stats.errors.slice(0, 3).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleImport}>
                Start New Import
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-muted/30 flex justify-between border-t px-6 py-4">
        <div className="text-xs text-muted-foreground">
          Imported laundromats will be immediately visible on your website.
        </div>
      </CardFooter>
    </Card>
  );
};

export default LaundryDataImporter;