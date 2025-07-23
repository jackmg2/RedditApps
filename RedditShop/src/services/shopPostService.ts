import { ShopPost, ShopImage } from '../types/shopPost.js';
import { ShopPin } from '../types/shopPin.js';

export class ShopPostService {
  private context: any;

  constructor(context: any) {
    this.context = context;
  }

  async loadShopPost(postId: string): Promise<ShopPost> {
    try {
      if (!postId) {
        console.warn('No postId provided to loadShopPost');
        return new ShopPost();
      }

      const shopPostJsonFromRedis = await this.context.redis.get(`shop_post_${postId}`);
      
      if (!shopPostJsonFromRedis) {
        console.warn(`No shop post data found for postId: ${postId}`);
        return new ShopPost();
      }

      if (typeof shopPostJsonFromRedis !== 'string') {
        console.error('Shop post data is not a string:', typeof shopPostJsonFromRedis);
        return new ShopPost();
      }

      // Parse the JSON string and create a proper ShopPost instance
      const data = JSON.parse(shopPostJsonFromRedis);
      
      if (!data || typeof data !== 'object') {
        console.error('Invalid shop post data structure:', data);
        return new ShopPost();
      }

      return ShopPost.fromData(data);
    } catch (error) {
      console.error('Error loading shop post:', error);
      return new ShopPost();
    }
  }

  async saveShopPost(postId: string, shopPost: ShopPost): Promise<void> {
    try {
      if (!postId) {
        throw new Error('No postId provided to saveShopPost');
      }

      if (!shopPost) {
        throw new Error('No shopPost provided to saveShopPost');
      }

      // Convert the ShopPost instance to a plain object for JSON serialization
      const plainObject = this.shopPostToPlainObject(shopPost);
      const jsonString = JSON.stringify(plainObject);
      await this.context.redis.set(`shop_post_${postId}`, jsonString);
    } catch (error) {
      console.error('Error saving shop post:', error);
      throw error;
    }
  }

