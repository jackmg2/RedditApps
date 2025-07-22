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

      {/* Navigation arrows (only show if multiple images) */}
      {totalImages > 1 && (
        <>
          {/* Left arrow */}
          <vstack alignment="start middle" width="100%" height="100%">
            <hstack padding="medium">
              <button
                icon="left"
                appearance="secondary"
                size="medium"
                onPress={() => onNavigate('prev')}
              />
            </hstack>
          </vstack>

          {/* Right arrow */}
          <vstack alignment="end middle" width="100%" height="100%">
            <hstack padding="medium">
              <button
                icon="right"
                appearance="secondary"
                size="medium"
                onPress={() => onNavigate('next')}
              />
            </hstack>
          </vstack>
        </>
      )}

      {/* Image counter (only show if multiple images) */}
      {totalImages > 1 && (
        <vstack alignment="center bottom" width="100%" height="100%">
          <hstack padding="medium">
            <hstack
              backgroundColor="rgba(0,0,0,0.6)"
              cornerRadius="medium"
              padding="small"
            >
              <text size="small" color="white" weight="bold">
                {currentIndex + 1} / {totalImages}
              </text>
            </hstack>
          </hstack>
        </vstack>
      )}

      {/* Render children (pins, overlays, etc.) */}
      {children}
    </zstack>
  );
};