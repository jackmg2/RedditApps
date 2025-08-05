// src/components/PageSideNavigation.tsx - Updated for edit permissions
import { Devvit } from '@devvit/public-api';

interface PageSideNavigationProps {
  side: 'left' | 'right';
  isEditMode: boolean;
  isModerator: boolean; // This now represents "canEdit" from the parent
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
  isModerator, // This actually represents "canEdit" permission
  totalPages,
  onNavigate,
  onAddPageBefore,
  onAddPageAfter
}) => {
  // In edit mode for users with edit permissions
  if (isEditMode && isModerator) { // isModerator here represents "canEdit"
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