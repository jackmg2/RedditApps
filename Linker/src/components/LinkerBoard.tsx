// Updated LinkerBoard.tsx - With unified page index state management
import { Devvit, useState } from '@devvit/public-api';
import { useModerator } from '../hooks/useModerator.js';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { useBackgroundImageForm } from '../forms/BackgroundImageForm.js';
import { LinkGrid } from './LinkGrid.js';
import { ModeratorToolbar } from './ModeratorToolbar.js';
import { AnalyticsOverlay } from './AnalyticsOverlay.js';
import { PageNavigation } from './PageNavigation.js';
import { PageSideNavigation } from './PageSideNavigation.js';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { shouldPreventNavigation, normalizeUrl, isSafeUrl } from '../utils/linkUtils.js';
import { getNavigationIndices, validateNavigationState, createDefaultPageTitle } from '../utils/pageUtils.js';

interface LinkerBoardProps {
  context: any;
  linkerDataHook: {
    linker: any;
    loading: boolean;
    error: Error | null;
    refreshData: () => void;
    saveLinker: (linker: any) => Promise<void>;
    updateLinkerOptimistically: (linker: any) => void;
  };
  linkerActions: {
    updateCell: (cell: LinkCell) => Promise<void>;
    updatePage: (data: any) => Promise<void>;
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
    // Page management actions
    addPageAfter: (pageIndex: number) => Promise<void>;
    addPageBefore: (pageIndex: number) => Promise<void>;
    removePage: (pageIndex: number) => Promise<void>;
  };
  onShowEditCellForm: (cell: LinkCell, variantIndex: number) => void;
  onShowEditPageForm: (pageData: any) => void;
  // NEW: External page index state management
  currentPageIndex: number;
  setCurrentPageIndex: (index: number) => void;
}

/**
 * Enhanced board component with unified page index state management
 */
