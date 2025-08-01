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
  onEdit: (cell: LinkCell) => void;
  onClick: (cell: LinkCell, selectedVariant: Link) => void;
  onToggleDescription: (cellId: string) => void;
  onTrackImpression: (cellId: string, variantId: string) => void;
}

/**
 * Individual cell component that handles variant selection and rendering
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
  onTrackImpression
}) => {
  const isEmpty = LinkCell.isEmpty(cell);
  
  // Select the variant to display (with rotation logic)
  const selectedVariant = selectVariant(cell);
  
  // Track impression when component renders (only if not in edit mode)
  if (!isEditMode && !isEmpty) {
    // Use setTimeout to ensure tracking happens after render
    setTimeout(() => {
      onTrackImpression(cell.id, selectedVariant.id);
    }, 0);
  }

  // Set defaults for styling
  selectedVariant.backgroundColor = selectedVariant.backgroundColor || '#000000';
  selectedVariant.backgroundOpacity = selectedVariant.backgroundOpacity || 0.5;

  // Handle empty cell in edit mode
  if (isEmpty && isEditMode && isModerator) {
    return (
      <vstack
        key={cell.id}
        gap="small"
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

  return (
    <zstack
      key={cell.id}
      cornerRadius="medium"
      border={selectedVariant.image || isEmpty ? "none" : "thin"}
      borderColor={selectedVariant.image ? "transparent" : foregroundColor}
      height="100%"
      width="100%"
      onPress={() => {
        if (isEditMode && isModerator) {
          onEdit(cell);
        } else if (!isEditMode && selectedVariant.uri) {
          onClick(cell, selectedVariant);
        }
      }}
    >
      {/* Background image */}
      {selectedVariant.image && (
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

      {/* Title with background */}
      {selectedVariant.title && !showDescription && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="middle center"
        >
          <hstack
            backgroundColor={hexToRgba(selectedVariant.backgroundColor, selectedVariant.backgroundOpacity)}
            cornerRadius="medium"
            padding="none"
            width="100%"
            alignment="middle center"
          >
            <text
              size="medium"
              weight="bold"
              color={selectedVariant.textColor || "#FFFFFF"}
              wrap
            >
              {selectedVariant.title}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Description view */}
      {selectedVariant.description && showDescription && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="middle center"
        >
          <hstack
            backgroundColor={hexToRgba(selectedVariant.backgroundColor, selectedVariant.backgroundOpacity)}
            cornerRadius="medium"
            padding="small"
            width="100%"
            alignment="middle center"
          >
            <text
              size="small"
              color={selectedVariant.textColor || "#FFFFFF"}
              wrap
            >
              {selectedVariant.description}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Rotation indicator - top left */}
      {cell.rotationEnabled && cell.links.length > 1 && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="top start"
        >
          <hstack
            backgroundColor="rgba(74, 144, 226, 0.9)"
            cornerRadius="medium"
            padding="xsmall"
          >
            <text
              size="small"
              color="white"
              weight="bold"
            >
              🔄 {cell.links.filter(link => !Link.isEmpty(link)).length}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Click count indicator - only show in edit mode */}
      {isEditMode && isModerator && !isEmpty && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="top end"
        >
          <hstack
            backgroundColor="rgba(255, 215, 0, 0.9)"
            cornerRadius="medium"
            padding="xsmall"
          >
            <text
              size="small"
              color="black"
              weight="bold"
            >
              👆 {cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0)}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Toggle button in bottom right corner - only show in view mode */}
      {(selectedVariant.description && !isEditMode) && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="bottom end"
        >
          <button
            icon="info"
            size="small"
            onPress={() => onToggleDescription(cell.id)}
          />
        </vstack>
      )}
    </zstack>
  );
};