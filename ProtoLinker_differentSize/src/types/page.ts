// src/types/page.ts - Updated with grid layout support
import { randomId } from "../utils.js";
import { Link } from "./link.js";
import { LinkCell } from "./linkCell.js";

export class Page {
    public id: string;
    public cells: LinkCell[];
    public title: string;
    public backgroundColor: string;
    public foregroundColor: string;
    public backgroundImage: string;
    public columns: number;
    public rows: number; // NEW: Number of rows in the grid

    constructor() {
        this.id = randomId();
        this.title = '';
        this.backgroundColor = '#000000';
        this.foregroundColor = '#FFFFFF';
        this.backgroundImage = '';
        this.columns = 4;
        this.rows = 4; // Default 4x4 grid
        
        // Initialize with default 16 cells for 4x4 grid
        this.cells = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                const cell = new LinkCell();
                cell.row = row;
                cell.col = col;
                cell.rowSpan = 1;
                cell.colSpan = 1;
                this.cells.push(cell);
            }
        }
    }

    public static fromData(data: {
        id: string,
        cells?: LinkCell[],
        links?: Link[], // For backward compatibility
        title: string,
        backgroundColor?: string,
        foregroundColor?: string,
        backgroundImage?: string,
        columns?: number,
        rows?: number
    }): Page {
        let page = new Page();
        page.id = data.id;
        page.title = data.title;
        page.backgroundColor = data.backgroundColor || '#000000';
        page.foregroundColor = data.foregroundColor || '#FFFFFF';
        page.backgroundImage = data.backgroundImage || '';
        page.columns = data.columns || 4;
        page.rows = data.rows || 4; // Default to 4 rows if not specified

        // Migration: Handle both old (links) and new (cells) data structure
        if (data.cells) {
            // New format with LinkCell
            page.cells = data.cells.map(c => LinkCell.fromData(c));
            
            // Migrate cells without position/span information
            page.migrateLegacyCells();
        } else if (data.links) {
            // Legacy format with Link[] - migrate to LinkCell[] with positions
            const totalCells = data.links.length;
            page.rows = Math.ceil(totalCells / page.columns);
            
            page.cells = data.links.map((link, index) => {
                const cell = new LinkCell();
                cell.links = [Link.fromData(link)];
                cell.weights = [1];
                cell.displayName = link.title || '';
                cell.rotationEnabled = false;
                cell.impressionCount = 0;
                cell.variantImpressions = {};
                
                // Assign grid position
                cell.row = Math.floor(index / page.columns);
                cell.col = index % page.columns;
                cell.rowSpan = 1;
                cell.colSpan = 1;
                
                return cell;
            });
        }
        
        return page;
    }

    // Migrate legacy cells that don't have position/span information
    private migrateLegacyCells(): void {
        let needsMigration = false;
        
        // Check if any cells lack position information
        for (const cell of this.cells) {
            if (cell.row === undefined || cell.col === undefined) {
                needsMigration = true;
                break;
            }
        }
        
        if (needsMigration) {
            // Assign positions to cells without them
            this.cells.forEach((cell, index) => {
                if (cell.row === undefined || cell.col === undefined) {
                    // Assign sequential positions
                    cell.row = Math.floor(index / this.columns);
                    cell.col = index % this.columns;
                    cell.rowSpan = 1;
                    cell.colSpan = 1;
                }
            });
            
            // Update rows count if needed
            const maxRow = Math.max(...this.cells.map(c => c.row + (c.rowSpan || 1)));
            this.rows = Math.max(this.rows, maxRow);
        }
    }

    // Check if a cell can be placed at a specific position with given span
    public canPlaceCell(row: number, col: number, rowSpan: number, colSpan: number, excludeCellId?: string): boolean {
        // Check boundaries
        if (row < 0 || col < 0 || row + rowSpan > this.rows || col + colSpan > this.columns) {
            return false;
        }

        // Check for overlaps with other cells
        for (const cell of this.cells) {
            // Skip the cell we're trying to place/move
            if (excludeCellId && cell.id === excludeCellId) {
                continue;
            }

            // Skip empty cells
            if (LinkCell.isEmpty(cell)) {
                continue;
            }

            // Check if this cell would overlap with the proposed position
            const cellEndRow = cell.row + cell.rowSpan;
            const cellEndCol = cell.col + cell.colSpan;
            const proposedEndRow = row + rowSpan;
            const proposedEndCol = col + colSpan;

            // Check for overlap
            if (!(row >= cellEndRow || proposedEndRow <= cell.row ||
                  col >= cellEndCol || proposedEndCol <= cell.col)) {
                return false;
            }
        }

        return true;
    }

    // Update cell spanning
    public updateCellSpan(cellId: string, newRowSpan: number, newColSpan: number): boolean {
        const cell = this.cells.find(c => c.id === cellId);
        if (!cell) return false;

        // Check if new span fits at current position
        if (this.canPlaceCell(cell.row, cell.col, newRowSpan, newColSpan, cellId)) {
            cell.rowSpan = newRowSpan;
            cell.colSpan = newColSpan;
            return true;
        }

        return false;
    }

    // Move a cell to a new position
    public moveCell(cellId: string, newRow: number, newCol: number): boolean {
        const cell = this.cells.find(c => c.id === cellId);
        if (!cell) return false;

        // Check if cell can be placed at new position
        if (this.canPlaceCell(newRow, newCol, cell.rowSpan, cell.colSpan, cellId)) {
            cell.row = newRow;
            cell.col = newCol;
            return true;
        }

        return false;
    }

    // Update grid dimensions
    public updateGridDimensions(newRows: number, newColumns: number): void {
        this.rows = newRows;
        this.columns = newColumns;
        
        // Adjust cells that would be out of bounds
        for (const cell of this.cells) {
            if (cell.row >= this.rows) {
                cell.row = this.rows - 1;
            }
            if (cell.col >= this.columns) {
                cell.col = this.columns - 1;
            }
            if (cell.row + cell.rowSpan > this.rows) {
                cell.rowSpan = this.rows - cell.row;
            }
            if (cell.col + cell.colSpan > this.columns) {
                cell.colSpan = this.columns - cell.col;
            }
        }
    }

    // Get grid usage statistics
    public getGridUsageStats(): {
        totalGridCells: number;
        occupiedGridCells: number;
        utilizationPercentage: number;
        largestCell: { cellId: string; size: number } | null;
    } {
        const totalGridCells = this.rows * this.columns;
        let occupiedGridCells = 0;
        let largestCell: { cellId: string; size: number } | null = null;
        
        for (const cell of this.cells) {
            if (!LinkCell.isEmpty(cell)) {
                const cellSize = cell.rowSpan * cell.colSpan;
                occupiedGridCells += cellSize;
                
                if (!largestCell || cellSize > largestCell.size) {
                    largestCell = { cellId: cell.id, size: cellSize };
                }
            }
        }
        
        return {
            totalGridCells,
            occupiedGridCells,
            utilizationPercentage: Math.round((occupiedGridCells / totalGridCells) * 100),
            largestCell
        };
    }

    // Analytics methods updated for LinkCell with spanning
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

    // Keep existing getClicksPerRow and getClicksPerColumn methods for compatibility
    public getClicksPerRow(): number[] {
        const rowClicks: number[] = new Array(this.rows).fill(0);
        
        for (const cell of this.cells) {
            const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
            // Distribute clicks across all rows the cell spans
            for (let r = cell.row; r < cell.row + cell.rowSpan && r < this.rows; r++) {
                rowClicks[r] += cellClicks / cell.rowSpan;
            }
        }
        
        return rowClicks;
    }

    public getClicksPerColumn(): number[] {
        const colClicks: number[] = new Array(this.columns).fill(0);
        
        for (const cell of this.cells) {
            const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
            // Distribute clicks across all columns the cell spans
            for (let c = cell.col; c < cell.col + cell.colSpan && c < this.columns; c++) {
                colClicks[c] += cellClicks / cell.colSpan;
            }
        }
        
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