import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './button';
import { X, Upload, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  value: any[];
  onChange: (files: any[]) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  value = [],
  onChange,
  multiple = false,
  accept = 'image/*,application/pdf',
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
}) => {
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      // Handle accepted files
      if (acceptedFiles?.length) {
        const newFiles = [...value];
        
        // Check if adding these files would exceed maxFiles
        if (!multiple) {
          onChange(acceptedFiles.slice(0, 1));
        } else if (newFiles.length + acceptedFiles.length <= maxFiles) {
          onChange([...newFiles, ...acceptedFiles]);
        } else {
          setErrors([`You can only upload a maximum of ${maxFiles} files.`]);
        }
      }
      
      // Handle rejected files
      if (rejectedFiles?.length) {
        const errorMessages = rejectedFiles.map(file => {
          const errors = file.errors.map((error: any) => {
            if (error.code === 'file-too-large') {
              return `File is too large. Max size is ${maxSize / 1024 / 1024}MB.`;
            }
            if (error.code === 'file-invalid-type') {
              return 'File type not supported.';
            }
            return error.message;
          });
          return errors.join(', ');
        });
        
        setErrors([...new Set(errorMessages)]);
      } else {
        setErrors([]);
      }
    },
    [multiple, maxFiles, maxSize, onChange, value]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.split(',').reduce((acc: Record<string, string[]>, item) => {
      // Parse accept string to format needed by react-dropzone
      const trimmed = item.trim();
      if (trimmed.includes('/')) {
        const [type, subtype] = trimmed.split('/');
        if (subtype === '*') {
          acc[type] = [];
        } else {
          if (!acc[type]) acc[type] = [];
          acc[type].push(`.${subtype}`);
        }
      } else if (trimmed.startsWith('.')) {
        if (!acc['application']) acc['application'] = [];
        acc['application'].push(trimmed);
      }
      return acc;
    }, {}),
    multiple,
    maxFiles,
    maxSize,
  });

  const removeFile = (index: number) => {
    const newFiles = [...value];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-gray-400",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="h-8 w-8 text-gray-400" />
          {isDragActive ? (
            <p>Drop the files here...</p>
          ) : (
            <>
              <p className="font-medium">
                Drag & drop {multiple ? "files" : "a file"} here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                {multiple
                  ? `Upload up to ${maxFiles} files (max ${
                      maxSize / 1024 / 1024
                    }MB each)`
                  : `Maximum file size: ${maxSize / 1024 / 1024}MB`}
              </p>
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="text-red-500 text-sm">
          {errors.map((error, i) => (
            <p key={i}>{error}</p>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((file: File, i) => (
            <li
              key={i}
              className="bg-gray-50 rounded-lg p-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <File className="h-5 w-5 text-gray-400" />
                <div className="text-sm truncate max-w-[200px] md:max-w-xs">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(i)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};