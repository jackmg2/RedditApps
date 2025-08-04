// src/components/PageSideNavigation.tsx
import { Devvit } from '@devvit/public-api';

interface PageSideNavigationProps {
  side: 'left' | 'right';
  isEditMode: boolean;
  isModerator: boolean;
  totalPages: number;
  onNavigate: () => void;
  onAddPageBefore?: () => void;
  onAddPageAfter?: () => void;
}

/**
 * Side navigation component for page management and navigation
 */
export const PageSideNavigation: Devvit.BlockComponent<PageSideNavigationProps> = ({
  side,
  isEditMode,
  isModerator,
  totalPages,
  onNavigate,
  onAddPageBefore,
  onAddPageAfter
}) => {
  // In edit mode for moderators
  if (isEditMode && isModerator) {
    return (
      <vstack gap="small" alignment="middle center" width="40px">
        {/* Add page button */}
        <button
          icon="add"
          appearance="primary"
          size="small"
          onPress={side === 'left' ? onAddPageBefore : onAddPageAfter}
        />
        
        {/* Navigation arrow (only if multiple pages) */}
        {totalPages > 1 && (
          <button
            icon={side === 'left' ? 'left' : 'right'}
            appearance="secondary"
            size="small"
            onPress={onNavigate}
          />
        )}
      </vstack>
    );
  }

  // No navigation needed
  return null;
};