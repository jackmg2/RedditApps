// Updated LinkerBoard.tsx
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
    nextVariant: (cellId: string) => Promise<void>;
    addVariant: (cellId: string) => Promise<void>;
    removeVariant: (cellId: string) => Promise<void>;
  };
  onShowEditCellForm: (cell: LinkCell, variantIndex: number) => void;
  onShowEditPageForm: (pageData: any) => void;
  onShowBackgroundImageForm: () => void;
}

/**
 * Enhanced board component with comprehensive button click prevention
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
  
  // New state for button click prevention
  const [buttonClickTimestamps, setButtonClickTimestamps] = useState<{ [key: string]: number }>({});

  const { linker, loading, error } = linkerDataHook;
  const { isModerator } = useModerator(context);
  const analytics = useAnalytics(linker, 0, isEditMode, isModerator);

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

  const toggleDescriptionView = (cellId: string) => {
    setShowDescriptionMap(prev => ({
      ...prev,
      [cellId]: !prev[cellId]
    }));
    
    // Set both the general prevention timestamp and button-specific timestamp
    setPreventNavigationTimestamp(Date.now());
    handleButtonClick(cellId);
  };

  const handleCellClick = async (cell: LinkCell, selectedVariant: Link) => {
    // Check both general navigation prevention and button-specific prevention
    if (shouldPreventNavigation(preventNavigationTimestamp) || wasButtonRecentlyClicked(cell.id)) {
      console.log('Navigation prevented due to recent button click');
      return;
    }

    // Check if selected variant has a valid URI
    if (!selectedVariant.uri || selectedVariant.uri.trim() === '') {
      console.log('No link URL provided');
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

  const handleEditCell = (cell: LinkCell, variantIndex?: number) => {
    // Check if button was recently clicked to prevent accidental edit triggers
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
      // Clear button click timestamps when exiting edit mode
      setButtonClickTimestamps({});
    } else {
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

  // Variant management handlers with button click tracking
  const handleNextVariant = async (cellId: string) => {
    await linkerActions.nextVariant(cellId);
    
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
      
      const currentCell = linker?.pages[0]?.cells.find((c: LinkCell) => c.id === cellId);
      if (!currentCell) {
        context.ui.showToast('Cell not found');
        return;
      }
      
      await linkerActions.addVariant(cellId);
      
      setTimeout(() => {
        const updatedCell = linker?.pages[0]?.cells.find((c: LinkCell) => c.id === cellId);
        if (updatedCell) {
          console.log('Found updated cell with', updatedCell.links.length, 'variants');
          const newVariantIndex = Math.max(0, updatedCell.links.length - 1);
          
          setEditingVariantMap(prev => ({
            ...prev,
            [cellId]: newVariantIndex
          }));
          
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

  // Clear old button click timestamps periodically to prevent memory leaks
  setTimeout(() => {
    const currentTime = Date.now();
    setButtonClickTimestamps(prev => {
      const cleaned: { [key: string]: number } = {};
      Object.entries(prev).forEach(([cellId, timestamp]) => {
        if (currentTime - timestamp < 2000) { // Keep timestamps for 2 seconds
          cleaned[cellId] = timestamp;
        }
      });
      return cleaned;
    });
  }, 5000);

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

        {/* Moderation toolbar */}
        {isEditMode && isModerator && (
          <ModeratorToolbar
            onEditPage={handleEditPage}
            onAddRow={linkerActions.addRow}
            onAddColumn={linkerActions.addColumn}
            onEditBackground={onShowBackgroundImageForm}
            toggleAnalyticsOverlay={toggleAnalyticsOverlay}
          />
        )}
        
        {/* Enhanced link grid with button click prevention */}
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
          onButtonClick={handleButtonClick}
        />

        {/* Multi-page indicator */}
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

      {/* Analytics Overlay */}
      <AnalyticsOverlay
        linker={linker}
        currentPageIndex={0}
        isVisible={showAnalyticsOverlay}
        onClose={() => setShowAnalyticsOverlay(false)}
      />
    </zstack>
  );
};