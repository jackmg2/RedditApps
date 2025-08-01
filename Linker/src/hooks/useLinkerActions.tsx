// Updated useLinkerActions.tsx - Removed optimistic update from trackLinkClick
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
  // New variant management methods
  nextVariant: (cellId: string) => Promise<void>;
  addVariant: (cellId: string) => Promise<void>;
  removeVariant: (cellId: string) => Promise<void>;
}

/**
 * Enhanced linker actions with variant management functionality
 */
export const useLinkerActions = ({ linker, saveLinker, updateLinkerOptimistically, context }: UseLinkerActionsProps): UseLinkerActionsReturn => {

  const updateCell = async (cell: LinkCell): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = 0; // Currently only supports the first page
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
    const pageIndex = 0;
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
    const pageIndex = 0;
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
    const pageIndex = 0;
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
    updatedLinker.pages[0].backgroundImage = backgroundImage;

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
    const columns = updatedLinker.pages[0].columns || 4;

    updatedLinker.pages[0].cells = addRowToGrid(updatedLinker.pages[0].cells, columns);

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
    const currentColumns = updatedLinker.pages[0].columns || 4;

    const { cells, columns } = addColumnToGrid(updatedLinker.pages[0].cells, currentColumns);

    updatedLinker.pages[0].cells = cells;
    updatedLinker.pages[0].columns = columns;

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
    const columns = updatedLinker.pages[0].columns || 4;

    updatedLinker.pages[0].cells = removeRowFromGrid(updatedLinker.pages[0].cells, rowIndex, columns);

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
      const currentColumns = updatedLinker.pages[0].columns || 4;

      const { cells, columns } = removeColumnFromGrid(updatedLinker.pages[0].cells, colIndex, currentColumns);

      updatedLinker.pages[0].cells = cells;
      updatedLinker.pages[0].columns = columns;

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
    const pageIndex = 0; // Currently only supports the first page
    const cellIndex = updatedLinker.pages[pageIndex].cells.findIndex(c => c.id === cellId);

    if (cellIndex !== -1) {
      const targetCell = updatedLinker.pages[pageIndex].cells[cellIndex];
      const linkIndex = targetCell.links.findIndex(l => l.id === variantId);
      
      if (linkIndex !== -1) {
        const targetLink = targetCell.links[linkIndex];
        targetLink.clickCount = (targetLink.clickCount || 0) + 1;

        // FIXED: No optimistic update here - just save to avoid visual artifacts
        // The user has already navigated, so they won't see the re-render
        await saveLinker(updatedLinker);
      }
    }
  };

  const trackImpression = async (cellId: string, variantId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = 0; // Currently only supports the first page
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
    // New variant management methods
    nextVariant,
    addVariant,
    removeVariant
  };
};