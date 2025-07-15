import { randomId } from "../utils.js";
import { Page } from "./page.js";

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
        linker.pages = data.pages.map(p=>Page.fromData(p));
    
        return linker;
      }

    // Analytics methods
    public getTotalClicks(): number {
        return this.pages.reduce((sum, page) => sum + page.getTotalClicks(), 0);
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

    public resetAllClicks(): void {
        this.pages.forEach(page => page.resetAllClicks());
    }

    // Get analytics summary for display
    public getAnalyticsSummary(): {
        totalClicks: number;
        mostClickedPage?: { title: string; clicks: number; index: number };
        mostClickedLink?: { title: string; clicks: number; pageIndex: number };
    } {
        const totalClicks = this.getTotalClicks();
        const result: any = { totalClicks };
        
        if (totalClicks > 0) {
            const mostClickedPageData = this.getMostClickedPage();
            if (mostClickedPageData) {
                result.mostClickedPage = {
                    title: mostClickedPageData.page.title || `Page ${mostClickedPageData.pageIndex + 1}`,
                    clicks: mostClickedPageData.page.getTotalClicks(),
                    index: mostClickedPageData.pageIndex
                };
                
                const mostClickedLink = mostClickedPageData.page.getMostClickedLink();
                if (mostClickedLink) {
                    result.mostClickedLink = {
                        title: mostClickedLink.title || 'Untitled Link',
                        clicks: mostClickedLink.clickCount || 0,
                        pageIndex: mostClickedPageData.pageIndex
                    };
                }
            }
        }
        
        return result;
    }
}