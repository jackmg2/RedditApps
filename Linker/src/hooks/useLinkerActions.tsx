// src/hooks/useLinkerActions.tsx
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { Page } from '../types/page.js';
import { addRowToGrid, addColumnToGrid, removeRowFromGrid, removeColumnFromGrid } from '../utils/gridUtils.js';
import { clearCellVariantCache } from '../utils/rotationUtils.js';
import { RedisDataService, REDIS_FEATURE_FLAGS } from '../services/RedisDataService.js';

interface UseLinkerActionsProps {
  linker: Linker | null;
  saveLinker: (linker: Linker) => Promise<void>;
  updateLinkerOptimistically: (linker: Linker) => void;
  context: any;
  currentPageIndex?: number;
}

interface UseLinkerActionsReturn {
  updateCell: (cell: LinkCell) => Promise<void>;
  updatePage: (data: { id: string, title: string, foregroundColor?: string, backgroundColor?: string, backgroundImage?: string }) => Promise<void>;
  updateBackgroundImage: (backgroundImage: string) => Promise<void>;
  addRow: () => Promise<void>;
  addColumn: () => Promise<void>;
  removeRow: (rowIndex: number) => Promise<void>;
  removeColumn: (colIndex: number) => Promise<void>;
  trackLinkClick: (cellId: string, variantId: string) => Promise<void>;
  trackImpression: (cellId: string, variantId: string) => Promise<void>;
  nextVariant: (cellId: string) => Promise<void>;
  addVariant: (cellId: string) => Promise<void>;
  removeVariant: (cellId: string) => Promise<void>;
  addPageAfter: (pageIndex: number) => Promise<void>;
  addPageBefore: (pageIndex: number) => Promise<void>;
  removePage: (pageIndex: number) => Promise<void>;
}

/**
 * Enhanced linker actions with atomic operations support
 */
