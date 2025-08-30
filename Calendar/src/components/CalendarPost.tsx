import { Devvit, useState, useAsync } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { AppSettings } from '../types/AppSettings.js';
import { EventService } from '../services/eventService.js';
import { RedisService } from '../services/redisService.js';
import { categorizeEvents, CategorizedEvents } from '../utils/eventUtils.js';
import { createEventForm } from '../forms/eventForm.js';
import { createBackgroundImageForm } from '../forms/backgroundImageForm.js';
import { EventDisplay } from './EventDisplay.js';
import { ModeratorControls } from './ModeratorControls.js';

export const CalendarPost = (context: Devvit.Context) => {
  const [isModerator, setIsModerator] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [redisKey, setRedisKey] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check if user is moderator - returns serialized boolean
  const isModeratorAsync = useAsync(async () => {
    const currentUser = await context.reddit.getCurrentUser();
    const mods = await (await context.reddit.getModerators({ 
      subredditName: context.subredditName as string 
    })).all();
    const isMod = mods.some(m => m.username === currentUser?.username);
    return JSON.stringify(isMod);
  });

  // Get settings - returns serialized settings object
  const settingsAsync = useAsync(async () => {
    const settings = await context.settings.getAll() as AppSettings;
    return JSON.stringify(settings);
  });

  // Get Redis key for this post - already returns string
  const redisIdAsync = useAsync(async () => {
    if (!context.postId) return 'events';
    const post = await context.reddit.getPostById(context.postId);
    return RedisService.getRedisKey(context.postId, post.createdAt);
  });

  // Get background image - already returns string
  const backgroundImageAsync = useAsync(async () => {
    if (!redisKey) return '';
    return await RedisService.getBackgroundImage(redisKey, context);
  }, { depends: [redisKey, refreshTrigger] });

  // Get events - returns serialized events object
  const eventsAsync = useAsync(async () => {
    if (!redisKey) return '{}';
    const events = await RedisService.getEvents(redisKey, context);
    return JSON.stringify(events);
  }, { depends: [redisKey, refreshTrigger] });

  // Parse and update state from async results
  if (redisIdAsync?.data) {
    setRedisKey(redisIdAsync.data);
  }
  
  if (backgroundImageAsync?.data !== undefined) {
    setBackgroundImage(backgroundImageAsync.data || '');
  }
  
  if (isModeratorAsync?.data) {
    const moderatorStatus = JSON.parse(isModeratorAsync.data);
    setIsModerator(moderatorStatus);
  }

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  const handleAddEvent = () => {
    const newEvent = new Event();
    context.ui.showForm(createEventForm({
      e: JSON.stringify(newEvent),
      redisKey,
      onSuccess: handleRefresh
    }));
  };

  const handleEditEvent = (event: Event) => {
    context.ui.showForm(createEventForm({
      e: JSON.stringify(event),
      redisKey,
      onSuccess: handleRefresh
    }));
  };

  const handleRemoveEvent = async (event: Event) => {
    try {
      await EventService.removeEvent(event.id, redisKey, context);
      handleRefresh();
      context.ui.showToast(`Your event has been removed!`);
    } catch (err) {
      context.ui.showToast(`Error while removing: ${err}`);
    }
  };

  const handleBackgroundImage = () => {
    context.ui.showForm(createBackgroundImageForm({
      currentImage: backgroundImage,
      redisKey,
      onSuccess: handleRefresh
    }));
  };

  const dateFormatter = new Intl.DateTimeFormat(context.uiEnvironment?.locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  // Parse events and settings from JSON
  let categorizedEvents: CategorizedEvents | null = null;
  let settings: AppSettings | undefined = undefined;

  if (eventsAsync.data && eventsAsync.data !== '{}') {
    const parsedEvents = JSON.parse(eventsAsync.data);
    // Reconstruct Event objects from parsed data
    const eventObjects: { [id: string]: Event } = {};
    for (const [id, eventData] of Object.entries(parsedEvents)) {
      eventObjects[id] = Event.fromData(eventData as any);
    }
    categorizedEvents = categorizeEvents(eventObjects);
  }

  if (settingsAsync.data) {
    settings = JSON.parse(settingsAsync.data) as AppSettings;
  }

  return (
    <zstack height="100%">
      {/* Background Layer */}
      {backgroundImage && (
        <image
          url={backgroundImage}
          height="100%"
          width="100%"
          imageHeight={256}
          imageWidth={256}
          resizeMode="cover"
          description="Calendar background"
        />
      )}

      {/* Content Layer */}
      <vstack
        gap="small"
        padding="medium"
        height="100%"
        width="100%"
        backgroundColor={backgroundImage ? "rgba(0,0,0,0.3)" : "transparent"}
      >
        {/* Moderator controls when in edit mode */}
        {isEditMode && isModerator && (
          <ModeratorControls 
            onAddEvent={handleAddEvent}
            onBackgroundImage={handleBackgroundImage}
          />
        )}

        {/* Calendar content */}
        {eventsAsync.loading && <text>Calendar is loading...</text>}
        
        {(categorizedEvents && settings) ? (
          <EventDisplay
            context={context}
            categorizedEvents={categorizedEvents}
            settings={settings}
            dateFormatter={dateFormatter}
            isEditMode={isEditMode}
            isModerator={isModerator}
            onEditEvent={handleEditEvent}
            onRemoveEvent={handleRemoveEvent}
          />
        ) : null}

        {/* Edit button for moderators */}
        {isModerator && (
          <vstack alignment="end bottom" grow>
            <spacer grow />
            <hstack alignment="end bottom" width="100%">
              <button
                icon={isEditMode ? "checkmark" : "edit"}
                appearance={isEditMode ? "success" : "secondary"}
                size="small"
                onPress={() => setIsEditMode(!isEditMode)}
              />
            </hstack>
          </vstack>
        )}
      </vstack>
    </zstack>
  );
};