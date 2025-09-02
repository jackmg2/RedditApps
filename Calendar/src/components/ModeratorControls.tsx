import { Devvit } from '@devvit/public-api';

interface ModeratorControlsProps {
  isEditMode: boolean;
  isModerator: boolean;
  onToggleEditMode: () => void;
  onAddEvent: () => void;
  onBackgroundImage: () => void;
}

export const ModeratorControls = ({ 
  isEditMode, 
  isModerator, 
  onToggleEditMode, 
  onAddEvent, 
  onBackgroundImage 
}: ModeratorControlsProps) => {
  if (!isModerator) return null;

  return (
    <hstack gap="none" padding="none" cornerRadius="medium" width="100%">
      {/* Left side - Add and Background buttons (only shown in edit mode) */}
      <hstack alignment="start top" gap="small">
        {isEditMode && (
          <>
            <button
              icon="add"
              appearance="primary"
              size="small"
              onPress={onAddEvent}
            />
            <button
              icon="image-post"
              appearance="primary"
              size="small"
              onPress={onBackgroundImage}
            />
          </>
        )}
      </hstack>

      {/* Right side - Edit/Validate button */}
      <hstack alignment="end top" grow>
        <button
          icon={isEditMode ? "checkmark" : "edit"}
          appearance={isEditMode ? "success" : "secondary"}
          size="small"
          onPress={onToggleEditMode}
        />
      </hstack>
    </hstack>
  );
};