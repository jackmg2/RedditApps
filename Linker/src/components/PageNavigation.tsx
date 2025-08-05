// src/components/PageNavigation.tsx - Updated for edit permissions
import { Devvit } from '@devvit/public-api';
import { EditButton } from './EditButton.js';

interface PageNavigationProps {
    currentPageIndex: number;
    totalPages: number;
    pages: any[];
    foregroundColor: string;
    isEditMode: boolean;
    isModerator: boolean; // This now represents "canEdit" from the parent
    onNavigatePrevious: () => void;
    onNavigateNext: () => void;
    onToggleEditMode: () => void;
}

/**
 * Unified page navigation and header component (now only used in view mode)
 */
export const PageNavigation: Devvit.BlockComponent<PageNavigationProps> = ({
    currentPageIndex,
    totalPages,
    pages,
    foregroundColor,
    isEditMode,
    isModerator, // This actually represents "canEdit" permission
    onNavigatePrevious,
    onNavigateNext,
    onToggleEditMode
}) => {
    // Helper function to truncate title (first 6 characters + ...)
    const truncateTitle = (title: string): string => {
        if (!title || title.trim() === '') return 'Untitled';
        const cleanTitle = title.trim();
        if (cleanTitle.length <= 10) return cleanTitle;
        return cleanTitle.substring(0, 10) + '...';
    };

    // Get current page title (full version for center)
    const currentPageTitle = pages[currentPageIndex]?.title || `Page ${currentPageIndex + 1}`;

    // For single page, show simple layout
    if (totalPages <= 1) {
        return (
            <hstack width="100%" alignment="center middle" gap="none" padding="small">
                {/* Spacer */}
                <hstack width="80px" />

                {/* Current page title */}
                <hstack alignment="center middle"
                    grow
                    padding="small">
                    <text
                        color={foregroundColor}
                        size="large"
                        weight="bold"
                        alignment="center"
                    >
                        {currentPageTitle}
                    </text>
                </hstack>

                {/* Edit controls */}
                <hstack alignment="end bottom" gap="small" width="80px">
                    {isModerator && ( // isModerator here represents "canEdit"
                        <EditButton
                            isEditMode={isEditMode}
                            onToggleEditMode={onToggleEditMode}
                        />
                    )}
                </hstack>
            </hstack>
        );
    }

    // Calculate previous and next page indices (with looping)
    const previousPageIndex = currentPageIndex === 0 ? totalPages - 1 : currentPageIndex - 1;
    const nextPageIndex = currentPageIndex === totalPages - 1 ? 0 : currentPageIndex + 1;

    // Get page titles
    const previousPageTitle = pages[previousPageIndex]?.title || `Page ${previousPageIndex + 1}`;
    const nextPageTitle = pages[nextPageIndex]?.title || `Page ${nextPageIndex + 1}`;

    return (
        <hstack width="100%" alignment="center middle" gap="none" padding="small">
            {/* Previous page title (clickable) */}
            <hstack
                alignment="start middle"
                onPress={onNavigatePrevious}
                padding="small"
                cornerRadius="small"
                backgroundColor="rgba(255,255,255,0.3)"
                width="120px"
            >
                <text
                    color={`${foregroundColor}AA`} // Semi-transparent
                    size="medium"
                    alignment="center"
                >
                    ← {truncateTitle(previousPageTitle)}
                </text>
            </hstack>

            {/* Current page title */}
            <hstack alignment="center middle" grow>
                <text
                    color={foregroundColor}
                    size="xlarge"
                    weight="bold"
                    alignment="center"
                >
                    {currentPageTitle}
                </text>
            </hstack>

            {/* Next page title (clickable) */}
            <hstack
                alignment="end middle"
                onPress={onNavigateNext}
                padding="small"
                cornerRadius="small"
                backgroundColor="rgba(255,255,255,0.3)"
                width="120px"
            >
                <text
                    color={`${foregroundColor}AA`} // Semi-transparent
                    size="medium"
                    alignment="center"
                >
                    {truncateTitle(nextPageTitle)} →
                </text>
            </hstack>

            {/* Edit button - Only edit toggle, no remove page button */}
            <hstack alignment="end middle" gap="small">
                {isModerator && ( // isModerator here represents "canEdit" permission
                    <EditButton
                        isEditMode={isEditMode}
                        onToggleEditMode={onToggleEditMode}
                    />
                )}
            </hstack>
        </hstack>
    );
};