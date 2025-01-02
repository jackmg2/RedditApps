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

Devvit.addCustomPostType({
  name: 'Community Links',
  height: 'tall',
  render: (context) => {
    const [linker, setLinker] = useState(JSON.stringify(new Linker()));
    const [isModerator, setIsModerator] = useState(false);
    const [count, setCount] = useState(1);

    const { data, loading, error } = useAsync(async () => {

      const linkerJson = await context.redis.get(`linker_${context.postId}`) as string;
      const linker: { [id: number]: Linker } = JSON.parse(linkerJson || JSON.stringify(new Linker()));
      return JSON.stringify(linker);
    },
      { depends: [count] });

    const isModeratorAsync = useAsync(async () => {
      const currentUser = (await context.reddit.getCurrentUser());
      const isModerator = (await (await context.reddit.getModerators({ subredditName: context.subredditName as string })).all()).some(m => m.username == currentUser?.username);

      return isModerator;
    },
      { depends: [count] });

    setIsModerator(isModeratorAsync.data ?? false);
    setLinker(data ?? JSON.stringify(new Linker()));

    const updateLink = async (link: Link) => {
      try {
        const updatedLinker = new Linker();
        updatedLinker.pages = [...JSON.parse(linker).pages];

        const linkIndex = updatedLinker.pages[0].links.findIndex(l => l.id === link.id);
        if (linkIndex !== -1) {
          updatedLinker.pages[0].links[linkIndex] = link;
          await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
          setLinker(JSON.stringify(updatedLinker));
          setCount((prev) => prev + 1);
          context.ui.showToast('Link updated successfully');
        }
      } catch (e) {
        context.ui.showToast('Failed to update link');
      }
    };

    const updatePage = async (data: { id: string, title: string }) => {
      try {
        const updatedLinker = new Linker();
        updatedLinker.pages = [...JSON.parse(linker).pages];

        const pageIndex = updatedLinker.pages.findIndex(p => p.id === data.id);
        if (pageIndex !== -1) {
          updatedLinker.pages[pageIndex].title = data.title;
          await context.redis.set(`linker_${context.postId}`, JSON.stringify(updatedLinker));
          setLinker(JSON.stringify(updatedLinker));
          setCount((prev) => prev + 1);
          context.ui.showToast('Board updated successfully');
        }
      } catch (e) {
        context.ui.showToast('Failed to update board');
      }
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
            label: 'Illustration',
            type: 'image',
            defaultValue: tempData.image
          }
        ],
        title: 'Edit Link',
        acceptLabel: 'Save',
      } as const;
    },
      async (tempData) => {
        let link = Link.fromData(tempData);
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
          }
        ],
        title: 'Edit Board',
        acceptLabel: 'Save',
      } as const;
    },
      async (tempData) => {
        await updatePage(tempData);
      });

    const renderHeader = (page: Page) => (
      <hstack gap="small" padding="small" cornerRadius="medium">
        {isModerator && (
          <button
            icon="edit"
            appearance="primary"
            size="small"
            onPress={() => {
              context.ui.showForm(editPageForm, { data, e: JSON.stringify(page) });
            }
            }
          />
        )}
        <vstack alignment="center middle" grow>
          <text alignment="center middle">{page.title}</text>
        </vstack>
      </hstack>
    );

    const renderLink = (link: Link) => {
      const isEmpty = Link.isEmpty(link);

      if (isModerator && isEmpty) {
        return (
          <vstack
            gap="small"
            padding="small"
            cornerRadius="medium"
            border="thin"
            borderColor="red"
            grow
            onPress={() => context.ui.showForm(editLinkForm, { data, e: JSON.stringify(link) })}
          >
            <text alignment="middle center" size="xxlarge">+</text>
          </vstack>
        );
      }

      return (
        <zstack
          gap="small"
          padding="small"
          cornerRadius="medium"
          border={isEmpty ? 'none' : 'thin'}
          borderColor="red"
          grow
          onPress={() => {
            if (isModerator) {
              context.ui.showForm(editLinkForm, { data, e: JSON.stringify(link) });
            } else {
              context.ui.navigateTo(link.uri);
            }
          }}
        >
          {link.image && (
            <image
              url={link.image}
              height="100%"
              width="100%"
              imageWidth={250}
              imageHeight={250}
              resizeMode="fit"
              description={link.title}
            />
          )}
          {link.title && (
            <vstack grow alignment="center bottom" height="100%" width="100%">
              <text alignment="center bottom">{link.title}</text>
            </vstack>
          )}
        </zstack>
      );
    };

    const renderRow = (links: Link[]) => (
      <hstack gap="small" padding="small" cornerRadius="medium" grow>
        {links.map(link => renderLink(link))}
      </hstack>
    );

    const renderLinks = (links: Link[]) => (
      <vstack grow>
        {[0, 4, 8, 12].map(i => renderRow(links.slice(i, i + 4)))}
      </vstack>
    );

    if (loading) return <text>Loading...</text>;
    if (error) return <text color="red" wrap>{error.message}</text>;

    return (
      <vstack gap="small" padding="medium" grow>
        {renderHeader(JSON.parse(linker).pages[0])}
        {renderLinks(JSON.parse(linker).pages[0].links)}
      </vstack>
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