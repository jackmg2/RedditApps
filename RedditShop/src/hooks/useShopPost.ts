import { useState, useAsync } from '@devvit/public-api';
import { ShopPost, ShopImage } from '../types/shopPost.js';
import { ShopPin } from '../types/shopPin.js';
import { ShopPostService } from '../services/shopPostService.js';

export interface ShopPostHookReturn {
  shopPost: ShopPost | null;
  currentImage: ShopImage | null;
  currentImageIndex: number;
  setCurrentImageIndex: (index: number) => void;
  loading: boolean;
  addPin: (pin: ShopPin) => Promise<void>;
  updatePin: (pin: ShopPin) => Promise<void>;
  removePin: (pinId: string) => Promise<void>;
  addImage: (imageUrl: string, width?: number, height?: number) => Promise<void>;
  removeImage: (imageId: string) => Promise<void>;
  navigateImage: (direction: 'prev' | 'next') => void;
  trackClick: (pinId: string) => Promise<void>;
  refreshData: () => void;
}

export function useShopPost(context: any): ShopPostHookReturn {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const service = new ShopPostService(context);

  // Load shop post data
  const shopPostAsync = useAsync(async () => {
    try {
      const post = await service.loadShopPost(context.postId);
      return post ? JSON.parse(JSON.stringify(post)) : null;
    } catch (error) {
      console.error('Error loading shop post:', error);
      return null;
    }
  }, {
    depends: [refreshTrigger]
  });

  const shopPost = shopPostAsync.data || null;
  const loading = shopPostAsync.loading;
  
  const currentImage = shopPost && shopPost.images.length > 0 
    ? shopPost.images[currentImageIndex] || null 
    : null;

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const addPin = async (pin: ShopPin) => {
    try {
      await service.addPin(context.postId, currentImageIndex, pin);
      refreshData();
      context.ui.showToast('Pin added successfully!');
    } catch (error) {
      console.error('Error adding pin:', error);
      context.ui.showToast('Failed to add pin');
    }
  };

  const updatePin = async (pin: ShopPin) => {
    try {
      await service.updatePin(context.postId, currentImageIndex, pin);
      refreshData();
      context.ui.showToast('Pin updated successfully!');
    } catch (error) {
      console.error('Error updating pin:', error);
      context.ui.showToast('Failed to update pin');
    }
  };

  const removePin = async (pinId: string) => {
    try {
      await service.removePin(context.postId, currentImageIndex, pinId);
      refreshData();
      context.ui.showToast('Pin removed successfully!');
    } catch (error) {
      console.error('Error removing pin:', error);
      context.ui.showToast('Failed to remove pin');
    }
  };

  const addImage = async (imageUrl: string, width?: number, height?: number) => {
    try {
      const updatedShopPost = await service.addImage(context.postId, imageUrl, width, height);
      setCurrentImageIndex(updatedShopPost.images.length - 1); // Navigate to new image
      refreshData();
      context.ui.showToast('Image added successfully!');
    } catch (error) {
      console.error('Error adding image:', error);
      context.ui.showToast('Failed to add image');
    }
  };

  const removeImage = async (imageId: string) => {
    try {
      await service.removeImage(context.postId, imageId);
      
      // Adjust current index if needed
      if (shopPost && currentImageIndex >= shopPost.images.length - 1) {
        setCurrentImageIndex(Math.max(0, shopPost.images.length - 2));
      }
      
      refreshData();
      context.ui.showToast('Image removed successfully!');
    } catch (error) {
      console.error('Error removing image:', error);
      context.ui.showToast('Cannot remove the last image');
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!shopPost || shopPost.images.length <= 1) return;

    if (direction === 'prev') {
      setCurrentImageIndex(currentImageIndex > 0 ? currentImageIndex - 1 : shopPost.images.length - 1);
    } else {
      setCurrentImageIndex(currentImageIndex < shopPost.images.length - 1 ? currentImageIndex + 1 : 0);
    }
  };

  const trackClick = async (pinId: string) => {
    try {
      await service.trackClick(context.postId, pinId);
      // Note: We don't refresh data here to avoid UI flicker during click tracking
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  return {
    shopPost,
    currentImage,
    currentImageIndex,
    setCurrentImageIndex,
    loading,
    addPin,
    updatePin,
    removePin,
    addImage,
    removeImage,
    navigateImage,
    trackClick,
    refreshData
  };
}