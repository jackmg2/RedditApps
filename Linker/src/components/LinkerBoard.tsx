import { Devvit, useState } from '@devvit/public-api';
import { useModerator } from '../hooks/useModerator.js';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { LinkGrid } from './LinkGrid.js';
import { ModeratorToolbar } from './ModeratorToolbar.js';
import { EditButton } from './EditButton.js';
import { AnalyticsDisplay } from './AnalyticsDisplay.js';
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
    updateLink: (link: Link) => Promise<void>;
    updatePage: (data: any) => Promise<void>;
    updateBackgroundImage: (backgroundImage: string) => Promise<void>;
    addRow: () => Promise<void>;
    addColumn: () => Promise<void>;
    removeRow: (rowIndex: number) => Promise<void>;
    removeColumn: (colIndex: number) => Promise<void>;
    trackLinkClick: (linkId: string) => Promise<void>;
  };
  onShowEditLinkForm: (link: Link) => void;
  onShowEditPageForm: (pageData: any) => void;
  onShowBackgroundImageForm: () => void;
}

/**
 * Main board component that orchestrates the linker interface
 */
export const LinkerBoard: Devvit.BlockComponent<LinkerBoardProps> = ({
  context,
  linkerDataHook,
  linkerActions,
  onShowEditLinkForm,
  onShowEditPageForm,
  onShowBackgroundImageForm
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDescriptionMap, setShowDescriptionMap] = useState<{ [key: string]: boolean }>({});
  const [preventNavigationTimestamp, setPreventNavigationTimestamp] = useState(0);

  // Use the passed data hook result instead of creating a new one
  const { linker, loading, error } = linkerDataHook;
  const { isModerator } = useModerator(context);
  
  // Use the passed actions instead of creating new ones
  const analytics = useAnalytics(linker, isEditMode, isModerator);

  const toggleDescriptionView = (linkId: string) => {
    setShowDescriptionMap(prev => ({
      ...prev,
      [linkId]: !prev[linkId]
    }));
    
    // Set flag to prevent navigation with timestamp
    setPreventNavigationTimestamp(Date.now());
  };

  const handleLinkClick = async (link: Link) => {
    // Prevent navigation if recently toggled description view
    if (shouldPreventNavigation(preventNavigationTimestamp)) {
      return;
    }

    // Check if link has a valid URI
    if (!link.uri || link.uri.trim() === '') {
      context.ui.showToast('No link URL provided');
      return;
    }

      // Normalize the URL (add https:// if missing)
      const normalizedUrl = normalizeUrl(link.uri);
      
      // Validate the URL for safety
      if (!isSafeUrl(normalizedUrl)) {
        context.ui.showToast('Invalid or unsafe URL');
        return;
      }

      // Track the click before navigation (optimistically)
      linkerActions.trackLinkClick(link.id).then(context.ui.navigateTo(normalizedUrl));      
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  const handleEditPage = () => {
    if (linker && linker.pages[0]) {
      onShowEditPageForm(linker.pages[0]);
    }
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
            <hstack alignment="end bottom">
              <spacer />
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
          />
        )}

        {/* Analytics display - only show in edit mode for moderators */}
        {isEditMode && isModerator && analytics.hasAnyClicks && (
          <AnalyticsDisplay
            totalClicks={analytics.totalClicks}
            mostClicked={analytics.mostClicked}
            foregroundColor={foregroundColor}
          />
        )}

        {/* Link grid */}
        <LinkGrid
          links={page.links}
          columns={columns}
          foregroundColor={foregroundColor}
          isEditMode={isEditMode}
          isModerator={isModerator}
          showDescriptionMap={showDescriptionMap}
          onEditLink={onShowEditLinkForm}
          onClickLink={handleLinkClick}
          onToggleDescription={toggleDescriptionView}
          onRemoveRow={linkerActions.removeRow}
          onRemoveColumn={linkerActions.removeColumn}
        />
      </vstack>
    </zstack>
  );
};