// Updated LinkerBoard.tsx - Fixed page navigation timing and validation
import { Devvit, useState } from '@devvit/public-api';
import { useEditPermissions } from '../hooks/useEditPermissions.js';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { useBackgroundImageForm } from '../forms/BackgroundImageForm.js';
import { LinkGrid } from './LinkGrid.js';
import { ModeratorToolbar } from './ModeratorToolbar.js';
import { AnalyticsOverlay } from './AnalyticsOverlay.js';
import { PageSideNavigation } from './PageSideNavigation.js';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { shouldPreventNavigation, normalizeUrl, isSafeUrl } from '../utils/linkUtils.js';
import { getNavigationIndices, validateNavigationState, createDefaultPageTitle } from '../utils/pageUtils.js';
import { PageNavigation } from './PageNavigation.js';
import { useEditCellSpanForm } from '../forms/EditCellSpanForm.js';

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
    // Spanning actions
    updateCellSpan: (cellId: string, rowSpan: number, colSpan: number) => Promise<void>;
    updateGridDimensions: (rows: number, columns: number)=> Promise<void>;
  };
  onShowEditCellForm: (cell: LinkCell, variantIndex: number) => void;
  onShowEditPageForm: (pageData: any) => void;
  onShowEditCellSpanForm: (cell: LinkCell) => void;
  // NEW: External page index state management
  currentPageIndex: number;
  setCurrentPageIndex: (index: number) => void;
}

/**
 * Enhanced board component with improved page navigation timing
 */
