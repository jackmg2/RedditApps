// src/components/LinkerBoard.tsx (Enhanced with variant management)
import { Devvit, useState } from '@devvit/public-api';
import { useModerator } from '../hooks/useModerator.js';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { LinkGrid } from './LinkGrid.js';
import { ModeratorToolbar } from './ModeratorToolbar.js';
import { EditButton } from './EditButton.js';
import { AnalyticsOverlay } from './AnalyticsOverlay.js';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { shouldPreventNavigation, normalizeUrl, isSafeUrl } from '../utils/linkUtils.js';

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
    // New variant management methods
    nextVariant: (cellId: string) => Promise<void>;
    addVariant: (cellId: string) => Promise<void>;
    removeVariant: (cellId: string) => Promise<void>;
  };
  onShowEditCellForm: (cell: LinkCell, variantIndex: number) => void;
  onShowEditPageForm: (pageData: any) => void;
  onShowBackgroundImageForm: () => void;
}

/**
 * Enhanced board component with variant management
 */
export const LinkerBoard: Devvit.BlockComponent<LinkerBoardProps> = ({
  context,
  linkerDataHook,
  linkerActions,
  onShowEditCellForm,
  onShowEditPageForm,
  onShowBackgroundImageForm
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDescriptionMap, setShowDescriptionMap] = useState<{ [key: string]: boolean }>({});
  const [editingVariantMap, setEditingVariantMap] = useState<{ [key: string]: number }>({});
  const [preventNavigationTimestamp, setPreventNavigationTimestamp] = useState(0);
  const [showAnalyticsOverlay, setShowAnalyticsOverlay] = useState(false);

  // Use the passed data hook result instead of creating a new one
  const { linker, loading, error } = linkerDataHook;
  const { isModerator } = useModerator(context);
  
  // Use analytics for performance indicators
  const analytics = useAnalytics(linker, 0, isEditMode, isModerator);

  const toggleDescriptionView = (cellId: string) => {
    setShowDescriptionMap(prev => ({
      ...prev,
      [cellId]: !prev[cellId]
    }));
    
    // Set flag to prevent navigation with timestamp
    setPreventNavigationTimestamp(Date.now());
  };

  const handleCellClick = async (cell: LinkCell, selectedVariant: Link) => {
    // Prevent navigation if recently toggled description view
    if (shouldPreventNavigation(preventNavigationTimestamp)) {
      return;
    }

    // Check if selected variant has a valid URI
    if (!selectedVariant.uri || selectedVariant.uri.trim() === '') {
      context.ui.showToast('No link URL provided');
      return;
    }

    // Normalize the URL (add https:// if missing)
    const normalizedUrl = normalizeUrl(selectedVariant.uri);
    
    // Validate the URL for safety
    if (!isSafeUrl(normalizedUrl)) {
      context.ui.showToast('Invalid or unsafe URL');
      return;
    }

    // Track the click before navigation (optimistically)
    linkerActions.trackLinkClick(cell.id, selectedVariant.id).then(() => {
      context.ui.navigateTo(normalizedUrl);
    });
  };

  const handleImpressionTracking = async (cellId: string, variantId: string) => {
    // Track impression (this is called from LinkCellComponent on render)
    await linkerActions.trackImpression(cellId, variantId);
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
    // Close analytics overlay when exiting edit mode
    if (isEditMode) {
      setShowAnalyticsOverlay(false);
      // Clear variant editing state when exiting edit mode
      setEditingVariantMap({});
    } else {
      // Initialize editing variant map when entering edit mode
      if (linker && linker.pages[0]) {
        const initialMap: { [key: string]: number } = {};
        linker.pages[0].cells.forEach((cell: LinkCell) => {
          initialMap[cell.id] = cell.currentEditingIndex || 0;
        });
        setEditingVariantMap(initialMap);
      }
    }
  };

  const handleEditPage = () => {
    if (linker && linker.pages[0]) {
      onShowEditPageForm(linker.pages[0]);
    }
  };

  const toggleAnalyticsOverlay = () => {
    setShowAnalyticsOverlay(!showAnalyticsOverlay);
  };

  // Variant management handlers
  const handleNextVariant = async (cellId: string) => {
    await linkerActions.nextVariant(cellId);
    
    // Update local editing state to reflect the change
    if (linker && linker.pages[0]) {
      const cell = linker.pages[0].cells.find((c: LinkCell) => c.id === cellId);
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
      console.log('Adding variant for cell:', cellId);
      
      // First, find the current cell to get its state
      const currentCell = linker?.pages[0]?.cells.find((c: LinkCell) => c.id === cellId);
      if (!currentCell) {
        context.ui.showToast('Cell not found');
        return;
      }
      
      await linkerActions.addVariant(cellId);
      
      // After successful addition, find the updated cell and open edit form
      // Use a small delay to allow optimistic update to complete
      setTimeout(() => {
        const updatedCell = linker?.pages[0]?.cells.find((c: LinkCell) => c.id === cellId);
        if (updatedCell) {
          console.log('Found updated cell with', updatedCell.links.length, 'variants');
          const newVariantIndex = Math.max(0, updatedCell.links.length - 1);
          
          setEditingVariantMap(prev => ({
            ...prev,
            [cellId]: newVariantIndex
          }));
          
          // Open edit form for the new variant
          handleEditCell(updatedCell, newVariantIndex);
        } else {
          console.error('Could not find updated cell');
        }
      }, 150);
      
    } catch (error) {
      console.error('Failed to add variant:', error);
      context.ui.showToast('Failed to add variant');
    }
  };

  const handleRemoveVariant = async (cellId: string) => {
    await linkerActions.removeVariant(cellId);
    
    // Update local editing state to reflect the removal
    if (linker && linker.pages[0]) {
      const cell = linker.pages[0].cells.find((c: LinkCell) => c.id === cellId);
      if (cell) {
        setEditingVariantMap(prev => ({
          ...prev,
          [cellId]: cell.currentEditingIndex || 0
        }));
      }
    }
  };

  const handleEditCell = (cell: LinkCell, variantIndex?: number) => {
    const actualVariantIndex = variantIndex !== undefined 
      ? variantIndex 
      : editingVariantMap[cell.id] || cell.currentEditingIndex || 0;
    
    onShowEditCellForm(cell, actualVariantIndex);
  };

  if (loading) {
    return <text>Loading...</text>;
  }

  if (error) {
    return <text color="red" wrap>{error.message}</text>;
  }

  if (!linker || !linker.pages[0]) {
    return <text color="red">Failed to load linker data</text>;
  }

  const page = linker.pages[0];
  const backgroundColor = page.backgroundColor || '#000000';
  const foregroundColor = page.foregroundColor || '#FFFFFF';
  const backgroundImage = page.backgroundImage || '';
  const columns = page.columns || 4;

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
        gap="medium"
        padding="medium"
        height="100%"
        width="100%"
        backgroundColor={backgroundImage ? "rgba(0,0,0,0.3)" : "transparent"}
      >
        {/* Header with title and edit button */}
        <hstack alignment="end top">
          <hstack alignment="center" grow>
            <text
              size="xlarge"
              weight="bold"
              color={foregroundColor}
            >
              {page.title || 'Community Links'}
            </text>
          </hstack>

          {isModerator && (
            <hstack alignment="end bottom" gap="small">                            
              <EditButton
                isEditMode={isEditMode}
                onToggleEditMode={handleToggleEditMode}
              />
            </hstack>
          )}
        </hstack>

        {/* Moderation toolbar - only show when in edit mode and user is moderator */}
        {isEditMode && isModerator && (
          <ModeratorToolbar
            onEditPage={handleEditPage}
            onAddRow={linkerActions.addRow}
            onAddColumn={linkerActions.addColumn}
            onEditBackground={onShowBackgroundImageForm}
            toggleAnalyticsOverlay={toggleAnalyticsOverlay}
          />
        )}
        
        {/* Enhanced link grid with variant management */}
        <LinkGrid
          cells={page.cells}
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
        />

        {/* Multi-page indicator - show if multiple pages exist */}
        {analytics.hasMultiplePages && (
          <hstack alignment="center bottom" width="100%">
            <hstack
              backgroundColor="rgba(0,0,0,0.6)"
              cornerRadius="medium"
              padding="small"
              gap="small"
            >
              <text color={foregroundColor} size="small">
                📚 Page 1 of {linker.pages.length}
              </text>
            </hstack>
          </hstack>
        )}
      </vstack>

      {/* Analytics Overlay - rendered on top of everything */}
      <AnalyticsOverlay
        linker={linker}
        currentPageIndex={0}
        isVisible={showAnalyticsOverlay}
        onClose={() => setShowAnalyticsOverlay(false)}
      />
    </zstack>
  );
};