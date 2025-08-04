// Updated useLinkerActions.tsx - With page management functionality
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
  // New page management methods
  addPageAfter: (pageIndex: number) => Promise<void>;
  addPageBefore: (pageIndex: number) => Promise<void>;
  removePage: (pageIndex: number) => Promise<void>;
}

/**
 * Enhanced linker actions with page management functionality
 */
export const useLinkerActions = ({ linker, saveLinker, updateLinkerOptimistically, context, currentPageIndex = 0 }: UseLinkerActionsProps): UseLinkerActionsReturn => {

  const updateCell = async (cell: LinkCell): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex; // Use current page index instead of hardcoded 0
    
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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast('Cell updated successfully');
    } catch (error) {
      context.ui.showToast('Failed to update cell');
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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

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
    targetCell.addVariant(); // This creates a new Link and sets currentEditingIndex to it

    // Clear variant cache for this cell since variants were added
    clearCellVariantCache(cellId);

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

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
    const success = targetCell.removeCurrentVariant();

    if (!success) {
      context.ui.showToast('Cannot remove the last variant');
      return;
    }

    // Clear variant cache for this cell since variants were removed
    clearCellVariantCache(cellId);

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Variant removed (${targetCell.getActiveVariantCount()} remaining)`);
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

      // Show immediate feedback with optimistic update
      updateLinkerOptimistically(updatedLinker);

      try {
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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

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

      // Show immediate feedback with optimistic update
      updateLinkerOptimistically(updatedLinker);

      await saveLinker(updatedLinker);
      context.ui.showToast('Column removed successfully');
    } catch (error) {
      context.ui.showToast('Cannot remove the last column');
      throw error;
    }
  };

  const trackLinkClick = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;
    
    if (pageIndex >= updatedLinker.pages.length) {
      return; // Silently fail for tracking to avoid interrupting user experience
    }
    
    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex !== -1) {
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      const linkIndex = targetCell.links.findIndex(l => l.id === variantId);
      
      if (linkIndex !== -1) {
        const targetLink = targetCell.links[linkIndex];
        targetLink.clickCount = (targetLink.clickCount || 0) + 1;

        // No optimistic update here to avoid visual artifacts
        await saveLinker(updatedLinker);
      }
    }
  };

  const trackImpression = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;
    
    if (pageIndex >= updatedLinker.pages.length) {
      return; // Silently fail for tracking to avoid interrupting user experience
    }
    
    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex !== -1) {
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      
      // Track impression at cell level
      targetCell.impressionCount = (targetCell.impressionCount || 0) + 1;
      
      // Track impression for specific variant
      if (!targetCell.variantImpressions) {
        targetCell.variantImpressions = {};
      }
      targetCell.variantImpressions[variantId] = (targetCell.variantImpressions[variantId] || 0) + 1;

      // For impression tracking, we can optimistically update
      updateLinkerOptimistically(updatedLinker);

      // Save impressions (could be batched for performance if needed)
      await saveLinker(updatedLinker);
    }
  };

  // NEW PAGE MANAGEMENT METHODS

  const addPageAfter = async (pageIndex: number): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    
    // Create a new page
    const newPage = new Page();
    newPage.title = `Page ${updatedLinker.pages.length + 1}`;
    
    // Copy style from current page
    if (pageIndex >= 0 && pageIndex < updatedLinker.pages.length) {
      const currentPage = updatedLinker.pages[pageIndex];
      newPage.backgroundColor = currentPage.backgroundColor;
      newPage.foregroundColor = currentPage.foregroundColor;
      newPage.backgroundImage = currentPage.backgroundImage;
      newPage.columns = currentPage.columns;
    }

    // Insert the new page after the specified index
    updatedLinker.pages.splice(pageIndex + 1, 0, newPage);

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Page ${pageIndex + 2} added successfully`);
    } catch (error) {
      context.ui.showToast('Failed to add page');
      throw error;
    }
  };

  const addPageBefore = async (pageIndex: number): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    
    // Create a new page
    const newPage = new Page();
    newPage.title = `Page ${pageIndex + 1}`;
    
    // Copy style from current page
    if (pageIndex >= 0 && pageIndex < updatedLinker.pages.length) {
      const currentPage = updatedLinker.pages[pageIndex];
      newPage.backgroundColor = currentPage.backgroundColor;
      newPage.foregroundColor = currentPage.foregroundColor;
      newPage.backgroundImage = currentPage.backgroundImage;
      newPage.columns = currentPage.columns;
    }

    // Insert the new page before the specified index
    updatedLinker.pages.splice(pageIndex, 0, newPage);

    // Update titles of existing pages after insertion
    for (let i = pageIndex + 1; i < updatedLinker.pages.length; i++) {
      if (updatedLinker.pages[i].title.startsWith('Page ')) {
        updatedLinker.pages[i].title = `Page ${i + 1}`;
      }
    }

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Page ${pageIndex + 1} added successfully`);
    } catch (error) {
      context.ui.showToast('Failed to add page');
      throw error;
    }
  };

  const removePage = async (pageIndex: number): Promise<void> => {
    if (!linker) return;

    if (linker.pages.length <= 1) {
      context.ui.showToast('Cannot remove the last page');
      return;
    }

    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      context.ui.showToast('Invalid page index');
      return;
    }

    const updatedLinker = Linker.fromData(linker);
    
    // Remove the page
    updatedLinker.pages.splice(pageIndex, 1);

    // Update titles of remaining pages if they use default naming
    for (let i = 0; i < updatedLinker.pages.length; i++) {
      if (updatedLinker.pages[i].title.startsWith('Page ')) {
        updatedLinker.pages[i].title = `Page ${i + 1}`;
      }
    }

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Page ${pageIndex + 1} removed successfully`);
    } catch (error) {
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
    // Variant management methods
    nextVariant,
    addVariant,
    removeVariant,
    // NEW page management methods
    addPageAfter,
    addPageBefore,
    removePage
  };
};