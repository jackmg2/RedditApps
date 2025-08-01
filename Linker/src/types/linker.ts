import { randomId } from "../utils.js";
import { Page } from "./page.js";
import { LinkCell } from "./linkCell.js";
import { Link } from "./link.js";

export class Linker {
    public id: string;
    public pages: Page[];
  
    constructor() {
      this.id = randomId();
      this.pages = [new Page()];
    }

    public static fromData(data: {
        id: string,
        pages: Page[]
    }): Linker {
        let linker = new Linker();
        linker.id = data.id;
        linker.pages = data.pages.map(p => Page.fromData(p));
    
        return linker;
    }

    // Analytics methods updated for LinkCell structure
    public getTotalClicks(): number {
        return this.pages.reduce((sum, page) => sum + page.getTotalClicks(), 0);
    }

    public getTotalImpressions(): number {
        return this.pages.reduce((sum, page) => sum + page.getTotalImpressions(), 0);
    }

    public getMostClickedPage(): { page: Page; pageIndex: number } | null {
        if (this.pages.length === 0) return null;
        
        let maxClicks = 0;
        let mostClickedPageIndex = 0;
        
        this.pages.forEach((page, index) => {
            const pageClicks = page.getTotalClicks();
            if (pageClicks > maxClicks) {
                maxClicks = pageClicks;
                mostClickedPageIndex = index;
            }
        });
        
        if (maxClicks === 0) return null;
        
        return {
            page: this.pages[mostClickedPageIndex],
            pageIndex: mostClickedPageIndex
        };
    }

    public getMostClickedCell(): { cell: LinkCell; pageIndex: number; cellIndex: number } | null {
        let maxClicks = 0;
        let result: { cell: LinkCell; pageIndex: number; cellIndex: number } | null = null;
        
        this.pages.forEach((page, pageIndex) => {
            page.cells.forEach((cell, cellIndex) => {
                const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
                if (cellClicks > maxClicks && !LinkCell.isEmpty(cell)) {
                    maxClicks = cellClicks;
                    result = { cell, pageIndex, cellIndex };
                }
            });
        });
        
        return result;
    }

    public resetAllClicks(): void {
        this.pages.forEach(page => page.resetAllClicks());
    }

    public resetAllImpressions(): void {
        this.pages.forEach(page => {
            page.cells.forEach(cell => {
                cell.impressionCount = 0;
                cell.variantImpressions = {};
            });
        });
    }

    // Get analytics summary for display updated for LinkCell structure
    public getAnalyticsSummary(): {
        totalClicks: number;
        totalImpressions: number;
        overallClickRate: number;
        mostClickedPage?: { title: string; clicks: number; index: number };
        mostClickedCell?: { displayName: string; clicks: number; pageIndex: number };
        abTestCount: number;
    } {
        const totalClicks = this.getTotalClicks();
        const totalImpressions = this.getTotalImpressions();
        const overallClickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        
        const result: any = { 
            totalClicks, 
            totalImpressions, 
            overallClickRate: Math.round(overallClickRate * 100) / 100,
            abTestCount: 0
        };
        
        if (totalClicks > 0) {
            const mostClickedPageData = this.getMostClickedPage();
            if (mostClickedPageData) {
                result.mostClickedPage = {
                    title: mostClickedPageData.page.title || `Page ${mostClickedPageData.pageIndex + 1}`,
                    clicks: mostClickedPageData.page.getTotalClicks(),
                    index: mostClickedPageData.pageIndex
                };
            }
            
            const mostClickedCellData = this.getMostClickedCell();
            if (mostClickedCellData) {
                const cellClicks = mostClickedCellData.cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
                result.mostClickedCell = {
                    displayName: mostClickedCellData.cell.displayName || 'Untitled Cell',
                    clicks: cellClicks,
                    pageIndex: mostClickedCellData.pageIndex
                };
            }
        }
        
        // Count A/B tests
        for (const page of this.pages) {
            for (const cell of page.cells) {
                if (cell.rotationEnabled && cell.links.length > 1 && cell.impressionCount > 0) {
                    result.abTestCount++;
                }
            }
        }
        
        return result;
    }