export const useLinkerActions = ({ 
  linker, 
  saveLinker, 
  updateLinkerOptimistically, 
  context, 
  currentPageIndex = 0 
}: UseLinkerActionsProps): UseLinkerActionsReturn => {
  
  // Initialize Redis service for atomic operations
  const redisService = new RedisDataService(context, context.postId);

  const updateCell = async (cell: LinkCell): Promise<void> => {
    if (!linker) return;

    const startTime = Date.now();
    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cell.id);

    if (cellIndex === -1) {
      context.ui.showToast('Cell not found');
      return;
    }

    // Create the updated cell with proper data
    const updatedCell = LinkCell.fromData({
      id: cell.id,
      links: cell.links.map(link => Link.fromData({
        id: link.id,
        uri: link.uri || '',
        title: link.title || '',
        image: link.image || '',
        textColor: link.textColor || '#FFFFFF',
        description: link.description || '',
        backgroundColor: link.backgroundColor || '#000000',
        backgroundOpacity: typeof link.backgroundOpacity === 'number' ? link.backgroundOpacity : 0.5,
        clickCount: typeof link.clickCount === 'number' ? link.clickCount : 0
      })),
      weights: cell.weights,
      displayName: cell.displayName || '',
      rotationEnabled: cell.rotationEnabled,
      impressionCount: cell.impressionCount || 0,
      variantImpressions: cell.variantImpressions || {},
      currentEditingIndex: cell.currentEditingIndex || 0
    });

    updatedLinker.pages[pageIndex].cells[cellIndex] = updatedCell;

    // Clear variant cache for this cell since it was updated
    clearCellVariantCache(cell.id);

    try {
      // If using new Redis, also do atomic update
      if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
        await redisService.updateCell(updatedCell);
        
        if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
          const duration = Date.now() - startTime;
          console.log(`[Actions] Cell update completed in ${duration}ms`);
        }
      }
      
      // Always save full linker for now (during migration)
      await saveLinker(updatedLinker);
      context.ui.showToast('Cell updated successfully');
    } catch (error) {
      context.ui.showToast('Failed to update cell');
      throw error;
    }
  };

  const trackLinkClick = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const startTime = Date.now();

    // Use atomic operation if new Redis is enabled
    if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
      try {
        const newCount = await redisService.trackClick(variantId);
        
        if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
          const duration = Date.now() - startTime;
          console.log(`[Actions] Click tracked atomically in ${duration}ms. Count: ${newCount}`);
        }

        // If not using new Redis exclusively, also update the full structure
        if (!REDIS_FEATURE_FLAGS.USE_NEW_REDIS) {
          const updatedLinker = Linker.fromData(linker);
          const pageIndex = currentPageIndex;

          if (pageIndex < updatedLinker.pages.length) {
            const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);
            if (cellIndex !== -1) {
              const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
              const linkIndex = targetCell.links.findIndex(l => l.id === variantId);
              if (linkIndex !== -1) {
                targetCell.links[linkIndex].clickCount = newCount;
                await saveLinker(updatedLinker);
              }
            }
          }
        }
        
        return;
      } catch (error) {
        console.error('[Actions] Atomic click tracking failed:', error);
        // Fall through to legacy method
      }
    }

    // Legacy method
    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      return; // Silently fail for tracking
    }

    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex !== -1) {
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      const linkIndex = targetCell.links.findIndex(l => l.id === variantId);

      if (linkIndex !== -1) {
        const targetLink = targetCell.links[linkIndex];
        targetLink.clickCount = (targetLink.clickCount || 0) + 1;
        await saveLinker(updatedLinker);
      }
    }

    if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
      const duration = Date.now() - startTime;
      console.log(`[Actions] Click tracked (legacy) in ${duration}ms`);
    }
  };

  const trackImpression = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const startTime = Date.now();

    // Use atomic operation if new Redis is enabled
    if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
      try {
        await redisService.trackImpression(cellId, variantId);
        
        if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
          const duration = Date.now() - startTime;
          console.log(`[Actions] Impression tracked atomically in ${duration}ms`);
        }

        // If not using new Redis exclusively, also update the full structure
        if (!REDIS_FEATURE_FLAGS.USE_NEW_REDIS) {
          const updatedLinker = Linker.fromData(linker);
          const pageIndex = currentPageIndex;

          if (pageIndex < updatedLinker.pages.length) {
            const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);
            if (cellIndex !== -1) {
              const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
              targetCell.impressionCount = (targetCell.impressionCount || 0) + 1;
              if (!targetCell.variantImpressions) {
                targetCell.variantImpressions = {};
              }
              targetCell.variantImpressions[variantId] = (targetCell.variantImpressions[variantId] || 0) + 1;
              await saveLinker(updatedLinker);
            }
          }
        }
        
        return;
      } catch (error) {
        console.error('[Actions] Atomic impression tracking failed:', error);
        // Fall through to legacy method
      }
    }

    // Legacy method
    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      return; // Silently fail for tracking
    }

    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex !== -1) {
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      targetCell.impressionCount = (targetCell.impressionCount || 0) + 1;
      if (!targetCell.variantImpressions) {
        targetCell.variantImpressions = {};
      }
      targetCell.variantImpressions[variantId] = (targetCell.variantImpressions[variantId] || 0) + 1;
      await saveLinker(updatedLinker);
    }

    if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
      const duration = Date.now() - startTime;
      console.log(`[Actions] Impression tracked (legacy) in ${duration}ms`);
    }
  };

  const nextVariant = async (cellId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex === -1) {
      context.ui.showToast('Cell not found');
      return;
    }

    const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
    targetCell.nextVariant();

    try {
      await saveLinker(updatedLinker);
    } catch (error) {
      context.ui.showToast('Failed to navigate variant');
      throw error;
    }
  };

  const addVariant = async (cellId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex === -1) {
      context.ui.showToast('Cell not found');
      return;
    }

    const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
    targetCell.addVariant();

    // Clear variant cache for this cell since variants were added
    clearCellVariantCache(cellId);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Variant added (${targetCell.getActiveVariantCount()} total)`);
    } catch (error) {
      context.ui.showToast('Failed to add variant');
      throw error;
    }
  };

  const removeVariant = async (cellId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex === -1) {
      context.ui.showToast('Cell not found');
      return;
    }

    const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];

    // Check if this is the last active variant before removing
    const activeVariants = targetCell.links.filter(link => !Link.isEmpty(link));
    const isLastVariant = activeVariants.length <= 1;

    const success = targetCell.removeCurrentVariant();

    if (!success) {
      context.ui.showToast('Failed to remove variant');
      return;
    }

    // Clear variant cache for this cell since variants were removed
    clearCellVariantCache(cellId);

    try {
      await saveLinker(updatedLinker);

      if (isLastVariant) {
        context.ui.showToast('Cell cleared successfully');
      } else {
        context.ui.showToast(`Variant removed (${targetCell.getActiveVariantCount()} remaining)`);
      }
    } catch (error) {
      context.ui.showToast('Failed to remove variant');
      throw error;
    }
  };

  const updatePage = async (data: { id: string, title: string, foregroundColor?: string, backgroundColor?: string, backgroundImage?: string }): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = updatedLinker.pages.findIndex(p => p.id === data.id);

    if (pageIndex !== -1) {
      updatedLinker.pages[pageIndex].title = data.title;
      if (data.foregroundColor) {
        updatedLinker.pages[pageIndex].foregroundColor = data.foregroundColor;
      }
      if (data.backgroundColor) {
        updatedLinker.pages[pageIndex].backgroundColor = data.backgroundColor;
      }
      if (data.backgroundImage !== undefined) {
        updatedLinker.pages[pageIndex].backgroundImage = data.backgroundImage;
      }

      try {
        // If using new Redis, also do atomic update
        if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
          await redisService.updatePage(updatedLinker.pages[pageIndex]);
        }
        
        await saveLinker(updatedLinker);
        context.ui.showToast('Board updated successfully');
      } catch (error) {
        context.ui.showToast('Failed to update board');
        throw error;
      }
    }
  };

  const updateBackgroundImage = async (backgroundImage: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    updatedLinker.pages[pageIndex].backgroundImage = backgroundImage;

    try {
      // If using new Redis, also do atomic update
      if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
        await redisService.updatePage(updatedLinker.pages[pageIndex]);
      }
      
      await saveLinker(updatedLinker);
      context.ui.showToast('Background image updated successfully');
    } catch (error) {
      context.ui.showToast('Failed to update background image');
      throw error;
    }
  };

  const addRow = async (): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const columns = updatedLinker.pages[pageIndex].columns || 4;
    updatedLinker.pages[pageIndex].cells = addRowToGrid(updatedLinker.pages[pageIndex].cells, columns);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast('Row added successfully');
    } catch (error) {
      context.ui.showToast('Failed to add row');
      throw error;
    }
  };

  const addColumn = async (): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const currentColumns = updatedLinker.pages[pageIndex].columns || 4;
    const { cells, columns } = addColumnToGrid(updatedLinker.pages[pageIndex].cells, currentColumns);

    updatedLinker.pages[pageIndex].cells = cells;
    updatedLinker.pages[pageIndex].columns = columns;

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast('Column added successfully');
    } catch (error) {
      context.ui.showToast('Failed to add column');
      throw error;
    }
  };

  const removeRow = async (rowIndex: number): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const columns = updatedLinker.pages[pageIndex].columns || 4;
    updatedLinker.pages[pageIndex].cells = removeRowFromGrid(updatedLinker.pages[pageIndex].cells, rowIndex, columns);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast('Row removed successfully');
    } catch (error) {
      context.ui.showToast('Failed to remove row');
      throw error;
    }
  };

  const removeColumn = async (colIndex: number): Promise<void> => {
    if (!linker) return;

    try {
      const updatedLinker = Linker.fromData(linker);
      const pageIndex = currentPageIndex;

      if (pageIndex >= updatedLinker.pages.length) {
        context.ui.showToast('Page not found');
        return;
      }

      const currentColumns = updatedLinker.pages[pageIndex].columns || 4;
      const { cells, columns } = removeColumnFromGrid(updatedLinker.pages[pageIndex].cells, colIndex, currentColumns);

      updatedLinker.pages[pageIndex].cells = cells;
      updatedLinker.pages[pageIndex].columns = columns;

      await saveLinker(updatedLinker);
      context.ui.showToast('Column removed successfully');
    } catch (error) {
      context.ui.showToast('Cannot remove the last column');
      throw error;
    }
  };

  const addPageAfter = async (pageIndex: number): Promise<void> => {
    if (!linker) {
      throw new Error('No linker data available');
    }

    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const updatedLinker = Linker.fromData(linker);

    const newPage = new Page();
    const newPageNumber = pageIndex + 2;
    newPage.title = `Page ${newPageNumber}`;

    // Copy styling from the reference page
    const referencePage = updatedLinker.pages[pageIndex];
    if (referencePage) {
      newPage.backgroundColor = referencePage.backgroundColor || '#000000';
      newPage.foregroundColor = referencePage.foregroundColor || '#FFFFFF';
      newPage.backgroundImage = referencePage.backgroundImage || '';
      newPage.columns = referencePage.columns || 4;
    }

    // Insert the new page after the specified index
    updatedLinker.pages.splice(pageIndex + 1, 0, newPage);

    // Update subsequent page titles that use default naming
    for (let i = pageIndex + 2; i < updatedLinker.pages.length; i++) {
      const page = updatedLinker.pages[i];
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    try {
      // If using new Redis, also do atomic page add
      if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
        await redisService.addPageAfter(pageIndex, newPage);
      }
      
      await saveLinker(updatedLinker);
      context.ui.showToast(`Page ${newPageNumber} added successfully`);
    } catch (error) {
      console.error('Failed to add page after:', error);
      context.ui.showToast('Failed to add page');
      throw error;
    }
  };

  const addPageBefore = async (pageIndex: number): Promise<void> => {
    if (!linker) {
      throw new Error('No linker data available');
    }

    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const updatedLinker = Linker.fromData(linker);

    const newPage = new Page();
    const newPageNumber = pageIndex + 1;
    newPage.title = `Page ${newPageNumber}`;

    // Copy styling from the reference page
    const referencePage = updatedLinker.pages[pageIndex];
    if (referencePage) {
      newPage.backgroundColor = referencePage.backgroundColor || '#000000';
      newPage.foregroundColor = referencePage.foregroundColor || '#FFFFFF';
      newPage.backgroundImage = referencePage.backgroundImage || '';
      newPage.columns = referencePage.columns || 4;
    }

    // Insert the new page before the specified index
    updatedLinker.pages.splice(pageIndex, 0, newPage);

    // Update titles of existing pages that got shifted
    for (let i = pageIndex + 1; i < updatedLinker.pages.length; i++) {
      const page = updatedLinker.pages[i];
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Page ${newPageNumber} added successfully`);
    } catch (error) {
      console.error('Failed to add page before:', error);
      context.ui.showToast('Failed to add page');
      throw error;
    }
  };

  const removePage = async (pageIndex: number): Promise<void> => {
    if (!linker) {
      throw new Error('No linker data available');
    }

    if (linker.pages.length <= 1) {
      throw new Error('Cannot remove the last page');
    }

    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const updatedLinker = Linker.fromData(linker);
    const pageToRemove = updatedLinker.pages[pageIndex];

    // Remove the page
    updatedLinker.pages.splice(pageIndex, 1);

    // Update titles of remaining pages that use default naming
    for (let i = 0; i < updatedLinker.pages.length; i++) {
      const page = updatedLinker.pages[i];
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    try {
      // If using new Redis, also do atomic page remove
      if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS || REDIS_FEATURE_FLAGS.DUAL_WRITE) {
        await redisService.removePage(pageIndex);
      }
      
      await saveLinker(updatedLinker);
      context.ui.showToast(`Page "${pageToRemove.title}" removed successfully`);
    } catch (error) {
      console.error('Failed to remove page:', error);
      context.ui.showToast('Failed to remove page');
      throw error;
    }
  };

  return {
    updateCell,
    updatePage,
    updateBackgroundImage,
    addRow,
    addColumn,
    removeRow,
    removeColumn,
    trackLinkClick,
    trackImpression,
    nextVariant,
    addVariant,
    removeVariant,
    addPageAfter,
    addPageBefore,
    removePage
  };
};