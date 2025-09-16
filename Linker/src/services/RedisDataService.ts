// src/services/RedisDataService.ts
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { Page } from '../types/page.js';

export class RedisDataService {
  private context: any;
  private postId: string;

  constructor(context: any, postId: string) {
    this.context = context;
    this.postId = postId;
  }

  // ========== KEY GENERATORS ==========
  private keys = {
    meta: () => `post:${this.postId}:meta`,
    pages: () => `post:${this.postId}:pages`,
    page: (pageId: string) => `post:${this.postId}:page:${pageId}`,
    pageCells: (pageId: string) => `post:${this.postId}:page:${pageId}:cells`,
    cell: (cellId: string) => `post:${this.postId}:cell:${cellId}`,
    cellLinks: (cellId: string) => `post:${this.postId}:cell:${cellId}:links`,
    link: (linkId: string) => `post:${this.postId}:link:${linkId}`,
    analytics: (cellId: string) => `post:${this.postId}:analytics:${cellId}`,
    clicks: (linkId: string) => `post:${this.postId}:clicks:${linkId}`,
    legacy: () => `linker_${this.postId}`,
    migrationComplete: () => `post:${this.postId}:migrated`
  };

  // ========== HASH OPERATIONS HELPER ==========
  private async setHashFields(key: string, fields: { [field: string]: string }): Promise<void> {
    for (const [field, value] of Object.entries(fields)) {
      console.log(`[Redis] Setting hash field: ${key} -> ${field} = ${value}`);
      await this.context.redis.hSet(key, field, value);      
    }
  }

  // ========== INITIALIZATION WITH AUTO-MIGRATION ==========
  async initializeBoard(): Promise<Linker> {
    // Check if new structure exists
    const metaExists = await this.context.redis.exists(this.keys.meta());
    
    if (metaExists) {
      console.log(`[Redis] Loading from new structure for post ${this.postId}`);
      return await this.loadLinker();
    }

    // Check if migration has been completed
    const migrationComplete = await this.context.redis.get(this.keys.migrationComplete());
    
    if (!migrationComplete) {
      // Check for legacy data to migrate
      const legacyData = await this.context.redis.get(this.keys.legacy());
      
      if (legacyData) {
        console.log(`[Redis] Migrating legacy data for post ${this.postId}`);
        const parsedData = JSON.parse(legacyData);
        const migrated = await this.migrateLegacyData(parsedData);
        
        // Mark migration as complete
        await this.context.redis.set(this.keys.migrationComplete(), 'true');
        
        // Delete legacy data after successful migration
        await this.context.redis.del(this.keys.legacy());
        console.log(`[Redis] Migration complete, legacy data removed for post ${this.postId}`);
        
        return migrated;
      }
    }

    // No existing data, create new board
    console.log(`[Redis] Creating new board for post ${this.postId}`);
    return await this.createNewBoard();
  }

  // ========== LOADING OPERATIONS ==========
  async loadLinker(): Promise<Linker> {
    console.log(`[Redis] Loading linker for post ${this.postId}`);
    console.log(`[Redis] Fetching metadata from key: ${this.keys.meta()}`);    
    const meta = await this.context.redis.hGetAll(this.keys.meta());
    console.log(`[Redis] Metadata fetched:`, meta);
    if (!meta || !meta.id) {
      throw new Error('Linker metadata not found');
    }

    // Get all page IDs in order
    const pageIds = await this.context.redis.zRange(this.keys.pages(), 0, -1);
    
    // Load pages in parallel with error handling
    const pages = await Promise.all(
      pageIds.map(async (pageId: { member: string }) => {
        try {
          const actualPageId = typeof pageId === 'string' ? pageId : pageId.member;
          return await this.loadPage(actualPageId);
        } catch (error) {
          console.error(`Failed to load page ${pageId}:`, error);
          // Return a default page on error
          const page = new Page();
          page.id = typeof pageId === 'string' ? pageId : pageId.member;
          return page;
        }
      })
    );

    return Linker.fromData({
      id: meta.id,
      pages
    });
  }

