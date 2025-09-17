import { useState, useAsync } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { Page } from '../types/page.js';

interface UseLinkerDataReturn {
  linker: Linker | null;
  loading: boolean;
  error: Error | null;
  refreshData: () => void;
  saveLinker: (linker: Linker) => Promise<void>;
  updateLinkerOptimistically: (linker: Linker) => void;
}

/**
 * Redis Hash storage structure:
 * - linker_{postId}: Main linker metadata with page IDs
 * - page_{postId}_{pageId}: Page data with cell IDs
 * - cell_{postId}_{cellId}: Cell data with links
 */
export const useLinkerData = (context: any): UseLinkerDataReturn => {
  const [refreshKey, setRefreshKey] = useState(`${context.postId}_${Date.now()}`);
  const [optimisticLinker, setOptimisticLinker] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const { data, loading, error } = useAsync(async () => {
    const postId = context.postId;
    console.log(`Fetching data for post: ${postId}`);
    
    // Fetch main linker metadata
    const linkerKey = `linker_${postId}`;
    const linkerData = await context.redis.hGetAll(linkerKey);
    
    let linker: Linker;

    if (linkerData && linkerData.id) {
      // Existing linker - reconstruct from hash storage
      linker = new Linker();
      linker.id = linkerData.id;
      
      // Parse page IDs
      const pageIds = linkerData.pageIds ? linkerData.pageIds.split(',') : [];
      linker.pages = [];
      
      // Fetch each page
      for (const pageId of pageIds) {
        const pageKey = `page_${postId}_${pageId}`;
        const pageData = await context.redis.hGetAll(pageKey);
        
        if (pageData && pageData.id) {
          const page = new Page();
          page.id = pageData.id;
          page.title = pageData.title || '';
          page.backgroundColor = pageData.backgroundColor || '#000000';
          page.foregroundColor = pageData.foregroundColor || '#FFFFFF';
          page.backgroundImage = pageData.backgroundImage || '';
          page.columns = parseInt(pageData.columns) || 4;
          
          // Parse cell IDs
          const cellIds = pageData.cellIds ? pageData.cellIds.split(',') : [];
          page.cells = [];
          
          // Fetch each cell
          for (const cellId of cellIds) {
            const cellKey = `cell_${postId}_${cellId}`;
            const cellData = await context.redis.hGetAll(cellKey);
            
            if (cellData && cellData.id) {
              const cell = new LinkCell();
              cell.id = cellData.id;
              cell.displayName = cellData.displayName || '';
              cell.rotationEnabled = cellData.rotationEnabled === 'true';
              cell.impressionCount = parseInt(cellData.impressionCount) || 0;
              cell.currentEditingIndex = parseInt(cellData.currentEditingIndex) || 0;
              
              // Parse JSON fields
              try {
                cell.links = cellData.links ? JSON.parse(cellData.links).map((l: any) => Link.fromData(l)) : [new Link()];
                cell.weights = cellData.weights ? JSON.parse(cellData.weights) : [1];
                cell.variantImpressions = cellData.variantImpressions ? JSON.parse(cellData.variantImpressions) : {};
              } catch (e) {
                console.error('Error parsing cell data:', e);
                cell.links = [new Link()];
                cell.weights = [1];
                cell.variantImpressions = {};
              }
              
              // Ensure weights array matches links array
              while (cell.weights.length < cell.links.length) {
                cell.weights.push(1);
              }
              cell.weights = cell.weights.slice(0, cell.links.length);
              
              // Auto-enable rotation for cells with multiple active variants
              const activeVariants = cell.links.filter(link => !Link.isEmpty(link));
              if (activeVariants.length > 1) {
                cell.rotationEnabled = true;
              }
              
              page.cells.push(cell);
            }
          }
          
          // If cells array is empty, initialize with default cells
          if (page.cells.length === 0) {
            for (let i = 0; i < 16; i++) {
              page.cells.push(new LinkCell());
            }
          }
          
          linker.pages.push(page);
        }
      }
      
      // If no pages were loaded, create a default one
      if (linker.pages.length === 0) {
        linker.pages.push(new Page());
      }
      
    } else {
      // Create new linker with default structure
      linker = new Linker();
      
      // Save the initial structure using hash storage
      await saveLinkerToHashes(context, linker);
    }

    setIsInitialized(true);
    return JSON.stringify(linker);
  }, { depends: [refreshKey] });

  const saveLinkerToHashes = async (ctx: any, linker: Linker): Promise<void> => {
    const postId = ctx.postId;
    
    // Save main linker metadata
    const linkerKey = `linker_${postId}`;
    const pageIds = linker.pages.map(p => p.id).join(',');
    
    await ctx.redis.hSet(linkerKey, {
      id: linker.id,
      pageIds: pageIds
    });
    
    // Save each page
    for (const page of linker.pages) {
      const pageKey = `page_${postId}_${page.id}`;
      const cellIds = page.cells.map(c => c.id).join(',');
      
      await ctx.redis.hSet(pageKey, {
        id: page.id,
        title: page.title || '',
        backgroundColor: page.backgroundColor || '#000000',
        foregroundColor: page.foregroundColor || '#FFFFFF',
        backgroundImage: page.backgroundImage || '',
        columns: (page.columns || 4).toString(),
        cellIds: cellIds
      });
      
      // Save each cell
      for (const cell of page.cells) {
        const cellKey = `cell_${postId}_${cell.id}`;
        
        await ctx.redis.hSet(cellKey, {
          id: cell.id,
          displayName: cell.displayName || '',
          rotationEnabled: cell.rotationEnabled ? 'true' : 'false',
          impressionCount: (cell.impressionCount || 0).toString(),
          currentEditingIndex: (cell.currentEditingIndex || 0).toString(),
          links: JSON.stringify(cell.links.map(link => ({
            id: link.id,
            uri: link.uri || '',
            title: link.title || '',
            image: link.image || '',
            textColor: link.textColor || '#FFFFFF',
            description: link.description || '',
            backgroundColor: link.backgroundColor || '#000000',
            backgroundOpacity: typeof link.backgroundOpacity === 'number' ? link.backgroundOpacity : 0.5,
            clickCount: typeof link.clickCount === 'number' ? link.clickCount : 0
          }))),
          weights: JSON.stringify(cell.weights || [1]),
          variantImpressions: JSON.stringify(cell.variantImpressions || {})
        });
      }
    }
  };

  const refreshData = () => {
    setOptimisticLinker('');
    setRefreshKey(`${context.postId}_${Date.now()}`);
  };

  const updateLinkerOptimistically = (linker: Linker) => {
    const properLinkerInstance = Linker.fromData(linker);
    setOptimisticLinker(JSON.stringify(properLinkerInstance));
  };

  const saveLinker = async (linker: Linker): Promise<void> => {
    updateLinkerOptimistically(linker);

    try {
      await saveLinkerToHashes(context, linker);
      console.log(`Data saved successfully for post: ${context.postId}`);
    } catch (error) {
      console.error(`Failed to save data for post ${context.postId}:`, error);
      refreshData();
      throw error;
    }
  };

  // Cleanup function to remove all related hashes when post is deleted
  context.cleanupLinkerData = async () => {
    const postId = context.postId;
    const linkerKey = `linker_${postId}`;
    const linkerData = await context.redis.hGetAll(linkerKey);
    
    if (linkerData && linkerData.pageIds) {
      const pageIds = linkerData.pageIds.split(',');
      
      // Delete all cells and pages
      for (const pageId of pageIds) {
        const pageKey = `page_${postId}_${pageId}`;
        const pageData = await context.redis.hGetAll(pageKey);
        
        if (pageData && pageData.cellIds) {
          const cellIds = pageData.cellIds.split(',');
          
          // Delete all cells for this page
          for (const cellId of cellIds) {
            const cellKey = `cell_${postId}_${cellId}`;
            await context.redis.del(cellKey);
          }
        }
        
        // Delete the page
        await context.redis.del(pageKey);
      }
    }
    
    // Delete the main linker
    await context.redis.del(linkerKey);
  };

  let currentLinker: Linker | null = null;
  
  if (optimisticLinker) {
    currentLinker = JSON.parse(optimisticLinker);
  } else if (data && isInitialized) {
    currentLinker = Linker.fromData(JSON.parse(data as string));
  } else if (data) {
    currentLinker = Linker.fromData(JSON.parse(data as string));
  }

  return {
    linker: currentLinker,
    loading: loading && !optimisticLinker,
    error: error
      ? (error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : JSON.stringify(error)))
      : null,
    refreshData,
    saveLinker,
    updateLinkerOptimistically
  };
};