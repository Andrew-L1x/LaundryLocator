import { useEffect } from 'react';

interface AdContainerProps {
  format: 'horizontal' | 'vertical' | 'native';
  className?: string;
  slotId?: string; // AdSense ad slot ID
}

const AdContainer = ({ format, className = '', slotId = '5962626236' }: AdContainerProps) => {
  // Using actual Google AdSense ad units
  
  // Define ad sizes based on format
  const getAdSize = () => {
    switch (format) {
      case 'horizontal':
        return { width: 728, height: 90 }; // Leaderboard ad
      case 'vertical':
        return { width: 300, height: 600 }; // Large skyscraper
      case 'native':
        return { width: 300, height: 250 }; // Medium rectangle
      default:
        return { width: 728, height: 90 };
    }
  };
  
  const { width, height } = getAdSize();
  
  // Use useEffect to load ads after component mounts
  useEffect(() => {
    // Push the ad slot to Google's ad queue
    try {
      // @ts-ignore - AdSense global
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);
  
  return (
    <div className={`ad-container ${className}`} data-ad-format={format}>
      <ins className="adsbygoogle"
        style={{ display: 'block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-3906265762225434"
        data-ad-slot={slotId}
        data-ad-format={format === 'native' ? 'auto' : ''}
        data-full-width-responsive={format === 'horizontal' ? 'true' : 'false'}>
      </ins>
    </div>
  );
};

export default AdContainer;