  async loadPage(pageId: string): Promise<Page> {
    const pageData = await this.context.redis.hGetAll(this.keys.page(pageId));
    if (!pageData || !pageData.id) {
      throw new Error(`Page ${pageId} not found`);
    }

    // Get all cell IDs in order
    const cellIds = await this.context.redis.zRange(this.keys.pageCells(pageId), 0, -1);
    
    // Load cells in parallel with error handling
    const cells = await Promise.all(
      cellIds.map(async (cellId: any) => {
        try {
          const actualCellId = typeof cellId === 'string' ? cellId : cellId.member;
          return await this.loadCell(actualCellId);
        } catch (error) {
          console.error(`Failed to load cell ${cellId}:`, error);
          return new LinkCell(); // Return empty cell on error
        }
      })
    );

    return Page.fromData({
      id: pageData.id,
      title: pageData.title || '',
      backgroundColor: pageData.backgroundColor || '#000000',
      foregroundColor: pageData.foregroundColor || '#FFFFFF',
      backgroundImage: pageData.backgroundImage || '',
      columns: parseInt(pageData.columns || '4'),
      cells
    });
  }

  async loadCell(cellId: string): Promise<LinkCell> {
    const cellData = await this.context.redis.hGetAll(this.keys.cell(cellId));
    if (!cellData || !cellData.id) {
      // Return empty cell for missing data
      const emptyCell = new LinkCell();
      emptyCell.id = cellId;
      return emptyCell;
    }

    // Get all link IDs in order
    const linkIds = await this.context.redis.zRange(this.keys.cellLinks(cellId), 0, -1);
    
    // Load links and analytics in parallel
    const [links, analytics] = await Promise.all([
      Promise.all(linkIds.map((linkId: any) => {
        const actualLinkId = typeof linkId === 'string' ? linkId : linkId.member;
        return this.loadLink(actualLinkId);
      })),
      this.context.redis.hGetAll(this.keys.analytics(cellId))
    ]);

    // Parse weights
    const weights = cellData.weights ? cellData.weights.split(',').map(Number) : links.map(() => 1);

    // Build variant impressions map
    const variantImpressions: { [key: string]: number } = {};
    if (analytics) {
      Object.keys(analytics).forEach(key => {
        if (key.startsWith('variant:')) {
          const variantId = key.replace('variant:', '');
          variantImpressions[variantId] = parseInt(analytics[key]) || 0;
        }
      });
    }

    return LinkCell.fromData({
      id: cellData.id,
      displayName: cellData.displayName || '',
      rotationEnabled: cellData.rotationEnabled === 'true',
      links: links.length > 0 ? links : [new Link()],
      weights,
      impressionCount: parseInt(analytics?.impressions || '0'),
      variantImpressions,
      currentEditingIndex: parseInt(cellData.currentEditingIndex || '0')
    });
  }

  async loadLink(linkId: string): Promise<Link> {
    const [linkData, clickCount] = await Promise.all([
      this.context.redis.hGetAll(this.keys.link(linkId)),
      this.context.redis.get(this.keys.clicks(linkId))
    ]);

    if (!linkData || !linkData.id) {
      const emptyLink = new Link();
      emptyLink.id = linkId;
      return emptyLink;
    }

    return Link.fromData({
      id: linkData.id,
      uri: linkData.uri || '',
      title: linkData.title || '',
      image: linkData.image || '',
      textColor: linkData.textColor || '#FFFFFF',
      description: linkData.description || '',
      backgroundColor: linkData.backgroundColor || '#000000',
      backgroundOpacity: parseFloat(linkData.backgroundOpacity || '0.5'),
      clickCount: parseInt(clickCount || '0')
    });
  }

  // ========== SAVING OPERATIONS ==========
  async saveFullLinker(linker: Linker): Promise<void> {
    // Update metadata
    await this.setHashFields(this.keys.meta(), {
      id: linker.id,
      version: '2.0',
      pageCount: linker.pages.length.toString(),
      updated: Date.now().toString()
    });

    // Clear and rebuild pages
    await this.context.redis.del(this.keys.pages());
    
    for (let pageIndex = 0; pageIndex < linker.pages.length; pageIndex++) {
      const page = linker.pages[pageIndex];
      
      // Add page to sorted set
      await this.context.redis.zAdd(this.keys.pages(), { score: pageIndex, member: page.id });
      
      // Save page and its cells
      await this.savePage(page);
    }
  }

