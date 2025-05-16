import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ApiErrorDisplayProps {
  error: Error | null;
  resetError?: () => void;
  message?: string;
}

const ApiErrorDisplay = ({ 
  error, 
  resetError, 
  message = "We couldn't load the data. Please try again." 
}: ApiErrorDisplayProps) => {
  return (
    <div className="bg-gray-50 border rounded-lg p-6 my-4 text-center">
      <div className="flex justify-center mb-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">Data Loading Error</h3>
      
      <p className="text-gray-600 mb-4">
        {message}
      </p>
      
      {process.env.NODE_ENV !== 'production' && error && (
        <div className="p-3 bg-gray-100 rounded text-left mb-4 overflow-x-auto">
          <p className="text-xs font-mono text-red-600">{error.message}</p>
        </div>
      )}
      
      {resetError && (
        <button
          onClick={resetError}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
};

export default ApiErrorDisplay;