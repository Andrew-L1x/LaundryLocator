import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { X, UploadCloud, File, ImageIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type FileWithPreview = File & {
  preview?: string;
  id: string;
};

interface FileUploadProps {
  value: any[];
  onChange: (files: any[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  value = [],
  onChange,
  accept = 'image/*',
  multiple = false,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
}) => {
  const [rejectedFiles, setRejectedFiles] = useState<any[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejected: any[]) => {
      // Handle accepted files
      const newFiles = acceptedFiles.map((file) => 
        Object.assign(file, {
          id: Math.random().toString(36).substring(2),
          preview: file.type.startsWith('image/') 
            ? URL.createObjectURL(file)
            : undefined,
        })
      );
      
      // Limit to max files if multiple
      const updatedFiles = multiple 
        ? [...value, ...newFiles].slice(0, maxFiles) 
        : newFiles.slice(0, 1);
      
      onChange(updatedFiles);
      
      // Handle rejected files
      setRejectedFiles(rejected);
      
      // Clear rejected files after 5 seconds
      if (rejected.length > 0) {
        setTimeout(() => {
          setRejectedFiles([]);
        }, 5000);
      }
    },
    [value, onChange, multiple, maxFiles]
  );

  // Remove a file from the list
  const removeFile = (fileToRemove: FileWithPreview) => {
    const updatedFiles = value.filter((file: FileWithPreview) => file.id !== fileToRemove.id);
    onChange(updatedFiles);
  };

  // Clear all files
  const removeAllFiles = () => {
    onChange([]);
  };

  // Setup the file dropzone
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: accept ? { [accept.includes('/') ? accept : `${accept}/*`]: [] } : undefined,
    multiple,
    maxFiles,
    maxSize,
    disabled,
  });

  // Create object URL for image previews
  React.useEffect(() => {
    // Revoke the object URLs when component unmounts
    return () => {
      value.forEach((file: FileWithPreview) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [value]);

  // File type icon based on extension
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return <File className="h-8 w-8 text-red-500" />;
      case 'doc':
      case 'docx':
        return <File className="h-8 w-8 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <File className="h-8 w-8 text-green-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <ImageIcon className="h-8 w-8 text-purple-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center">
          <UploadCloud className="h-10 w-10 text-gray-400 mb-2" />
          <p className="text-sm font-medium">
            {isDragActive
              ? 'Drop the files here...'
              : `Drag and drop ${multiple ? 'files' : 'a file'}, or click to select`}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {multiple
              ? `Up to ${maxFiles} ${accept.includes('image') ? 'images' : 'files'}`
              : accept.includes('image') ? 'PNG, JPG, GIF up to 5MB' : 'Max file size: 5MB'}
          </p>
        </div>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {value.length} {value.length === 1 ? 'file' : 'files'} selected
            </p>
            {value.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeAllFiles}
                type="button"
              >
                Clear all
              </Button>
            )}
          </div>

          <ul className="space-y-2">
            {value.map((file: FileWithPreview) => (
              <li
                key={file.id}
                className="flex items-center justify-between bg-gray-50 p-2 rounded-md"
              >
                <div className="flex items-center">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-10 w-10 object-cover rounded"
                    />
                  ) : (
                    getFileIcon(file.name)
                  )}
                  <div className="ml-3">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file)}
                  className="h-8 w-8 p-0"
                  type="button"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rejectedFiles.length > 0 && (
        <div className="text-sm text-red-500 animate-in fade-in slide-in-from-top-1">
          <p>The following files could not be uploaded:</p>
          <ul className="list-disc list-inside mt-1">
            {rejectedFiles.map((rejection, index) => (
              <li key={index}>
                {rejection.file.name}{' '}
                <span className="text-xs">
                  ({rejection.errors.map((e: any) => e.message).join(', ')})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};