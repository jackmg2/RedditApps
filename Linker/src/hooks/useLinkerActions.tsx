import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { Page } from '../types/page.js';
import { addRowToGrid, addColumnToGrid, removeRowFromGrid, removeColumnFromGrid } from '../utils/gridUtils.js';

interface UseLinkerActionsProps {
  linker: Linker | null;
  saveLinker: (linker: Linker) => Promise<void>;
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
export const useLinkerActions = ({ linker, saveLinker, context }: UseLinkerActionsProps): UseLinkerActionsReturn => {
  
  const updateLink = async (link: Link): Promise<void> => {
    if (!linker) return;
    
    const updatedLinker = Linker.fromData(linker);
    const pageIndex = 0; // Currently only supports the first page
    const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === link.id);

    if (linkIndex !== -1) {
      // Preserve the structure and ensure all properties are set
      const updatedLink = Link.fromData({
        id: link.id,
        uri: link.uri,
        title: link.title,
        image: link.image,
        textColor: link.textColor,
        description: link.description,
        backgroundColor: link.backgroundColor,
        backgroundOpacity: link.backgroundOpacity,
        clickCount: link.clickCount || 0
      });
      
      updatedLinker.pages[pageIndex].links[linkIndex] = updatedLink;
      await saveLinker(updatedLinker);
      context.ui.showToast('Link updated successfully');
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
      
      await saveLinker(updatedLinker);
      context.ui.showToast('Board updated successfully');
    }
  };

  const updateBackgroundImage = async (backgroundImage: string): Promise<void> => {
    if (!linker) return;
    
    const updatedLinker = Linker.fromData(linker);
    updatedLinker.pages[0].backgroundImage = backgroundImage;
    
    await saveLinker(updatedLinker);
    context.ui.showToast('Background image updated successfully');
  };

  const addRow = async (): Promise<void> => {
    if (!linker) return;
    
    const updatedLinker = Linker.fromData(linker);
    const columns = updatedLinker.pages[0].columns || 4;
    
    updatedLinker.pages[0].links = addRowToGrid(updatedLinker.pages[0].links, columns);
    
    await saveLinker(updatedLinker);
    context.ui.showToast('Row added successfully');
  };

  const addColumn = async (): Promise<void> => {
    if (!linker) return;
    
    const updatedLinker = Linker.fromData(linker);
    const currentColumns = updatedLinker.pages[0].columns || 4;
    
    const { links, columns } = addColumnToGrid(updatedLinker.pages[0].links, currentColumns);
    
    updatedLinker.pages[0].links = links;
    updatedLinker.pages[0].columns = columns;
    
    await saveLinker(updatedLinker);
    context.ui.showToast('Column added successfully');
  };

  const removeRow = async (rowIndex: number): Promise<void> => {
    if (!linker) return;
    
    const updatedLinker = Linker.fromData(linker);
    const columns = updatedLinker.pages[0].columns || 4;
    
    updatedLinker.pages[0].links = removeRowFromGrid(updatedLinker.pages[0].links, rowIndex, columns);
    
    await saveLinker(updatedLinker);
    context.ui.showToast('Row removed successfully');
  };

  const removeColumn = async (colIndex: number): Promise<void> => {
    if (!linker) return;
    
    try {
      const updatedLinker = Linker.fromData(linker);
      const currentColumns = updatedLinker.pages[0].columns || 4;
      
      const { links, columns } = removeColumnFromGrid(updatedLinker.pages[0].links, colIndex, currentColumns);
      
      updatedLinker.pages[0].links = links;
      updatedLinker.pages[0].columns = columns;
      
      await saveLinker(updatedLinker);
      context.ui.showToast('Column removed successfully');
    } catch (error) {
      context.ui.showToast('Cannot remove the last column');
    }
  };

  const trackLinkClick = async (linkId: string): Promise<void> => {
    if (!linker) return;
    
    const updatedLinker = Linker.fromData(linker);
    const pageIndex = 0; // Currently only supports the first page
    const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === linkId);

    if (linkIndex !== -1) {
      const targetLink = updatedLinker.pages[pageIndex].links[linkIndex];
      if (targetLink.trackClick) {
        targetLink.trackClick();
      } else {
        targetLink.clickCount = (targetLink.clickCount || 0) + 1;
      }
      
      await saveLinker(updatedLinker);
      console.log(`Tracked click for link ${linkId}, new count: ${targetLink.clickCount}`);
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