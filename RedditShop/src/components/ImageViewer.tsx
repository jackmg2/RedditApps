import { Devvit } from '@devvit/public-api';
import { ShopImage } from '../types/shopPost.js';

interface ImageViewerProps {
  image: ShopImage;
  totalImages: number;
  currentIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  children?: any;
}

export const ImageViewer: Devvit.BlockComponent<ImageViewerProps> = ({ 
  image, 
  totalImages, 
  currentIndex, 
  onNavigate,
  children 
}) => {
  return (
    <zstack height="100%" width="100%">
      {/* Background image */}
      <image
        url={image.url}
        imageHeight={image.height || 600}
        imageWidth={image.width || 600}
        height="100%"
        width="100%"
        resizeMode="fit"
        description="Shop image"
      />

      {/* Render children (pins, overlays, etc.) */}
      {children}
    </zstack>
  );
};