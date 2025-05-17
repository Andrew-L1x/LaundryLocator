import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';

// Admin interface for batch importing data
export default function AdminBatchImportPage() {
  const [importing, setImporting] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<any>(null);
  const [dataFile, setDataFile] = useState<string>('/data/import_ready_laundromats.json');
  const [batchSize, setBatchSize] = useState(100);
  const [activeTab, setActiveTab] = useState('import-data');
  
  const { toast } = useToast();

  // Add a log entry
  const addLog = (message: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Start the import process
  const startImport = async () => {
    try {
      setImporting(true);
      setError(null);
      setLog([]);
      setImportStats(null);
      setCurrentBatch(0);
      setProcessedItems(0);
      
      // Get file info
      const fileInfoResponse = await apiRequest('GET', `/api/admin/import/file-info?file=${dataFile}`);
      const fileInfo = await fileInfoResponse.json();
      
      if (fileInfo.error) {
        setError(fileInfo.error);
        addLog(`Error: ${fileInfo.error}`);
        setImporting(false);
        return;
      }
      
      setTotalItems(fileInfo.totalItems);
      setTotalBatches(Math.ceil(fileInfo.totalItems / batchSize));
      addLog(`Found ${fileInfo.totalItems} items in file. Starting import...`);
      
      // Start the batch import
      await processBatches(0, Math.ceil(fileInfo.totalItems / batchSize));
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred');
      addLog(`Error: ${err.message || 'Unknown error occurred'}`);
      setImporting(false);
    }
  };
  
  // Process all batches recursively
  const processBatches = async (batchIndex: number, totalBatches: number) => {
    if (batchIndex >= totalBatches) {
      // All batches completed
      addLog('Import completed!');
      
      try {
        // Get final stats
        const statsResponse = await apiRequest('GET', `/api/admin/import/stats`);
        const stats = await statsResponse.json();
        setImportStats(stats);
        addLog(`Imported: ${stats.imported}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
      } catch (err) {
        addLog('Failed to get final import stats');
      }
      
      setImporting(false);
      toast({
        title: "Import Completed",
        description: `Successfully processed all ${totalItems} records.`,
      });
      return;
    }
    
    try {
      setCurrentBatch(batchIndex + 1);
      addLog(`Processing batch ${batchIndex + 1} of ${totalBatches}...`);
      
      // Import the current batch
      const importResponse = await apiRequest('POST', '/api/admin/import/batch', {
        file: dataFile,
        batchIndex,
        batchSize
      });
      
      const result = await importResponse.json();
      
      if (result.error) {
        addLog(`Batch ${batchIndex + 1} error: ${result.error}`);
        setError(result.error);
        setImporting(false);
        return;
      }
      
      setProcessedItems(prev => prev + result.processed);
      addLog(`Batch ${batchIndex + 1} completed. Imported: ${result.imported}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
      
      // Process the next batch
      await processBatches(batchIndex + 1, totalBatches);
    } catch (err: any) {
      addLog(`Batch ${batchIndex + 1} error: ${err.message || 'Unknown error'}`);
      setError(err.message || 'Unknown error');
      setImporting(false);
    }
  };
  
  // Calculate progress percentage
  const progressPercentage = totalBatches > 0 
    ? Math.round((currentBatch / totalBatches) * 100) 
    : 0;

  return (
    <div className="container max-w-6xl py-10">
      <h1 className="text-3xl font-bold mb-6">Admin Data Import</h1>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import-data">Import Laundromat Data</TabsTrigger>
          <TabsTrigger value="import-logs">Import Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="import-data" className="space-y-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Import Laundromat Data</CardTitle>
              <CardDescription>
                Import enriched laundromat data from the data file into the database in batches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Data File:</label>
                  <input 
                    type="text" 
                    value={dataFile} 
                    onChange={(e) => setDataFile(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={importing}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Batch Size:</label>
                  <input 
                    type="number" 
                    value={batchSize} 
                    onChange={(e) => setBatchSize(parseInt(e.target.value))}
                    className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    min={10}
                    max={500}
                    disabled={importing}
                  />
                </div>
              </div>
              
              {importing && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Progress: {progressPercentage}%</span>
                    <span className="text-sm">Batch {currentBatch} of {totalBatches}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <div className="text-sm text-right">Processed {processedItems} of {totalItems} items</div>
                </div>
              )}
              
              {error && (
                <div className="text-red-500 border border-red-300 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
              
              {importStats && (
                <div className="border rounded-md p-3 bg-green-50">
                  <h3 className="font-medium">Import Results:</h3>
                  <ul className="mt-2 space-y-1">
                    <li>Total processed: {importStats.total}</li>
                    <li>Imported: {importStats.imported}</li>
                    <li>Skipped: {importStats.skipped}</li>
                    <li>Errors: {importStats.errors}</li>
                  </ul>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={startImport} 
                disabled={importing || !dataFile}
                className="w-full"
              >
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="import-logs" className="py-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Log</CardTitle>
              <CardDescription>
                Log of the import process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] overflow-y-auto border rounded-md p-3 bg-black text-green-400 font-mono text-sm">
                {log.length === 0 ? (
                  <div className="text-gray-400 italic">No log entries yet.</div>
                ) : (
                  <div className="space-y-1">
                    {log.map((entry, index) => (
                      <div key={index}>{entry}</div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                onClick={() => setLog([])}
                disabled={log.length === 0}
              >
                Clear Log
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}