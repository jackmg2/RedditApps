import { Devvit, useState } from '@devvit/public-api';
import { useLinkerData } from '../hooks/useLinkerData.js';
import { useModerator } from '../hooks/useModerator.js';
import { useLinkerActions } from '../hooks/useLinkerActions.js';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { LinkGrid } from './LinkGrid.js';
import { ModeratorToolbar } from './ModeratorToolbar.js';
import { EditButton } from './EditButton.js';
import { AnalyticsDisplay } from './AnalyticsDisplay.js';
import { Link } from '../types/link.js';
import { shouldPreventNavigation } from '../utils/linkUtils.js';

interface LinkerBoardProps {
  context: any;
  onShowEditLinkForm: (link: Link) => void;
  onShowEditPageForm: (pageData: any) => void;
  onShowBackgroundImageForm: () => void;
}

/**
 * Main board component that orchestrates the linker interface
 */
export const LinkerBoard: Devvit.BlockComponent<LinkerBoardProps> = ({
  context,
  onShowEditLinkForm,
  onShowEditPageForm,
  onShowBackgroundImageForm
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDescriptionMap, setShowDescriptionMap] = useState<{ [key: string]: boolean }>({});
  const [preventNavigationTimestamp, setPreventNavigationTimestamp] = useState(0);

  // Custom hooks
  const { linker, loading, error, saveLinker } = useLinkerData(context);
  const { isModerator } = useModerator(context);
  const linkerActions = useLinkerActions({ linker, saveLinker, context });
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
    if (shouldPreventNavigation(preventNavigationTimestamp)) {
      return;
    }

    if (link.uri) {
      // Track the click before navigation
      await linkerActions.trackLinkClick(link.id);
      context.ui.navigateTo(link.uri);
    }
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