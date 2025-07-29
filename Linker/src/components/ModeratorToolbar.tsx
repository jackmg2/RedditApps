import { Devvit } from '@devvit/public-api';

interface ModeratorToolbarProps {
  onEditPage: () => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onEditBackground: () => void;
}

/**
 * Toolbar component for moderator actions
 */
export const ModeratorToolbar: Devvit.BlockComponent<ModeratorToolbarProps> = ({
  onEditPage,
  onAddRow,
  onAddColumn,
  onEditBackground
}) => {
  return (
    <hstack gap="small" alignment="start middle">
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

      <hstack alignment='end top' grow>
        <button
          icon="image-post"
          appearance="primary"
          size="small"
          onPress={onEditBackground}
        />
      </hstack>
    </hstack>
  );
};