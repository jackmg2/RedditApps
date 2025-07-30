import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { Page } from '../types/page.js';
import { addRowToGrid, addColumnToGrid, removeRowFromGrid, removeColumnFromGrid } from '../utils/gridUtils.js';

interface UseLinkerActionsProps {
  linker: Linker | null;
  saveLinker: (linker: Linker) => Promise<void>;
  updateLinkerOptimistically: (linker: Linker) => void; // Required, not optional
  context: any;
}

interface UseLinkerActionsReturn {
  updateLink: (link: Link) => Promise<void>;
  updatePage: (data: { id: string, title: string, foregroundColor?: string, backgroundColor?: string, backgroundImage?: string }) => Promise<void>;
  updateBackgroundImage: (backgroundImage: string) => Promise<void>;
  addRow: () => Promise<void>;
  addColumn: () => Promise<void>;
  removeRow: (rowIndex: number) => Promise<void>;
  removeColumn: (colIndex: number) => Promise<void>;
  trackLinkClick: (linkId: string) => Promise<void>;
}

/**
 * Custom hook for all linker CRUD operations
 */
export const useLinkerActions = ({ linker, saveLinker, updateLinkerOptimistically, context }: UseLinkerActionsProps): UseLinkerActionsReturn => {

  const updateLink = async (link: Link): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = 0; // Currently only supports the first page
    const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === link.id);

    // Create the updated link with proper data
    const updatedLink = Link.fromData({
      id: link.id,
      uri: link.uri || '',
      title: link.title || '',
      image: link.image || '',
      textColor: link.textColor || '#FFFFFF',
      description: link.description || '',
      backgroundColor: link.backgroundColor || '#000000',
      backgroundOpacity: typeof link.backgroundOpacity === 'number' ? link.backgroundOpacity : 0.5,
      clickCount: typeof link.clickCount === 'number' ? link.clickCount : 0
    });

    updatedLinker.pages[pageIndex].links[linkIndex] = updatedLink;

    // Show immediate feedback with optimistic update
    updateLinkerOptimistically(updatedLinker);

    try {
      await saveLinker(updatedLinker);
      context.ui.showToast('Link updated successfully');
    } catch (error) {
      context.ui.showToast('Failed to update link');
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

    updatedLinker.pages[0].links = addRowToGrid(updatedLinker.pages[0].links, columns);

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

    const { links, columns } = addColumnToGrid(updatedLinker.pages[0].links, currentColumns);

    updatedLinker.pages[0].links = links;
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

    updatedLinker.pages[0].links = removeRowFromGrid(updatedLinker.pages[0].links, rowIndex, columns);

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

      const { links, columns } = removeColumnFromGrid(updatedLinker.pages[0].links, colIndex, currentColumns);

      updatedLinker.pages[0].links = links;
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

  const trackLinkClick = async (linkId: string): Promise<void> => {
    if (!linker) return;

    const updatedLinker = Linker.fromData(linker);
    const pageIndex = 0; // Currently only supports the first page
    const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === linkId);

    if (linkIndex !== -1) {
      const targetLink = updatedLinker.pages[pageIndex].links[linkIndex];
      targetLink.clickCount = (targetLink.clickCount || 0) + 1;

      // For click tracking, we can optimistically update
      updateLinkerOptimistically(updatedLinker);

      await saveLinker(updatedLinker);

    }
  };

  return {
    updateLink,
    updatePage,
    updateBackgroundImage,
    addRow,
    addColumn,
    removeRow,
    removeColumn,
    trackLinkClick
  };
};