import { Devvit, useForm, useState, useAsync, SettingsValues } from '@devvit/public-api';
import { Event } from './types/event.js'
import { isValidDate, isValidDateRange, isValidHexColor, isValidUrl } from './utils.js'

const createPostForm = Devvit.createForm(
  {
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        defaultValue: 'Community Calendar',
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
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading Community Calendar...</text>
        </vstack>
      ),
    });
    context.ui.showToast({ text: 'Created Community Calendar post! Please refresh.' });
  });

Devvit.addSettings([
  {
    name: 'titleRightNow',
    label: 'Events',
    type: 'string',
    helpText: 'Title of events happening just today.',
    defaultValue: 'Today'
  },
  {
    name: 'titleThisMonth',
    label: 'Events',
    type: 'string',
    helpText: 'Title of events happening during the whole month.',
    defaultValue: 'This month'
  },
  {
    name: 'titleFuture',
    label: 'Events',
    type: 'string',
    helpText: 'Title of events happening in the future.',
    defaultValue: 'Coming soon'
  },
]);

// Function to categorize events
const categorizeEvents = (eventsToCat: { [id: string]: Event }) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();

  return Object.values(eventsToCat).reduce((acc, event) => {
    const beginDate = new Date(event.dateBegin);
    const endDate = new Date(event.dateEnd);

    if (beginDate.getTime() === endDate.getTime() &&
      beginDate.getDate() === currentDate &&
      beginDate.getMonth() === currentMonth) {
      acc.today.push(event);
    } else if ((beginDate.getTime() <= today.getTime() && endDate.getTime() >= today.getTime()) && endDate > today && beginDate.getTime() !== endDate.getTime()) {
      acc.thisMonth.push(event);
    } else if (beginDate > today) {
      acc.future.push(event);
    }

    return acc;
  }, { today: [], thisMonth: [], future: [] } as Record<string, Event[]>);
};

