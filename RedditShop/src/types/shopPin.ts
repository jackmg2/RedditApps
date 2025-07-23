export class ShopPin {
    public id: string;
    public title: string;
    public link: string;
    public x: number; // X position as percentage (0-100, decimals allowed)
    public y: number; // Y position as percentage (0-100, decimals allowed)
    public color: string; // Pin color in hex format
    public createdAt: string;

    constructor(title?: string, link?: string, x?: number, y?: number, color?: string) {
        this.id = this.generateId();
        this.title = title || '';
        this.link = link || '';
        this.x = x || 50;
        this.y = y || 50;
        this.color = (typeof color === 'string' && color) ? color : '#2b2321EE';
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
        color?: string;
        createdAt: string;
    }): ShopPin {
        const pin = new ShopPin();
        pin.id = data.id;
        pin.title = data.title;
        pin.link = data.link;
        pin.x = data.x;
        pin.y = data.y;
        pin.color = (typeof data.color === 'string' && data.color) ? data.color : '#2b2321EE';
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

        // Allow decimal positions
        if (this.x < 0 || this.x > 100 || isNaN(this.x)) {
            return 'Pin X position must be a number between 0 and 100';
        }

        if (this.y < 0 || this.y > 100 || isNaN(this.y)) {
            return 'Pin Y position must be a number between 0 and 100';
        }

        // Validate color format (hex with optional alpha)
        if (this.color && !this.isValidHexColor(this.color)) {
            return 'Pin color must be a valid hex color (e.g., #FF0000 or #FF0000FF)';
        }

        return '';
    }

    private isValidHexColor(color: string): boolean {
        // Check for hex color format: #RGB, #RRGGBB, #RRGGBBAA
        const hexPattern = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
        return hexPattern.test(color);
    }

    // Helper method to format position for display
    public getFormattedPosition(): string {
        return `(${this.x.toFixed(1)}%, ${this.y.toFixed(1)}%)`;
    }
}