export const LinkerBoard: Devvit.BlockComponent<LinkerBoardProps> = ({
  context,
  linkerDataHook,
  linkerActions,
  onShowEditCellForm,
  onShowEditPageForm,
  currentPageIndex,
  setCurrentPageIndex
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDescriptionMap, setShowDescriptionMap] = useState<{ [key: string]: boolean }>({});
  const [editingVariantMap, setEditingVariantMap] = useState<{ [key: string]: number }>({});
  const [preventNavigationTimestamp, setPreventNavigationTimestamp] = useState(0);
  const [showAnalyticsOverlay, setShowAnalyticsOverlay] = useState(false);
  const [buttonClickTimestamps, setButtonClickTimestamps] = useState<{ [key: string]: number }>({});

  const { linker, loading, error } = linkerDataHook;
  const { isModerator } = useModerator(context);

  // Ensure current page index is valid and validate navigation state
  let validPageIndex = currentPageIndex;
  if (linker && linker.pages) {
    const validation = validateNavigationState(currentPageIndex, linker.pages.length, linker.pages);
    
    if (!validation.isValid) {
      console.warn('Navigation validation errors:', validation.errors);
      validPageIndex = validation.correctedIndex;
      
      if (validPageIndex !== currentPageIndex) {
        setCurrentPageIndex(validPageIndex);
      }
    } else {
      validPageIndex = validation.correctedIndex;
    }
  }

  const analytics = useAnalytics(linker, validPageIndex, isEditMode, isModerator);
  
  // Background image form - managed internally with current page
  const backgroundImageForm = useBackgroundImageForm({
    currentBackgroundImage: linker?.pages[validPageIndex]?.backgroundImage || '',
    onUpdateBackgroundImage: linkerActions.updateBackgroundImage
  });

  // Helper function to check if a cell button was recently clicked
  const wasButtonRecentlyClicked = (cellId: string, delay: number = 500): boolean => {
    const timestamp = buttonClickTimestamps[cellId];
    if (!timestamp) return false;
    
    const currentTime = Date.now();
    const elapsed = currentTime - timestamp;
    
    return elapsed < delay;
  };

  // Handle button clicks by setting timestamp
  const handleButtonClick = (cellId: string) => {
    setButtonClickTimestamps(prev => ({
      ...prev,
      [cellId]: Date.now()
    }));
  };

  // Page navigation functions - now use external state
  const navigateToPage = (pageIndex: number) => {
    if (!linker || !linker.pages) return;
    
    const totalPages = linker.pages.length;
    if (totalPages === 0) return;
    
    // Use utilities for safe navigation with looping
    const { previousIndex, nextIndex } = getNavigationIndices(validPageIndex, totalPages);
    
    let targetIndex = pageIndex;
    
    // Handle special navigation cases
    if (pageIndex === -1) {
      targetIndex = previousIndex;
    } else if (pageIndex === totalPages) {
      targetIndex = nextIndex;
    } else if (pageIndex < 0) {
      targetIndex = totalPages - 1;
    } else if (pageIndex >= totalPages) {
      targetIndex = 0;
    }
    
    setCurrentPageIndex(targetIndex);
    
    // Clear editing state when changing pages
    setEditingVariantMap({});
    setShowDescriptionMap({});
    setButtonClickTimestamps({});
  };

  const navigatePrevious = () => {
    navigateToPage(-1); // Special flag for previous
  };

  const navigateNext = () => {
    navigateToPage(linker?.pages?.length || 0); // Special flag for next
  };

  // Page management functions
  const handleAddPageAfter = async () => {
    try {
      await linkerActions.addPageAfter(validPageIndex);
      // Navigate to the newly created page
      setCurrentPageIndex(validPageIndex + 1);
    } catch (error) {
      console.error('Failed to add page after:', error);
    }
  };

  const handleAddPageBefore = async () => {
    try {
      await linkerActions.addPageBefore(validPageIndex);
      // Navigate to the newly created page (current page shifts right)
      setCurrentPageIndex(validPageIndex + 1);
    } catch (error) {
      console.error('Failed to add page before:', error);
    }
  };

  const handleRemovePage = async () => {
    if (!linker || linker.pages.length <= 1) {
      context.ui.showToast('Cannot remove the last page');
      return;
    }

    try {
      await linkerActions.removePage(validPageIndex);
      
      // Adjust current page index if necessary
      const newTotalPages = linker.pages.length - 1;
      if (validPageIndex >= newTotalPages) {
        setCurrentPageIndex(Math.max(0, newTotalPages - 1));
      }
    } catch (error) {
      console.error('Failed to remove page:', error);
    }
  };

  const toggleDescriptionView = (cellId: string) => {
    setShowDescriptionMap(prev => ({
      ...prev,
      [cellId]: !prev[cellId]
    }));
    
    setPreventNavigationTimestamp(Date.now());
    handleButtonClick(cellId);
  };

  const handleCellClick = async (cell: LinkCell, selectedVariant: Link) => {
    if (shouldPreventNavigation(preventNavigationTimestamp) || wasButtonRecentlyClicked(cell.id)) {
      console.log('Navigation prevented due to recent button click');
      return;
    }

    if (!selectedVariant.uri || selectedVariant.uri.trim() === '') {
      console.log('No link URL provided');
      return;
    }

    const normalizedUrl = normalizeUrl(selectedVariant.uri);
    
    if (!isSafeUrl(normalizedUrl)) {
      context.ui.showToast('Invalid or unsafe URL');
      return;
    }

    context.ui.navigateTo(normalizedUrl);
    
    try {
      await linkerActions.trackLinkClick(cell.id, selectedVariant.id);
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  };

  const handleEditCell = (cell: LinkCell, variantIndex?: number) => {
    if (wasButtonRecentlyClicked(cell.id)) {
      console.log('Edit prevented due to recent button click');
      return;
    }

    const actualVariantIndex = variantIndex !== undefined 
      ? variantIndex 
      : editingVariantMap[cell.id] || cell.currentEditingIndex || 0;
    
    onShowEditCellForm(cell, actualVariantIndex);
  };

  const handleImpressionTracking = async (cellId: string, variantId: string) => {
    await linkerActions.trackImpression(cellId, variantId);
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      setShowAnalyticsOverlay(false);
      setEditingVariantMap({});
      setButtonClickTimestamps({});
    } else {
      if (linker && linker.pages[validPageIndex]) {
        const initialMap: { [key: string]: number } = {};
        linker.pages[validPageIndex].cells.forEach((cell: LinkCell) => {
          initialMap[cell.id] = cell.currentEditingIndex || 0;
        });
        setEditingVariantMap(initialMap);
      }
    }
  };

  const handleEditPage = () => {
    if (linker && linker.pages[validPageIndex]) {
      onShowEditPageForm(linker.pages[validPageIndex]);
    }
  };

  const handleShowBackgroundImageForm = () => {
    context.ui.showForm(backgroundImageForm);
  };

  const toggleAnalyticsOverlay = () => {
    setShowAnalyticsOverlay(!showAnalyticsOverlay);
  };

  // Variant management handlers
  const handleNextVariant = async (cellId: string) => {
    await linkerActions.nextVariant(cellId);
    
    if (linker && linker.pages[validPageIndex]) {
      const cell = linker.pages[validPageIndex].cells.find((c: LinkCell) => c.id === cellId);
      if (cell) {
        setEditingVariantMap(prev => ({
          ...prev,
          [cellId]: cell.currentEditingIndex || 0
        }));
      }
    }
  };

  const handleAddVariant = async (cellId: string) => {
    try {
      const currentCell = linker?.pages[validPageIndex]?.cells.find((c: LinkCell) => c.id === cellId);
      if (!currentCell) {
        context.ui.showToast('Cell not found');
        return;
      }
      
      await linkerActions.addVariant(cellId);
      
      setTimeout(() => {
        const updatedCell = linker?.pages[validPageIndex]?.cells.find((c: LinkCell) => c.id === cellId);
        if (updatedCell) {
          const newVariantIndex = Math.max(0, updatedCell.links.length - 1);
          
          setEditingVariantMap(prev => ({
            ...prev,
            [cellId]: newVariantIndex
          }));
          
          handleEditCell(updatedCell, newVariantIndex);
        }
      }, 150);
      
    } catch (error) {
      console.error('Failed to add variant:', error);
      context.ui.showToast('Failed to add variant');
    }
  };

  const handleRemoveVariant = async (cellId: string) => {
    await linkerActions.removeVariant(cellId);
    
    if (linker && linker.pages[validPageIndex]) {
      const cell = linker.pages[validPageIndex].cells.find((c: LinkCell) => c.id === cellId);
      if (cell) {
        setEditingVariantMap(prev => ({
          ...prev,
          [cellId]: cell.currentEditingIndex || 0
        }));
      }
    }
  };

  // Clean up old button click timestamps
  if (Object.keys(buttonClickTimestamps).length > 0) {
    setTimeout(() => {
      const currentTime = Date.now();
      setButtonClickTimestamps(prev => {
        const cleaned: { [key: string]: number } = {};
        Object.entries(prev).forEach(([cellId, timestamp]) => {
          if (currentTime - timestamp < 2000) {
            cleaned[cellId] = timestamp;
          }
        });
        return cleaned;
      });
    }, 5000);
  }

  if (loading) {
    return <text>Loading...</text>;
  }

  if (error) {
    return <text color="red" wrap>{error.message}</text>;
  }

  if (!linker || !linker.pages || linker.pages.length === 0) {
    return <text color="red">Failed to load linker data</text>;
  }

  const currentPage = linker.pages[validPageIndex];
  if (!currentPage) {
    return <text color="red">Current page not found</text>;
  }

  const backgroundColor = currentPage.backgroundColor || '#000000';
  const foregroundColor = currentPage.foregroundColor || '#FFFFFF';
  const backgroundImage = currentPage.backgroundImage || '';
  const columns = currentPage.columns || 4;
  const totalPages = linker.pages.length;

  return (
    <zstack height="100%">
      {/* Background Layer */}
      {backgroundImage ? (
        <image
          url={backgroundImage}
          height="100%"
          width="100%"
          imageHeight={256}
          imageWidth={256}
          resizeMode="cover"
          description="Board background"
        />
      ) : (
        <vstack backgroundColor={backgroundColor} height="100%" width="100%" />
      )}

      {/* Content Layer */}
      <vstack
        gap="none"
        padding="medium"
        height="100%"
        width="100%"
        backgroundColor={backgroundImage ? "rgba(0,0,0,0.3)" : "transparent"}
      >
        {/* Unified Page Navigation Header */}
        <PageNavigation
          currentPageIndex={validPageIndex}
          totalPages={totalPages}
          pages={linker.pages}
          foregroundColor={foregroundColor}
          isEditMode={isEditMode}
          isModerator={isModerator}
          onNavigatePrevious={navigatePrevious}
          onNavigateNext={navigateNext}
          onToggleEditMode={handleToggleEditMode}
          onRemovePage={handleRemovePage}
        />

        {/* Moderation toolbar */}
        {isEditMode && isModerator && (
          <ModeratorToolbar
            onEditPage={handleEditPage}
            onAddRow={linkerActions.addRow}
            onAddColumn={linkerActions.addColumn}
            onEditBackground={handleShowBackgroundImageForm}
            toggleAnalyticsOverlay={toggleAnalyticsOverlay}
          />
        )}

        {/* Main content with side navigation */}
        <hstack gap="small" height="100%" width="100%" alignment="center middle">
          {/* Left side navigation */}
          <PageSideNavigation
            side="left"
            isEditMode={isEditMode}
            isModerator={isModerator}
            totalPages={totalPages}
            onNavigate={navigatePrevious}
            onAddPageBefore={handleAddPageBefore}
          />

          {/* Main grid */}
          <vstack grow height="100%">
            <LinkGrid
              cells={currentPage.cells}
              columns={columns}
              foregroundColor={foregroundColor}
              isEditMode={isEditMode}
              isModerator={isModerator}
              showDescriptionMap={showDescriptionMap}
              editingVariantMap={editingVariantMap}
              onEditCell={handleEditCell}
              onClickCell={handleCellClick}
              onToggleDescription={toggleDescriptionView}
              onRemoveRow={linkerActions.removeRow}
              onRemoveColumn={linkerActions.removeColumn}
              onTrackImpression={handleImpressionTracking}
              onNextVariant={handleNextVariant}
              onAddVariant={handleAddVariant}
              onRemoveVariant={handleRemoveVariant}
              onButtonClick={handleButtonClick}
            />
          </vstack>

          {/* Right side navigation */}
          <PageSideNavigation
            side="right"
            isEditMode={isEditMode}
            isModerator={isModerator}
            totalPages={totalPages}
            onNavigate={navigateNext}
            onAddPageAfter={handleAddPageAfter}
          />
        </hstack>

        {/* Page indicator */}
        {totalPages > 1 && (
          <hstack alignment="center bottom" width="100%">
            <hstack
              backgroundColor="rgba(0,0,0,0.6)"
              cornerRadius="medium"
              padding="small"
              gap="small"
            >
              <text color={foregroundColor} size="small">
                📚 Page {validPageIndex + 1} of {totalPages}
              </text>
            </hstack>
          </hstack>
        )}
      </vstack>

      {/* Analytics Overlay */}
      <AnalyticsOverlay
        linker={linker}
        currentPageIndex={validPageIndex}
        isVisible={showAnalyticsOverlay}
        onClose={() => setShowAnalyticsOverlay(false)}
      />
    </zstack>
  );
};