  async savePage(page: Page): Promise<void> {
    // Save page metadata
    await this.setHashFields(this.keys.page(page.id), {
      id: page.id,
      title: page.title || '',
      backgroundColor: page.backgroundColor || '#000000',
      foregroundColor: page.foregroundColor || '#FFFFFF',
      backgroundImage: page.backgroundImage || '',
      columns: page.columns.toString(),
      cellCount: page.cells.length.toString()
    });

    // Clear and rebuild cells
    await this.context.redis.del(this.keys.pageCells(page.id));
    
    for (let cellIndex = 0; cellIndex < page.cells.length; cellIndex++) {
      const cell = page.cells[cellIndex];
      await this.context.redis.zAdd(this.keys.pageCells(page.id), { score: cellIndex, member: cell.id });
      await this.saveCell(cell);
    }
  }

  async saveCell(cell: LinkCell): Promise<void> {
    try {
      // Save cell metadata with all fields as strings
      const cellData: { [key: string]: string } = {
        id: cell.id || '',
        displayName: cell.displayName || '',
        rotationEnabled: String(cell.rotationEnabled || false),
        linkCount: String(cell.links?.length || 0),
        weights: (cell.weights || []).join(',') || '1',
        currentEditingIndex: String(cell.currentEditingIndex || 0)
      };
      
      await this.setHashFields(this.keys.cell(cell.id), cellData);
      
      // Handle links
      if (cell.links && cell.links.length > 0) {
        // Clear old links sorted set
        await this.context.redis.del(this.keys.cellLinks(cell.id));
        
        // Add all links
        for (let linkIndex = 0; linkIndex < cell.links.length; linkIndex++) {
          const link = cell.links[linkIndex];
          await this.context.redis.zAdd(this.keys.cellLinks(cell.id), { 
            score: linkIndex, 
            member: link.id 
          });
          await this.saveLink(link);
        }
      } else {
        // Ensure at least one empty link
        await this.context.redis.del(this.keys.cellLinks(cell.id));
        const emptyLink = new Link();
        await this.context.redis.zAdd(this.keys.cellLinks(cell.id), { 
          score: 0, 
          member: emptyLink.id 
        });
        await this.saveLink(emptyLink);
      }

      // Save analytics if they exist
      if (cell.impressionCount > 0 || Object.keys(cell.variantImpressions || {}).length > 0) {
        const analyticsData: { [key: string]: string } = {
          impressions: String(cell.impressionCount || 0)
        };
        
        if (cell.variantImpressions) {
          Object.keys(cell.variantImpressions).forEach(variantId => {
            analyticsData[`variant:${variantId}`] = String(cell.variantImpressions[variantId] || 0);
          });
        }
        
        await this.setHashFields(this.keys.analytics(cell.id), analyticsData);
      }
    } catch (error) {
      console.error(`[Redis] Failed to save cell ${cell.id}:`, error);
      throw error;
    }
  }

  async saveLink(link: Link): Promise<void> {
    try {
      const linkData: { [key: string]: string } = {
        id: link.id || '',
        uri: link.uri || '',
        title: link.title || '',
        image: link.image || '',
        textColor: link.textColor || '#FFFFFF',
        description: link.description || '',
        backgroundColor: link.backgroundColor || '#000000',
        backgroundOpacity: String(link.backgroundOpacity !== undefined ? link.backgroundOpacity : 0.5)
      };
      
      await this.setHashFields(this.keys.link(link.id), linkData);

      // Save click count if it exists
      if (link.clickCount && link.clickCount > 0) {
        await this.context.redis.set(this.keys.clicks(link.id), String(link.clickCount));
      }
    } catch (error) {
      console.error(`[Redis] Failed to save link ${link.id}:`, error);
      throw error;
    }
  }

