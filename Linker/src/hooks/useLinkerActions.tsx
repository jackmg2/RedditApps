import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { Page } from '../types/page.js';
import { addRowToGrid, addColumnToGrid, removeRowFromGrid, removeColumnFromGrid } from '../utils/gridUtils.js';
import { clearCellVariantCache } from '../utils/rotationUtils.js';

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
 * Optimized linker actions using Redis Hash operations
 */
export const useLinkerActions = ({ linker, saveLinker, updateLinkerOptimistically, context, currentPageIndex = 0 }: UseLinkerActionsProps): UseLinkerActionsReturn => {

  // Helper to save only a specific cell using hash update
  const saveCellToHash = async (pageId: string, cell: LinkCell): Promise<void> => {
    const postId = context.postId;
    const cellKey = `cell_${postId}_${cell.id}`;
    
    await context.redis.hSet(cellKey, {
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
  };

  // Helper to save only a specific page metadata using hash update
  const savePageToHash = async (page: Page): Promise<void> => {
    const postId = context.postId;
    const pageKey = `page_${postId}_${page.id}`;
    const cellIds = page.cells.map(c => c.id).join(',');
    
    await context.redis.hSet(pageKey, {
      id: page.id,
      title: page.title || '',
      backgroundColor: page.backgroundColor || '#000000',
      foregroundColor: page.foregroundColor || '#FFFFFF',
      backgroundImage: page.backgroundImage || '',
      columns: (page.columns || 4).toString(),
      cellIds: cellIds
    });
  };

  // Helper to update just the click count for a link
  const updateCellClickCount = async (pageId: string, cellId: string, variantId: string, increment: number = 1): Promise<void> => {
    const postId = context.postId;
    const cellKey = `cell_${postId}_${cellId}`;
    
    // Fetch current cell data
    const cellData = await context.redis.hGet(cellKey, 'links');
    if (cellData) {
      const links = JSON.parse(cellData);
      const linkIndex = links.findIndex((l: any) => l.id === variantId);
      
      if (linkIndex !== -1) {
        links[linkIndex].clickCount = (links[linkIndex].clickCount || 0) + increment;
        
        // Update only the links field
        await context.redis.hSet(cellKey, {
          links: JSON.stringify(links)
        });
      }
    }
  };

  // Helper to update impression tracking - FIXED: Use individual hGet calls instead of array
  const updateCellImpressions = async (pageId: string, cellId: string, variantId: string): Promise<void> => {
    const postId = context.postId;
    const cellKey = `cell_${postId}_${cellId}`;
    
    try {
      // FIXED: Make separate hGet calls instead of passing an array
      const impressionCountStr = await context.redis.hGet(cellKey, 'impressionCount');
      const variantImpressionsStr = await context.redis.hGet(cellKey, 'variantImpressions');
      
      const impressionCount = parseInt(impressionCountStr || '0') + 1;
      const variantImpressions = variantImpressionsStr ? JSON.parse(variantImpressionsStr) : {};
      variantImpressions[variantId] = (variantImpressions[variantId] || 0) + 1;
      
      // Update only impression fields
      await context.redis.hSet(cellKey, {
        impressionCount: impressionCount.toString(),
        variantImpressions: JSON.stringify(variantImpressions)
      });
    } catch (error) {
      console.error('Error updating cell impressions:', error);
      // Fallback: still increment local state even if Redis update fails
    }
  };

  const updateCell = async (cell: LinkCell): Promise<void> => {
    if (!linker) return;

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
      // Optimized: Only update the specific cell in Redis
      await saveCellToHash(updatedLinker.pages[pageIndex].id, updatedCell);
      
      // Update optimistic state
      updateLinkerOptimistically(updatedLinker);
      
      context.ui.showToast('Cell updated successfully');
    } catch (error) {
      context.ui.showToast('Failed to update cell');
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
        // Optimized: Only update the specific page metadata
        await savePageToHash(updatedLinker.pages[pageIndex]);
        
        // Update optimistic state
        updateLinkerOptimistically(updatedLinker);
        
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
      // Optimized: Only update the background image field
      const postId = context.postId;
      const pageKey = `page_${postId}_${updatedLinker.pages[pageIndex].id}`;
      
      await context.redis.hSet(pageKey, {
        backgroundImage: backgroundImage
      });
      
      // Update optimistic state
      updateLinkerOptimistically(updatedLinker);
      
      context.ui.showToast('Background image updated successfully');
    } catch (error) {
      context.ui.showToast('Failed to update background image');
      throw error;
    }
  };

  const trackLinkClick = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const pageIndex = currentPageIndex;
    if (pageIndex >= linker.pages.length) return;

    const cellIndex = linker.pages[pageIndex].cells.findIndex(c => c.id === cellId);
    if (cellIndex === -1) return;

    try {
      // Optimized: Only update the click count in Redis
      await updateCellClickCount(linker.pages[pageIndex].id, cellId, variantId);
      
      // Update local state for immediate UI feedback
      const updatedLinker = Linker.fromData(linker);
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      const linkIndex = targetCell.links.findIndex(l => l.id === variantId);
      
      if (linkIndex !== -1) {
        targetCell.links[linkIndex].clickCount = (targetCell.links[linkIndex].clickCount || 0) + 1;
        updateLinkerOptimistically(updatedLinker);
      }
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  };

  const trackImpression = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const pageIndex = currentPageIndex;
    if (pageIndex >= linker.pages.length) return;

    const cellIndex = linker.pages[pageIndex].cells.findIndex(c => c.id === cellId);
    if (cellIndex === -1) return;

    try {
      // Optimized: Only update impression data in Redis
      await updateCellImpressions(linker.pages[pageIndex].id, cellId, variantId);
      
      // Update local state for immediate UI feedback
      const updatedLinker = Linker.fromData(linker);
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      
      targetCell.impressionCount = (targetCell.impressionCount || 0) + 1;
      if (!targetCell.variantImpressions) {
        targetCell.variantImpressions = {};
      }
      targetCell.variantImpressions[variantId] = (targetCell.variantImpressions[variantId] || 0) + 1;
      
      updateLinkerOptimistically(updatedLinker);
    } catch (error) {
      console.error('Failed to track impression:', error);
    }
  };

  // For operations that need full linker update (add/remove rows, columns, pages)
  // we still need to use the full saveLinker method
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
    
    // Get cells that will be removed (for cleanup)
    const startIndex = rowIndex * columns;
    const endIndex = startIndex + columns;
    const cellsToRemove = updatedLinker.pages[pageIndex].cells.slice(startIndex, endIndex);

    updatedLinker.pages[pageIndex].cells = removeRowFromGrid(updatedLinker.pages[pageIndex].cells, rowIndex, columns);

    try {
      // Delete removed cells from Redis
      const postId = context.postId;
      for (const cell of cellsToRemove) {
        const cellKey = `cell_${postId}_${cell.id}`;
        await context.redis.del(cellKey);
      }
      
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
      
      // Get cells that will be removed (for cleanup)
      const cellsToRemove: LinkCell[] = [];
      const rows = Math.ceil(updatedLinker.pages[pageIndex].cells.length / currentColumns);
      
      for (let row = 0; row < rows; row++) {
        const index = row * currentColumns + colIndex;
        if (index < updatedLinker.pages[pageIndex].cells.length) {
          cellsToRemove.push(updatedLinker.pages[pageIndex].cells[index]);
        }
      }

      const { cells, columns } = removeColumnFromGrid(updatedLinker.pages[pageIndex].cells, colIndex, currentColumns);

      updatedLinker.pages[pageIndex].cells = cells;
      updatedLinker.pages[pageIndex].columns = columns;

      // Delete removed cells from Redis
      const postId = context.postId;
      for (const cell of cellsToRemove) {
        const cellKey = `cell_${postId}_${cell.id}`;
        await context.redis.del(cellKey);
      }

      await saveLinker(updatedLinker);
      context.ui.showToast('Column removed successfully');
    } catch (error) {
      context.ui.showToast('Cannot remove the last column');
      throw error;
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
      // Optimized: Only update the currentEditingIndex
      const postId = context.postId;
      const cellKey = `cell_${postId}_${cellId}`;
      
      await context.redis.hSet(cellKey, {
        currentEditingIndex: targetCell.currentEditingIndex.toString()
      });
      
      updateLinkerOptimistically(updatedLinker);
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

    clearCellVariantCache(cellId);

    try {
      // Need to update the full cell since we're modifying arrays
      await saveCellToHash(updatedLinker.pages[pageIndex].id, targetCell);
      updateLinkerOptimistically(updatedLinker);
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
    const activeVariants = targetCell.links.filter(link => !Link.isEmpty(link));
    const isLastVariant = activeVariants.length <= 1;

    const success = targetCell.removeCurrentVariant();

    if (!success) {
      context.ui.showToast('Failed to remove variant');
      return;
    }

    clearCellVariantCache(cellId);

    try {
      // Need to update the full cell since we're modifying arrays
      await saveCellToHash(updatedLinker.pages[pageIndex].id, targetCell);
      updateLinkerOptimistically(updatedLinker);

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

    const referencePage = updatedLinker.pages[pageIndex];
    if (referencePage) {
      newPage.backgroundColor = referencePage.backgroundColor || '#000000';
      newPage.foregroundColor = referencePage.foregroundColor || '#FFFFFF';
      newPage.backgroundImage = referencePage.backgroundImage || '';
      newPage.columns = referencePage.columns || 4;
    }

    updatedLinker.pages.splice(pageIndex + 1, 0, newPage);

    for (let i = pageIndex + 2; i < updatedLinker.pages.length; i++) {
      const page = updatedLinker.pages[i];
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    try {
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

    const referencePage = updatedLinker.pages[pageIndex];
    if (referencePage) {
      newPage.backgroundColor = referencePage.backgroundColor || '#000000';
      newPage.foregroundColor = referencePage.foregroundColor || '#FFFFFF';
      newPage.backgroundImage = referencePage.backgroundImage || '';
      newPage.columns = referencePage.columns || 4;
    }

    updatedLinker.pages.splice(pageIndex, 0, newPage);

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

    // Delete all cells for this page from Redis
    const postId = context.postId;
    for (const cell of pageToRemove.cells) {
      const cellKey = `cell_${postId}_${cell.id}`;
      await context.redis.del(cellKey);
    }
    
    // Delete the page from Redis
    const pageKey = `page_${postId}_${pageToRemove.id}`;
    await context.redis.del(pageKey);

    // Remove the page from the array
    updatedLinker.pages.splice(pageIndex, 1);

    // Update titles of remaining pages
    for (let i = 0; i < updatedLinker.pages.length; i++) {
      const page = updatedLinker.pages[i];
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    try {
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