// src/components/ModeratorToolbar.tsx - Enhanced with grid controls
import { Devvit } from '@devvit/public-api';

interface ModeratorToolbarProps {
  onEditPage: () => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onEditBackground: () => void;
  toggleAnalyticsOverlay: () => void;
  onToggleEditMode: () => void;
  onRemovePage?: () => void;
  totalPages: number;
  // NEW: Grid control props
  onEditGridDimensions?: () => void;
  currentRows?: number;
  currentColumns?: number;
  showGridInfo?: boolean;
}

/**
 * Enhanced toolbar component with grid management controls
 */
export const ModeratorToolbar: Devvit.BlockComponent<ModeratorToolbarProps> = ({
  onEditPage,
  onAddRow,
  onAddColumn,
  onEditBackground,
  toggleAnalyticsOverlay,
  onToggleEditMode,
  onRemovePage,
  totalPages,
  onEditGridDimensions,
  currentRows = 4,
  currentColumns = 4,
  showGridInfo = true
}) => {
  return (
    <vstack gap="small" width="100%">
      {/* Grid info display */}
      {showGridInfo && (
        <hstack 
          backgroundColor="rgba(74, 144, 226, 0.1)" 
          cornerRadius="medium" 
          padding="small"
          alignment="center middle"
          gap="medium"
        >
          <text size="small" weight="bold" color="#4A90E2">
            Grid: {currentRows}×{currentColumns}
          </text>
          
          {onEditGridDimensions ? (
            <button
              icon="settings"
              appearance="secondary"
              size="small"
              onPress={onEditGridDimensions}
            >
              Resize Grid
            </button>
          ) : null}
          
          <text size="xsmall" color="#666" style="body">
            Cells can span multiple rows/columns
          </text>
        </hstack>
      )}
      
      {/* Main toolbar */}
      <hstack gap="small" alignment="start middle">
        {/* Left side - Page and grid controls */}
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
          Row
        </button>

        <button
          icon="add"
          appearance="primary"
          size="small"
          onPress={onAddColumn}
        >
          Column
        </button>

        {/* Right side - Analytics and settings */}
        <hstack alignment='end top' grow gap="small">
          {(totalPages > 1 && onRemovePage) ? (
            <button
              icon="delete"
              appearance="destructive"
              size="small"
              onPress={onRemovePage}
            />
          ): null}

          <button
            icon="statistics"
            appearance="secondary"
            size="small"
            onPress={toggleAnalyticsOverlay}
          >
            Analytics
          </button>

          <button
            icon="image-post"
            appearance="primary"
            size="small"
            onPress={onEditBackground}
          />

          <button
            icon="checkmark"
            appearance="success"
            size="small"
            onPress={onToggleEditMode}
          />
        </hstack>
      </hstack>
      
      {/* Grid tips */}
      {showGridInfo && (
        <hstack padding="xsmall" gap="small">
          <text size="xsmall" color="#888">💡 Tip:</text>
          <text size="xsmall" color="#666">
            Click the resize button (↔️) on any cell to change its span
          </text>
        </hstack>
      )}
    </vstack>
  );
};