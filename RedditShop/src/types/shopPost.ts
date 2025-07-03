import { ShopPin } from './shopPin.js';

export class ShopPost {
    public title: string;
    public imageUrl: string;
    public pins: ShopPin[];
    public createdAt: string;
    public authorId?: string;

    constructor() {
        this.title = '';
        this.imageUrl = '';
        this.pins = [];
        this.createdAt = new Date().toISOString();
    }

    public static fromData(data: {
        title: string;
        imageUrl: string;
        pins: any[];
        createdAt: string;
        authorId?: string;
    }): ShopPost {
        const shopPost = new ShopPost();
        shopPost.title = data.title;
        shopPost.imageUrl = data.imageUrl;
        shopPost.pins = data.pins.map(p => ShopPin.fromData(p));
        shopPost.createdAt = data.createdAt;
        shopPost.authorId = data.authorId;
        return shopPost;
    }

    public isValid(): string {
        if (!this.title?.trim()) {
            return 'Title is required';
        }

        if (!this.imageUrl?.trim()) {
            return 'Image is required';
        }

        // Validate all pins
        for (const pin of this.pins) {
            const pinValidation = pin.isValid();
            if (pinValidation) {
                return pinValidation;
            }
        }

        return '';
    }
}