    // Get all cells with A/B testing enabled
    public getCellsWithABTesting(): { 
        cell: LinkCell; 
        pageIndex: number; 
        cellIndex: number; 
        pageTitle: string;
    }[] {
        const abTestCells: { 
            cell: LinkCell; 
            pageIndex: number; 
            cellIndex: number; 
            pageTitle: string;
        }[] = [];
        
        this.pages.forEach((page, pageIndex) => {
            page.cells.forEach((cell, cellIndex) => {
                if (cell.rotationEnabled && cell.links.length > 1) {
                    abTestCells.push({
                        cell,
                        pageIndex,
                        cellIndex,
                        pageTitle: page.title || `Page ${pageIndex + 1}`
                    });
                }
            });
        });
        
        return abTestCells;
    }

    // Get performance insights across all pages
    public getPerformanceInsights(): {
        hasLowPerformers: boolean;
        hasHighPerformers: boolean;
        needsReorganization: boolean;
        hasABTests: boolean;
        overallClickRate: number;
        suggestions: string[];
    } {
        const totalClicks = this.getTotalClicks();
        const totalImpressions = this.getTotalImpressions();
        const overallClickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        
        const allCells = this.pages.flatMap(page => page.cells);
        const activeCells = allCells.filter(cell => !LinkCell.isEmpty(cell));
        const cellsWithClicks = activeCells.filter(cell => 
            cell.links.some(link => (link.clickCount || 0) > 0)
        );
        const abTestCells = this.getCellsWithABTesting();
        
        const suggestions: string[] = [];
        const hasLowPerformers = activeCells.length > 0 && (cellsWithClicks.length / activeCells.length) < 0.5;
        const hasHighPerformers = cellsWithClicks.length > 0;
        const needsReorganization = hasHighPerformers && hasLowPerformers;
        const hasABTests = abTestCells.length > 0;

        if (totalClicks === 0) {
            suggestions.push("No clicks yet - consider promoting your links");
        } else if (hasLowPerformers) {
            suggestions.push("Some cells aren't getting clicks - consider adding variants or updating content");
        }

        if (hasHighPerformers) {
            suggestions.push("Some cells are performing well - analyze what makes them successful");
        }

        if (hasABTests) {
            suggestions.push(`You have ${abTestCells.length} A/B tests running - check variant performance`);
        }

        if (overallClickRate > 5) {
            suggestions.push("Great engagement! Your links are performing well");
        } else if (overallClickRate > 0 && overallClickRate < 2) {
            suggestions.push("Low click rate - consider improving titles or adding more compelling variants");
        }

        if (needsReorganization) {
            suggestions.push("Consider moving high-performing content to help promote less-clicked cells");
        }

        if (activeCells.length > 10 && !hasABTests) {
            suggestions.push("With this many cells, consider A/B testing your best performers");
        }

        return {
            hasLowPerformers,
            hasHighPerformers,
            needsReorganization,
            hasABTests,
            overallClickRate: Math.round(overallClickRate * 100) / 100,
            suggestions
        };
    }

    // Utility methods for cell management
    public findCellById(cellId: string): { 
        cell: LinkCell; 
        pageIndex: number; 
        cellIndex: number; 
    } | null {
        for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex++) {
            const page = this.pages[pageIndex];
            for (let cellIndex = 0; cellIndex < page.cells.length; cellIndex++) {
                const cell = page.cells[cellIndex];
                if (cell.id === cellId) {
                    return { cell, pageIndex, cellIndex };
                }
            }
        }
        return null;
    }

    public getActiveCellCount(): number {
        return this.pages.reduce((sum, page) => 
            sum + page.cells.filter(cell => !LinkCell.isEmpty(cell)).length, 0
        );
    }

    public getTotalVariantCount(): number {
        return this.pages.reduce((sum, page) => 
            sum + page.cells.reduce((pageSum, cell) => 
                pageSum + cell.links.filter(link => !Link.isEmpty(link)).length, 0
            ), 0
        );
    }
}