  private shopPostToPlainObject(shopPost: ShopPost): any {
    return {
      title: shopPost.title || '',
      images: (shopPost.images || []).map(image => ({
        id: image.id || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: image.url || '',
        pins: (image.pins || []).map(pin => ({
          id: pin.id || `pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: pin.title || '',
          link: pin.link || '',
          x: typeof pin.x === 'number' ? pin.x : 50,
          y: typeof pin.y === 'number' ? pin.y : 50,
          color: typeof pin.color === 'string' ? pin.color : '#2b2321EE',
          createdAt: pin.createdAt || new Date().toISOString()
        })),
        createdAt: image.createdAt || new Date().toISOString(),
        width: image.width,
        height: image.height,
        aspectRatio: image.aspectRatio
      })),
      createdAt: shopPost.createdAt || new Date().toISOString(),
      authorId: shopPost.authorId,
      clickTracking: shopPost.clickTracking || {}
    };
  }

  async getRealAuthorId(postId: string): Promise<string | null> {
    try {
      if (!postId) {
        console.warn('No postId provided to getRealAuthorId');
        return null;
      }

      const result = await this.context.redis.get(`shop_post_author_${postId}`);
      return typeof result === 'string' ? result : null;
    } catch (error) {
      console.error('Error getting real author ID:', error);
      return null;
    }
  }

  async setRealAuthorId(postId: string, authorId: string): Promise<void> {
    try {
      if (!postId || !authorId) {
        throw new Error('PostId and authorId are required for setRealAuthorId');
      }

      await this.context.redis.set(`shop_post_author_${postId}`, authorId);
    } catch (error) {
      console.error('Error setting real author ID:', error);
      throw error;
    }
  }

  async addPin(postId: string, imageIndex: number, pin: ShopPin): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    // Validate inputs
    if (!shopPost) {
      throw new Error('Shop post not found or could not be loaded');
    }

    if (!shopPost.images || shopPost.images.length === 0) {
      throw new Error('No images found in shop post');
    }

    if (imageIndex < 0 || imageIndex >= shopPost.images.length) {
      throw new Error(`Image at index ${imageIndex} not found. Available images: ${shopPost.images.length}`);
    }

    if (!shopPost.images[imageIndex]) {
      throw new Error(`Image at index ${imageIndex} is null or undefined`);
    }

    // Ensure pin has proper properties
    if (!pin) {
      throw new Error('Pin is required');
    }

    if (!pin.color || typeof pin.color !== 'string') {
      pin.color = '#2b2321EE';
    }

    // Initialize pins array if it doesn't exist
    if (!shopPost.images[imageIndex].pins) {
      shopPost.images[imageIndex].pins = [];
    }

    shopPost.images[imageIndex].pins.push(pin);
    await this.saveShopPost(postId, shopPost);
    
    return shopPost;
  }

  async updatePin(postId: string, imageIndex: number, updatedPin: ShopPin): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    // Validate inputs
    if (!shopPost || !shopPost.images || shopPost.images.length === 0) {
      throw new Error('Shop post or images not found');
    }

    if (imageIndex < 0 || imageIndex >= shopPost.images.length) {
      throw new Error(`Image at index ${imageIndex} not found`);
    }

    const targetImage = shopPost.images[imageIndex];
    if (!targetImage || !targetImage.pins) {
      throw new Error('Target image or pins not found');
    }

    const pinIndex = targetImage.pins.findIndex(pin => pin.id === updatedPin.id);
    if (pinIndex === -1) {
      throw new Error(`Pin with ID ${updatedPin.id} not found`);
    }

    // Ensure updated pin has proper color
    if (!updatedPin.color || typeof updatedPin.color !== 'string') {
      updatedPin.color = '#2b2321EE';
    }

    targetImage.pins[pinIndex] = updatedPin;
    await this.saveShopPost(postId, shopPost);
    
    return shopPost;
  }

  async removePin(postId: string, imageIndex: number, pinId: string): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    // Validate inputs
    if (!shopPost || !shopPost.images || shopPost.images.length === 0) {
      throw new Error('Shop post or images not found');
    }

    if (imageIndex < 0 || imageIndex >= shopPost.images.length) {
      throw new Error(`Image at index ${imageIndex} not found`);
    }

    const targetImage = shopPost.images[imageIndex];
    if (!targetImage || !targetImage.pins) {
      throw new Error('Target image or pins not found');
    }

    const initialLength = targetImage.pins.length;
    targetImage.pins = targetImage.pins.filter(pin => pin.id !== pinId);
    
    if (targetImage.pins.length === initialLength) {
      throw new Error(`Pin with ID ${pinId} not found`);
    }

    await this.saveShopPost(postId, shopPost);
    return shopPost;
  }

  async addImage(postId: string, imageUrl: string, width?: number, height?: number): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Valid image URL is required');
    }

    const newImage: ShopImage = {
      id: Math.random().toString(36).substr(2, 9),
      url: imageUrl,
      pins: [],
      createdAt: new Date().toISOString(),
      width: width,
      height: height,
      aspectRatio: width && height ? width / height : undefined
    };
    
    // Initialize images array if it doesn't exist
    if (!shopPost.images) {
      shopPost.images = [];
    }

    shopPost.images.push(newImage);
    await this.saveShopPost(postId, shopPost);
    
    return shopPost;
  }

  async removeImage(postId: string, imageId: string): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    if (!shopPost || !shopPost.images) {
      throw new Error('Shop post or images not found');
    }

    if (shopPost.images.length <= 1) {
      throw new Error('Cannot remove the last image');
    }
    
    const initialLength = shopPost.images.length;
    shopPost.images = shopPost.images.filter(img => img.id !== imageId);
    
    if (shopPost.images.length === initialLength) {
      throw new Error(`Image with ID ${imageId} not found`);
    }

    await this.saveShopPost(postId, shopPost);
    return shopPost;
  }

  async trackClick(postId: string, pinId: string): Promise<void> {
    try {
      if (!postId || !pinId) {
        console.warn('PostId and pinId are required for tracking clicks');
        return;
      }

      const shopPost = await this.loadShopPost(postId);
      if (shopPost) {
        shopPost.trackClick(pinId);
        await this.saveShopPost(postId, shopPost);
      }
    } catch (error) {
      console.error('Error tracking click:', error);
      // Don't throw here since click tracking is not critical
    }
  }
}