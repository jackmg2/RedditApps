import { randomId } from "../utils.js";
import { Link } from "./link.js";
import { LinkCell } from "./linkCell.js";

export class Page {
    public id: string;
    public cells: LinkCell[]; // Changed from links to cells
    public title: string;
    public backgroundColor: string;
    public foregroundColor: string;
    public backgroundImage: string;
    public columns: number;

    constructor() {
        this.id = randomId();
        this.cells = [
            new LinkCell(), new LinkCell(), new LinkCell(), new LinkCell(),
            new LinkCell(), new LinkCell(), new LinkCell(), new LinkCell(),
            new LinkCell(), new LinkCell(), new LinkCell(), new LinkCell(),
            new LinkCell(), new LinkCell(), new LinkCell(), new LinkCell()
        ];
        this.title = '';
        this.backgroundColor = '#000000';
        this.foregroundColor = '#FFFFFF';
        this.backgroundImage = '';
        this.columns = 4;
    }

    public static fromData(data: {
        id: string,
        cells?: LinkCell[],
        links?: Link[], // For backward compatibility
        title: string,
        backgroundColor?: string,
        foregroundColor?: string,
        backgroundImage?: string,
        columns?: number
    }): Page {
        let page = new Page();
        page.id = data.id;
        page.title = data.title;
        page.backgroundColor = data.backgroundColor || '#000000';
        page.foregroundColor = data.foregroundColor || '#FFFFFF';
        page.backgroundImage = data.backgroundImage || '';
        page.columns = data.columns || 4;

        // Migration: Handle both old (links) and new (cells) data structure
        if (data.cells) {
            // New format with LinkCell
            page.cells = data.cells.map(c => LinkCell.fromData(c));
        } else if (data.links) {
            // Legacy format with Link[] - migrate to LinkCell[]
            page.cells = data.links.map(link => {
                const cell = new LinkCell();
                cell.links = [Link.fromData(link)];
                cell.weights = [1];
                cell.displayName = link.title || '';
                cell.rotationEnabled = false;
                cell.impressionCount = 0;
                cell.variantImpressions = {};
                return cell;
            });
        }
        
        return page;
    }

    // Analytics methods updated for LinkCell
    public getTotalClicks(): number {
        return this.cells.reduce((sum, cell) => {
            return sum + cell.links.reduce((cellSum, link) => cellSum + (link.clickCount || 0), 0);
        }, 0);
    }

    public getTotalImpressions(): number {
        return this.cells.reduce((sum, cell) => sum + (cell.impressionCount || 0), 0);
    }

    public getMostClickedCell(): LinkCell | null {
        const nonEmptyCells = this.cells.filter(cell => !LinkCell.isEmpty(cell));
        if (nonEmptyCells.length === 0) return null;
        
        return nonEmptyCells.reduce((max, current) => {
            const currentClicks = current.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
            const maxClicks = max.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
            return currentClicks > maxClicks ? current : max;
        });
    }

    public getMostClickedLink(): Link | null {
        let mostClicked: Link | null = null;
        let maxClicks = 0;

        for (const cell of this.cells) {
            for (const link of cell.links) {
                const clicks = link.clickCount || 0;
                if (clicks > maxClicks && !Link.isEmpty(link)) {
                    maxClicks = clicks;
                    mostClicked = link;
                }
            }
        }

        return mostClicked;
    }

    public getClicksPerRow(): number[] {
        const rowClicks: number[] = [];
        const rows = Math.ceil(this.cells.length / this.columns);
        
        for (let row = 0; row < rows; row++) {
            let rowTotal = 0;
            for (let col = 0; col < this.columns; col++) {
                const index = row * this.columns + col;
                if (index < this.cells.length) {
                    rowTotal += this.cells[index].links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
                }
            }
            rowClicks.push(rowTotal);
        }
        
        return rowClicks;
    }

    public getClicksPerColumn(): number[] {
        const colClicks: number[] = new Array(this.columns).fill(0);
        
        this.cells.forEach((cell, index) => {
            const col = index % this.columns;
            const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
            colClicks[col] += cellClicks;
        });
        
        return colClicks;
    }

    public resetAllClicks(): void {
        this.cells.forEach(cell => {
            cell.links.forEach(link => {
                if (link.resetClicks) {
                    link.resetClicks();
                } else {
                    link.clickCount = 0;
                }
            });
            // Reset cell-level analytics
            cell.impressionCount = 0;
            cell.variantImpressions = {};
        });
    }

    // Updated analytics methods for LinkCell structure
    public getActiveCellsCount(): number {
        return this.cells.filter(cell => !LinkCell.isEmpty(cell)).length;
    }

    public getClickedCellsCount(): number {
        return this.cells.filter(cell => {
            const totalClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
            return !LinkCell.isEmpty(cell) && totalClicks > 0;
        }).length;
    }

    public getAverageClicksPerCell(): number {
        const activeCells = this.getActiveCellsCount();
        if (activeCells === 0) return 0;
        return this.getTotalClicks() / activeCells;
    }

    public getTopPerformingCells(limit: number = 3): LinkCell[] {
        return this.cells
            .filter(cell => !LinkCell.isEmpty(cell))
            .sort((a, b) => {
                const aClicks = a.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
                const bClicks = b.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
                return bClicks - aClicks;
            })
            .slice(0, limit);
    }

    public getCellsWithRotation(): LinkCell[] {
        return this.cells.filter(cell => cell.rotationEnabled && cell.links.length > 1);
    }

    // Get cells that have A/B testing data
    public getCellsWithABData(): LinkCell[] {
        return this.cells.filter(cell => {
            return cell.rotationEnabled && 
                   cell.links.length > 1 && 
                   cell.impressionCount > 0;
        });
    }

    // Performance insights updated for LinkCell
    public getPerformanceInsights(): {
        hasLowPerformers: boolean;
        hasHighPerformers: boolean;
        needsReorganization: boolean;
        hasABTests: boolean;
        suggestions: string[];
    } {
        const totalClicks = this.getTotalClicks();
        const activeCells = this.getActiveCellsCount();
        const clickedCells = this.getClickedCellsCount();
        const abTestCells = this.getCellsWithABData();
        
        const suggestions: string[] = [];
        const hasLowPerformers = activeCells > 0 && (clickedCells / activeCells) < 0.5;
        const hasHighPerformers = this.getTopPerformingCells(1).length > 0;
        const needsReorganization = hasHighPerformers && hasLowPerformers;
        const hasABTests = abTestCells.length > 0;

        if (totalClicks === 0) {
            suggestions.push("No clicks yet - consider promoting your links");
        } else if (hasLowPerformers) {
            suggestions.push("Some cells aren't getting clicks - consider updating content or adding variants");
        }

        if (hasHighPerformers) {
            suggestions.push("Some cells are performing very well - analyze what makes them successful");
        }

        if (hasABTests) {
            suggestions.push(`You have ${abTestCells.length} A/B tests running - check variant performance`);
        }

        if (needsReorganization) {
            suggestions.push("Consider moving high-performing content to help promote less-clicked cells");
        }

        return {
            hasLowPerformers,
            hasHighPerformers,
            needsReorganization,
            hasABTests,
            suggestions
        };
    }
}