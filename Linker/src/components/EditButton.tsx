import { Devvit } from '@devvit/public-api';

interface EditButtonProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

/**
 * Edit mode toggle button component
 */
export const EditButton: Devvit.BlockComponent<EditButtonProps> = ({
  isEditMode,
  onToggleEditMode
}) => {
  return (
    <hstack alignment="end bottom" width="100%">
      <button
        icon={isEditMode ? "checkmark" : "edit"}
        appearance={isEditMode ? "success" : "secondary"}
        size="small"
        onPress={onToggleEditMode}
      />
    </hstack>
  );
};