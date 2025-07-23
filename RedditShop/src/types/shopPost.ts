import { ShopPin } from './shopPin.js';

export interface ShopImage {
    id: string;
    url: string;
    pins: ShopPin[];
    createdAt: string;
    width?: number;
    height?: number;  
    aspectRatio?: number; 
}

export class ShopPost {
    public title: string;
    public images: ShopImage[];
    public createdAt: string;    
    public authorId?: string;
    public clickTracking: { [pinId: string]: number }; // Track clicks per pin ID

    constructor() {
        this.title = '';
        this.images = [];
        this.createdAt = new Date().toISOString();
        this.clickTracking = {};
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    public addImage(imageUrl: string): ShopImage {
        if (!imageUrl || typeof imageUrl !== 'string') {
            throw new Error('Valid image URL is required');
        }

        const newImage: ShopImage = {
            id: this.generateId(),
            url: imageUrl,
            pins: [],
            createdAt: new Date().toISOString()
        };
        this.images.push(newImage);
        return newImage;
    }

    public removeImage(imageId: string): boolean {
        if (!imageId || typeof imageId !== 'string') {
            return false;
        }

        const initialLength = this.images.length;
        this.images = this.images.filter(img => img.id !== imageId);
        return this.images.length < initialLength;
    }

    public getImage(imageId: string): ShopImage | undefined {
        if (!imageId || typeof imageId !== 'string') {
            return undefined;
        }
        return this.images.find(img => img.id === imageId);
    }

    public static fromData(data: any): ShopPost {
        const shopPost = new ShopPost();
        
        if (!data || typeof data !== 'object') {
            console.warn('Invalid data provided to ShopPost.fromData:', data);
            return shopPost;
        }

        shopPost.title = data.title || '';
        shopPost.createdAt = data.createdAt || new Date().toISOString();
        shopPost.authorId = data.authorId;
        shopPost.clickTracking = data.clickTracking || {};

        // Handle backward compatibility
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            // New format with multiple images
            shopPost.images = data.images.map((img: any, index: number) => {
                if (!img || typeof img !== 'object') {
                    console.warn(`Invalid image data at index ${index}:`, img);
                    return null;
                }

                return {
                    id: img.id || shopPost.generateId(),
                    url: img.url || '',
                    pins: Array.isArray(img.pins) ? img.pins.map((p: any) => {
                        try {
                            return ShopPin.fromData(p);
                        } catch (error) {
                            console.warn('Error creating pin from data:', p, error);
                            return null;
                        }
                    }).filter(Boolean) : [],
                    createdAt: img.createdAt || new Date().toISOString(),
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.aspectRatio
                };
            }).filter(Boolean); // Remove any null entries
        } else if (data.imageUrl && typeof data.imageUrl === 'string') {
            // Old format with single image - convert to new format
            const singleImage: ShopImage = {
                id: shopPost.generateId(),
                url: data.imageUrl,
                pins: Array.isArray(data.pins) ? data.pins.map((p: any) => {
                    try {
                        return ShopPin.fromData(p);
                    } catch (error) {
                        console.warn('Error creating pin from legacy data:', p, error);
                        return null;
                    }
                }).filter(Boolean) : [],
                createdAt: data.createdAt || new Date().toISOString()
            };
            shopPost.images = [singleImage];
        } else {
            // No valid image data found
            shopPost.images = [];
        }

        return shopPost;
    }

    public trackClick(pinId: string): void {
        if (!pinId || typeof pinId !== 'string') {
            console.warn('Invalid pinId provided to trackClick:', pinId);
            return;
        }

        if (!this.clickTracking) {
            this.clickTracking = {};
        }

        if (!this.clickTracking[pinId]) {
            this.clickTracking[pinId] = 0;
        }
        this.clickTracking[pinId]++;
    }

    public getClickCount(pinId: string): number {
        if (!pinId || typeof pinId !== 'string' || !this.clickTracking) {
            return 0;
        }
        return this.clickTracking[pinId] || 0;
    }

    public getTotalClicks(): number {
        if (!this.clickTracking || typeof this.clickTracking !== 'object') {
            return 0;
        }
        return Object.values(this.clickTracking).reduce((sum, count) => {
            return sum + (typeof count === 'number' ? count : 0);
        }, 0);
    }

    public getMostClickedPin(): { pinId: string; clicks: number } | null {
        if (!this.clickTracking || typeof this.clickTracking !== 'object') {
            return null;
        }

        const entries = Object.entries(this.clickTracking).filter(([_, count]) => typeof count === 'number');
        if (entries.length === 0) return null;
        
        const [pinId, clicks] = entries.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        
        return { pinId, clicks: clicks as number };
    }    

    public isValid(): string {
        if (!this.title?.trim()) {
            return 'Title is required';
        }

        if (!this.images || this.images.length === 0) {
            return 'At least one image is required';
        }

        // Validate all images and their pins
        for (let i = 0; i < this.images.length; i++) {
            const image = this.images[i];
            if (!image || typeof image !== 'object') {
                return `Image at index ${i} is invalid`;
            }

            if (!image.url?.trim()) {
                return `Image at index ${i} must have a valid URL`;
            }

            if (!image.pins || !Array.isArray(image.pins)) {
                continue; // Pins array can be empty
            }

            for (let j = 0; j < image.pins.length; j++) {
                const pin = image.pins[j];
                if (!pin || typeof pin !== 'object') {
                    return `Pin at index ${j} in image ${i} is invalid`;
                }

                const pinValidation = pin.isValid();
                if (pinValidation) {
                    return `Pin at index ${j} in image ${i}: ${pinValidation}`;
                }
            }
        }

        return '';
    }

    // Legacy getter for backward compatibility
    public get imageUrl(): string {
        return this.images.length > 0 ? this.images[0].url : '';
    }

    // Legacy getter for backward compatibility
    public get pins(): ShopPin[] {
        return this.images.length > 0 ? this.images[0].pins : [];
    }
}