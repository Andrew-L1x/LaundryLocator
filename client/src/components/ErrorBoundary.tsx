import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to gracefully handle React component errors
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error to an error reporting service
    console.error('Uncaught error:', error, errorInfo);
    
    // In a production app, you would send this to your error tracking service
    // e.g., Sentry, LogRocket, etc.
  }
  
  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-xl font-semibold">Something went wrong</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              We're sorry, an error occurred while trying to display this content.
            </p>
            
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
                
                <Link href="/" className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Go to Home Page
                </Link>
              </div>
              
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <div className="mt-6 p-3 bg-gray-100 rounded-md overflow-auto text-xs text-gray-800">
                  <p className="font-bold mb-2">{this.state.error.toString()}</p>
                  <pre>{this.state.errorInfo?.componentStack}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;