import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, FileDown, Database } from 'lucide-react';
import { apiRequest, dataEnrichmentApi } from '@/lib/queryClient';

// Define types for enrichment responses
interface EnrichmentResult {
  success: boolean;
  message: string;
  enrichedPath?: string;
  stats?: {
    totalRecords: number;
    enrichedRecords: number;
    duplicatesRemoved: number;
    errors: string[];
  };
}

interface BatchEnrichmentResponse {
  success: boolean;
  message: string;
  jobId?: string;
  status?: string;
  enrichedPath?: string;
  stats?: {
    totalRecords: number;
    enrichedRecords: number;
    duplicatesRemoved: number;
    errors: string[];
  };
}

interface CSVFilesResponse {
  success: boolean;
  files: string[];
}

const LaundryDataEnricher: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);

  // Query to fetch the list of available CSV files
  const { data: csvFiles, isLoading: isLoadingFiles } = useQuery<CSVFilesResponse>({
    queryKey: ['/api/csv/list'],
    queryFn: async () => {
      return await dataEnrichmentApi<CSVFilesResponse>('/api/csv/list');
    }
  });

  // Mutation for enriching data
  const enrichMutation = useMutation({
    mutationFn: async (filePath: string) => {
      return await dataEnrichmentApi<EnrichmentResult>('/api/laundry/enrich', 'POST', { filePath });
    },
    onSuccess: (data) => {
      setEnrichmentResult(data);
      setProcessingComplete(true);
      
      toast({
        title: "Enrichment Complete",
        description: data.message,
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Enrichment Failed",
        description: error.message || "Failed to enrich data",
        variant: "destructive"
      });
    }
  });

  // Mutation for batch processing
  const batchEnrichMutation = useMutation({
    mutationFn: async (filePath: string) => {
      return await dataEnrichmentApi<BatchEnrichmentResponse>('/api/laundry/batch-enrich', 'POST', { filePath });
    },
    onSuccess: (data) => {
      if (data.jobId) {
        setBatchJobId(data.jobId);
        startPolling(data.jobId);
        
        toast({
          title: "Batch Processing Started",
          description: "We'll notify you when it's complete. This may take several minutes.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Batch Processing Failed",
        description: error.message || "Failed to start batch processing",
        variant: "destructive"
      });
    }
  });

  // Query for batch job status (only runs when jobId is available)
  const { data: batchStatus, refetch: refetchBatchStatus } = useQuery<BatchEnrichmentResponse | null>({
    queryKey: ['/api/laundry/batch-status', batchJobId],
    queryFn: async () => {
      if (!batchJobId) return null;
      return await dataEnrichmentApi<BatchEnrichmentResponse>(`/api/laundry/batch-status/${batchJobId}`);
    },
    enabled: !!batchJobId,
    refetchOnWindowFocus: false,
    refetchInterval: false
  });
  
  // Handle batch status updates
  useEffect(() => {
    if (batchStatus && batchStatus.status === 'completed') {
      stopPolling();
      setEnrichmentResult(batchStatus);
      setProcessingComplete(true);
      setBatchJobId(null);
      
      toast({
        title: "Batch Processing Complete",
        description: batchStatus.message,
      });
    }
  }, [batchStatus, toast]);

  // Start polling for batch job status
  const startPolling = (jobId: string) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    // Poll every 5 seconds
    const interval = setInterval(() => {
      setProgressPercent(prev => {
        // Simulate progress until we get actual progress
        if (prev < 95) return prev + 1;
        return prev;
      });
      refetchBatchStatus();
    }, 5000);
    
    setPollInterval(interval);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setProgressPercent(100);
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  // Handle file selection
  const handleSelectFile = (fileName: string) => {
    setSelectedFile(fileName);
    setProcessingComplete(false);
    setEnrichmentResult(null);
    setBatchJobId(null);
    setProgressPercent(0);
  };

  // Handle enrichment
  const handleEnrich = () => {
    if (!selectedFile) return;
    
    // The full path to the selected file
    const filePath = `/repo/data/csv_uploads/${selectedFile}`;
    
    // If it's likely a small file (under 5MB), use direct enrichment
    // Otherwise use batch processing for large files
    // This is a simplification - in reality this would be based on file size
    if (true) { // Always use batch for 27k+ rows
      batchEnrichMutation.mutate(filePath);
    } else {
      enrichMutation.mutate(filePath);
    }
  };

  // Handle download of enriched file
  const handleDownload = () => {
    if (!enrichmentResult?.enrichedPath) return;
    
    // Create a link to download the file
    const link = document.createElement('a');
    link.href = `/api/files/download?path=${encodeURIComponent(enrichmentResult.enrichedPath)}`;
    link.download = enrichmentResult.enrichedPath.split('/').pop() || 'enriched_data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Laundromat Data Enrichment</CardTitle>
          <CardDescription>
            Enhance your laundromat data with SEO tags, summaries, and premium scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Select a CSV file to enrich</h3>
              {isLoadingFiles ? (
                <div className="flex justify-center my-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : csvFiles?.files.length === 0 ? (
                <Alert className="my-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No CSV Files Available</AlertTitle>
                  <AlertDescription>
                    Upload a CSV file first to see it listed here.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableCaption>Available CSV files for enrichment</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvFiles && csvFiles.files && csvFiles.files.map((file: string, index: number) => (
                      <TableRow key={index} className={selectedFile === file ? "bg-muted" : ""}>
                        <TableCell className="font-medium">{file}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant={selectedFile === file ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSelectFile(file)}
                          >
                            {selectedFile === file ? "Selected" : "Select"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            
            {selectedFile && (
              <div className="border rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Selected File: {selectedFile}</h3>
                    <p className="text-sm text-gray-500">
                      This will enrich your data with SEO tags, descriptions, and premium scoring
                    </p>
                  </div>
                  <Button
                    onClick={handleEnrich}
                    disabled={batchEnrichMutation.isPending || enrichMutation.isPending || !!batchJobId}
                  >
                    {(batchEnrichMutation.isPending || enrichMutation.isPending || !!batchJobId) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Enrich Data
                      </>
                    )}
                  </Button>
                </div>
                
                {(!!batchJobId || batchEnrichMutation.isPending) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Processing large file...</span>
                      <span className="text-sm text-gray-500">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-gray-500">
                      This may take several minutes for large files. You can safely leave this page and check back later.
                    </p>
                  </div>
                )}
                
                {processingComplete && enrichmentResult && (
                  <div className="space-y-4">
                    <Alert variant={enrichmentResult.success ? "default" : "destructive"}>
                      {enrichmentResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {enrichmentResult.success ? "Enrichment Complete" : "Enrichment Failed"}
                      </AlertTitle>
                      <AlertDescription>
                        {enrichmentResult.message}
                      </AlertDescription>
                    </Alert>
                    
                    {enrichmentResult.stats && (
                      <div className="bg-muted p-4 rounded-md">
                        <h4 className="font-medium mb-2">Processing Statistics:</h4>
                        <ul className="space-y-1 text-sm">
                          <li>Total Records: {enrichmentResult.stats.totalRecords}</li>
                          <li>Successfully Enriched: {enrichmentResult.stats.enrichedRecords}</li>
                          <li>Duplicates Removed: {enrichmentResult.stats.duplicatesRemoved}</li>
                          <li>Errors: {enrichmentResult.stats.errors.length}</li>
                        </ul>
                      </div>
                    )}
                    
                    {enrichmentResult.success && enrichmentResult.enrichedPath && (
                      <Button onClick={handleDownload} className="w-full">
                        <FileDown className="mr-2 h-4 w-4" />
                        Download Enriched Data
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <div className="text-xs text-gray-500">
            <p>
              <strong>How it works:</strong> This tool enhances your laundromat data with SEO-optimized tags, 
              summaries, default descriptions (if missing), and premium scores.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LaundryDataEnricher;