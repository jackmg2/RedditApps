import { Devvit } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { AppSettings } from '../types/AppSettings.js';
import { CategorizedEvents, getAllEventsSorted, paginateEvents } from '../utils/eventUtils.js';

interface EventDisplayProps {
  context: Devvit.Context;
  categorizedEvents: CategorizedEvents;
  settings: AppSettings;
  dateFormatter: Intl.DateTimeFormat;
  isEditMode: boolean;
  isModerator: boolean;
  currentPage: number;
  onEditEvent: (event: Event) => void;
  onRemoveEvent: (event: Event) => void;
  onPageChange: (page: number) => void;
}

export const EventDisplay = ({
  context,
  categorizedEvents,
  settings,
  dateFormatter,
  isEditMode,
  isModerator,
  currentPage,
  onEditEvent,
  onRemoveEvent,
  onPageChange
}: EventDisplayProps) => {
  const renderEvent = (event: Event, isNowEvent: boolean = false) => (
    <hstack 
      gap="small" 
      padding="small" 
      backgroundColor={`${event.backgroundColor}`} 
      cornerRadius="medium"
      onPress={() => {
        if (!isEditMode && event.link) {
          context.ui.navigateTo(event.link);
        }
      }}
    >
      {event && isEditMode && isModerator && (
        <hstack alignment="middle">
          <button
            icon="edit"
            appearance="primary"
            size="small"
            onPress={() => onEditEvent(event)}
          />
          <spacer />
          <button
            icon="remove"
            appearance="destructive"
            size="small"
            onPress={() => onRemoveEvent(event)}
          />
          <spacer />
        </hstack>
      )}
      
      <vstack>
        <hstack alignment="bottom">
          <text size="large" weight="bold" color={`${event.foregroundColor}`}>
            {event.title}
            {isNowEvent && (
              <text size="small" weight="bold" color="#FF6B6B"> ● LIVE</text>
            )}
          </text>
          <text size="small" weight="regular" color={`${event.foregroundColor}`} alignment="bottom">
            &nbsp;{formatEventDate(event, dateFormatter)}
          </text>
        </hstack>
        <hstack width="100%">
          <text color={`${event.foregroundColor}`} wrap>{event.description}</text>
        </hstack>
      </vstack>
    </hstack>
  );

  const formatEventDate = (event: Event, formatter: Intl.DateTimeFormat): string => {
    const beginDate = new Date(event.dateBegin);
    const endDate = new Date(event.dateEnd);
    
    if (beginDate.getTime() === endDate.getTime()) {
      return `(${formatter.format(beginDate)}${event.hourBegin ? ' ' + event.hourBegin : ''}${event.hourEnd ? ' - ' + event.hourEnd : ''})`;
    } else {
      return `(${formatter.format(beginDate)}${event.hourBegin ? ' ' + event.hourBegin : ''} - ${formatter.format(endDate)}${event.hourEnd ? ' ' + event.hourEnd : ''})`;
    }
  };

  // Get all events sorted chronologically
  const allEventsSorted = getAllEventsSorted(categorizedEvents);
  
  // Get paginated events
  const paginationData = paginateEvents(allEventsSorted, currentPage, 6);
  
  if (allEventsSorted.length === 0) {
    return (
      <vstack alignment="middle center" height="100%">
        <text size="large">No events to display</text>
      </vstack>
    );
  }

  // Separate events by category for this page
  const nowEventsOnPage = paginationData.events.filter(event => 
    categorizedEvents.now.some(nowEvent => nowEvent.id === event.id)
  );
  const upcomingEventsOnPage = paginationData.events.filter(event => 
    !categorizedEvents.now.some(nowEvent => nowEvent.id === event.id)
  );

  return (
    <vstack gap="small" height="100%">
      {/* Pagination Info */}
      {paginationData.totalEvents > 6 && (
        <hstack alignment="center" gap="small">
          <text size="small">
            Page {paginationData.currentPage + 1} of {paginationData.totalPages} 
            ({paginationData.totalEvents} events total)
          </text>
        </hstack>
      )}

      {/* Events Display */}
      <vstack gap="small" grow>
        {/* Now Events Section */}
        {nowEventsOnPage.length > 0 && (
          <vstack gap="small">
            <text size="xlarge" weight="bold">{settings.titleNow}</text>
            {nowEventsOnPage.map(event => (
              <vstack key={event.id}>
                {renderEvent(event, true)}
              </vstack>
            ))}
          </vstack>
        )}

        {/* Upcoming Events Section */}
        {upcomingEventsOnPage.length > 0 && (
          <vstack gap="small">
            <text size="xlarge" weight="bold">{settings.titleUpcoming}</text>
            {upcomingEventsOnPage.map(event => (
              <vstack key={event.id}>
                {renderEvent(event, false)}
              </vstack>
            ))}
          </vstack>
        )}
      </vstack>

      {/* Pagination Controls */}
      {paginationData.totalPages > 1 && (
        <hstack alignment="center" gap="medium" padding="small">
          <button
            icon="left"
            appearance="secondary"
            size="small"
            disabled={!paginationData.hasPrevious}
            onPress={() => onPageChange(currentPage - 1)}
          />
          
          <text size="small">
            {paginationData.currentPage + 1} / {paginationData.totalPages}
          </text>
          
          <button
            icon="right"
            appearance="secondary"
            size="small"
            disabled={!paginationData.hasNext}
            onPress={() => onPageChange(currentPage + 1)}
          />
        </hstack>
      )}
    </vstack>
  );
};