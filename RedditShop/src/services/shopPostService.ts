import { ShopPost, ShopImage } from '../types/shopPost.js';
import { ShopPin } from '../types/shopPin.js';

export class ShopPostService {
  private context: any;

  constructor(context: any) {
    this.context = context;
  }

  async loadShopPost(postId: string): Promise<ShopPost> {
    try {
      const shopPostJsonFromRedis = await this.context.redis.get(`shop_post_${postId}`);
      
      if (shopPostJsonFromRedis && typeof shopPostJsonFromRedis === 'string') {
        // Parse the JSON string and create a proper ShopPost instance
        const data = JSON.parse(shopPostJsonFromRedis);
        return ShopPost.fromData(data);
      } else {
        // Return a new empty ShopPost if no data exists
        return new ShopPost();
      }
    } catch (error) {
      console.error('Error loading shop post:', error);
      return new ShopPost();
    }
  }

  async saveShopPost(postId: string, shopPost: ShopPost): Promise<void> {
    try {
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
      title: shopPost.title,
      images: shopPost.images.map(image => ({
        id: image.id,
        url: image.url,
        pins: image.pins.map(pin => ({
          id: pin.id,
          title: pin.title,
          link: pin.link,
          x: pin.x,
          y: pin.y,
          color: pin.color, // Include color in serialization
          createdAt: pin.createdAt
        })),
        createdAt: image.createdAt,
        width: image.width,
        height: image.height,
        aspectRatio: image.aspectRatio
      })),
      createdAt: shopPost.createdAt,
      authorId: shopPost.authorId,
      clickTracking: shopPost.clickTracking
    };
  }

  async getRealAuthorId(postId: string): Promise<string | null> {
    try {
      const result = await this.context.redis.get(`shop_post_author_${postId}`);
      return typeof result === 'string' ? result : null;
    } catch (error) {
      console.error('Error getting real author ID:', error);
      return null;
    }
  }

  async setRealAuthorId(postId: string, authorId: string): Promise<void> {
    try {
      await this.context.redis.set(`shop_post_author_${postId}`, authorId);
    } catch (error) {
      console.error('Error setting real author ID:', error);
      throw error;
    }
  }

  async addPin(postId: string, imageIndex: number, pin: ShopPin): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    if (shopPost.images[imageIndex]) {
      shopPost.images[imageIndex].pins.push(pin);
      await this.saveShopPost(postId, shopPost);
    }
    
    return shopPost;
  }

  async updatePin(postId: string, imageIndex: number, updatedPin: ShopPin): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    if (shopPost.images[imageIndex]) {
      const pinIndex = shopPost.images[imageIndex].pins.findIndex(pin => pin.id === updatedPin.id);
      if (pinIndex !== -1) {
        shopPost.images[imageIndex].pins[pinIndex] = updatedPin;
        await this.saveShopPost(postId, shopPost);
      }
    }
    
    return shopPost;
  }

  async removePin(postId: string, imageIndex: number, pinId: string): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    if (shopPost.images[imageIndex]) {
      shopPost.images[imageIndex].pins = shopPost.images[imageIndex].pins.filter(pin => pin.id !== pinId);
      await this.saveShopPost(postId, shopPost);
    }
    
    return shopPost;
  }

  async addImage(postId: string, imageUrl: string, width?: number, height?: number): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    const newImage: ShopImage = {
      id: Math.random().toString(36).substr(2, 9),
      url: imageUrl,
      pins: [],
      createdAt: new Date().toISOString(),
      width: width,
      height: height,
      aspectRatio: width && height ? width / height : undefined
    };
    
    shopPost.images.push(newImage);
    await this.saveShopPost(postId, shopPost);
    
    return shopPost;
  }

  async removeImage(postId: string, imageId: string): Promise<ShopPost> {
    const shopPost = await this.loadShopPost(postId);
    
    if (shopPost.images.length <= 1) {
      throw new Error('Cannot remove the last image');
    }
    
    shopPost.removeImage(imageId);
    await this.saveShopPost(postId, shopPost);
    
    return shopPost;
  }

  async trackClick(postId: string, pinId: string): Promise<void> {
    const shopPost = await this.loadShopPost(postId);
    shopPost.trackClick(pinId);
    await this.saveShopPost(postId, shopPost);
  }
}