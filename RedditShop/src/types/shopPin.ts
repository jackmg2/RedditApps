export class ShopPin {
    public id: string;
    public title: string;
    public link: string;
    public x: number; // X position as percentage (0-100)
    public y: number; // Y position as percentage (0-100)
    public createdAt: string;

    constructor(title?: string, link?: string, x?: number, y?: number) {
        this.id = this.generateId();
        this.title = title || '';
        this.link = link || '';
        this.x = x || 50;
        this.y = y || 50;
        this.createdAt = new Date().toISOString();
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    public static fromData(data: {
        id: string;
        title: string;
        link: string;
        x: number;
        y: number;
        createdAt: string;
    }): ShopPin {
        const pin = new ShopPin();
        pin.id = data.id;
        pin.title = data.title;
        pin.link = data.link;
        pin.x = data.x;
        pin.y = data.y;
        pin.createdAt = data.createdAt;
        return pin;
    }

    public isValid(): string {
        if (!this.title?.trim()) {
            return 'Pin title is required';
        }

        if (!this.link?.trim()) {
            return 'Pin link is required';
        }

        if (!this.link.startsWith('https://')) {
            return 'Pin link must start with https://';
        }

        if (this.x < 0 || this.x > 100) {
            return 'Pin X position must be between 0 and 100';
        }

        if (this.y < 0 || this.y > 100) {
            return 'Pin Y position must be between 0 and 100';
        }

        return '';
    }
}