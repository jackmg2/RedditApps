import { Devvit } from '@devvit/public-api';

interface ModeratorControlsProps {
  onAddEvent: () => void;
  onBackgroundImage: () => void;
}

export const ModeratorControls = ({ onAddEvent, onBackgroundImage }: ModeratorControlsProps) => (
  <hstack gap="none" padding="none" cornerRadius="medium" width="100%">
    <hstack alignment="start top">
      <button
        icon="add"
        appearance="primary"
        size="small"
        onPress={onAddEvent}
      />
    </hstack>

    <hstack alignment="end top" grow>
      <button
        icon="image-post"
        appearance="primary"
        size="small"
        onPress={onBackgroundImage}
      />
    </hstack>
  </hstack>
);