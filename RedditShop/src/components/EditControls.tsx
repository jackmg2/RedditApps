import { Devvit } from '@devvit/public-api';
import { ShopPost } from '../types/shopPost.js';
import { getAnalyticsSummary } from '../utils/analytics.js';
import { generateGridPositions } from '../utils/positioning.js';

interface EditControlsProps {
  isEditMode: boolean;
  canEdit: boolean;
  shopPost: ShopPost | null;
  currentImageIndex: number;
  totalImages: number;
  onToggleEdit: () => void;
  onAddPin: (x: number, y: number) => void;
  onAddImage: () => void;
  onRemoveImage: () => void;
  pendingPinPosition: { x: number, y: number } | null;
}

export const EditControls: Devvit.BlockComponent<EditControlsProps> = ({ 
  isEditMode, 
  canEdit,
  shopPost,
  currentImageIndex,
  totalImages,
  onToggleEdit,
  onAddPin,
  onAddImage,
  onRemoveImage,
  pendingPinPosition
}) => {
  const renderGridButtons = () => {
    const positions = generateGridPositions(6, 6);
    const buttons = [];
    const rows = 6;
    const cols = 6;

    for (let row = 0; row < rows; row++) {
      const rowButtons = [];
      for (let col = 0; col < cols; col++) {
        const positionIndex = row * cols + col;
        const position = positions[positionIndex];

        rowButtons.push(
          <vstack
            key={`${row}-${col}`}
            width={`${100 / cols}%`}
            height="100%"
            alignment="center middle"
            onPress={() => onAddPin(position.x, position.y)}
          >
            <text size="large" color="rgba(255,255,255,0.8)" weight="bold"></text>
          </vstack>
        );
      }
      buttons.push(
        <hstack key={row.toString()} height={`${100 / rows}%`} width="100%" gap="none">
          {rowButtons}
        </hstack>
      );
    }

    return buttons;
  };

  return (
    <>
      {/* Clickable overlay grid for adding pins (only in edit mode) */}
      {isEditMode && canEdit && (
        <vstack height="100%" width="100%" gap="none">
          {renderGridButtons()}
        </vstack>
      )}

      {/* Pending pin indicator */}
      {isEditMode && pendingPinPosition && (
        <vstack
          alignment="start top"
          width="100%"
          height="100%"
        >
          <spacer height={`${pendingPinPosition.y}%`} />
          <hstack width="100%">
            <spacer width={`${pendingPinPosition.x}%`} />
            <hstack
              alignment="center middle"
              width="24px"
              height="24px"
              backgroundColor="#FFD700"
              cornerRadius="full"
              border="thin"
              borderColor="white"
            >
              <text size="small" color="black" weight="bold">+</text>
            </hstack>
          </hstack>
        </vstack>
      )}

      {/* Bottom controls */}
      <vstack alignment="start bottom" width="100%" height="100%">
        <hstack padding="medium" gap="small" width="100%">
          <spacer grow />

          {/* Add Image button (only in edit mode) */}
          {isEditMode && canEdit && (
            <button
              icon="add"
              appearance="secondary"
              size="medium"
              onPress={onAddImage}
            >
              Add Image
            </button>
          )}
        </hstack>
      </vstack>

      {/* Edit controls - top right */}
      {canEdit && (
        <vstack alignment="end top" width="100%" height="100%">
          <hstack padding="medium" gap="small">
            {/* Remove Image button (only in edit mode and if more than 1 image) */}
            {isEditMode && totalImages > 1 && (
              <button
                icon="delete"
                appearance="destructive"
                size="small"
                onPress={onRemoveImage}
              >
                Remove Image
              </button>
            )}

            <button
              icon={isEditMode ? "checkmark" : "edit"}
              appearance={isEditMode ? "success" : "secondary"}
              size="small"
              onPress={onToggleEdit}
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>
          </hstack>
        </vstack>
      )}

      {/* Edit mode instruction and analytics */}
      {isEditMode && canEdit && (
        <vstack alignment="center top" width="100%" height="100%">
          <vstack
            padding="small"
            backgroundColor="rgba(0,0,0,0.9)"
            cornerRadius="medium"
            gap="small"
            maxWidth="90%"
          >
            <text size="small" color="white" weight="bold">
              👆 Click to add pins, or open existing pins to edit/remove
            </text>

            {/* Analytics Summary */}
            {shopPost && (() => {
              const analytics = getAnalyticsSummary(shopPost, currentImageIndex);
              if (!analytics) return null;

              return (
                <vstack gap="small">
                  <text size="small" color="#FFD700" weight="bold">
                    📊 Analytics Summary
                  </text>
                  <text size="small" color="white">
                    Total clicks: {analytics.totalClicks}
                  </text>
                  {analytics.topProduct && (
                    <text size="small" color="white">
                      Top product: {analytics.topProduct.title} ({analytics.topProduct.clicks} clicks)
                    </text>
                  )}
                  <text size="small" color="white">
                    Current image: {analytics.currentImageClicks} clicks
                  </text>
                </vstack>
              );
            })()}
          </vstack>
        </vstack>
      )}
    </>
  );
};