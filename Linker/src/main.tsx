import { Devvit, useForm, useState, useAsync } from '@devvit/public-api';
import { Linker } from './types/linker.js';
import { Link } from './types/link.js';
import { Page } from './types/page.js';

const createPostForm = Devvit.createForm(
  {
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        defaultValue: 'Community Links',
        onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
      }
    ],
    title: 'New Community Links Post',
    acceptLabel: 'Save',
  },
  async (event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.reddit.submitPost({
      title: event.values.title,
      subredditName: subreddit.name,
      preview: <text size="large">Loading Community Links...</text>
    });
    context.ui.showToast('Links board created. Please refresh.');
  });

Devvit.addSettings([
  {
    name: 'backgroundColor',
    label: 'Background Color',
    type: 'string',
    defaultValue: '#FFFFFF',
    helpText: 'Hex color code for the board background (e.g., #FFFFFF for white)',
  }
]);

Devvit.addCustomPostType({
  name: 'Community Links',
  height: 'tall',
  render: (context) => {
    const [linker, setLinker] = useState(JSON.stringify(new Linker()));
    const [isModerator, setIsModerator] = useState(false);
    const [count, setCount] = useState(1);
    const [settings, setSettings] = useState({
      backgroundColor: '#FFFFFF'
    });

    const settingsAsync = useAsync(async () => {
      return JSON.stringify(await context.settings.getAll());
    }, { depends: [count] });

    const { data, loading, error } = useAsync(async () => {
      const linkerJson = await context.redis.get(`linker_${context.postId}`) as string;
      const linker: { [id: number]: Linker } = JSON.parse(linkerJson || JSON.stringify(new Linker()));
      return JSON.stringify(linker);
    }, { depends: [count] });

    const isModeratorAsync = useAsync(async () => {
      const currentUser = (await context.reddit.getCurrentUser());
      const isModerator = (await (await context.reddit.getModerators({ subredditName: context.subredditName as string })).all()).some(m => m.username == currentUser?.username);
      return isModerator;
    }, { depends: [count] });

    if (settingsAsync.data) {
      setSettings(settingsAsync.data as any);
    }

    setIsModerator(isModeratorAsync.data ?? false);
    setLinker(data ?? JSON.stringify(new Linker()));

    const updateLink = async (link: Link) => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      const pageIndex = 0; // Currently only supports the first page
      const linkIndex = updatedLinker.pages[pageIndex].links.findIndex(l => l.id === link.id);

      if (linkIndex !== -1) {
        updatedLinker.pages[pageIndex].links[linkIndex] = link;
        await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
        setLinker(JSON.stringify(updatedLinker));
        setCount((prev) => prev + 1);
        context.ui.showToast('Link updated successfully');
      }
    };

    const updatePage = async (data: { id: string, title: string, backgroundColor?: string, backgroundImage?: string }) => {
      const updatedLinker = new Linker();
      updatedLinker.pages = [...JSON.parse(linker).pages];

      const pageIndex = updatedLinker.pages.findIndex(p => p.id === data.id);
      if (pageIndex !== -1) {
        updatedLinker.pages[pageIndex].title = data.title;
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
            name: 'description',
            label: 'Description',
            type: 'paragraph',
            defaultValue: tempData.description || ''
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
            defaultValue: tempData.backgroundColor || settings.backgroundColor,
            helpText: 'Hex color code (e.g., #FFFFFF for white)'
          },
          {
            name: 'backgroundImage',
            label: 'Background Image',
            type: 'image',
            defaultValue: tempData.backgroundImage || '',
            helpText: 'Upload an image for the board background (optional)'
          }
        ],
        title: 'Edit Board',
        acceptLabel: 'Save',
      } as const;
    },
      async (tempData) => {
        await updatePage(tempData);
      });

    // Render a single link cell
    const renderLink = (link: Link) => {
      const isEmpty = Link.isEmpty(link);

      if (isEmpty && isModerator) {
        return (
          <vstack
            key={link.id}
            gap="small"
            padding="small"
            cornerRadius="medium"
            border="thin"
            borderColor="#CCCCCC"
            height="100%"
            width="100%"
            alignment="middle center"
            onPress={() => context.ui.showForm(editLinkForm, { e: JSON.stringify(link) })}
          >
            <text alignment="middle center" size="xxlarge" color="#AAAAAA">+</text>
          </vstack>
        );
      }

      return (
        <zstack
          key={link.id}
          cornerRadius="medium"
          border={link.image ? "none" : "thin"}
          borderColor="#DDDDDD"
          height="100%"
          width="100%"
          onPress={() => {
            if (isModerator) {
              context.ui.showForm(editLinkForm, { e: JSON.stringify(link) });
            } else if (link.uri) {
              context.ui.navigateTo(link.uri);
            }
          }}
        >
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

          {link.title && (
            <vstack
              height="100%"
              width="100%"
              padding="none"
              alignment="top center"
            >
              <text
                size="medium"
                weight="bold"
                color={link.textColor || "#FFFFFF"}
                wrap
              >
                {link.title}
              </text>
            </vstack>
          )}

          {link.description && (
            <vstack
              height="100%"
              width="100%"
              padding="none"
              alignment="bottom center"
            >
              <text
                size="small"
                color={link.textColor || "#FFFFFF"}
                wrap
              >
                {link.description}
              </text>
            </vstack>
          )}
        </zstack>
      );
    };

    if (loading) return <text>Loading...</text>;
    if (error) return <text color="red" wrap>{error.message}</text>;

    const linkerData = JSON.parse(linker);
    const page = linkerData.pages[0];
    const backgroundColor = page.backgroundColor || settings.backgroundColor || '#FFFFFF';
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
          <hstack alignment="center">
            <text
              size="xlarge"
              weight="bold"
              color={backgroundImage ? "#FFFFFF" : "#000000"}
            >
              {page.title || 'Community Links'}
            </text>
          </hstack>

          {isModerator && (
            <hstack gap="small" alignment="end">
              <button
                icon="edit"
                appearance="primary"
                size="small"
                onPress={() => context.ui.showForm(editPageForm, { e: JSON.stringify(page) })}
              >Edit Board</button>
              <button
                icon="add"
                appearance="primary"
                size="small"
                onPress={addRow}>Add Row</button>
              <button
                icon="add"
                appearance="primary"
                size="small"
                onPress={addColumn}
              >Add Column</button>
            </hstack>
          )}

          <vstack gap="small" grow>
            {linkGrid.map((row, rowIndex) => (
              <hstack key={`row-${rowIndex}`} gap="small" height={`${100 / rows}%`}>
                {row.map((link) => (
                  <vstack key={link.id} width={`${100 / columns}%`} height="100%">
                    {renderLink(link)}
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

Devvit.addMenuItem({
  label: 'Create Links Board',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    try {
      context.ui.showForm(createPostForm, { _, e: JSON.stringify(context) });
    } catch (e) {
      console.error(e);
      context.ui.showToast('Failed to create links board');
    }
  }
});

Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;