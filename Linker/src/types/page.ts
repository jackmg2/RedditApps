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

    // Analytics methods for detailed insights
    public getActiveLinksCount(): number {
        return this.links.filter(link => !Link.isEmpty(link)).length;
    }

    public getClickedLinksCount(): number {
        return this.links.filter(link => !Link.isEmpty(link) && (link.clickCount || 0) > 0).length;
    }

    public getAverageClicksPerLink(): number {
        const activeLinks = this.getActiveLinksCount();
        if (activeLinks === 0) return 0;
        return this.getTotalClicks() / activeLinks;
    }

    public getTopPerformingLinks(limit: number = 3): Link[] {
        return this.links
            .filter(link => !Link.isEmpty(link) && (link.clickCount || 0) > 0)
            .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
            .slice(0, limit);
    }

    public getLeastPerformingLinks(limit: number = 3): Link[] {
        const activeLinksWithClicks = this.links.filter(link => !Link.isEmpty(link));
        return activeLinksWithClicks
            .sort((a, b) => (a.clickCount || 0) - (b.clickCount || 0))
            .slice(0, limit);
    }

    public getClickDistributionStats(): {
        mean: number;
        median: number;
        standardDeviation: number;
        variance: number;
    } {
        const clickCounts = this.links
            .filter(link => !Link.isEmpty(link))
            .map(link => link.clickCount || 0);

        if (clickCounts.length === 0) {
            return { mean: 0, median: 0, standardDeviation: 0, variance: 0 };
        }

        const mean = clickCounts.reduce((sum, count) => sum + count, 0) / clickCounts.length;
        
        const sortedCounts = [...clickCounts].sort((a, b) => a - b);
        const median = sortedCounts.length % 2 === 0
            ? (sortedCounts[sortedCounts.length / 2 - 1] + sortedCounts[sortedCounts.length / 2]) / 2
            : sortedCounts[Math.floor(sortedCounts.length / 2)];

        const variance = clickCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / clickCounts.length;
        const standardDeviation = Math.sqrt(variance);

        return {
            mean: Math.round(mean * 100) / 100,
            median,
            standardDeviation: Math.round(standardDeviation * 100) / 100,
            variance: Math.round(variance * 100) / 100
        };
    }

    public getHeatmapData(): { 
        position: { row: number; col: number }; 
        clicks: number; 
        intensity: number; 
        linkTitle: string;
    }[] {
        const maxClicks = Math.max(...this.links.map(link => link.clickCount || 0));
        
        return this.links.map((link, index) => {
            const row = Math.floor(index / this.columns);
            const col = index % this.columns;
            const clicks = link.clickCount || 0;
            const intensity = maxClicks > 0 ? clicks / maxClicks : 0;

            return {
                position: { row, col },
                clicks,
                intensity,
                linkTitle: Link.isEmpty(link) ? '' : (link.title || 'Untitled')
            };
        }).filter(item => item.linkTitle !== ''); // Only return non-empty links
    }

    // Performance insights
    public getPerformanceInsights(): {
        hasLowPerformers: boolean;
        hasHighPerformers: boolean;
        needsReorganization: boolean;
        suggestions: string[];
    } {
        const stats = this.getClickDistributionStats();
        const totalClicks = this.getTotalClicks();
        const activeLinks = this.getActiveLinksCount();
        const clickedLinks = this.getClickedLinksCount();
        
        const suggestions: string[] = [];
        const hasLowPerformers = stats.mean > 0 && (clickedLinks / activeLinks) < 0.5;
        const hasHighPerformers = stats.standardDeviation > stats.mean * 0.5;
        const needsReorganization = hasHighPerformers && hasLowPerformers;

        if (totalClicks === 0) {
            suggestions.push("No clicks yet - consider promoting your links");
        } else if (hasLowPerformers) {
            suggestions.push("Some links aren't getting clicks - consider updating titles or positions");
        }

        if (hasHighPerformers) {
            suggestions.push("Some links are performing very well - analyze what makes them successful");
        }

        if (needsReorganization) {
            suggestions.push("Consider moving high-performing links to help promote less-clicked ones");
        }

        if (stats.mean > 5) {
            suggestions.push("Great engagement! Your links are performing well");
        }

        return {
            hasLowPerformers,
            hasHighPerformers,
            needsReorganization,
            suggestions
        };
    }
}