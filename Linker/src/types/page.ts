import { randomId } from "../utils.js";
import { Link } from "./link.js";

export class Page {
    public id: string;
    public links: Link[];
    public title: string;
    public backgroundColor: string;
    public foregroundColor: string;  // Added foreground color
    public backgroundImage: string;
    public columns: number;

    constructor() {
        this.id = randomId();
        this.links = [
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link(),
            new Link(), new Link(), new Link(), new Link()
        ];
        this.title = '';
        this.backgroundColor = '#000000';  // Default background is black
        this.foregroundColor = '#FFFFFF';  // Default foreground is white
        this.backgroundImage = '';
        this.columns = 4; // Default number of columns
    }

    public static fromData(data: {
        id: string,
        links: Link[],
        title: string,
        backgroundColor?: string,
        foregroundColor?: string,  // Added to the interface
        backgroundImage?: string,
        columns?: number
    }): Page {
        let page = new Page();
        page.id = data.id;
        page.links = data.links.map(l => Link.fromData(l));
        page.title = data.title;
        page.backgroundColor = data.backgroundColor || '#000000';  // Default to black
        page.foregroundColor = data.foregroundColor || '#FFFFFF';  // Default to white
        page.backgroundImage = data.backgroundImage || '';
        page.columns = data.columns || 4;
        return page;
    }

    // Analytics methods for click tracking
    public getTotalClicks(): number {
        return this.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
    }

    public getMostClickedLink(): Link | null {
        const nonEmptyLinks = this.links.filter(link => !Link.isEmpty(link) && (link.clickCount || 0) > 0);
        if (nonEmptyLinks.length === 0) return null;
        
        return nonEmptyLinks.reduce((max, current) => 
            (current.clickCount || 0) > (max.clickCount || 0) ? current : max
        );
    }

    public getClicksPerRow(): number[] {
        const rowClicks: number[] = [];
        const rows = Math.ceil(this.links.length / this.columns);
        
        for (let row = 0; row < rows; row++) {
            let rowTotal = 0;
            for (let col = 0; col < this.columns; col++) {
                const index = row * this.columns + col;
                if (index < this.links.length) {
                    rowTotal += this.links[index].clickCount || 0;
                }
            }
            rowClicks.push(rowTotal);
        }
        
        return rowClicks;
    }

    public getClicksPerColumn(): number[] {
        const colClicks: number[] = new Array(this.columns).fill(0);
        
        this.links.forEach((link, index) => {
            const col = index % this.columns;
            colClicks[col] += link.clickCount || 0;
        });
        
        return colClicks;
    }

    public resetAllClicks(): void {
        this.links.forEach(link => {
            if (link.resetClicks) {
                link.resetClicks();
            } else {
                link.clickCount = 0;
            }
        });
    }
}