// Add a custom post type for the calendar
Devvit.addCustomPostType({
  name: 'Community Calendar',
  height: 'tall',
  render: (context) => {
    const [isModerator, setIsModerator] = useState(false);
    const [settings, setSettings] = useState('{}');
    const [redisId, setRedisId] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const isModeratorAsync = useAsync(async () => {
      const currentUser = (await context.reddit.getCurrentUser());
      const isModerator = (await (await context.reddit.getModerators({ subredditName: context.subredditName as string })).all()).some(m => m.username == currentUser?.username);

      return isModerator;
    });

    const settingsAsync = useAsync(async () => {
      const settings = await context.settings.getAll();
      return JSON.stringify(settings);
    });

    const redisIdAsync = useAsync(async () => {
      let redisId = 'events';
      if (context.postId) {
        const creationDate = (await context.reddit.getPostById(context.postId)).createdAt;
        const updateDate = new Date(2024, 11, 5, 0, 0, 0, 0);

        //if built with old version, we keep the old key
        if (creationDate.getTime() > updateDate.getTime()) {
          redisId += context.postId;
        }
      }
      return redisId;
    });

    const eventsAsync = useAsync(async () => {
      const eventsJson = await context.redis.get(redisId) as string;
      const allEvents: { [id: string]: Event } = JSON.parse(eventsJson || '{}');

      //We clean old events
      const loadedEvents = Object.values(allEvents).filter(e => {
        const currentDate = (new Date()).toISOString().split('T')[0];
        return isValidDateRange(currentDate, e.dateEnd);
      }).reduce((acc, event) => {
        acc[Number(event.id)] = event;
        return acc;
      }, {} as { [id: string]: Event });
      return JSON.stringify(loadedEvents);
    },
      { depends: [redisId, refreshTrigger] });
    
    if (redisIdAsync && redisIdAsync.data) {
      setRedisId(redisIdAsync.data);
    }

    if (settingsAsync && settingsAsync.data) {
      setSettings(settingsAsync.data);
    }

    setIsModerator(isModeratorAsync.data ?? false);

    const updateEvents = async (event: Event) => {
      let eventErrorMessage = event.isValid();
      if (eventErrorMessage != '') {
        context.ui.showToast(eventErrorMessage);
      }
      else {
        //Force Redis download again to avoid context issue
        const eventsJsonFromRedis = await context.redis.get(redisId) as string;
        const eventsObj = JSON.parse(eventsJsonFromRedis || '{}');
        eventsObj[event.id] = event;
        const eventsJsonModified = JSON.stringify(eventsObj);
        await context.redis.set(redisId, eventsJsonModified);
        setRefreshTrigger((prev) => prev + 1);
        context.ui.showToast(`Your event has been updated!`);
      }
    }

    const removeEvent = async (event: Event) => {
      try {
        //Force Redis download again to avoid context issue
        const eventsJsonFromRedis = await context.redis.get(redisId) as string;
        const eventsObj = JSON.parse(eventsJsonFromRedis);
        delete eventsObj[event.id];
        const eventsJsonModified = JSON.stringify(eventsObj);
        await context.redis.set(redisId, eventsJsonModified);
        setRefreshTrigger((prev) => prev + 1);
        context.ui.showToast(`Your event has been removed!`);
      } catch (err) {
        context.ui.showToast(`Error while removing: ${err}`);
      }
    }

    //Render moderation menu
    const renderModMenu = () => (
      <vstack gap="small" padding="small" cornerRadius="medium">
        <button
          icon="add"
          appearance="primary"
          size="small"
          onPress={() => {
            let newEvent = new Event();
            context.ui.showForm(addOrEditEventForm, { e: JSON.stringify(newEvent) });
          }}
        />
      </vstack>
    );

    // Render an event
    const renderEvent = (event: Event, dateFormatter: Intl.DateTimeFormat) => (
      <hstack gap="small" padding="small" backgroundColor={`${event.backgroundColor}`} cornerRadius="medium"
        onPress={() => {
          if (!isModerator && event.link) {
            context.ui.navigateTo(event.link);
          }
        }
        }>
        {event && isModerator && (
          <hstack alignment="middle">
            <button
              icon="edit"
              appearance="primary"
              size="small"
              onPress={(e) => {
                context.ui.showForm(addOrEditEventForm, { e: JSON.stringify(event) });
              }
              }
            />
            <spacer />
            <button
              icon="remove"
              appearance="destructive"
              size="small"
              onPress={async (e) => {
                await removeEvent(event);
              }
              }
            />
            <spacer />
          </hstack>)}
        <vstack>
          <hstack alignment="bottom">
            <text size="large" weight="bold" color={`${event.foregroundColor}`}>{event.title} </text>
            <text size="small" weight="regular" color={`${event.foregroundColor}`} alignment="bottom">&nbsp;{
              new Date(event.dateBegin).getTime() === new Date(event.dateEnd).getTime()
                ? `(${dateFormatter.format(new Date(event.dateBegin))}${event.hourBegin ? ' ' + event.hourBegin : ''}${event.hourEnd ? ' - ' + event.hourEnd : ''})`
                : `(${dateFormatter.format(new Date(event.dateBegin))}${event.hourBegin ? ' ' + event.hourBegin : ''} - ${dateFormatter.format(new Date(event.dateEnd))}${event.hourEnd ? ' ' + event.hourEnd : ''})`
            }</text>
          </hstack>
          <hstack width="100%">
            <text color={`${event.foregroundColor}`} wrap>{event.description}</text>
          </hstack>
        </vstack>
      </hstack>
    );

    const renderCategories = (categorizedEvents: Record<string, Event[]>, settings: SettingsValues, dateFormatter: Intl.DateTimeFormat) => (
      <vstack gap="small">
        {categorizedEvents.today.length > 0 && renderCategory(settings.titleRightNow as string, categorizedEvents.today, isModerator, dateFormatter)}
        {categorizedEvents.thisMonth.length > 0 && renderCategory(settings.titleThisMonth as string, categorizedEvents.thisMonth, isModerator, dateFormatter)}
        {categorizedEvents.future.length > 0 && renderCategory(settings.titleFuture as string, categorizedEvents.future, isModerator, dateFormatter)}
      </vstack>
    );

    // Render a category of events
    const renderCategory = (title: string, events: Event[], isModerator: boolean, dateFormatter: Intl.DateTimeFormat) => (
      <vstack gap="small">
        <text size="xlarge" weight="bold">{title}</text>
        {events.sort((a, b) => new Date(a.dateBegin).getTime() - new Date(b.dateBegin).getTime()).map(e => renderEvent(e, dateFormatter))}
      </vstack>
    );

    const addOrEditEventForm = useForm(
      (dataArgs) => {
        const data = JSON.parse(dataArgs.e) as Event;

        return {
          fields: [
            {
              name: 'id',
              label: `Id*`,
              type: 'string',
              disabled: true,
              defaultValue: `${data.id}`,
              onValidate: (e: any) => {
                if (e.value == '') { return 'Id can\'t be empty.' }
              }
            },
            {
              name: 'title',
              label: `Title*`,
              type: 'string',
              defaultValue: `${(data.title != undefined && data.title != 'undefined') ? data.title : ''}`,
              onValidate: (e: any) => {
                if (e.value == '') { return 'Title can\'t be empty.' }
              }
            },
            {
              name: 'dateBegin',
              label: `Begin Date*`,
              type: 'string',
              defaultValue: `${data.dateBegin}`,
              onValidate: (e: any) => {
                if (!isValidDate(e.value)) { return 'Date Begin must be a valid date in this format: YYYY-mm-dd.' }
              }
            },
            {
              name: 'dateEnd',
              label: `End Date*`,
              type: 'string',
              defaultValue: `${data.dateEnd}`,
              onValidate: (e: any) => {
                if (!isValidDate(e.value)) { return 'Date End must be a valid date in this format: YYYY-mm-dd.' }
              }
            },
            {
              name: 'hourBegin',
              label: `Begin Hour`,
              type: 'string'
            },
            {
              name: 'hourEnd',
              label: `End Hour`,
              type: 'string'
            },
            {
              name: 'description',
              label: `Description`,
              type: 'paragraph',
              defaultValue: `${(data.description != undefined && data.description != 'undefined') ? data.description : ''}`
            },
            {
              name: 'link',
              label: `Link`,
              type: 'string',
              defaultValue: `${(data.link != undefined && data.link != 'undefined') ? data.link : ''}`,
              onValidate: (e: any) => {
                if (!isValidUrl(e.value)) { return 'Link must start with https.' }
              }
            },
            {
              name: 'backgroundColor',
              label: `Background Color`,
              type: 'string',
              defaultValue: `${data.backgroundColor}`,
              onValidate: (e: any) => {
                if (!isValidHexColor(e.value)) { return 'Color must be in a valid hexadecimal format: #FF00FF.' }
              }
            },
            {
              name: 'foregroundColor',
              label: `Foreground Color`,
              type: 'string',
              defaultValue: `${data.foregroundColor}`,
              onValidate: (e: any) => {
                if (!isValidHexColor(e.value)) { return 'Color must be in a valid hexadecimal format: #FF00FF.' }
              }
            }
          ],
          title: 'Event',
          acceptLabel: 'Save Event',
        } as const;
      },
      async (data) => {
        let event = Event.fromData(data);
        await updateEvents(event);
      }
    );

    const dateFormatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    };
    const dateFormatter = new Intl.DateTimeFormat(context.uiEnvironment?.locale, dateFormatOptions);
    return (
      <vstack gap="small" padding="medium">
        {isModerator && renderModMenu()}
        {eventsAsync.loading && <text>Calendar is loading...</text>}
        {eventsAsync.data && renderCategories(categorizeEvents(JSON.parse(eventsAsync.data)), JSON.parse(settings), dateFormatter)}
      </vstack>
    );
  },

});

// Add a menu item to create the calendar post
Devvit.addMenuItem({
  label: 'Create Community Calendar',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    try {
      context.ui.showForm(createPostForm, { _, e: JSON.stringify(context) });
    }
    catch (error) {
      console.log(error);
      context.ui.showToast('Failed to create calendar.');
    }

  },
});

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;