export const LinkerBoard: Devvit.BlockComponent<LinkerBoardProps> = ({
  context,
  linkerDataHook,
  linkerActions,
  onShowEditCellForm,
  onShowEditPageForm,
  onShowEditCellSpanForm,
  currentPageIndex,
  setCurrentPageIndex
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDescriptionMap, setShowDescriptionMap] = useState<{ [key: string]: boolean }>({});
  const [editingVariantMap, setEditingVariantMap] = useState<{ [key: string]: number }>({});
  const [preventNavigationTimestamp, setPreventNavigationTimestamp] = useState(0);
  const [showAnalyticsOverlay, setShowAnalyticsOverlay] = useState(false);
  const [buttonClickTimestamps, setButtonClickTimestamps] = useState<{ [key: string]: number }>({});
  const [pendingPageNavigation, setPendingPageNavigation] = useState<number | null>(null);

  const { linker, loading, error } = linkerDataHook;

  // Use the new edit permissions hook instead of just moderator check
  const { canEdit, isModerator, isWhitelisted } = useEditPermissions(context);

  // Improved validation that's less aggressive about resetting page index
  let validPageIndex = currentPageIndex;
  if (linker && linker.pages) {
    // Only validate if we have pages and the current index is clearly invalid
    if (linker.pages.length > 0) {
      if (currentPageIndex < 0) {
        validPageIndex = 0;
        setCurrentPageIndex(0);
      } else if (currentPageIndex >= linker.pages.length) {
        // If we have a pending navigation to a new page, be more lenient
        if (pendingPageNavigation !== null && pendingPageNavigation < linker.pages.length) {
          validPageIndex = pendingPageNavigation;
          setCurrentPageIndex(pendingPageNavigation);
          setPendingPageNavigation(null);
        } else {
          validPageIndex = linker.pages.length - 1;
          setCurrentPageIndex(linker.pages.length - 1);
        }
      }
    }
  }

  const analytics = useAnalytics(linker, validPageIndex, isEditMode, canEdit);

  // Background image form - managed internally with current page
  const backgroundImageForm = useBackgroundImageForm({
    currentBackgroundImage: linker?.pages[validPageIndex]?.backgroundImage || '',
    onUpdateBackgroundImage: linkerActions.updateBackgroundImage
  });

  const editCellSpanForm = useEditCellSpanForm({
    onUpdateCellSpan: linkerActions.updateCellSpan
  });

  const handleEditCellSpan = (cell: LinkCell) => {
    if (!canEdit) {
      context.ui.showToast('You do not have permission to resize cells');
      return;
    }

    onShowEditCellSpanForm(cell);
  };

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

  // Improved page management functions with better timing
  const handleAddPageAfter = async () => {
    if (!canEdit) {
      context.ui.showToast('You do not have permission to add pages');
      return;
    }

    try {
      const targetPageIndex = validPageIndex + 1;
      // Set pending navigation BEFORE the operation
      setPendingPageNavigation(targetPageIndex);

      await linkerActions.addPageAfter(validPageIndex);

      // Navigate to the newly created page after a short delay
      // to ensure the optimistic update has been applied
      setTimeout(() => {
        setCurrentPageIndex(targetPageIndex);
        setPendingPageNavigation(null);
      }, 100);

    } catch (error) {
      console.error('Failed to add page after:', error);
      setPendingPageNavigation(null);
    }
  };

  const handleAddPageBefore = async () => {
    if (!canEdit) {
      context.ui.showToast('You do not have permission to add pages');
      return;
    }

    try {
      const targetPageIndex = validPageIndex + 1; // Current page shifts right
      // Set pending navigation BEFORE the operation
      setPendingPageNavigation(targetPageIndex);

      await linkerActions.addPageBefore(validPageIndex);

      // Navigate to the newly created page after a short delay
      setTimeout(() => {
        setCurrentPageIndex(targetPageIndex);
        setPendingPageNavigation(null);
      }, 100);

    } catch (error) {
      console.error('Failed to add page before:', error);
      setPendingPageNavigation(null);
    }
  };

  const handleRemovePage = async () => {
    if (!canEdit) {
      context.ui.showToast('You do not have permission to remove pages');
      return;
    }

    if (!linker || linker.pages.length <= 1) {
      context.ui.showToast('Cannot remove the last page');
      return;
    }

    try {
      await linkerActions.removePage(validPageIndex);

      // Adjust current page index if necessary
      const newTotalPages = linker.pages.length - 1;
      if (validPageIndex >= newTotalPages) {
        const newIndex = Math.max(0, newTotalPages - 1);
        setTimeout(() => {
          setCurrentPageIndex(newIndex);
        }, 100);
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
    if (!canEdit) {
      context.ui.showToast('You do not have permission to edit cells');
      return;
    }

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
    if (!canEdit) {
      context.ui.showToast('You do not have permission to edit this board');
      return;
    }

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
    if (!canEdit) {
      context.ui.showToast('You do not have permission to edit page settings');
      return;
    }

    if (linker && linker.pages[validPageIndex]) {
      onShowEditPageForm(linker.pages[validPageIndex]);
    }
  };

  const handleShowBackgroundImageForm = () => {
    if (!canEdit) {
      context.ui.showToast('You do not have permission to change background');
      return;
    }

    context.ui.showForm(backgroundImageForm);
  };

  const toggleAnalyticsOverlay = () => {
    setShowAnalyticsOverlay(!showAnalyticsOverlay);
  };

  // Variant management handlers - Only available to users with edit permissions
  const handleNextVariant = async (cellId: string) => {
    if (!canEdit) return;

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
    if (!canEdit) {
      context.ui.showToast('You do not have permission to add variants');
      return;
    }

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
    if (!canEdit) {
      context.ui.showToast('You do not have permission to remove variants');
      return;
    }

    // Check if this is the last variant before removing
    const currentCell = linker?.pages[validPageIndex]?.cells.find((c: LinkCell) => c.id === cellId);
    const activeVariants = currentCell ? currentCell.links.filter(link => !Link.isEmpty(link)) : [];
    const isLastVariant = activeVariants.length <= 1;

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
    return <text color="red">Current page not found (Page {validPageIndex + 1} of {linker.pages.length})</text>;
  }

  const backgroundColor = currentPage.backgroundColor || '#000000';
  const foregroundColor = currentPage.foregroundColor || '#FFFFFF';
  const backgroundImage = currentPage.backgroundImage || '';
  const columns = currentPage.columns || 4;
  const totalPages = linker.pages.length;

  // EDIT MODE LAYOUT - Available to users with edit permissions
  if (isEditMode) {
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

        {/* Content Layer - Fixed layout to prevent overflow */}
        <vstack
          height="100%"
          width="100%"
          backgroundColor={backgroundImage ? "rgba(0,0,0,0.3)" : "transparent"}
          gap="none"
        >
          {/* Top section: User status and toolbar - Fixed height */}
          <vstack gap="small" padding="medium" width="100%">
            {/* Show user status in edit mode */}
            {isWhitelisted && !isModerator && (
              <hstack alignment="center middle" width="100%">
                <hstack
                  backgroundColor="rgba(74, 144, 226, 0.8)"
                  cornerRadius="medium"
                  padding="small"
                >
                  <text color="white" size="small" weight="bold">
                    ✏️ Whitelisted Editor
                  </text>
                </hstack>
              </hstack>
            )}

            {/* Moderation toolbar */}
            <ModeratorToolbar
              onEditPage={handleEditPage}
              onAddRow={linkerActions.addRow}
              onAddColumn={linkerActions.addColumn}
              onEditBackground={handleShowBackgroundImageForm}
              toggleAnalyticsOverlay={toggleAnalyticsOverlay}
              onToggleEditMode={handleToggleEditMode}
              onRemovePage={handleRemovePage}
              totalPages={totalPages}
            />
          </vstack>

          {/* Main content area - Takes remaining space */}
          <vstack grow padding="medium" gap="small">
            <hstack gap="small" height="100%" width="100%" alignment="center middle">
              {/* Left side navigation */}
              <PageSideNavigation
                side="left"
                isEditMode={isEditMode}
                isModerator={canEdit}
                totalPages={totalPages}
                onNavigate={navigatePrevious}
                onAddPageBefore={handleAddPageBefore}
              />

              {/* Main grid - Now properly contained */}
              <vstack grow height="100%">
                <LinkGrid
                  cells={currentPage.cells}
                  columns={columns}
                  rows={currentPage.rows || 4} // Add rows parameter
                  foregroundColor={foregroundColor}
                  isEditMode={isEditMode}
                  isModerator={canEdit}
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
                  onEditCellSpan={handleEditCellSpan} // Add span editing handler
                />
              </vstack>

              {/* Right side navigation */}
              <PageSideNavigation
                side="right"
                isEditMode={isEditMode}
                isModerator={canEdit}
                totalPages={totalPages}
                onNavigate={navigateNext}
                onAddPageAfter={handleAddPageAfter}
              />
            </hstack>
          </vstack>
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
  }

  // VIEW MODE LAYOUT - MAXIMIZED GRID SPACE
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

      {/* Maximized Grid Content - No padding, minimal gaps */}
      <vstack
        height="100%"
        width="100%"
        backgroundColor={backgroundImage ? "rgba(0,0,0,0.2)" : "transparent"}
        gap="none"
        padding="none"
      >
        <PageNavigation
          currentPageIndex={validPageIndex}
          totalPages={totalPages}
          pages={linker.pages}
          foregroundColor={foregroundColor}
          isModerator={canEdit}
          isEditMode={isEditMode}
          onNavigatePrevious={navigatePrevious}
          onNavigateNext={navigateNext}
          onToggleEditMode={handleToggleEditMode}
        />

        {/* MAXIMIZED GRID - Takes all remaining space */}
        <vstack grow height="100%" width="100%" padding="small">
          <LinkGrid
            cells={currentPage.cells}
            columns={columns}
            rows={currentPage.rows || 4} // Add rows parameter
            foregroundColor={foregroundColor}
            isEditMode={isEditMode}
            isModerator={canEdit}
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
            onEditCellSpan={handleEditCellSpan} // Add span editing handler
          />
        </vstack>
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