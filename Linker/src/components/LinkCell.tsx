import { Devvit } from '@devvit/public-api';
import { Link } from '../types/link.js';
import { hexToRgba } from '../utils/colorUtils.js';

interface LinkCellProps {
  link: Link;
  foregroundColor: string;
  isEditMode: boolean;
  isModerator: boolean;
  showDescription: boolean;
  onEdit: (link: Link) => void;
  onClick: (link: Link) => void;
  onToggleDescription: (linkId: string) => void;
}

/**
 * Individual link cell component
 */
export const LinkCell: Devvit.BlockComponent<LinkCellProps> = ({ 
  link, 
  foregroundColor, 
  isEditMode, 
  isModerator,
  showDescription,
  onEdit,
  onClick,
  onToggleDescription
}) => {
  const isEmpty = Link.isEmpty(link);
  
  // Set defaults for styling
  link.backgroundColor = link.backgroundColor || '#000000';
  link.backgroundOpacity = link.backgroundOpacity || 0.5;

  // Handle empty cell in edit mode
  if (isEmpty && isEditMode && isModerator) {
    return (
      <vstack
        key={link.id}
        gap="small"
        padding="small"
        cornerRadius="medium"
        border="thin"
        borderColor={foregroundColor}
        height="100%"
        width="100%"
        alignment="middle center"
        onPress={() => onEdit(link)}
      >
        <text alignment="middle center" size="xxlarge" color={foregroundColor}>+</text>
      </vstack>
    );
  }

  return (
    <zstack
      key={link.id}
      cornerRadius="medium"
      border={link.image || isEmpty ? "none" : "thin"}
      borderColor={link.image ? "transparent" : foregroundColor}
      height="100%"
      width="100%"
      onPress={() => {
        if (isEditMode && isModerator) {
          onEdit(link);
        } else if (!isEditMode && link.uri) {
          onClick(link);
        }
      }}
    >
      {/* Background image */}
      {link.image && (
        <image
          url={link.image}
          imageHeight="256px"
          imageWidth="256px"
          height="100%"
          width="100%"
          resizeMode="cover"
          description={link.title || "Image"}
        />
      )}

      {/* Title with background */}
      {link.title && !showDescription && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="middle center"
        >
          <hstack
            backgroundColor={hexToRgba(link.backgroundColor, link.backgroundOpacity)}
            cornerRadius="medium"
            padding="none"
            width="100%"
            alignment="middle center"
          >
            <text
              size="medium"
              weight="bold"
              color={link.textColor || "#FFFFFF"}
              wrap
            >
              {link.title}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Description view */}
      {link.description && showDescription && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="middle center"
        >
          <hstack
            backgroundColor={hexToRgba(link.backgroundColor, link.backgroundOpacity)}
            cornerRadius="medium"
            padding="small"
            width="100%"
            alignment="middle center"
          >
            <text
              size="small"
              color={link.textColor || "#FFFFFF"}
              wrap
            >
              {link.description}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Click count indicator - only show in edit mode */}
      {isEditMode && isModerator && !isEmpty && (link.clickCount || 0) > 0 && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="top start"
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
              👆 {link.clickCount || 0}
            </text>
          </hstack>
        </vstack>
      )}

      {/* Toggle button in top right corner - only show in view mode */}
      {(link.description && !isEditMode) && (
        <vstack
          height="100%"
          width="100%"
          padding="none"
          alignment="top end"
        >
          <button
            icon="info"
            size="small"
            onPress={() => onToggleDescription(link.id)}
          />
        </vstack>
      )}
    </zstack>
  );
};