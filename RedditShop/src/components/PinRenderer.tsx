import { Devvit } from '@devvit/public-api';
import { ShopPin } from '../types/shopPin.js';
import { ShopPost } from '../types/shopPost.js';

interface PinRendererProps {
  pins: ShopPin[];
  shopPost: ShopPost | null;
  showAllTooltips: boolean;
  activeTooltip: string | null;
  isEditMode: boolean;
  canEdit: boolean;
  onPinClick: (pinId: string) => void;
  onPinEdit: (pin: ShopPin) => void;
  onPinRemove: (pinId: string) => void;
  onTrackClick: (pinId: string) => void;
  context: any;
}

export const PinRenderer: Devvit.BlockComponent<PinRendererProps> = ({ 
  pins, 
  shopPost,
  showAllTooltips, 
  activeTooltip, 
  isEditMode, 
  canEdit,
  onPinClick,
  onPinEdit,
  onPinRemove,
  onTrackClick,
  context
}) => {
  const renderPin = (pin: ShopPin) => {
    const isTooltipVisible = showAllTooltips || activeTooltip === pin.id;

    return (
      <vstack key={pin.id}>
        <hstack
          alignment="center middle"
          width="24px"
          height="24px"
          backgroundColor="#2b2321EE"
          darkBackgroundColor="#2b2321EE"
          lightBackgroundColor="#2b2321EE"
          cornerRadius="full"
          border="thin"
          borderColor="#00000020"
          onPress={() => onPinClick(pin.id)}
        />

        {isTooltipVisible && (
          <vstack
            backgroundColor="#2b2321EE"
            cornerRadius="medium"
            padding="small"
            border="none"
            gap="small"
            minWidth="150px"
            maxWidth="200px"
            onPress={() => {
              if (pin.link && !isEditMode) {
                onTrackClick(pin.id);
                context.ui.navigateTo(pin.link);
              }
            }}
          >
            <text size="medium" weight="bold" color="white" wrap>
              {pin.title}
            </text>

            {/* Show click count in edit mode */}
            {isEditMode && canEdit && shopPost && (
              <text size="small" color="#FFD700" weight="bold">
                👆 {shopPost.getClickCount(pin.id)} clicks
              </text>
            )}

            {!isEditMode && (
              <text size="small" color="white" wrap>
                {pin.link.substring(0, 20)}...
              </text>
            )}

            {isEditMode && canEdit && (
              <hstack gap="small">
                <button
                  size="small"
                  appearance="primary"
                  onPress={() => onPinEdit(pin)}
                >
                  Edit
                </button>
                <button
                  size="small"
                  appearance="destructive"
                  onPress={() => onPinRemove(pin.id)}
                >
                  Remove
                </button>
              </hstack>
            )}
          </vstack>
        )}
      </vstack>
    );
  };

  return (
    <>
      {pins.map(pin => (
        <vstack
          key={pin.id}
          alignment="start top"
          width="100%"
          height="100%"
        >
          <spacer height={`${pin.y}%`} />
          <hstack width="100%">
            <spacer width={`${pin.x}%`} />
            {renderPin(pin)}
          </hstack>
        </vstack>
      ))}
    </>
  );
};