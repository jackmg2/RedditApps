import { Devvit, useForm, useState, useAsync } from '@devvit/public-api';
import { Linker } from './types/linker.js';
import { Link } from './types/link.js';
import { Page } from './types/page.js';
import './createPost.js';

Devvit.addCustomPostType({
  name: 'Community Links',
  height: 'tall',
  render: (context) => {
    const [linker, setLinker] = useState(JSON.stringify(new Linker()));
    const [isModerator, setIsModerator] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [count, setCount] = useState(1);
    const [showDescriptionMap, setShowDescriptionMap] = useState<{ [key: string]: boolean }>({});
    const [preventNavigation, setPreventNavigation] = useState(false);
    const [preventNavigationTimestamp, setPreventNavigationTimestamp] = useState(0);

    const { data, loading, error } = useAsync(async () => {
      const linkerJson = await context.redis.get(`linker_${context.postId}`) as string;
      let linker: Linker;
      
      if (linkerJson) {
        const parsedData = JSON.parse(linkerJson);
        linker = Linker.fromData(parsedData);
        
        // Ensure all links have click count initialized (backward compatibility)
        linker.pages.forEach(page => {
          page.links.forEach(link => {
            if (link.clickCount === undefined || link.clickCount === null) {
              link.clickCount = 0;
            }
          });
        });
      } else {
        linker = new Linker();
      }
      
      return JSON.stringify(linker);
    }, { depends: [count] });

    const isModeratorAsync = useAsync(async () => {
      const currentUser = (await context.reddit.getCurrentUser());
      const isModerator = (await (await context.reddit.getModerators({ subredditName: context.subredditName as string })).all()).some(m => m.username == currentUser?.username);
      return isModerator;
    }, { depends: [count] });

    setIsModerator(isModeratorAsync.data ?? false);
    setLinker(data ?? JSON.stringify(new Linker()));

    const toggleDescriptionView = (linkId: string) => {
      setShowDescriptionMap(prev => ({
        ...prev,
        [linkId]: !prev[linkId]
      }));
      
      // Set flag to prevent navigation with timestamp
      setPreventNavigation(true);
      setPreventNavigationTimestamp(Date.now());
    };

    // Check if we should reset the prevention flag
    const shouldPreventNavigation = () => {
      if (!preventNavigation) return false;
      
      const currentTime = Date.now();
      const elapsed = currentTime - preventNavigationTimestamp;
      
      if (elapsed >= 1000) {
        setPreventNavigation(false);
        return false;
      }
      
      return true;
    };

    const trackLinkClick = async (linkId: string) => {
      const linkerData = JSON.parse(linker);
      const updatedLinker = Linker.fromData(linkerData);

      const pageIndex = 0; // Currently only supports the first page
      const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === linkId);

      if (linkIndex !== -1) {
        // Ensure the link has trackClick method or initialize clickCount
        const targetLink = updatedLinker.pages[pageIndex].links[linkIndex];
        if (targetLink.trackClick) {
          targetLink.trackClick();
        } else {
          targetLink.clickCount = (targetLink.clickCount || 0) + 1;
        }
        
        await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
        setLinker(JSON.stringify(updatedLinker));
        setCount((prev) => prev + 1);
        console.log(`Tracked click for link ${linkId}, new count: ${targetLink.clickCount}`);
      }
    };

    const updateLink = async (link: Link) => {
      const linkerData = JSON.parse(linker);
      const updatedLinker = Linker.fromData(linkerData);

      const pageIndex = 0; // Currently only supports the first page
      const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === link.id);

      if (linkIndex !== -1) {
        // Preserve the structure and ensure all properties are set
        const updatedLink = Link.fromData({
          id: link.id,
          uri: link.uri,
          title: link.title,
          image: link.image,
          textColor: link.textColor,
          description: link.description,
          backgroundColor: link.backgroundColor,
          backgroundOpacity: link.backgroundOpacity,
          clickCount: link.clickCount || 0
        });
        
        updatedLinker.pages[pageIndex].links[linkIndex] = updatedLink;
        await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
        setLinker(JSON.stringify(updatedLinker));
        setCount((prev) => prev + 1);
        context.ui.showToast('Link updated successfully');
      }
    };

    const updatePage = async (data: { id: string, title: string, foregroundColor?: string, backgroundColor?: string, backgroundImage?: string }) => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      const pageIndex = updatedLinker.pages.findIndex(p => p.id === data.id);
      if (pageIndex !== -1) {
        updatedLinker.pages[pageIndex].title = data.title;
        if (data.foregroundColor) {
          updatedLinker.pages[pageIndex].foregroundColor = data.foregroundColor;
        }
        if (data.backgroundColor) {
          updatedLinker.pages[pageIndex].backgroundColor = data.backgroundColor;
        }
        if (data.backgroundImage !== undefined) {
          updatedLinker.pages[pageIndex].backgroundImage = data.backgroundImage;
        }
        await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
        setLinker(JSON.stringify(updatedLinker));
        setCount((prev) => prev + 1);
        context.ui.showToast('Board updated successfully');
      }
    };

    const updateBackgroundImage = async (backgroundImage: string) => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      updatedLinker.pages[0].backgroundImage = backgroundImage;

      await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
      setLinker(JSON.stringify(updatedLinker));
      setCount((prev) => prev + 1);
      context.ui.showToast('Background image updated successfully');
    };

    const addRow = async () => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      // Add a new row of links (4 links or however many columns we have)
      const columns = updatedLinker.pages[0].columns || 4;
      for (let i = 0; i < columns; i++) {
        updatedLinker.pages[0].links.push(new Link());
      }

      await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
      setLinker(JSON.stringify(updatedLinker));
      setCount((prev) => prev + 1);
      context.ui.showToast('Row added successfully');
    };

    const addColumn = async () => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      // Increase column count
      updatedLinker.pages[0].columns = (updatedLinker.pages[0].columns || 4) + 1;

      // Add a new link at appropriate positions to create a new column
      const currentLinks = [...updatedLinker.pages[0].links];
      const newLinks = [];
      const columns = updatedLinker.pages[0].columns;

      // Calculate how many rows we currently have
      const rows = Math.ceil(currentLinks.length / (columns - 1));

      // Create a new array with links inserted at the right positions
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          if (col === columns - 1) {
            // This is our new column, add a new link
            newLinks.push(new Link());
          } else {
            // Get the existing link from the old array if it exists
            const index = row * (columns - 1) + col;
            if (index < currentLinks.length) {
              newLinks.push(currentLinks[index]);
            }
          }
        }
      }

      updatedLinker.pages[0].links = newLinks;

      await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
      setLinker(JSON.stringify(updatedLinker));
      setCount((prev) => prev + 1);
      context.ui.showToast('Column added successfully');
    };

    const removeRow = async (rowIndex: number) => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      const columns = updatedLinker.pages[0].columns || 4;

      // Calculate the start and end index of the links in this row
      const startIndex = rowIndex * columns;
      const endIndex = startIndex + columns;

      // Remove the links in this row
      updatedLinker.pages[0].links = [
        ...updatedLinker.pages[0].links.slice(0, startIndex),
        ...updatedLinker.pages[0].links.slice(endIndex)
      ];

      await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
      setLinker(JSON.stringify(updatedLinker));
      setCount((prev) => prev + 1);
      context.ui.showToast('Row removed successfully');
    };

    const removeColumn = async (colIndex: number) => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      // Decrease column count
      const originalColumns = updatedLinker.pages[0].columns || 4;
      updatedLinker.pages[0].columns = originalColumns - 1;

      if (originalColumns <= 1) {
        context.ui.showToast('Cannot remove the last column');
        return;
      }

      const currentLinks = [...updatedLinker.pages[0].links];
      const newLinks = [];

      // Calculate how many rows we currently have
      const rows = Math.ceil(currentLinks.length / originalColumns);

      // Remove the specified column by excluding it from the new array
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < originalColumns; col++) {
          if (col !== colIndex) {
            const index = row * originalColumns + col;
            if (index < currentLinks.length) {
              newLinks.push(currentLinks[index]);
            }
          }
        }
      }

      updatedLinker.pages[0].links = newLinks;

      await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
      setLinker(JSON.stringify(updatedLinker));
      setCount((prev) => prev + 1);
      context.ui.showToast('Column removed successfully');
    };

    const backgroundImageForm = useForm(() => {
      const page = JSON.parse(linker).pages[0];
      return {
        fields: [
          {
            name: 'backgroundImage',
            label: 'Background Image',
            type: 'image',
            defaultValue: page.backgroundImage || '',
            helpText: 'Upload an image for the board background (leave empty to remove)'
          }
        ],
        title: 'Change Background Image',
        acceptLabel: 'Save',
      } as const;
    },
      async (formData) => {
        await updateBackgroundImage(formData.backgroundImage || '');
      });

    const editLinkForm = useForm((dataArgs) => {
      const tempData = JSON.parse(dataArgs.e) as Link;

      return {
        fields: [
          {
            name: 'id',
            label: 'Id',
            type: 'string',
            disabled: true,
            defaultValue: tempData.id,
            onValidate: (e: any) => e.value === '' ? 'Id required' : undefined
          },
          {
            name: 'title',
            label: 'Title',
            type: 'string',
            defaultValue: tempData.title,
            onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
          },
          {
            name: 'uri',
            label: 'Link',
            type: 'string',
            defaultValue: tempData.uri
          },
          {
            name: 'image',
            label: 'Background Image',
            type: 'image',
            defaultValue: tempData.image
          },
          {
            name: 'textColor',
            label: 'Text Color',
            type: 'string',
            defaultValue: tempData.textColor || '#FFFFFF',
            helpText: 'Hex color code (e.g., #FFFFFF for white)'
          },
          {
            name: 'backgroundColor',
            label: 'Title Background Color',
            type: 'string',
            defaultValue: tempData.backgroundColor || '#000000',
            helpText: 'Hex color code for title background (e.g., #000000 for black)'
          },
          {
            name: 'backgroundOpacity',
            label: 'Title Background Opacity',
            type: 'string',
            defaultValue: (tempData.backgroundOpacity !== undefined ? tempData.backgroundOpacity : 0.5).toString(),
            helpText: 'Opacity value between 0 and 1 (e.g., 0.5 for 50%)'
          },
          {
            name: 'description',
            label: 'Description',
            type: 'paragraph',
            defaultValue: tempData.description || ''
          },
          {
            name: 'clickCount',
            label: 'Click Count',
            type: 'string',
            defaultValue: (tempData.clickCount || 0).toString(),
            helpText: 'Number of times this link has been clicked (you can edit this value)'
          }
        ],
        title: 'Edit Link',
        acceptLabel: 'Save',
      } as const;
    },
      async (tempData) => {
        let link = new Link();
        link.id = tempData.id;
        link.title = tempData.title;
        link.uri = tempData.uri;
        link.image = tempData.image;
        link.textColor = tempData.textColor;
        link.description = tempData.description;
        link.backgroundColor = tempData.backgroundColor;
        link.backgroundOpacity = parseFloat(tempData.backgroundOpacity);
        link.clickCount = parseInt(tempData.clickCount) || 0;
        await updateLink(link);
      });

    const editPageForm = useForm((dataArgs) => {
      const tempData = JSON.parse(dataArgs.e) as Page;
      return {
        fields: [
          {
            name: 'id',
            label: 'Id',
            type: 'string',
            disabled: true,
            defaultValue: tempData.id,
            onValidate: (e: any) => e.value === '' ? 'Id required' : undefined
          },
          {
            name: 'title',
            label: 'Title',
            type: 'string',
            defaultValue: tempData.title,
            onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
          },
          {
            name: 'backgroundColor',
            label: 'Background Color',
            type: 'string',
            defaultValue: tempData.backgroundColor || '#000000',
            helpText: 'Hex color code (e.g., #000000 for black)'
          },
          {
            name: 'foregroundColor',
            label: 'Foreground Color',
            type: 'string',
            defaultValue: tempData.foregroundColor || '#FFFFFF',
            helpText: 'Hex color code for text and borders (e.g., #FFFFFF for white)'
          }
        ],
        title: 'Edit Board',
        acceptLabel: 'Save',
      } as const;
    },
      async (tempData) => {
        await updatePage(tempData);
      });

    // Render edit/validate button in bottom right corner
    const renderEditButton = () => (
      <hstack alignment="end bottom" width="100%">
        <button
          icon={isEditMode ? "checkmark" : "edit"}
          appearance={isEditMode ? "success" : "secondary"}
          size="small"
          onPress={() => {
            setIsEditMode(!isEditMode);
          }}
        >
        </button>
      </hstack>
    );

    // Render moderation menu (only visible in edit mode)
    const renderModMenu = () => (
      <hstack gap="small" alignment="start middle">

        <button
          icon="edit"
          appearance="primary"
          size="small"
          onPress={() => context.ui.showForm(editPageForm, { e: JSON.stringify(JSON.parse(linker).pages[0]) })}
        ></button>

        <button
          icon="add"
          appearance="primary"
          size="small"
          onPress={addRow}
        >Add Row</button>

        <button
          icon="add"
          appearance="primary"
          size="small"
          onPress={addColumn}
        >Add Column</button>

        <hstack alignment='end top' grow>
          <button
            icon="image-post"
            appearance="primary"
            size="small"
            onPress={() => context.ui.showForm(backgroundImageForm)}
          ></button>
        </hstack>
      </hstack>
    );

    // Render a single link cell
    const renderLink = (link: Link, foregroundColor: string) => {
      const isEmpty = Link.isEmpty(link);
      const showDescription = showDescriptionMap[link.id] || false;
      link.backgroundColor = link.backgroundColor || '#000000'; // Default to black
      link.backgroundOpacity = link.backgroundOpacity || 0.5; // Default to 50% opacity

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
            onPress={() => context.ui.showForm(editLinkForm, { e: JSON.stringify(link) })}
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
              context.ui.showForm(editLinkForm, { e: JSON.stringify(link) });
            } else if (!isEditMode && link.uri && !shouldPreventNavigation()) {
              // Track the click before navigation
              trackLinkClick(link.id);
              context.ui.navigateTo(link.uri);
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
                backgroundColor={`rgba(${parseInt(link.backgroundColor.slice(1, 3), 16)}, ${parseInt(link.backgroundColor.slice(3, 5), 16)}, ${parseInt(link.backgroundColor.slice(5, 7), 16)}, ${link.backgroundOpacity || 0.5})`}
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
                backgroundColor={`rgba(${parseInt(link.backgroundColor.slice(1, 3), 16)}, ${parseInt(link.backgroundColor.slice(3, 5), 16)}, ${parseInt(link.backgroundColor.slice(5, 7), 16)}, ${link.backgroundOpacity || 0.5})`}
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
                onPress={(e) => {
                  toggleDescriptionView(link.id);
                }}
              />
            </vstack>
          )}
        </zstack>
      );
    };

    if (loading) return <text>Loading...</text>;
    if (error) return <text color="red" wrap>{error.message}</text>;

    const linkerData = JSON.parse(linker);
    const page = linkerData.pages[0];
    const backgroundColor = page.backgroundColor || '#000000'; // Default to black
    const foregroundColor = page.foregroundColor || '#FFFFFF'; // Default to white
    const backgroundImage = page.backgroundImage || '';
    const columns = page.columns || 4;

    // Calculate how many rows we need
    const rows = Math.ceil(page.links.length / columns);

    // Create a matrix of links
    const linkGrid: Link[][] = [];
    for (let i = 0; i < rows; i++) {
      linkGrid.push(page.links.slice(i * columns, (i + 1) * columns));

      // Pad the last row with empty links if needed
      if (i === rows - 1 && linkGrid[i].length < columns) {
        const padding = columns - linkGrid[i].length;
        for (let j = 0; j < padding; j++) {
          linkGrid[i].push(new Link());
        }
      }
    }

    // Calculate analytics for edit mode
    const getAnalytics = () => {
      if (!isEditMode || !isModerator) return null;
      
      const linkerData = JSON.parse(linker);
      const currentPage = linkerData.pages[0];
      
      // Ensure links have clickCount property
      const links = currentPage.links.map((link: any) => ({
        ...link,
        clickCount: link.clickCount || 0
      }));
      
      const totalClicks = links.reduce((sum: number, link: any) => sum + link.clickCount, 0);
      if (totalClicks === 0) return null;
      
      const mostClicked = links.reduce((max: any, current: any) => 
        current.clickCount > max.clickCount ? current : max
      );
      
      return {
        totalClicks,
        mostClicked: mostClicked.clickCount > 0 ? mostClicked : null
      };
    };

    const analytics = getAnalytics();

    // Main container
    return (
      <zstack height="100%">
        {/* Background Layer */}
        {backgroundImage ? (
          <image
            url={backgroundImage}
            height="100%"
            width="100%"
            imageHeight={256}
            imageWidth={256}
            resizeMode="cover"
            description="Board background"
          />
        ) : (
          <vstack backgroundColor={backgroundColor} height="100%" width="100%" />
        )}

        {/* Content Layer */}
        <vstack
          gap="medium"
          padding="medium"
          height="100%"
          width="100%"
          backgroundColor={backgroundImage ? "rgba(0,0,0,0.3)" : "transparent"}
        >
          <hstack alignment="end top">
            <hstack alignment="center" grow>
              <text
                size="xlarge"
                weight="bold"
                color={foregroundColor}
              >
                {page.title || 'Community Links'}
              </text>
              {/* Edit button in bottom right corner - only for moderators */}

            </hstack>

            {isModerator && (
              <hstack alignment="end bottom" >
                <spacer />
                {renderEditButton()}
              </hstack>
            )}
          </hstack>

          {/* Moderation menu - only show when in edit mode and user is moderator */}
          {isEditMode && isModerator && renderModMenu()}

          {/* Column headers with remove buttons - only in edit mode */}
          {isEditMode && isModerator && columns > 1 && (
            <hstack gap="none" height="12px">
              <vstack width="24px" /> {/* Spacer for row remove buttons */}
              {Array.from({ length: columns }).map((_, colIndex) => (
                <vstack key={`col-header-${colIndex}`}
                  width={`${(isEditMode && isModerator ? 97 : 100) / columns}%`}
                  alignment="bottom center"
                  gap='none'>
                  <button
                    height="12px"
                    appearance="destructive"
                    size="small"
                    width={`${(isEditMode && isModerator ? 97 : 100) / columns}%`}
                    onPress={() => removeColumn(colIndex)}
                  >-</button>
                </vstack>
              ))}
            </hstack>
          )}

          <vstack gap="small" grow>
            {linkGrid.map((row, rowIndex) => (
              <hstack key={`row-${rowIndex}`} gap="small" height={`${100 / rows}%`}>
                {/* Row remove button - only in edit mode */}
                {isEditMode && isModerator && (
                  <vstack width="12px" alignment="middle center">
                    <button
                      appearance="destructive"
                      size="small"
                      onPress={() => removeRow(rowIndex)}
                    >-</button>
                  </vstack>
                )}
                {row.map((link) => (
                  <vstack key={link.id} width={`${(isEditMode && isModerator ? 97 : 100) / columns}%`} height="100%">
                    {renderLink(link, foregroundColor)}
                  </vstack>
                ))}
              </hstack>
            ))}
          </vstack>
        </vstack>
      </zstack>
    );
  }
});

Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;