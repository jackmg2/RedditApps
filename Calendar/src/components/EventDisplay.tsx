import { Devvit } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { AppSettings } from '../types/AppSettings.js';
import { CategorizedEvents } from '../utils/eventUtils.js';

interface EventDisplayProps {
  categorizedEvents: CategorizedEvents;
  settings: AppSettings;
  dateFormatter: Intl.DateTimeFormat;
  isEditMode: boolean;
  isModerator: boolean;
  onEditEvent: (event: Event) => void;
  onRemoveEvent: (event: Event) => void;
}

export const EventDisplay = ({
  categorizedEvents,
  settings,
  dateFormatter,
  isEditMode,
  isModerator,
  onEditEvent,
  onRemoveEvent
}: EventDisplayProps) => {
  const renderEvent = (event: Event) => (
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

  const renderCategory = (title: string, events: Event[]) => {
    if (events.length === 0) return null;
    
    return (
      <vstack gap="small">
        <text size="xlarge" weight="bold">{title}</text>
        {events
          .sort((a, b) => new Date(a.dateBegin).getTime() - new Date(b.dateBegin).getTime())
          .map(e => renderEvent(e))}
      </vstack>
    );
  };

  return (
    <vstack gap="small">
      {renderCategory(settings.titleRightNow, categorizedEvents.today)}
      {renderCategory(settings.titleThisMonth, categorizedEvents.thisMonth)}
      {renderCategory(settings.titleFuture, categorizedEvents.future)}
    </vstack>
  );
};