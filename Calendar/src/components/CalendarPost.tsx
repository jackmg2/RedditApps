import { Devvit, useState, useAsync, useForm } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { AppSettings } from '../types/AppSettings.js';
import { EventService } from '../services/eventService.js';
import { RedisService } from '../services/redisService.js';
import { categorizeEvents, CategorizedEvents, getAllEventsSorted, paginateEvents } from '../utils/eventUtils.js';
import { EventDisplay } from './EventDisplay.js';
import { ModeratorControls } from './ModeratorControls.js';
import { isValidDate, isValidHexColor, isValidUrl } from '../utils/validators.js';

export const CalendarPost = (context: Devvit.Context) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Store the event being edited as separate primitive fields with default values
  const [eventId, setEventId] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDateBegin, setEventDateBegin] = useState(new Date().toISOString().split('T')[0]);
  const [eventDateEnd, setEventDateEnd] = useState(new Date().toISOString().split('T')[0]);
  const [eventHourBegin, setEventHourBegin] = useState('');
  const [eventHourEnd, setEventHourEnd] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [eventBackgroundColor, setEventBackgroundColor] = useState('#101720');
  const [eventForegroundColor, setEventForegroundColor] = useState('#F0FFF0');

  // Check if user is moderator
  const isModeratorAsync = useAsync(async () => {
    const currentUser = await context.reddit.getCurrentUser();
    const mods = await (await context.reddit.getModerators({ 
      subredditName: context.subredditName as string 
    })).all();
    const isMod = mods.some(m => m.username === currentUser?.username);
    return JSON.stringify(isMod);
  });

  // Get settings with new structure
  const settingsAsync = useAsync(async () => {
    const settings = await context.settings.getAll() as any;
    // Provide defaults for new structure
    const appSettings: AppSettings = {
      titleNow: settings.titleNow || settings.titleRightNow || 'Now',
      titleUpcoming: settings.titleUpcoming || settings.titleFuture || 'Upcoming events'
    };
    return JSON.stringify(appSettings);
  });

  // Get Redis key for this post
  const redisIdAsync = useAsync(async () => {
    if (!context.postId) return 'events';
    const post = await context.reddit.getPostById(context.postId);
    return RedisService.getRedisKey(context.postId, post.createdAt);
  });

  // Get events and background - properly depend on both redisKey and refreshCounter
  const dataAsync = useAsync(async () => {
    // Wait for redis key to be available
    if (!redisIdAsync.data) return null;
    
    const redisKey = redisIdAsync.data;
    
    // Fetch both events and background image
    const [events, backgroundImage] = await Promise.all([
      RedisService.getEvents(redisKey, context),
      RedisService.getBackgroundImage(redisKey, context)
    ]);
    
    return {
      events: JSON.stringify(events),
      backgroundImage,
      refreshTrigger: refreshCounter // Include refresh counter to force re-execution
    };
  }, {
    depends: [redisIdAsync.data, refreshCounter] // Properly depend on both values
  });

  const currentRedisKey = redisIdAsync?.data || 'events';
  const currentBackgroundImage = dataAsync?.data?.backgroundImage || '';
  const currentIsModerator = isModeratorAsync?.data ? JSON.parse(isModeratorAsync.data) : false;
  const eventsData = dataAsync?.data?.events;

  // Event Form using useForm
  const eventForm = useForm(
    {
      fields: [
        {
          name: 'id',
          label: `Id*`,
          type: 'string',
          disabled: true,
          defaultValue: eventId || Math.floor(Math.random() * Date.now()).toString(),
          onValidate: (e: any) => {
            if (e.value === '') { return 'Id can\'t be empty.' }
          }
        },
        {
          name: 'title',
          label: `Title*`,
          type: 'string',
          defaultValue: eventTitle || '',
          onValidate: (e: any) => {
            if (e.value === '') { return 'Title can\'t be empty.' }
          }
        },
        {
          name: 'dateBegin',
          label: `Begin Date*`,
          type: 'string',
          defaultValue: eventDateBegin || new Date().toISOString().split('T')[0],
          onValidate: (e: any) => {
            if (!isValidDate(e.value)) { return 'Date Begin must be a valid date in this format: YYYY-mm-dd.' }
          }
        },
        {
          name: 'dateEnd',
          label: `End Date*`,
          type: 'string',
          defaultValue: eventDateEnd || new Date().toISOString().split('T')[0],
          onValidate: (e: any) => {
            if (!isValidDate(e.value)) { return 'Date End must be a valid date in this format: YYYY-mm-dd.' }
          }
        },
        {
          name: 'hourBegin',
          label: `Begin Hour`,
          type: 'string',
          defaultValue: eventHourBegin || ''
        },
        {
          name: 'hourEnd',
          label: `End Hour`,
          type: 'string',
          defaultValue: eventHourEnd || ''
        },
        {
          name: 'description',
          label: `Description`,
          type: 'paragraph',
          defaultValue: eventDescription || ''
        },
        {
          name: 'link',
          label: `Link`,
          type: 'string',
          defaultValue: eventLink || '',
          onValidate: (e: any) => {
            if (!isValidUrl(e.value)) { return 'Link must start with https.' }
          }
        },
        {
          name: 'backgroundColor',
          label: `Background Color`,
          type: 'string',
          defaultValue: eventBackgroundColor || '#101720',
          onValidate: (e: any) => {
            if (!isValidHexColor(e.value)) { return 'Color must be in a valid hexadecimal format: #FF00FF.' }
          }
        },
        {
          name: 'foregroundColor',
          label: `Foreground Color`,
          type: 'string',
          defaultValue: eventForegroundColor || '#F0FFF0',
          onValidate: (e: any) => {
            if (!isValidHexColor(e.value)) { return 'Color must be in a valid hexadecimal format: #FF00FF.' }
          }
        }
      ],
      title: 'Event',
      acceptLabel: 'Save Event',
    },
    async (formData) => {
      try {
        
        // Create event from form data with safe defaults
        const eventData = {
          id: formData.id as string || Math.floor(Math.random() * Date.now()).toString(),
          title: formData.title as string || '',
          dateBegin: formData.dateBegin as string || new Date().toISOString().split('T')[0],
          dateEnd: formData.dateEnd as string || new Date().toISOString().split('T')[0],
          hourBegin: formData.hourBegin as string || '',
          hourEnd: formData.hourEnd as string || '',
          description: formData.description as string || '',
          link: formData.link as string || '',
          backgroundColor: formData.backgroundColor as string || '#101720',
          foregroundColor: formData.foregroundColor as string || '#F0FFF0'
        };

        const event = Event.fromData(eventData);
        
        await EventService.addOrUpdateEvent(event, currentRedisKey, context);
        setRefreshCounter(prev => prev + 1);
        // Reset to first page when adding new event
        setCurrentPage(0);
        context.ui.showToast(`Your event has been updated!`);
        // Clear form fields
        clearEventFields();
      } catch (error) {
        console.log('Error saving event:', error);
        context.ui.showToast(error instanceof Error ? error.message : 'Failed to save event');
      }
    }
  );

  // Background Image Form using useForm
  const backgroundImageForm = useForm(
    {
      fields: [
        {
          name: 'backgroundImage',
          label: 'Background Image',
          type: 'image',
          defaultValue: currentBackgroundImage,
          helpText: 'Upload an image for the calendar background (leave empty to remove)'
        }
      ],
      title: 'Change Background Image',
      acceptLabel: 'Save',
    },
    async (formData) => {
      try {
        const imageUrl = formData.backgroundImage as string || '';
        await EventService.updateBackgroundImage(imageUrl, currentRedisKey, context);
        setRefreshCounter(prev => prev + 1);
        context.ui.showToast('Background image updated successfully');
      } catch (error) {
        console.log('Error updating background:', error);
        context.ui.showToast(`Error while updating background: ${error}`);
      }
    }
  );

  const clearEventFields = () => {
    const todayDate = new Date().toISOString().split('T')[0];
    setEventId('');
    setEventTitle('');
    setEventDateBegin(todayDate);
    setEventDateEnd(todayDate);
    setEventHourBegin('');
    setEventHourEnd('');
    setEventDescription('');
    setEventLink('');
    setEventBackgroundColor('#101720');
    setEventForegroundColor('#F0FFF0');
  };

  const setEventFields = (event: Event | null) => {
    if (!event) {
      // If no event, create new defaults
      const newId = Math.floor(Math.random() * Date.now()).toString();
      const todayDate = new Date().toISOString().split('T')[0];
      setEventId(newId);
      setEventTitle('');
      setEventDateBegin(todayDate);
      setEventDateEnd(todayDate);
      setEventHourBegin('');
      setEventHourEnd('');
      setEventDescription('');
      setEventLink('');
      setEventBackgroundColor('#101720');
      setEventForegroundColor('#F0FFF0');
    } else {
      // Set from existing event with safe access
      setEventId(event.id || Math.floor(Math.random() * Date.now()).toString());
      setEventTitle(event.title || '');
      setEventDateBegin(event.dateBegin || new Date().toISOString().split('T')[0]);
      setEventDateEnd(event.dateEnd || new Date().toISOString().split('T')[0]);
      setEventHourBegin(event.hourBegin || '');
      setEventHourEnd(event.hourEnd || '');
      setEventDescription(event.description || '');
      setEventLink(event.link || '');
      setEventBackgroundColor(event.backgroundColor || '#101720');
      setEventForegroundColor(event.foregroundColor || '#F0FFF0');
    }
    // Force form recreation
    setFormKey(prev => prev + 1);
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  const handleAddEvent = () => {
    // Don't create Event object, just set defaults directly
    setEventFields(null);
    context.ui.showForm(eventForm);
  };

  const handleEditEvent = (event: Event) => {
    setEventFields(event);
    context.ui.showForm(eventForm);
  };

  const handleRemoveEvent = async (event: Event) => {
    try {
      await EventService.removeEvent(event.id, currentRedisKey, context);
      setRefreshCounter(prev => prev + 1);
      // Reset to first page if current page becomes empty
      setCurrentPage(0);
      context.ui.showToast(`Your event has been removed!`);
    } catch (err) {
      console.log('Error removing event:', err);
      context.ui.showToast(`Error while removing: ${err}`);
    }
  };

  const handleBackgroundImage = () => {
    context.ui.showForm(backgroundImageForm);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const dateFormatter = new Intl.DateTimeFormat(context.uiEnvironment?.locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  // Parse events and settings from JSON
  let categorizedEvents: CategorizedEvents | null = null;
  let settings: AppSettings | undefined = undefined;

  if (eventsData && eventsData !== '{}') {
    try {
      const parsedEvents = JSON.parse(eventsData);
      const eventObjects: { [id: string]: Event } = {};
      for (const [id, eventData] of Object.entries(parsedEvents)) {
        eventObjects[id] = Event.fromData(eventData as any);
      }
      categorizedEvents = categorizeEvents(eventObjects);
    } catch (error) {
      console.error('Error parsing events:', error);
    }
  }

  if (settingsAsync.data) {
    try {
      settings = JSON.parse(settingsAsync.data) as AppSettings;
    } catch (error) {
      console.error('Error parsing settings:', error);
    }
  }

  // Show loading if still fetching data
  if (dataAsync.loading || !redisIdAsync.data) {
    return (
      <vstack height="100%" width="100%" alignment="middle center">
        <text size="large">Loading Community Calendar...</text>
      </vstack>
    );
  }

  // Get pagination data for bottom controls
  const allEventsSorted = categorizedEvents ? getAllEventsSorted(categorizedEvents) : [];
  const paginationData = paginateEvents(allEventsSorted, currentPage, 6);

  return (
    <zstack height="100%" key={`calendar-${formKey}-${refreshCounter}`}>
      {/* Background Layer */}
      {currentBackgroundImage && (
        <image
          url={currentBackgroundImage}
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
        gap="none"
        height="100%"
        width="100%"
        backgroundColor={currentBackgroundImage ? "rgba(0,0,0,0.3)" : "transparent"}
      >
        {/* Top controls */}
        <vstack padding="small" gap="none">
          <ModeratorControls 
            isEditMode={isEditMode}
            isModerator={currentIsModerator}
            onToggleEditMode={handleToggleEditMode}
            onAddEvent={handleAddEvent}
            onBackgroundImage={handleBackgroundImage}
          />
        </vstack>

        {/* Main content area - grows to fill available space */}
        <vstack grow padding="small">
          {(categorizedEvents && settings) ? (
            <EventDisplay
              context={context}
              categorizedEvents={categorizedEvents}
              settings={settings}
              dateFormatter={dateFormatter}
              isEditMode={isEditMode}
              isModerator={currentIsModerator}
              currentPage={currentPage}
              onEditEvent={handleEditEvent}
              onRemoveEvent={handleRemoveEvent}
            />
          ) : (
            <vstack alignment="middle center" grow>
              <text>No events to display</text>
            </vstack>
          )}
        </vstack>

        {/* Bottom pagination - always visible when needed */}
        {paginationData.totalPages > 1 && (
          <hstack 
            alignment="center" 
            gap="medium" 
            padding="medium"
          >
            <button
              icon="left"
              appearance="secondary"
              size="small"
              disabled={!paginationData.hasPrevious}
              onPress={() => handlePageChange(currentPage - 1)}
            />
            
            <vstack gap='none' padding='none' alignment='center middle'>
            <text size="small" color="white" alignment='center bottom'>
              {paginationData.currentPage + 1} / {paginationData.totalPages}
            </text>
            </vstack>

            <button
              icon="right"
              appearance="secondary"
              size="small"
              disabled={!paginationData.hasNext}
              onPress={() => handlePageChange(currentPage + 1)}
            />
          </hstack>
        )}
      </vstack>
    </zstack>
  );
};