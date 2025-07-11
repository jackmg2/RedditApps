import { ShopPin } from './shopPin.js';

export interface ShopImage {
    id: string;
    url: string;
    pins: ShopPin[];
    createdAt: string;
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
        const initialLength = this.images.length;
        this.images = this.images.filter(img => img.id !== imageId);
        return this.images.length < initialLength;
    }

    public getImage(imageId: string): ShopImage | undefined {
        return this.images.find(img => img.id === imageId);
    }

    public static fromData(data: {
        title: string;
        imageUrl?: string; // For backward compatibility
        images?: ShopImage[];
        pins?: any[]; // For backward compatibility
        createdAt: string;
        authorId?: string;
        clickTracking?: { [pinId: string]: number };
    }): ShopPost {
        const shopPost = new ShopPost();
        shopPost.title = data.title;
        shopPost.createdAt = data.createdAt;
        shopPost.authorId = data.authorId;
        shopPost.clickTracking = data.clickTracking || {};

        // Handle backward compatibility
        if (data.images && data.images.length > 0) {
            // New format with multiple images
            shopPost.images = data.images.map(img => ({
                id: img.id || shopPost.generateId(),
                url: img.url,
                pins: img.pins ? img.pins.map(p => ShopPin.fromData(p)) : [],
                createdAt: img.createdAt || new Date().toISOString()
            }));
        } else if (data.imageUrl) {
            // Old format with single image - convert to new format
            const singleImage: ShopImage = {
                id: shopPost.generateId(),
                url: data.imageUrl,
                pins: data.pins ? data.pins.map(p => ShopPin.fromData(p)) : [],
                createdAt: data.createdAt
            };
            shopPost.images = [singleImage];
        }

        return shopPost;
    }

    public trackClick(pinId: string): void {
        if (!this.clickTracking[pinId]) {
            this.clickTracking[pinId] = 0;
        }
        this.clickTracking[pinId]++;
    }

    public getClickCount(pinId: string): number {
        return this.clickTracking[pinId] || 0;
    }

    public getTotalClicks(): number {
        return Object.values(this.clickTracking).reduce((sum, count) => sum + count, 0);
    }

    public getMostClickedPin(): { pinId: string; clicks: number } | null {
        const entries = Object.entries(this.clickTracking);
        if (entries.length === 0) return null;
        
        const [pinId, clicks] = entries.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        
        return { pinId, clicks };
    }    

    public isValid(): string {
        if (!this.title?.trim()) {
            return 'Title is required';
        }

        if (this.images.length === 0) {
            return 'At least one image is required';
        }

        // Validate all images and their pins
        for (const image of this.images) {
            if (!image.url?.trim()) {
                return 'All images must have valid URLs';
            }

            for (const pin of image.pins) {
                const pinValidation = pin.isValid();
                if (pinValidation) {
                    return pinValidation;
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