import { Devvit, useForm, useState } from '@devvit/public-api';
import { useShopPost } from '../hooks/useShopPost.js';
import { useUserPermissions } from '../hooks/useUserPermissions.js';
import { ImageViewer } from './ImageViewer.js';
import { PinRenderer } from './PinRenderer.js';
import { EditControls } from './EditControls.js';
import { createAddPinForm, createEditPinForm, createAddImageForm } from '../forms/shopPostForms.js';
import { AddPinFormData, validateAndCreatePin, validateAndUpdatePin, validateImageData } from '../forms/formHandlers.js';

interface ShopPostRendererProps {
  context: any;
}

export const ShopPostRenderer: Devvit.BlockComponent<ShopPostRendererProps> = ({ context }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAllTooltips, setShowAllTooltips] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [pendingPinPosition, setPendingPinPosition] = useState<{ x: number, y: number } | null>(null);
  const [showEditHint, setShowEditHint] = useState(false);

  // Custom hooks for data and permissions
  const shopPostHook = useShopPost(context);
  const { shopPost, currentImage, currentImageIndex, loading } = shopPostHook;
  const permissions = useUserPermissions(context, shopPost?.authorId);

  // Forms
  const addPinForm = useForm((data) => {
    const position = data ? JSON.parse(data.position) : { x: 50, y: 50 };
    return createAddPinForm(position);
  }, async (formData) => {
    const newPin = validateAndCreatePin(formData as AddPinFormData, context);
    if (newPin) {
      await shopPostHook.addPin(newPin);
      setPendingPinPosition(null);
    }
  });

  const editPinForm = useForm((data) => {
    const pinData = data ? JSON.parse(data.pinData) : null;
    return createEditPinForm(pinData);
  }, async (formData) => {
    const originalPin = currentImage?.pins.find(p => p.id === formData.pinId);
    if (!originalPin) {
      context.ui.showToast('Original pin not found');
      return;
    }

    // Convert color from string[] to string if necessary
    const normalizedFormData = {
      ...formData,
      color: Array.isArray(formData.color) ? formData.color[0] : formData.color,
    };
    const updatedPin = validateAndUpdatePin(normalizedFormData, originalPin, context);
    if (updatedPin) {
      await shopPostHook.updatePin(updatedPin);
    }
  });

  const addImageForm = useForm(() => {
    // Ensure the returned object matches the Form type
    const form = createAddImageForm();
    return {
      ...form,
      fields: form.fields as readonly any[], // Cast to readonly to satisfy the Form type
    };
  }, async (formData) => {
    // Ensure formData has the required 'image' property
    if (!formData.image) {
      context.ui.showToast('Image is required');
      return;
    }
    const { imageUrl, width, height } = validateImageData(formData as { image: string; width?: string; height?: string });
    await shopPostHook.addImage(imageUrl, width, height);
  });

  // Event handlers
  const toggleTooltip = (pinId: string) => {
    if (showAllTooltips) return;

    if (activeTooltip === pinId) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip(pinId);
    }
  };

  const quickAddPin = (x: number, y: number) => {
    if (!isEditMode || !permissions.canEdit) return;

    setPendingPinPosition({ x, y });
    context.ui.showForm(addPinForm, {
      position: JSON.stringify({ x, y })
    });
  };

  const editPin = (pin: any) => {
    context.ui.showForm(editPinForm, {
      pinData: JSON.stringify({
        id: pin.id,
        title: pin.title,
        link: pin.link,
        x: pin.x,
        y: pin.y,
        color: pin.color, // Include color in the edit data
        createdAt: pin.createdAt
      })
    });
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    shopPostHook.navigateImage(direction);
    // Reset tooltip states when changing images
    setActiveTooltip(null);
    setShowAllTooltips(false);
    setPendingPinPosition(null);
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setPendingPinPosition(null);
    if (!isEditMode) {
      setShowAllTooltips(false);
      setActiveTooltip(null);
      setShowEditHint(false); // Show hint when entering edit mode
    }
  };

  const handleTrackClick = async (pinId: string) => {
    await shopPostHook.trackClick(pinId);
  };

  // Loading state
  if (loading || permissions.loading) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large" weight="bold">Loading...</text>
      </vstack>
    );
  }

  // No images state
  if (!shopPost || shopPost.images.length === 0) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large" weight="bold">Shop Post</text>
        <text size="medium" color="secondary">No images uploaded yet</text>
        {permissions.canEdit && (
          <text size="small" color="secondary">
            Moderators and post creators can add shopping pins
          </text>
        )}
      </vstack>
    );
  }

  if (!currentImage) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large" weight="bold">Error loading image</text>
      </vstack>
    );
  }

  // Navigation helper variables
  const isFirstImage = currentImageIndex === 0;
  const isLastImage = currentImageIndex === shopPost.images.length - 1;
  const hasMultipleImages = shopPost.images.length > 1;

  return (
    <ImageViewer
      image={currentImage}
      totalImages={shopPost.images.length}
      currentIndex={currentImageIndex}
      onNavigate={navigateImage}>
      
      {/* Layer 1: Edit Controls Grid (lowest layer - behind everything else) */}
      <EditControls
        isEditMode={isEditMode}
        canEdit={permissions.canEdit}
        shopPost={shopPost}
        currentImageIndex={currentImageIndex}
        totalImages={shopPost.images.length}
        onToggleEdit={toggleEditMode}
        onAddPin={quickAddPin}
        onAddImage={() => context.ui.showForm(addImageForm)}
        onRemoveImage={() => currentImage && shopPostHook.removeImage(currentImage.id)}
        pendingPinPosition={pendingPinPosition}
        showEditHint={showEditHint}
        onToggleEditHint={() => setShowEditHint(!showEditHint)}
      />

      {/* Layer 2: Pin Renderer (middle layer - above grid, below UI controls) */}
      <PinRenderer
        pins={currentImage.pins}
        shopPost={shopPost}
        showAllTooltips={showAllTooltips}
        activeTooltip={activeTooltip}
        isEditMode={isEditMode}
        canEdit={permissions.canEdit}
        onPinClick={toggleTooltip}
        onPinEdit={editPin}
        onPinRemove={shopPostHook.removePin}
        onTrackClick={handleTrackClick}
        context={context}
      />

      {/* Layer 3: Navigation arrows (only show if multiple images and conditionally hide based on position) - HIGH PRIORITY LAYER */}
      {hasMultipleImages && (
        <>
          {/* Left arrow - only show if not on first image */}
          {!isFirstImage && (
            <vstack alignment="start middle" width="100%" height="100%">
              <hstack padding="medium">
                <button
                  icon="left"
                  appearance="secondary"
                  size="medium"
                  onPress={() => navigateImage('prev')}
                />
              </hstack>
            </vstack>
          )}

          {/* Right arrow - only show if not on last image */}
          {!isLastImage && (
            <vstack alignment="end middle" width="100%" height="100%">
              <hstack padding="medium">
                <button
                  icon="right"
                  appearance="secondary"
                  size="medium"
                  onPress={() => navigateImage('next')}
                />
              </hstack>
            </vstack>
          )}
        </>
      )}

      {/* Layer 4: Image counter (only show if multiple images) */}
      {shopPost.images.length > 1 && (
        <vstack alignment="center bottom" width="100%" height="100%">
          <hstack padding="medium">
            <hstack
              backgroundColor="rgba(0,0,0,0.6)"
              cornerRadius="medium"
              padding="small"
            >
              <text size="small" color="white" weight="bold">
                {currentImageIndex + 1} / {shopPost.images.length}
              </text>
            </hstack>
          </hstack>
        </vstack>
      )}

      {/* Layer 5: Show All Products button (only visible when NOT in edit mode) */}
      {!isEditMode && (
        <vstack alignment="start bottom" width="100%" height="100%">
          <hstack padding="medium" gap="small" width="100%">
            <button
              icon="search"
              appearance="secondary"
              size="medium"
              onPress={() => {
                setShowAllTooltips(!showAllTooltips);
                if (!showAllTooltips) {
                  setActiveTooltip(null);
                }
              }}
            >
              {showAllTooltips ? 'Hide Products' : 'Show All Products'}
            </button>
          </hstack>
        </vstack>
      )}
    </ImageViewer>
  );
};