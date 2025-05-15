interface AdContainerProps {
  format: 'horizontal' | 'vertical' | 'native';
  className?: string;
}

const AdContainer = ({ format, className = '' }: AdContainerProps) => {
  // This would be replaced with actual ad code in production
  // AdSense, Ezoic, etc. would provide script tags to insert
  
  const getAdHeight = () => {
    switch (format) {
      case 'horizontal':
        return 'h-24';
      case 'vertical':
        return 'h-96';
      case 'native':
        return 'h-auto';
      default:
        return 'h-24';
    }
  };
  
  return (
    <div className={`ad-container ${className}`} data-ad-format={format}>
      <div className={`bg-gray-100 rounded mx-auto ${getAdHeight()} flex items-center justify-center`}>
        <span className="text-gray-500 text-sm">Advertisement</span>
      </div>
    </div>
  );
};

export default AdContainer;
