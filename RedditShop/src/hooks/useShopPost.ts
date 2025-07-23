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

  // Load shop post data with better error handling and validation
  const shopPostAsync = useAsync(async () => {
    try {
      if (!context.postId) {
        console.warn('No postId available in context');
        return null;
      }

      const shopPostJsonFromRedis = await context.redis.get(`shop_post_${context.postId}`);
      
      if (!shopPostJsonFromRedis) {
        console.warn(`No shop post data found for postId: ${context.postId}`);
        // Return a minimal valid structure instead of null
        return {
          title: '',
          images: [],
          createdAt: new Date().toISOString(),
          clickTracking: {},
          authorId: undefined
        };
      }

      if (typeof shopPostJsonFromRedis !== 'string') {
        console.error('Shop post data is not a string:', typeof shopPostJsonFromRedis);
        return null;
      }

      const data = JSON.parse(shopPostJsonFromRedis);
      
      // Validate the parsed data structure
      if (!data || typeof data !== 'object') {
        console.error('Invalid shop post data structure:', data);
        return null;
      }

      // Ensure proper data structure with defaults
      const shopPostData = {
        title: data.title || '',
        images: Array.isArray(data.images) ? data.images : [],
        createdAt: data.createdAt || new Date().toISOString(),
        authorId: data.authorId,
        clickTracking: data.clickTracking || {}
      };

      // Validate that images array is properly structured
      shopPostData.images = shopPostData.images.map((img: any, index: number) => {
        if (!img || typeof img !== 'object') {
          console.warn(`Invalid image at index ${index}:`, img);
          return null;
        }
        
        return {
          id: img.id || `img_${index}_${Date.now()}`,
          url: img.url || '',
          pins: Array.isArray(img.pins) ? img.pins : [],
          createdAt: img.createdAt || new Date().toISOString(),
          width: img.width,
          height: img.height,
          aspectRatio: img.aspectRatio
        };
      }).filter(Boolean); // Remove any null entries
      
      return shopPostData;
    } catch (error) {
      console.error('Error loading shop post:', error);
      // Return a valid empty structure instead of null to prevent cascading errors
      return {
        title: '',
        images: [],
        createdAt: new Date().toISOString(),
        clickTracking: {},
        authorId: undefined
      };
    }
  }, {
    depends: [refreshTrigger, context.postId]
  });

  // Convert the plain object to a ShopPost instance when we need to use it
  const shopPost = shopPostAsync.data ? ShopPost.fromData(shopPostAsync.data) : null;
  const loading = shopPostAsync.loading;
  
  // Ensure currentImageIndex is valid for the current shopPost
  const validImageIndex = shopPost && shopPost.images.length > 0 
    ? Math.min(currentImageIndex, shopPost.images.length - 1)
    : 0;
  
  const currentImage = shopPost && shopPost.images.length > 0 
    ? shopPost.images[validImageIndex] || null 
    : null;

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const addPin = async (pin: ShopPin) => {
    try {
      // Validate pin before adding
      const validation = pin.isValid();
      if (validation) {
        context.ui.showToast(`Invalid pin: ${validation}`);
        return;
      }

      // Ensure we have a valid shop post and image
      if (!shopPost) {
        context.ui.showToast('Shop post not loaded');
        return;
      }

      if (!shopPost.images || shopPost.images.length === 0) {
        context.ui.showToast('No images available');
        return;
      }

      if (validImageIndex >= shopPost.images.length) {
        context.ui.showToast('Invalid image index');
        return;
      }

      await service.addPin(context.postId, validImageIndex, pin);
      refreshData();
    } catch (error) {
      console.error('Error adding pin:', error);
      context.ui.showToast('Failed to add pin');
    }
  };

  const updatePin = async (pin: ShopPin) => {
    try {
      // Validate pin before updating
      const validation = pin.isValid();
      if (validation) {
        context.ui.showToast(`Invalid pin: ${validation}`);
        return;
      }

      // Ensure we have a valid shop post and image
      if (!shopPost || !shopPost.images || validImageIndex >= shopPost.images.length) {
        context.ui.showToast('Invalid shop post or image');
        return;
      }

      await service.updatePin(context.postId, validImageIndex, pin);
      refreshData();
    } catch (error) {
      console.error('Error updating pin:', error);
      context.ui.showToast('Failed to update pin');
    }
  };

  const removePin = async (pinId: string) => {
    try {
      // Ensure we have a valid shop post and image
      if (!shopPost || !shopPost.images || validImageIndex >= shopPost.images.length) {
        context.ui.showToast('Invalid shop post or image');
        return;
      }

      await service.removePin(context.postId, validImageIndex, pinId);
      refreshData();
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
    } catch (error) {
      console.error('Error adding image:', error);
      context.ui.showToast('Failed to add image');
    }
  };

  const removeImage = async (imageId: string) => {
    try {
      await service.removeImage(context.postId, imageId);
      
      // Adjust current index if needed
      if (shopPost && validImageIndex >= shopPost.images.length - 1) {
        setCurrentImageIndex(Math.max(0, shopPost.images.length - 2));
      }
      
      refreshData();
    } catch (error) {
      console.error('Error removing image:', error);
      context.ui.showToast('Cannot remove the last image');
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!shopPost || shopPost.images.length <= 1) return;

    if (direction === 'prev') {
      setCurrentImageIndex(validImageIndex > 0 ? validImageIndex - 1 : shopPost.images.length - 1);
    } else {
      setCurrentImageIndex(validImageIndex < shopPost.images.length - 1 ? validImageIndex + 1 : 0);
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
    currentImageIndex: validImageIndex,
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