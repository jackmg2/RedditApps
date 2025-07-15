// src/main.tsx
import { Devvit, useForm, useState, useAsync } from '@devvit/public-api';
import './createPost.js';
import { ShopPost, ShopImage } from './types/shopPost.js';
import { ShopPin } from './types/shopPin.js';

Devvit.addSettings([
  {
    name: 'allowAllUsers',
    label: 'Allow all users to create shop posts',
    type: 'boolean',
    helpText: 'If enabled, all users can create shop posts. If disabled, only moderators can create them.',
    defaultValue: false
  }
]);

Devvit.addCustomPostType({
  name: 'Shop Post',
  height: 'tall',
  render: (context) => {
    // Use only primitive types for state
    const [shopPostJsonString, setShopPostJsonString] = useState<string | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isModerator, setIsModerator] = useState(false);
    const [isCreator, setIsCreator] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showAllTooltips, setShowAllTooltips] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    // Helper function to get ShopPost instance when needed
    const getShopPost = (): ShopPost | null => {
      if (!shopPostJsonString) return null;
      try {
        const data = JSON.parse(shopPostJsonString);
        return ShopPost.fromData(data);
      } catch (error) {
        console.error('Error parsing shop post JSON:', error);
        return null;
      }
    };

    // Helper to get current image
    const getCurrentImage = (): ShopImage | null => {
      const shopPost = getShopPost();
      if (!shopPost || shopPost.images.length === 0) return null;
      return shopPost.images[currentImageIndex] || null;
    };

    // Load current user data
    const userDataAsync = useAsync(async () => {
      try {
        const currentUser = await context.reddit.getCurrentUser();
        return {
          userId: currentUser?.id || null,
          username: currentUser?.username || null
        };
      } catch (error) {
        console.error('Error getting current user:', error);
        return { userId: null, username: null };
      }
    });

    // Load moderator status - only run after userDataAsync has data
    const isModeratorAsync = useAsync(async () => {
      try {
        const userData = userDataAsync.data;
        if (!userData?.username) {
          console.log('No username available for moderator check');
          return false;
        }

        const moderators = await context.reddit.getModerators({
          subredditName: context.subredditName as string
        });
        const allMods = await moderators.all();
        const isMod = allMods.some(m => m.username === userData.username);
        console.log('Is moderator:', isMod);
        return isMod;
      } catch (error) {
        console.error('Error checking moderator status:', error);
        return false;
      }
    }, {
      depends: [userDataAsync.data]
    });

    // Load shop post data
    const shopPostAsync = useAsync(async () => {
      try {
        const shopPostJsonFromRedis = await context.redis.get(`shop_post_${context.postId}`) as string;
        if (shopPostJsonFromRedis) {
          return shopPostJsonFromRedis;
        } else {
          const defaultShopPost = new ShopPost();
          return JSON.stringify(defaultShopPost);
        }
      } catch (error) {
        console.error('Error loading shop post:', error);
        const defaultShopPost = new ShopPost();
        return JSON.stringify(defaultShopPost);
      }
    });

    // Load creator status - only run after userDataAsync has data
    const isCreatorAsync = useAsync(async () => {
      try {
        if (!context.postId) {
          console.log('No postId available');
          return false;
        }
        
        const userData = userDataAsync.data;
        if (!userData?.userId) {
          console.log('No user data available, userData:', userData);
          return false;
        }

        const realAuthorId = await context.redis.get(`shop_post_author_${context.postId}`);
        console.log('Real author ID from Redis:', realAuthorId);
        console.log('Current user ID:', userData.userId);
        
        if (realAuthorId) {
          const isCreatorByRedis = userData.userId === realAuthorId;
          console.log('Is creator by Redis author ID:', isCreatorByRedis);
          return isCreatorByRedis;
        }

        if (shopPostJsonString) {
          try {
            const shopPostData = JSON.parse(shopPostJsonString);
            if (shopPostData?.authorId) {
              console.log('Shop post authorId:', shopPostData.authorId);
              const isCreatorByShopPost = userData.userId === shopPostData.authorId;
              console.log('Is creator by shop post:', isCreatorByShopPost);
              return isCreatorByShopPost;
            }
          } catch (error) {
            console.error('Error parsing shop post for creator check:', error);
          }
        }

        const post = await context.reddit.getPostById(context.postId);
        console.log('Reddit post authorId (likely bot):', post.authorId);
        const isCreatorByPost = userData.userId === post.authorId;
        console.log('Is creator by Reddit post:', isCreatorByPost);

        return isCreatorByPost;
      } catch (error) {
        console.error('Error checking creator status:', error);
        return false;
      }
    }, {
      depends: [userDataAsync.data, shopPostJsonString]
    });

    // Update state when async data loads
    if (userDataAsync.data && !currentUserId) {
      setCurrentUserId(userDataAsync.data.userId);
    }

    if (isModeratorAsync.data !== undefined && isModerator !== isModeratorAsync.data) {
      setIsModerator(isModeratorAsync?.data as boolean);
    }

    if (isCreatorAsync.data !== undefined && isCreator !== isCreatorAsync.data) {
      setIsCreator(isCreatorAsync?.data as boolean);
    }

    if (shopPostAsync.data && !shopPostJsonString) {
      setShopPostJsonString(shopPostAsync.data);
    }

    // Check if all data is loaded
    if (!dataLoaded && userDataAsync.data && isModeratorAsync.data !== undefined && 
        isCreatorAsync.data !== undefined && shopPostAsync.data) {
      console.log('All data loaded - setting dataLoaded to true');
      setDataLoaded(true);
    }

    const trackClick = async (pinId: string) => {
      const shopPost = getShopPost();
      if (!shopPost) return;
      
      shopPost.trackClick(pinId);
      await saveShopPost(shopPost);
    };

    const canEdit = isModerator || isCreator;
    const currentImage = getCurrentImage();

    const saveShopPost = async (shopPost: ShopPost) => {
      const jsonString = JSON.stringify(shopPost);
      await context.redis.set(`shop_post_${context.postId}`, jsonString);
      setShopPostJsonString(jsonString);
    };

    const addPin = async (pin: ShopPin) => {
      const shopPost = getShopPost();
      if (!shopPost || !currentImage) return;
      
      const updatedShopPostData = { ...shopPost };
      updatedShopPostData.images = [...updatedShopPostData.images];
      updatedShopPostData.images[currentImageIndex] = {
        ...currentImage,
        pins: [...currentImage.pins, pin]
      };

      // Convert plain object back to ShopPost instance
      const updatedShopPost = ShopPost.fromData(updatedShopPostData);

      await saveShopPost(updatedShopPost);
      setPendingPinPosition(null);
      context.ui.showToast('Pin added successfully!');
    };

    const updatePin = async (updatedPin: ShopPin) => {
      const shopPost = getShopPost();
      if (!shopPost || !currentImage) return;
      
      const updatedShopPost = { ...shopPost };
      updatedShopPost.images = [...updatedShopPost.images];
      const updatedImage = { ...currentImage };
      
      const pinIndex = updatedImage.pins.findIndex(pin => pin.id === updatedPin.id);
      if (pinIndex === -1) {
        context.ui.showToast('Pin not found for update');
        return;
      }

      updatedImage.pins = [...updatedImage.pins];
      updatedImage.pins[pinIndex] = ShopPin.fromData(updatedPin);
      updatedShopPost.images[currentImageIndex] = updatedImage;
;
      await saveShopPost(ShopPost.fromData(updatedShopPost));
      context.ui.showToast('Pin updated successfully!');
    };

    const removePin = async (pinId: string) => {
      const shopPost = getShopPost();
      if (!shopPost || !currentImage) return;
      
      const updatedShopPost = { ...shopPost };
      updatedShopPost.images = [...updatedShopPost.images];
      updatedShopPost.images[currentImageIndex] = {
        ...currentImage,
        pins: currentImage.pins.filter(pin => pin.id !== pinId)
      };

      await saveShopPost(ShopPost.fromData(updatedShopPost));
      context.ui.showToast('Pin removed successfully!');
    };

    const addImage = async (imageUrl: string) => {
      const shopPost = getShopPost();
      if (!shopPost) return;
      
      const newImage = shopPost.addImage(imageUrl);
      await saveShopPost(shopPost);
      setCurrentImageIndex(shopPost.images.length - 1); // Navigate to new image
      context.ui.showToast('Image added successfully!');
    };

    const removeImage = async (imageId: string) => {
      const shopPost = getShopPost();
      if (!shopPost || shopPost.images.length <= 1) {
        context.ui.showToast('Cannot remove the last image');
        return;
      }
      
      const removed = shopPost.removeImage(imageId);
      
      if (removed) {
        // Adjust current index if needed
        if (currentImageIndex >= shopPost.images.length) {
          setCurrentImageIndex(shopPost.images.length - 1);
        }
        
        await saveShopPost(shopPost);
        context.ui.showToast('Image removed successfully!');
      }
    };

    const toggleTooltip = (pinId: string) => {
      if (showAllTooltips) return;

      if (activeTooltip === pinId) {
        setActiveTooltip(null);
      } else {
        setActiveTooltip(pinId);
      }
    };

    const [pendingPinPosition, setPendingPinPosition] = useState<{ x: number, y: number } | null>(null);

    const addPinForm = useForm((data) => {
      const position = data ? JSON.parse(data.position) : { x: 50, y: 50 };
      return {
        fields: [
          {
            name: 'title',
            label: 'Product Title',
            type: 'string',
            required: true,
            helpText: 'Enter the product name or title'
          },
          {
            name: 'link',
            label: 'Product Link',
            type: 'string',
            required: true,
            helpText: 'Enter the URL to the product (must start with https://)'
          },
          {
            name: 'x',
            label: `X Position (${position.x.toFixed(1)}%)`,
            type: 'string',
            defaultValue: position.x.toFixed(1),
            helpText: 'Horizontal position on image (0-100, decimals allowed, e.g. 25.5)'
          },
          {
            name: 'y',
            label: `Y Position (${position.y.toFixed(1)}%)`,
            type: 'string',
            defaultValue: position.y.toFixed(1),
            helpText: 'Vertical position on image (0-100, decimals allowed, e.g. 75.2)'
          }
        ],
        title: 'Add Shopping Pin',
        acceptLabel: 'Add Pin',
      } as const;
    }, async (formData) => {
      if (!formData.link.startsWith('https://')) {
        context.ui.showToast('Link must start with https://');
        return;
      }

      const xPos = parseFloat(formData.x);
      const yPos = parseFloat(formData.y);

      if (isNaN(xPos) || xPos < 0 || xPos > 100) {
        context.ui.showToast('X position must be a valid number between 0 and 100');
        return;
      }

      if (isNaN(yPos) || yPos < 0 || yPos > 100) {
        context.ui.showToast('Y position must be a valid number between 0 and 100');
        return;
      }

      const newPin = new ShopPin(formData.title, formData.link, xPos, yPos);
      await addPin(newPin);
      setPendingPinPosition(null);
    });

    const addImageForm = useForm({
      fields: [
        {
          name: 'image',
          label: 'Product Image',
          type: 'image',
          required: true,
          helpText: 'Upload an additional image to add shopping pins to'
        }
      ],
      title: 'Add Image',
      acceptLabel: 'Add Image',
    }, async (formData) => {
      await addImage(formData.image);
    });

    const editPinForm = useForm((data) => {
      const pinData = data ? JSON.parse(data.pinData) : null;
      
      return {
        fields: [
          {
            name: 'pinId',
            label: 'Pin ID (Internal)',
            type: 'string',
            defaultValue: pinData.id,
            helpText: 'Internal ID for the pin being edited',
            disabled: true
          },
          {
            name: 'title',
            label: 'Product Title',
            type: 'string',
            required: true,
            defaultValue: pinData.title,
            helpText: 'Enter the product name or title'
          },
          {
            name: 'link',
            label: 'Product Link',
            type: 'string',
            required: true,
            defaultValue: pinData.link,
            helpText: 'Enter the URL to the product (must start with https://)'
          },
          {
            name: 'x',
            label: `X Position (${pinData.x.toFixed(1)}%)`,
            type: 'string',
            defaultValue: pinData.x.toFixed(1),
            helpText: 'Horizontal position on image (0-100, decimals allowed, e.g. 25.5)'
          },
          {
            name: 'y',
            label: `Y Position (${pinData.y.toFixed(1)}%)`,
            type: 'string',
            defaultValue: pinData.y.toFixed(1),
            helpText: 'Vertical position on image (0-100, decimals allowed, e.g. 75.2)'
          }
        ],
        title: 'Edit Shopping Pin',
        acceptLabel: 'Update Pin',
      } as const;
    }, async (formData) => {
      const pinId = formData.pinId;
      
      if (!formData.link.startsWith('https://')) {
        context.ui.showToast('Link must start with https://');
        return;
      }

      const xPos = parseFloat(formData.x);
      const yPos = parseFloat(formData.y);

      if (isNaN(xPos) || xPos < 0 || xPos > 100) {
        context.ui.showToast('X position must be a valid number between 0 and 100');
        return;
      }

      if (isNaN(yPos) || yPos < 0 || yPos > 100) {
        context.ui.showToast('Y position must be a valid number between 0 and 100');
        return;
      }

      const originalPin = currentImage?.pins.find(p => p.id === pinId);
      if (!originalPin) {
        context.ui.showToast('Original pin not found');
        return;
      }

      const updatedPin = ShopPin.fromData({
        id: pinId,
        title: formData.title,
        link: formData.link,
        x: xPos,
        y: yPos,
        createdAt: originalPin.createdAt
      });

      await updatePin(updatedPin);
    });

    const quickAddPin = (x: number, y: number) => {
      if (!isEditMode || !canEdit) return;

      setPendingPinPosition({ x, y });
      context.ui.showForm(addPinForm, {
        position: JSON.stringify({ x, y })
      });
    };

    const editPin = (pin: ShopPin) => {
      context.ui.showForm(editPinForm, {
        pinData: JSON.stringify({
          id: pin.id,
          title: pin.title,
          link: pin.link,
          x: pin.x,
          y: pin.y,
          createdAt: pin.createdAt
        })
      });
    };

    const navigateImage = (direction: 'prev' | 'next') => {
      const shopPost = getShopPost();
      if (!shopPost || shopPost.images.length <= 1) return;

      if (direction === 'prev') {
        setCurrentImageIndex(currentImageIndex > 0 ? currentImageIndex - 1 : shopPost.images.length - 1);
      } else {
        setCurrentImageIndex(currentImageIndex < shopPost.images.length - 1 ? currentImageIndex + 1 : 0);
      }
      
      // Reset tooltip states when changing images
      setActiveTooltip(null);
      setShowAllTooltips(false);
      setPendingPinPosition(null);
    };

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
            onPress={() => toggleTooltip(pin.id)}
          >
            
          </hstack>

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
                  // Track the click before navigating
                  trackClick(pin.id);
                  context.ui.navigateTo(pin.link);
                }
              }}
            >
              <text size="medium" weight="bold" color="white" wrap>
                {pin.title}
              </text>
              
              {/* Show click count in edit mode */}
              {isEditMode && canEdit && (() => {
                const shopPost = getShopPost();
                if (!shopPost) return null;
                const clickCount = shopPost.getClickCount(pin.id);
                return (
                  <text size="small" color="#FFD700" weight="bold">
                    👆 {clickCount} clicks
                  </text>
                );
              })()}
              
              {!isEditMode && (
                <text size="small" color="white" wrap>
                  {pin.link.substring(0,20)}...
                </text>
              )}
              
              {isEditMode && canEdit && (
                <hstack gap="small">
                  <button
                    size="small"
                    appearance="primary"
                    onPress={() => editPin(pin)}
                  >
                    Edit
                  </button>
                  <button
                    size="small"
                    appearance="destructive"
                    onPress={async () => {
                      await removePin(pin.id);
                    }}
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

    const renderGridButtons = () => {
      const buttons = [];
      const rows = 6;
      const cols = 6;
      
      for (let row = 0; row < rows; row++) {
        const rowButtons = [];
        for (let col = 0; col < cols; col++) {
          const x = ((col + 0.5) / cols) * 100;
          const y = ((row + 0.5) / rows) * 100;
          
          rowButtons.push(
            <vstack 
              key={`${row}-${col}`}
              width={`${100/cols}%`} 
              height="100%" 
              alignment="center middle" 
              onPress={() => quickAddPin(x, y)}
            >
              <text size="large" color="rgba(255,255,255,0.8)" weight="bold"></text>
            </vstack>
          );
        }
        buttons.push(
          <hstack key={row.toString()} height={`${100/rows}%`} width="100%" gap="none">
            {rowButtons}
          </hstack>
        );
      }
      
      return buttons;
    };

    const renderShopPost = () => {
      if (!dataLoaded || !shopPostJsonString) {
        return (
          <vstack height="100%" width="100%" alignment="middle center" gap="medium">
            <text size="large" weight="bold">Loading...</text>
          </vstack>
        );
      }

      const shopPost = getShopPost();
      if (!shopPost || shopPost.images.length === 0) {
        return (
          <vstack height="100%" width="100%" alignment="middle center" gap="medium">
            <text size="large" weight="bold">Shop Post</text>
            <text size="medium" color="secondary">No images uploaded yet</text>
            {canEdit && (
              <text size="small" color="secondary">
                Moderators and post creators can add shopping pins
              </text>
            )}
          </vstack>
        );
      }

      const currentImage = shopPost.images[currentImageIndex];

      return (
        <zstack height="100%" width="100%">
          {/* Background image */}
          <image
            url={currentImage.url}
            imageHeight={400}
            imageWidth={400}
            height="100%"
            width="100%"
            resizeMode="cover"
            description={shopPost.title || "Shop image"}
          />

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

          {/* Shopping pins */}
          {currentImage.pins.map(pin => (
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

          {/* Navigation arrows (only show if multiple images) */}
          {shopPost.images.length > 1 && (
            <>
              {/* Left arrow */}
              <vstack alignment="start middle" width="100%" height="100%">
                <hstack padding="medium">
                  <button
                    icon="left"
                    appearance="secondary"
                    size="medium"
                    onPress={() => navigateImage('prev')}
                  >
                  </button>
                </hstack>
              </vstack>

              {/* Right arrow */}
              <vstack alignment="end middle" width="100%" height="100%">
                <hstack padding="medium">
                  <button
                    icon="right"
                    appearance="secondary"
                    size="medium"
                    onPress={() => navigateImage('next')}
                  >
                  </button>
                </hstack>
              </vstack>
            </>
          )}

          {/* Bottom controls */}
          <vstack alignment="start bottom" width="100%" height="100%">
            <hstack padding="medium" gap="small" width="100%">
              {/* Show All Products button */}
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

              <spacer grow />

              {/* Image counter (only show if multiple images) */}
              {shopPost.images.length > 1 && (
                <hstack
                  backgroundColor="rgba(0,0,0,0.6)"
                  cornerRadius="medium"
                  padding="small"
                >
                  <text size="small" color="white" weight="bold">
                    {currentImageIndex + 1} / {shopPost.images.length}
                  </text>
                </hstack>
              )}

              {/* Add Image button (only in edit mode) */}
              {isEditMode && canEdit && (
                <button
                  icon="add"
                  appearance="secondary"
                  size="medium"
                  onPress={() => context.ui.showForm(addImageForm)}
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
                {isEditMode && shopPost.images.length > 1 && (
                  <button
                    icon="delete"
                    appearance="destructive"
                    size="small"
                    onPress={async () => {
                      await removeImage(currentImage.id);
                    }}
                  >
                    Remove Image
                  </button>
                )}
                
                <button
                  icon={isEditMode ? "checkmark" : "edit"}
                  appearance={isEditMode ? "success" : "secondary"}
                  size="small"
                  onPress={() => {
                    setIsEditMode(!isEditMode);
                    setPendingPinPosition(null);
                    if (!isEditMode) {
                      setShowAllTooltips(false);
                      setActiveTooltip(null);
                    }
                  }}
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
                {(() => {
                  const shopPost = getShopPost();
                  if (!shopPost || !shopPost.clickTracking || Object.keys(shopPost.clickTracking).length === 0) return null;
                  
                  const totalClicks = shopPost.getTotalClicks();
                  if (totalClicks === 0) return null;
                  
                  const mostClicked = shopPost.getMostClickedPin();
                  if (!mostClicked) return null;
                  
                  // Find the pin title
                  let pinTitle = "Unknown Pin";
                  for (const image of shopPost.images) {
                    const pin = image.pins.find(p => p.id === mostClicked.pinId);
                    if (pin) {
                      pinTitle = pin.title;
                      break;
                    }
                  }
                  
                  return (
                    <vstack gap="small">
                      <text size="small" color="#FFD700" weight="bold">
                        📊 Analytics Summary
                      </text>
                      <text size="small" color="white">
                        Total clicks: {totalClicks}
                      </text>
                      <text size="small" color="white">
                        Top product: {pinTitle} ({mostClicked.clicks} clicks)
                      </text>
                      <text size="small" color="white">
                        Current image: {currentImage?.pins.reduce((sum, pin) => sum + (shopPost.getClickCount(pin.id) || 0), 0) || 0} clicks
                      </text>
                    </vstack>
                  );
                })()}
              </vstack>
            </vstack>
          )}
        </zstack>
      );
    };

    return renderShopPost();
  },
});

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;