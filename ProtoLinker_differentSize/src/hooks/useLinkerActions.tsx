// Updated useLinkerActions.tsx - More reliable page management operations
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
  // Enhanced page management methods
  addPageAfter: (pageIndex: number) => Promise<void>;
  addPageBefore: (pageIndex: number) => Promise<void>;
  removePage: (pageIndex: number) => Promise<void>;
  updateCellSpan: (cellId: string, rowSpan: number, colSpan: number) => Promise<void>;
  updateGridDimensions: (rows: number, columns: number) => Promise<void>;

}

/**
 * Enhanced linker actions with more reliable page management
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

  const updateCellSpan = async (cellId: string, rowSpan: number, colSpan: number): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const page = updatedLinker.pages[pageIndex];
    const cell = page.cells.find(c => c.id === cellId);

    if (!cell) {
      context.ui.showToast('Cell not found');
      return;
    }

    // Check if the new span would fit
    if (!page.canPlaceCell(cell.row, cell.col, rowSpan, colSpan, cellId)) {
      context.ui.showToast('Cannot resize cell - would overlap with other cells or exceed grid boundaries');
      return;
    }

    // Update the cell span
    cell.rowSpan = rowSpan;
    cell.colSpan = colSpan;

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Cell resized to ${rowSpan}×${colSpan}`);
    } catch (error) {
      context.ui.showToast('Failed to resize cell');
      throw error;
    }
  };

  const updateGridDimensions = async (rows: number, columns: number): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const page = updatedLinker.pages[pageIndex];

    // Update grid dimensions
    page.updateGridDimensions(rows, columns);

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast(`Grid resized to ${rows}×${columns}`);
    } catch (error) {
      context.ui.showToast('Failed to resize grid');
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

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

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

    const page = updatedLinker.pages[pageIndex];
    const newRows = page.rows + 1;

    // Add new row of empty cells
    for (let col = 0; col < page.columns; col++) {
      const newCell = new LinkCell();
      newCell.row = page.rows;
      newCell.col = col;
      newCell.rowSpan = 1;
      newCell.colSpan = 1;
      page.cells.push(newCell);
    }

    page.rows = newRows;

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

  // Modified addColumn to work with grid system
  const addColumn = async (): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const page = updatedLinker.pages[pageIndex];
    const newColumns = page.columns + 1;

    // Add new column of empty cells
    for (let row = 0; row < page.rows; row++) {
      const newCell = new LinkCell();
      newCell.row = row;
      newCell.col = page.columns;
      newCell.rowSpan = 1;
      newCell.colSpan = 1;
      page.cells.push(newCell);
    }

    page.columns = newColumns;

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

    const page = updatedLinker.pages[pageIndex];

    if (page.rows <= 1) {
      context.ui.showToast('Cannot remove the last row');
      return;
    }

    // Remove cells in this row and adjust positions of cells below
    page.cells = page.cells.filter(cell => {
      // Remove cells that start in this row
      if (cell.row === rowIndex) {
        return false;
      }
      // Adjust cells that span into this row
      if (cell.row < rowIndex && cell.row + cell.rowSpan > rowIndex) {
        cell.rowSpan = Math.min(cell.rowSpan, rowIndex - cell.row);
      }
      // Move cells below this row up
      if (cell.row > rowIndex) {
        cell.row--;
      }
      return true;
    });

    page.rows--;

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

  // Modified removeColumn to handle spanning cells
  const removeColumn = async (colIndex: number): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = currentPageIndex;

    if (pageIndex >= updatedLinker.pages.length) {
      context.ui.showToast('Page not found');
      return;
    }

    const page = updatedLinker.pages[pageIndex];

    if (page.columns <= 1) {
      context.ui.showToast('Cannot remove the last column');
      return;
    }

    // Remove cells in this column and adjust positions of cells to the right
    page.cells = page.cells.filter(cell => {
      // Remove cells that start in this column
      if (cell.col === colIndex) {
        return false;
      }
      // Adjust cells that span into this column
      if (cell.col < colIndex && cell.col + cell.colSpan > colIndex) {
        cell.colSpan = Math.min(cell.colSpan, colIndex - cell.col);
      }
      // Move cells to the right of this column left
      if (cell.col > colIndex) {
        cell.col--;
      }
      return true;
    });

    page.columns--;

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast('Column removed successfully');
    } catch (error) {
      context.ui.showToast('Failed to remove column');
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

        // For click tracking, use minimal optimistic update to avoid interfering with UI
        // but don't delay save operation
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

      // For impression tracking, we can optimistically update but save without delay
      updateLinkerOptimistically(updatedLinker);
      await saveLinker(updatedLinker);
    }
  };

  // ENHANCED PAGE MANAGEMENT METHODS with better error handling and validation

  const addPageAfter = async (pageIndex: number): Promise<void> => {
    if (!linker) {
      throw new Error('No linker data available');
    }

    // Validate pageIndex
    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const updatedLinker = Linker.fromData(linker);

    // Create a new page with proper defaults
    const newPage = new Page();

    // Generate a proper title
    const newPageNumber = pageIndex + 2; // Adding after pageIndex, so new page will be pageIndex + 1, but human readable is +2
    newPage.title = `Page ${newPageNumber}`;

    // Copy styling from the reference page to maintain consistency
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
      // Only update if it looks like a default title
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    console.log(`Adding page after index ${pageIndex}. New page will be at index ${pageIndex + 1}`);

    // Apply optimistic update immediately
    updateLinkerOptimistically(updatedLinker);

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

    // Validate pageIndex
    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const updatedLinker = Linker.fromData(linker);

    // Create a new page
    const newPage = new Page();
    const newPageNumber = pageIndex + 1; // Human-readable number for the new page
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
      // Only update if it looks like a default title
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    console.log(`Adding page before index ${pageIndex}. New page will be at index ${pageIndex}, existing page shifts to ${pageIndex + 1}`);

    // Apply optimistic update immediately
    updateLinkerOptimistically(updatedLinker);

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

    // Validate pageIndex
    if (pageIndex < 0 || pageIndex >= linker.pages.length) {
      throw new Error(`Invalid page index: ${pageIndex}`);
    }

    const updatedLinker = Linker.fromData(linker);
    const pageToRemove = updatedLinker.pages[pageIndex];

    console.log(`Removing page at index ${pageIndex}: "${pageToRemove.title}"`);

    // Remove the page
    updatedLinker.pages.splice(pageIndex, 1);

    // Update titles of remaining pages that use default naming
    for (let i = 0; i < updatedLinker.pages.length; i++) {
      const page = updatedLinker.pages[i];
      if (page.title.match(/^Page \d+$/)) {
        page.title = `Page ${i + 1}`;
      }
    }

    console.log(`Page removed. Remaining pages: ${updatedLinker.pages.length}`);

    // Apply optimistic update immediately
    updateLinkerOptimistically(updatedLinker);

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
    // Variant management methods
    nextVariant,
    addVariant,
    removeVariant,
    // Enhanced page management methods with better error handling
    addPageAfter,
    addPageBefore,
    removePage,
    updateCellSpan,
    updateGridDimensions,
  };
};