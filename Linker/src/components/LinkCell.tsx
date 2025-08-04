// Updated LinkCell.tsx - Optimized for better space utilization
import { Devvit } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { selectVariant } from '../utils/rotationUtils.js';
import { hexToRgba } from '../utils/colorUtils.js';

interface LinkCellComponentProps {
  cell: LinkCell;
  foregroundColor: string;
  isEditMode: boolean;
  isModerator: boolean;
  showDescription: boolean;
  onEdit: (cell: LinkCell, variantIndex?: number) => void;
  onClick: (cell: LinkCell, selectedVariant: Link) => void;
  onToggleDescription: (cellId: string) => void;
  onTrackImpression: (cellId: string, variantId: string) => void;
  onNextVariant: (cellId: string) => void;
  onAddVariant: (cellId: string) => void;
  onRemoveVariant: (cellId: string) => void;
  currentVariantIndex?: number;
  // New prop for button click prevention
  onButtonClick: (cellId: string) => void;
}

/**
 * Enhanced cell component optimized for space utilization
 */
export const LinkCellComponent: Devvit.BlockComponent<LinkCellComponentProps> = ({ 
  cell, 
  foregroundColor, 
  isEditMode, 
  isModerator,
  showDescription,
  onEdit,
  onClick,
  onToggleDescription,
  onTrackImpression,
  onNextVariant,
  onAddVariant,
  onRemoveVariant,
  currentVariantIndex = 0,
  onButtonClick
}) => {
  const isEmpty = LinkCell.isEmpty(cell);
  
  // In edit mode, show the specific variant index, otherwise use rotation logic
  const selectedVariant = isEditMode && !isEmpty 
    ? (cell.links[currentVariantIndex] || cell.links[0])
    : selectVariant(cell);
  
  // Track impression when component renders (only if not in edit mode)
  if (!isEditMode && !isEmpty) {
    setTimeout(() => {
      onTrackImpression(cell.id, selectedVariant.id);
    }, 0);
  }

  // Set defaults for styling
  if (selectedVariant) {
    selectedVariant.backgroundColor = selectedVariant.backgroundColor || '#000000';
    selectedVariant.backgroundOpacity = selectedVariant.backgroundOpacity || 0.5;
  }

  // Helper function to handle button clicks with prevention
  const handleButtonClick = (action: () => void) => {
    // Set the prevention flag first
    onButtonClick(cell.id);
    // Then execute the action
    action();
  };

  // Handle empty cell in edit mode
  if (isEmpty && isEditMode && isModerator) {
    return (
      <vstack
        key={cell.id}
        gap="none"
        padding="small"
        cornerRadius="medium"
        border="thin"
        borderColor={foregroundColor}
        height="100%"
        width="100%"
        alignment="middle center"
        onPress={() => onEdit(cell)}
      >
        <text alignment="middle center" size="xxlarge" color={foregroundColor}>+</text>
      </vstack>
    );
  }

  const activeVariants = cell.links.filter(link => !Link.isEmpty(link));
  const hasMultipleVariants = activeVariants.length > 1;
  const currentIndex = isEditMode ? currentVariantIndex : 0;

  return (
    <zstack
      key={cell.id}
      cornerRadius="medium"
      border={selectedVariant?.image || isEmpty ? "none" : "thin"}
      borderColor={selectedVariant?.image ? "transparent" : foregroundColor}
      height="100%"
      width="100%"
      onPress={() => {
        if (isEditMode && isModerator) {
          onEdit(cell, currentIndex);
        } else if (!isEditMode && selectedVariant?.uri) {
          onClick(cell, selectedVariant);
        }
      }}
    >
      {/* Background image - Full coverage */}
      {selectedVariant?.image && (
        <image
          url={selectedVariant.image}
          imageHeight="256px"
          imageWidth="256px"
          height="100%"
          width="100%"
          resizeMode="cover"
          description={selectedVariant.title || "Image"}
        />
      )}

      {/* Title with background - Optimized sizing */}
      {selectedVariant?.title && !showDescription && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="middle center"
        >
          <hstack
            backgroundColor={hexToRgba(selectedVariant.backgroundColor, selectedVariant.backgroundOpacity)}
            cornerRadius="small"
            padding="small"
            width="95%" // Slightly smaller than container for better visual
            alignment="middle center"
          >
            <text
              size={isEditMode ? "small" : "medium"} // Smaller text in edit mode for more space
              weight="bold"
              color={selectedVariant.textColor || "#FFFFFF"}
              wrap
              alignment="center"
            >
              {selectedVariant.title}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Description view - Optimized sizing */}
      {selectedVariant?.description && showDescription && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="middle center"
        >
          <hstack
            backgroundColor={hexToRgba(selectedVariant.backgroundColor, selectedVariant.backgroundOpacity)}
            cornerRadius="small"
            padding="small"
            width="95%"
            alignment="middle center"
          >
            <text
              size="small"
              color={selectedVariant.textColor || "#FFFFFF"}
              wrap
              alignment="center"
            >
              {selectedVariant.description}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Edit Mode Controls - More compact layout */}
      {isEditMode && isModerator && !isEmpty && (
        <vstack
          height="100%"
          width="100%"
          padding="xsmall"
          alignment="top start"
        >
          <hstack gap="small" width="100%">
            {/* Refresh/Next Variant Button */}
            {hasMultipleVariants && (
              <button
                icon="refresh"
                size="small"
                appearance="secondary"
                onPress={() => handleButtonClick(() => onNextVariant(cell.id))}
              />
            )}
            
            {/* Add Variant Button */}
            <button
              icon="add"
              size="small"
              appearance="success"
              onPress={() => handleButtonClick(() => onAddVariant(cell.id))}
            />

            {/* Remove Variant Button (only if multiple variants) */}
            {hasMultipleVariants && (
              <button
                icon="delete"
                size="small"
                appearance="destructive"
                onPress={() => handleButtonClick(() => onRemoveVariant(cell.id))}
              />
            )}
          </hstack>
        </vstack>
      )}

      {/* Variant indicator - More compact */}
      {hasMultipleVariants && isEditMode && (
        <vstack
          height="100%"
          width="100%"
          padding="xsmall"
          alignment="bottom end"
        >
          <hstack
            backgroundColor="rgba(74, 144, 226, 0.9)"
            cornerRadius="small"
            padding="xsmall"
          >
            <text
              size="xsmall"
              color="white"
              weight="bold"
            >
              {`${currentIndex + 1}/${activeVariants.length}`}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Click count indicator - More compact */}
      {isEditMode && isModerator && !isEmpty && (
        <vstack
          height="100%"
          width="100%"
          padding="xsmall"
          alignment="bottom start"
        >
          <hstack
            backgroundColor="rgba(255, 215, 0, 0.9)"
            cornerRadius="small"
            padding="xsmall"
          >
            <text
              size="xsmall"
              color="black"
              weight="bold"
            >
              {selectedVariant?.clickCount || 0}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Info toggle button - More compact and only when needed */}
      {(selectedVariant?.description && !isEditMode) && (
        <vstack
          height="100%"
          width="100%"
          padding="xsmall"
          alignment="bottom end"
        >
          <button
            icon="info"
            size="small"
            appearance="secondary"
            onPress={() => handleButtonClick(() => onToggleDescription(cell.id))}
          />
        </vstack>
      )}
    </zstack>
  );
};