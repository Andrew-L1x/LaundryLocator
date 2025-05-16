import React, { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, Upload, FileText, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { apiRequest } from '../lib/queryClient';

// Define types for CSV import responses
interface CSVFile {
  name: string;
  path: string;
}

interface CSVUploadResponse {
  success: boolean;
  fileName: string;
  path: string;
  message?: string;
}

interface CSVImportResponse {
  success: boolean;
  total: number;
  imported: number;
  duplicates: number;
  errors: string[];
  message?: string;
}

interface CSVFilesResponse {
  success: boolean;
  files: string[];
  message?: string;
}

const CSVImporter: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<CSVImportResponse | null>(null);

  // Query to fetch the list of available CSV files
  const { data: csvFiles, isLoading: isLoadingFiles, refetch: refetchFiles } = useQuery<CSVFilesResponse>({
    queryKey: ['/api/csv/list'],
    onError: (error: any) => {
      toast({
        title: "Error fetching CSV files",
        description: error.message || "Could not load CSV files",
        variant: "destructive"
      });
    }
  });

  // Mutation for uploading a CSV file
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      
      // Read the file content as text
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
      
      // Upload the file
      const response = await apiRequest('/api/csv/upload', {
        method: 'POST',
        data: {
          fileName: file.name,
          fileContent
        }
      });
      
      return response as CSVUploadResponse;
    },
    onSuccess: (data) => {
      setUploadedFileName(data.fileName);
      toast({
        title: "CSV Uploaded Successfully",
        description: `${data.fileName} has been uploaded and is ready to import.`,
        variant: "default"
      });
      refetchFiles();
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CSV file",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  });

  // Mutation for importing a CSV file
  const importMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const response = await apiRequest('/api/csv/import', {
        method: 'POST',
        data: { filePath }
      });
      return response as CSVImportResponse;
    },
    onSuccess: (data) => {
      setImportResults(data);
      toast({
        title: "Import Completed",
        description: `Successfully imported ${data.imported} laundromats out of ${data.total}`,
        variant: "default"
      });
      // Invalidate queries that might be affected by the new data
      queryClient.invalidateQueries({ queryKey: ['/api/laundromats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/featured-laundromats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/premium-laundromats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/popular-cities'] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import laundromats from CSV",
        variant: "destructive"
      });
    }
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFile(file);
    setImportResults(null);
  };

  // Handle file upload
  const handleUpload = async () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    } else {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload",
        variant: "destructive"
      });
    }
  };

  // Handle file import
  const handleImport = (fileName: string) => {
    importMutation.mutate(fileName);
  };

  // Reset file selection
  const handleReset = () => {
    setSelectedFile(null);
    setUploadedFileName(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV Importer</CardTitle>
          <CardDescription>
            Upload and import laundromat data from CSV files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isUploading || importMutation.isPending}
                className="flex-1"
              />
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || importMutation.isPending}
                variant="outline"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
              <Button 
                onClick={handleReset}
                variant="ghost"
                disabled={isUploading || importMutation.isPending}
              >
                Reset
              </Button>
            </div>

            {selectedFile && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Selected File</AlertTitle>
                <AlertDescription>
                  {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </AlertDescription>
              </Alert>
            )}

            {uploadedFileName && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700">File Ready for Import</AlertTitle>
                <AlertDescription className="text-green-700">
                  <p className="mb-2">{uploadedFileName} has been uploaded successfully.</p>
                  <Button 
                    onClick={() => handleImport(uploadedFileName)}
                    disabled={importMutation.isPending}
                    className="mt-2"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import Data"
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {importResults && (
              <Alert className={importResults.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                {importResults.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertTitle className={importResults.success ? "text-green-700" : "text-red-700"}>
                  Import Results
                </AlertTitle>
                <AlertDescription className={importResults.success ? "text-green-700" : "text-red-700"}>
                  <p>Total records: {importResults.total}</p>
                  <p>Successfully imported: {importResults.imported}</p>
                  <p>Duplicates skipped: {importResults.duplicates}</p>
                  {importResults.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Errors ({importResults.errors.length}):</p>
                      <div className="max-h-40 overflow-y-auto bg-white p-2 rounded mt-1 border">
                        {importResults.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-600">{error}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available CSV Files</CardTitle>
          <CardDescription>
            Select an existing CSV file to import
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFiles ? (
            <div className="flex justify-center my-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : csvFiles?.files.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No CSV Files Available</AlertTitle>
              <AlertDescription>
                Upload a CSV file first to see it listed here.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableCaption>Available CSV files for import</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvFiles?.files.map((file, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{file}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleImport(file)}
                        disabled={importMutation.isPending}
                      >
                        {importMutation.isPending && importMutation.variables === file ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          "Import"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => refetchFiles()}>
            Refresh List
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CSVImporter;