  // ========== ATOMIC OPERATIONS ==========
  async trackClick(linkId: string): Promise<number> {
    return await this.context.redis.incr(this.keys.clicks(linkId));
  }

  async trackImpression(cellId: string, variantId: string): Promise<void> {
    await Promise.all([
      this.context.redis.hIncrBy(this.keys.analytics(cellId), 'impressions', 1),
      this.context.redis.hIncrBy(this.keys.analytics(cellId), `variant:${variantId}`, 1)
    ]);
  }

  async updateCell(cell: LinkCell): Promise<void> {
    await this.saveCell(cell);
  }

  async updateLink(link: Link): Promise<void> {
    await this.saveLink(link);
  }

  async updatePage(page: Page): Promise<void> {
    await this.setHashFields(this.keys.page(page.id), {
      id: page.id,
      title: page.title || '',
      backgroundColor: page.backgroundColor || '#000000',
      foregroundColor: page.foregroundColor || '#FFFFFF',
      backgroundImage: page.backgroundImage || '',
      columns: page.columns.toString()
    });
  }

  // ========== PAGE MANAGEMENT ==========
  async addPageAfter(pageIndex: number, page: Page): Promise<void> {
    // Save page data
    await this.savePage(page);
    
    // Insert into sorted set with temporary score
    await this.context.redis.zAdd(this.keys.pages(), { score: pageIndex + 0.5, member: page.id });
    
    // Re-score all pages to maintain integer scores
    const allPageIds = await this.context.redis.zRange(this.keys.pages(), 0, -1);
    for (let i = 0; i < allPageIds.length; i++) {
      const pageId = typeof allPageIds[i] === 'string' ? allPageIds[i] : allPageIds[i].member;
      await this.context.redis.zAdd(this.keys.pages(), { score: i, member: pageId });
    }
    
    // Update page count
    await this.context.redis.hIncrBy(this.keys.meta(), 'pageCount', 1);
  }

  async removePage(pageIndex: number): Promise<void> {
    const pageIds = await this.context.redis.zRange(this.keys.pages(), pageIndex, pageIndex);
    if (!pageIds.length) throw new Error('Page not found');
    
    const pageId = typeof pageIds[0] === 'string' ? pageIds[0] : pageIds[0].member;
    
    // Get all cells to clean up
    const cellIds = await this.context.redis.zRange(this.keys.pageCells(pageId), 0, -1);
    
    // Clean up cells and their links
    for (const cellIdData of cellIds) {
      const cellId = typeof cellIdData === 'string' ? cellIdData : cellIdData.member;
      const linkIds = await this.context.redis.zRange(this.keys.cellLinks(cellId), 0, -1);
      
      // Delete links
      for (const linkIdData of linkIds) {
        const linkId = typeof linkIdData === 'string' ? linkIdData : linkIdData.member;
        await this.context.redis.del(this.keys.link(linkId));
        await this.context.redis.del(this.keys.clicks(linkId));
      }
      
      // Delete cell data
      await this.context.redis.del(this.keys.cellLinks(cellId));
      await this.context.redis.del(this.keys.cell(cellId));
      await this.context.redis.del(this.keys.analytics(cellId));
    }
    
    // Delete page data
    await this.context.redis.del(this.keys.pageCells(pageId));
    await this.context.redis.del(this.keys.page(pageId));
    
    // Remove from sorted set
    await this.context.redis.zRem(this.keys.pages(), pageId);
    
    // Re-score remaining pages
    const remainingPageIds = await this.context.redis.zRange(this.keys.pages(), 0, -1);
    for (let i = 0; i < remainingPageIds.length; i++) {
      const pageId = typeof remainingPageIds[i] === 'string' ? remainingPageIds[i] : remainingPageIds[i].member;
      await this.context.redis.zAdd(this.keys.pages(), { score: i, member: pageId });
    }
    
    // Update page count
    await this.context.redis.hIncrBy(this.keys.meta(), 'pageCount', -1);
  }

