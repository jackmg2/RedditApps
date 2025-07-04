// src/main.tsx
import { Devvit, useForm, useState, useAsync } from '@devvit/public-api';
import './createPost.js';
import { ShopPost } from './types/shopPost.js';
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
    const [shopPost, setShopPost] = useState<ShopPost | null>(null);
    const [isModerator, setIsModerator] = useState(false);
    const [isCreator, setIsCreator] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showAllTooltips, setShowAllTooltips] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

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
      depends: [userDataAsync.data] // Only run when userDataAsync has data
    });

    // Load shop post data
    const shopPostAsync = useAsync(async () => {
      try {
        const shopPostJson = await context.redis.get(`shop_post_${context.postId}`) as string;
        if (shopPostJson) {
          return JSON.parse(shopPostJson) as ShopPost;
        } else {
          // If no shop post data exists, create a new one
          return new ShopPost();
        }
      } catch (error) {
        console.error('Error loading shop post:', error);
        return new ShopPost();
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

        // First, try to get the real author ID from Redis
        const realAuthorId = await context.redis.get(`shop_post_author_${context.postId}`);
        console.log('Real author ID from Redis:', realAuthorId);
        console.log('Current user ID:', userData.userId);
        
        if (realAuthorId) {
          const isCreatorByRedis = userData.userId === realAuthorId;
          console.log('Is creator by Redis author ID:', isCreatorByRedis);
          return isCreatorByRedis;
        }

        // Fallback: check shop post data
        const shopPostData = shopPostAsync.data;
        if (shopPostData?.authorId) {
          console.log('Shop post authorId:', shopPostData.authorId);
          const isCreatorByShopPost = userData.userId === shopPostData.authorId;
          console.log('Is creator by shop post:', isCreatorByShopPost);
          return isCreatorByShopPost;
        }

        // Last fallback: check Reddit post (this will likely be the bot)
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
      depends: [userDataAsync.data] // Only run when userDataAsync has data
    });

    // Update state when async data loads
    if (userDataAsync.data && !currentUserId) {
      setCurrentUserId(userDataAsync.data.userId);
    }

    if (isModeratorAsync.data !== undefined && isModerator !== isModeratorAsync.data) {
      setIsModerator(isModeratorAsync.data);
    }

    if (isCreatorAsync.data !== undefined && isCreator !== isCreatorAsync.data) {
      setIsCreator(isCreatorAsync.data);
    }

    if (shopPostAsync.data && !shopPost) {
      setShopPost(shopPostAsync.data);
    }

    // Check if all data is loaded
    if (!dataLoaded && userDataAsync.data && isModeratorAsync.data !== undefined && 
        isCreatorAsync.data !== undefined && shopPostAsync.data) {
      console.log('All data loaded - setting dataLoaded to true');
      console.log('User data:', userDataAsync.data);
      console.log('Is moderator:', isModeratorAsync.data);
      console.log('Is creator:', isCreatorAsync.data);
      setDataLoaded(true);
    }

    const canEdit = isModerator || isCreator;

    const addPin = async (pin: ShopPin) => {
      if (!shopPost) return;
      
      const updatedShopPost = { ...shopPost };
      updatedShopPost.pins = [...updatedShopPost.pins, pin];

      // Update Redis first
      await context.redis.set(`shop_post_${context.postId}`, JSON.stringify(updatedShopPost));
      
      // Then update local state
      setShopPost(updatedShopPost);
      setPendingPinPosition(null);
      
      context.ui.showToast('Pin added successfully!');
    };

    const updatePin = async (updatedPin: ShopPin) => {
      if (!shopPost) return;
      
      console.log('Before update - Current pins:', shopPost.pins.map(p => ({ id: p.id, title: p.title })));
      console.log('Updating pin with ID:', updatedPin.id, 'new title:', updatedPin.title);
      
      const updatedShopPost = { ...shopPost };
      const pinIndex = updatedShopPost.pins.findIndex(pin => pin.id === updatedPin.id);
      
      if (pinIndex === -1) {
        context.ui.showToast('Pin not found for update');
        console.log('Pin not found with ID:', updatedPin.id);
        return;
      }

      // Replace the pin at the found index
      updatedShopPost.pins[pinIndex] = { ...updatedPin };
      
      console.log('After update - New pins:', updatedShopPost.pins.map(p => ({ id: p.id, title: p.title })));

      // Update Redis first
      await context.redis.set(`shop_post_${context.postId}`, JSON.stringify(updatedShopPost));
      
      // Then update local state
      setShopPost(updatedShopPost);
      
      context.ui.showToast('Pin updated successfully!');
    };

    const removePin = async (pinId: string) => {
      if (!shopPost) return;
      
      const updatedShopPost = { ...shopPost };
      updatedShopPost.pins = updatedShopPost.pins.filter(pin => pin.id !== pinId);

      // Update Redis first
      await context.redis.set(`shop_post_${context.postId}`, JSON.stringify(updatedShopPost));
      
      // Then update local state
      setShopPost(updatedShopPost);
      
      context.ui.showToast('Pin removed successfully!');
    };

    const toggleTooltip = (pinId: string) => {
      if (showAllTooltips) return; // Don't toggle individual tooltips when all are shown

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
      // Validate URL
      if (!formData.link.startsWith('https://')) {
        context.ui.showToast('Link must start with https://');
        return;
      }

      // Parse and validate positions (allow decimals)
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

      const newPin = new ShopPin(
        formData.title,
        formData.link,
        xPos,
        yPos
      );

      await addPin(newPin);
      setPendingPinPosition(null);
    });

    const editPinForm = useForm((data) => {
      const pinData = data ? JSON.parse(data.pinData) : null;
      if (!pinData) return null;

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
      // Get the pin ID from the form data
      const pinId = formData.pinId;
      
      // Validate URL
      if (!formData.link.startsWith('https://')) {
        context.ui.showToast('Link must start with https://');
        return;
      }

      // Parse and validate positions (allow decimals)
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

      // Find the original pin to preserve createdAt
      const originalPin = shopPost?.pins.find(p => p.id === pinId);
      if (!originalPin) {
        context.ui.showToast('Original pin not found');
        return;
      }

      // Create updated pin object
      const updatedPin = {
        id: pinId,
        title: formData.title,
        link: formData.link,
        x: xPos,
        y: yPos,
        createdAt: originalPin.createdAt
      };

      console.log('Updating pin:', pinId, 'with data:', updatedPin);
      await updatePin(updatedPin as ShopPin);
    });

    const handleImageClick = () => {
      if (!isEditMode || !canEdit) return;

      // Since we can't get click coordinates in Devvit, we'll use a simplified approach
      // Show the form and let users adjust coordinates manually
      context.ui.showForm(addPinForm, {
        position: JSON.stringify({ x: 50, y: 50 })
      });
    };

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

    const renderPin = (pin: ShopPin) => {
      const isTooltipVisible = showAllTooltips || activeTooltip === pin.id;

      return (
        <vstack key={pin.id}>
          {/* Pin bullet */}
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

          {/* Tooltip */}
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
                  context.ui.navigateTo(pin.link);
                }
              }}
            >
              <text size="medium" weight="bold" color="white" wrap>
                {pin.title}
              </text>
              {!isEditMode && (
                <text size="small" color="white" wrap>
                  {pin.link.substring(0,20)}...
                </text>
              )}
              
              {/* Edit mode buttons */}
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
          // Calculate position based on grid
          // Add small offset from edges for better positioning
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
          <hstack key={row} height={`${100/rows}%`} width="100%" gap="none">
            {rowButtons}
          </hstack>
        );
      }
      
      return buttons;
    };

    const renderShopPost = () => {
      if (!dataLoaded || !shopPost) {
        return (
          <vstack height="100%" width="100%" alignment="middle center" gap="medium">
            <text size="large" weight="bold">Loading...</text>
            {/* Debug info - remove in production */}
            <text size="small" color="secondary">
              User: {currentUserId ? currentUserId.substring(0, 8) : 'Loading...'} | 
              Mod: {isModerator ? 'Yes' : 'No'} | 
              Creator: {isCreator ? 'Yes' : 'No'} | 
              Can Edit: {canEdit ? 'Yes' : 'No'}
            </text>
          </vstack>
        );
      }

      if (!shopPost.imageUrl) {
        return (
          <vstack height="100%" width="100%" alignment="middle center" gap="medium">
            <text size="large" weight="bold">Shop Post</text>
            <text size="medium" color="secondary">No image uploaded yet</text>
            {canEdit && (
              <text size="small" color="secondary">
                Moderators and post creators can add shopping pins
              </text>
            )}
            {/* Debug info - remove in production */}
            <text size="small" color="secondary">
              Can Edit: {canEdit ? 'Yes' : 'No'} (Mod: {isModerator ? 'Yes' : 'No'}, Creator: {isCreator ? 'Yes' : 'No'})
            </text>
            <text size="small" color="secondary">
              User ID: {currentUserId ? currentUserId.substring(0, 8) : 'None'}
            </text>
          </vstack>
        );
      }

      return (
        <zstack height="100%" width="100%">
          {/* Background image */}
          <image
            url={shopPost.imageUrl}
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
          {shopPost.pins.map(pin => (
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

          {/* Cart button - bottom left */}
          <vstack alignment="start bottom" width="100%" height="100%">
            <hstack padding="medium">
              <button
                icon="search"
                appearance="secondary"
                size="medium"
                onPress={() => {
                  setShowAllTooltips(!showAllTooltips);
                  if (!showAllTooltips) {
                    setActiveTooltip(null); // Close individual tooltip when showing all
                  }
                }}
              >
                {showAllTooltips ? 'Hide Products' : 'Show All Products'}
              </button>
            </hstack>
          </vstack>

          {/* Edit controls - top right */}
          {canEdit && (
            <vstack alignment="end top" width="100%" height="100%">
              <hstack padding="medium" gap="small">              
                <button
                  icon={isEditMode ? "checkmark" : "edit"}
                  appearance={isEditMode ? "success" : "secondary"}
                  size="small"
                  onPress={() => {
                    setIsEditMode(!isEditMode);
                    setPendingPinPosition(null); // Clear pending pin when exiting edit mode
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

          {/* Edit mode instruction */}
          {isEditMode && canEdit && (
            <vstack alignment="center top" width="100%" height="100%">
              <hstack
                padding="small"
                backgroundColor="rgba(0,0,0,0.8)"
                cornerRadius="medium"
              >
                <text size="small" color="white" weight="bold">
                  👆 Click to add pins, or open existing pins to edit/remove
                </text>
              </hstack>
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