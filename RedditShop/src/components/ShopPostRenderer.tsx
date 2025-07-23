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
  const [isProcessing, setIsProcessing] = useState(false);

  // Custom hooks for data and permissions
  const shopPostHook = useShopPost(context);
  const { shopPost, currentImage, currentImageIndex, loading } = shopPostHook;
  const permissions = useUserPermissions(context, shopPost?.authorId);

  // Forms with improved error handling
  const addPinForm = useForm((data) => {
    const position = data ? JSON.parse(data.position) : { x: 50, y: 50 };
    return createAddPinForm(position);
  }, async (formData) => {
    if (isProcessing) {
      context.ui.showToast('Please wait, processing previous request...');
      return;
    }

    setIsProcessing(true);
    try {
      const newPin = validateAndCreatePin(formData as AddPinFormData, context);
      if (newPin) {
        await shopPostHook.addPin(newPin);
        setPendingPinPosition(null);
        context.ui.showToast('Pin added successfully!');
      }
    } catch (error) {
      console.error('Error in addPinForm:', error);
      context.ui.showToast('Failed to add pin. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  });

  const editPinForm = useForm((data) => {
    const pinData = data ? JSON.parse(data.pinData) : null;
    return createEditPinForm(pinData);
  }, async (formData) => {
    if (isProcessing) {
      context.ui.showToast('Please wait, processing previous request...');
      return;
    }

    if (!currentImage) {
      context.ui.showToast('No current image found');
      return;
    }

    setIsProcessing(true);
    try {
      const originalPin = currentImage.pins.find(p => p.id === formData.pinId);
      if (!originalPin) {
        context.ui.showToast('Original pin not found');
        return;
      }

      // Normalize form data to handle array inputs and ensure all required fields are present
      const normalizedFormData = {
        pinId: formData.pinId,
        title: formData.title,
        link: formData.link,
        x: formData.x,
        y: formData.y,
        color: Array.isArray(formData.color) ? formData.color[0] : formData.color,
      };

      const updatedPin = validateAndUpdatePin(normalizedFormData, originalPin, context);
      if (updatedPin) {
        await shopPostHook.updatePin(updatedPin);
        context.ui.showToast('Pin updated successfully!');
      }
    } catch (error) {
      console.error('Error in editPinForm:', error);
      context.ui.showToast('Failed to update pin. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  });

  const addImageForm = useForm(() => {
    const form = createAddImageForm();
    return {
      ...form,
      fields: form.fields as readonly any[],
    };
  }, async (formData) => {
    if (isProcessing) {
      context.ui.showToast('Please wait, processing previous request...');
      return;
    }

    if (!formData.image) {
      context.ui.showToast('Image is required');
      return;
    }

    setIsProcessing(true);
    try {
      const { imageUrl, width, height } = validateImageData(formData as { image: string; width?: string; height?: string });
      await shopPostHook.addImage(imageUrl, width, height);
      context.ui.showToast('Image added successfully!');
    } catch (error) {
      console.error('Error in addImageForm:', error);
      context.ui.showToast('Failed to add image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  });

  // Event handlers with improved error handling
  const toggleTooltip = (pinId: string) => {
    if (showAllTooltips) return;

    if (activeTooltip === pinId) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip(pinId);
    }
  };

  const quickAddPin = (x: number, y: number) => {
    if (!isEditMode || !permissions.canEdit || isProcessing) return;

    setPendingPinPosition({ x, y });
    context.ui.showForm(addPinForm, {
      position: JSON.stringify({ x, y })
    });
  };

  const editPin = (pin: any) => {
    if (isProcessing) {
      context.ui.showToast('Please wait, processing previous request...');
      return;
    }

    context.ui.showForm(editPinForm, {
      pinData: JSON.stringify({
        id: pin.id,
        title: pin.title,
        link: pin.link,
        x: pin.x,
        y: pin.y,
        color: pin.color,
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
    if (isProcessing) {
      context.ui.showToast('Please wait, processing previous request...');
      return;
    }

    setIsEditMode(!isEditMode);
    setPendingPinPosition(null);
    if (!isEditMode) {
      setShowAllTooltips(false);
      setActiveTooltip(null);
      setShowEditHint(false);
    }
  };

  const handleTrackClick = async (pinId: string) => {
    try {
      await shopPostHook.trackClick(pinId);
    } catch (error) {
      console.error('Error tracking click:', error);
      // Don't show error to user since this is not critical
    }
  };

  const handleRemovePin = async (pinId: string) => {
    if (isProcessing) {
      context.ui.showToast('Please wait, processing previous request...');
      return;
    }

    setIsProcessing(true);
    try {
      await shopPostHook.removePin(pinId);
      context.ui.showToast('Pin removed successfully!');
    } catch (error) {
      console.error('Error removing pin:', error);
      context.ui.showToast('Failed to remove pin. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!currentImage || isProcessing) {
      context.ui.showToast('Cannot remove image at this time');
      return;
    }

    setIsProcessing(true);
    try {
      await shopPostHook.removeImage(currentImage.id);
      context.ui.showToast('Image removed successfully!');
    } catch (error) {
      console.error('Error removing image:', error);
      context.ui.showToast('Failed to remove image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state with processing indicator
  if (loading || permissions.loading) {
    return (
      <vstack height="100%" width="100%" alignment="middle center" gap="medium">
        <text size="large" weight="bold">Loading...</text>
        {isProcessing && (
          <text size="medium" color="secondary">Processing...</text>
        )}
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
        <text size="medium" color="secondary">Please refresh the page</text>
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
        canEdit={permissions.canEdit && !isProcessing}
        shopPost={shopPost}
        currentImageIndex={currentImageIndex}
        totalImages={shopPost.images.length}
        onToggleEdit={toggleEditMode}
        onAddPin={quickAddPin}
        onAddImage={() => !isProcessing && context.ui.showForm(addImageForm)}
        onRemoveImage={handleRemoveImage}
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
        canEdit={permissions.canEdit && !isProcessing}
        onPinClick={toggleTooltip}
        onPinEdit={editPin}
        onPinRemove={handleRemovePin}
        onTrackClick={handleTrackClick}
        context={context}
      />

      {/* Layer 3: Navigation arrows (only show if multiple images and conditionally hide based on position) */}
      {hasMultipleImages && !isProcessing && (
        <>
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
              disabled={isProcessing}
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

      {/* Layer 6: Processing overlay */}
      {isProcessing && (
        <vstack alignment="center middle" width="100%" height="100%">
          <vstack
            padding="medium"
            backgroundColor="rgba(0,0,0,0.8)"
            cornerRadius="medium"
            gap="small"
            alignment="center middle"
          >
            <text size="medium" color="white" weight="bold">
              Processing...
            </text>
            <text size="small" color="#FFD700">
              Please wait
            </text>
          </vstack>
        </vstack>
      )}
    </ImageViewer>
  );
};