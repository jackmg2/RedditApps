// src/components/LinkerBoard.tsx (Updated for LinkCell support)
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
    updateCell: (cell: LinkCell) => Promise<void>; // Changed from updateLink
    updatePage: (data: any) => Promise<void>;
    updateBackgroundImage: (backgroundImage: string) => Promise<void>;
    addRow: () => Promise<void>;
    addColumn: () => Promise<void>;
    removeRow: (rowIndex: number) => Promise<void>;
    removeColumn: (colIndex: number) => Promise<void>;
    trackLinkClick: (cellId: string, variantId: string) => Promise<void>; // Updated signature
    trackImpression: (cellId: string, variantId: string) => Promise<void>; // New method
  };
  onShowEditCellForm: (cell: LinkCell) => void; // Changed from onShowEditLinkForm
  onShowEditPageForm: (pageData: any) => void;
  onShowBackgroundImageForm: () => void;
}

/**
 * Main board component updated for LinkCell support with analytics overlay
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

        {/* New user guidance - show when no clicks yet */}
        {isEditMode && isModerator && !analytics.hasAnyClicks && (
          <hstack
            backgroundColor="rgba(77, 171, 247, 0.1)"
            cornerRadius="medium"
            padding="small"
            gap="small"
            alignment="start middle"
            border="thin"
            borderColor="#4dabf7"
          >
            <text color="#4dabf7" size="medium">💡</text>
            <vstack gap="small">
              <text color={foregroundColor} size="small" weight="bold">
                Ready to Track Performance & A/B Tests
              </text>
              <text color={foregroundColor} size="xsmall">
                Analytics will show click rates and variant performance once your links start getting traffic
              </text>
            </vstack>
          </hstack>
        )}

        {/* A/B Testing indicator - show if any cells have rotation enabled */}
        {analytics.detailedSummary && analytics.detailedSummary.totalImpressions > 0 && (
          <hstack
            backgroundColor="rgba(116, 195, 101, 0.1)"
            cornerRadius="medium"
            padding="small"
            gap="small"
            alignment="start middle"
            border="thin"
            borderColor="#74c365"
          >
            <text color="#74c365" size="medium">🧪</text>
            <vstack gap="small">
              <text color={foregroundColor} size="small" weight="bold">
                A/B Testing Active
              </text>
              <text color={foregroundColor} size="xsmall">
                {analytics.engagementMetrics?.abTestCount || 0} cells running variant tests • 
                {analytics.detailedSummary.overallClickRate}% overall click rate
              </text>
            </vstack>
          </hstack>
        )}

        {/* Link grid - now using cells instead of links */}
        <LinkGrid
          cells={page.cells} // Changed from links to cells
          columns={columns}
          foregroundColor={foregroundColor}
          isEditMode={isEditMode}
          isModerator={isModerator}
          showDescriptionMap={showDescriptionMap}
          onEditCell={onShowEditCellForm} // Changed from onEditLink
          onClickCell={handleCellClick} // Changed from onClickLink
          onToggleDescription={toggleDescriptionView}
          onRemoveRow={linkerActions.removeRow}
          onRemoveColumn={linkerActions.removeColumn}
          onTrackImpression={handleImpressionTracking}
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