  // ========== MIGRATION ==========
  private migrateLinkCellStructure(data: any): any {
    // Check if migration is needed (from Link[] to LinkCell[])
    if (data.pages && data.pages.length > 0) {
      const firstPage = data.pages[0];
      
      // If page has 'links' property but no 'cells' property, migrate
      if (firstPage.links && !firstPage.cells) {
        console.log('[Redis] Migrating Link[] to LinkCell[] structure');
        
        const migratedPages = data.pages.map((page: any) => ({
          ...page,
          cells: page.links.map((link: any) => ({
            id: `cell_${link.id}`,
            links: [link],
            weights: [1],
            displayName: link.title || '',
            rotationEnabled: false,
            impressionCount: 0,
            variantImpressions: {},
            currentEditingIndex: 0
          })),
          links: undefined
        }));

        return {
          ...data,
          pages: migratedPages
        };
      }
    }
    
    return data;
  }

  async migrateLegacyData(legacyData: any): Promise<Linker> {
    console.log(`[Redis] Starting migration for post ${this.postId}`);
    
    // First migrate Link[] to LinkCell[] if needed
    const migratedData = this.migrateLinkCellStructure(legacyData);
    
    // Create metadata
    await this.setHashFields(this.keys.meta(), {
      id: migratedData.id,
      version: '2.0',
      pageCount: migratedData.pages.length.toString(),
      created: Date.now().toString(),
      updated: Date.now().toString()
    });

    // Migrate pages
    for (let pageIndex = 0; pageIndex < migratedData.pages.length; pageIndex++) {
      const page = migratedData.pages[pageIndex];
      
      // Add page to sorted set
      await this.context.redis.zAdd(this.keys.pages(), { score: pageIndex, member: page.id });
      
      // Save page data
      await this.savePage(Page.fromData(page));
    }

    console.log(`[Redis] Migration completed for post ${this.postId}`);
    
    // Return the migrated data
    return await this.loadLinker();
  }

  // ========== CREATION ==========
  async createNewBoard(): Promise<Linker> {
    const linker = new Linker();
    
    // Create metadata
    await this.setHashFields(this.keys.meta(), {
      id: linker.id,
      version: '2.0',
      pageCount: '1',
      created: Date.now().toString(),
      updated: Date.now().toString()
    });

    // Create first page
    const page = linker.pages[0];
    await this.context.redis.zAdd(this.keys.pages(), { score: 0, member: page.id });
    await this.savePage(page);

    return linker;
  }

  // ========== CLEANUP ==========
  async deleteAllData(): Promise<void> {
    // Get all pages
    const pageIds = await this.context.redis.zRange(this.keys.pages(), 0, -1);
    
    for (const pageIdData of pageIds) {
      const pageId = typeof pageIdData === 'string' ? pageIdData : pageIdData.member;
      
      // Get all cells
      const cellIds = await this.context.redis.zRange(this.keys.pageCells(pageId), 0, -1);
      
      for (const cellIdData of cellIds) {
        const cellId = typeof cellIdData === 'string' ? cellIdData : cellIdData.member;
        
        // Get all links
        const linkIds = await this.context.redis.zRange(this.keys.cellLinks(cellId), 0, -1);
        
        // Delete links
        for (const linkIdData of linkIds) {
          const linkId = typeof linkIdData === 'string' ? linkIdData : linkIdData.member;
          await this.context.redis.del(this.keys.link(linkId));
          await this.context.redis.del(this.keys.clicks(linkId));
        }
        
        // Delete cell
        await this.context.redis.del(this.keys.cellLinks(cellId));
        await this.context.redis.del(this.keys.cell(cellId));
        await this.context.redis.del(this.keys.analytics(cellId));
      }
      
      // Delete page
      await this.context.redis.del(this.keys.pageCells(pageId));
      await this.context.redis.del(this.keys.page(pageId));
    }
    
    // Delete top-level keys
    await this.context.redis.del(this.keys.pages());
    await this.context.redis.del(this.keys.meta());
    await this.context.redis.del(this.keys.migrationComplete());
    
    // Legacy key should already be deleted after migration, but ensure it's gone
    await this.context.redis.del(this.keys.legacy());
  }
}