import { Devvit } from '@devvit/public-api';

interface ModeratorToolbarProps {
  onEditPage: () => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onEditBackground: () => void;
  toggleAnalyticsOverlay: () => void;
  // New props for edit mode functionality
  onToggleEditMode: () => void;
  onRemovePage?: () => void;
  totalPages: number;
}

/**
 * Enhanced toolbar component for moderator actions with edit mode controls
 */
export const ModeratorToolbar: Devvit.BlockComponent<ModeratorToolbarProps> = ({
  onEditPage,
  onAddRow,
  onAddColumn,
  onEditBackground,
  toggleAnalyticsOverlay,
  onToggleEditMode,
  onRemovePage,
  totalPages
}) => {
  return (
    <hstack gap="small" alignment="start middle">
      {/* Left side buttons */}
      <button
        icon="edit"
        appearance="primary"
        size="small"
        onPress={onEditPage}
      />

      <button
        icon="add"
        appearance="primary"
        size="small"
        onPress={onAddRow}
      >
        Add Row
      </button>

      <button
        icon="add"
        appearance="primary"
        size="small"
        onPress={onAddColumn}
      >
        Add Column
      </button>

      {/* Right side buttons */}
      <hstack alignment='end top' grow gap="small">
        {totalPages > 1 && onRemovePage ? (
          <button
            icon="delete"
            appearance="destructive"
            size="small"
            onPress={onRemovePage}
          />
        ) : null}

        {/* Analytics button */}
        <button
          icon="statistics"
          appearance="secondary"
          size="small"
          onPress={toggleAnalyticsOverlay}
        >
          Analytics
        </button>

        {/* Background button */}
        <button
          icon="image-post"
          appearance="primary"
          size="small"
          onPress={onEditBackground}
        ></button>

        {/* Save/Exit edit mode button */}
        <button
          icon="checkmark"
          appearance="success"
          size="small"
          onPress={onToggleEditMode}
        />
      </hstack>
    </hstack>
  );
};