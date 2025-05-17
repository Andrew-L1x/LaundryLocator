import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
}

export const Loader: React.FC<LoaderProps> = ({ 
  size = 'md', 
  color = 'primary' 
}) => {
  const sizeClass = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };
  
  const colorClass = {
    primary: 'border-primary border-t-transparent',
    secondary: 'border-secondary border-t-transparent',
    white: 'border-white border-t-transparent'
  };
  
  return (
    <div 
      className={`animate-spin rounded-full ${sizeClass[size]} ${colorClass[color]}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};