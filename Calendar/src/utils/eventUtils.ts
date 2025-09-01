import { Event } from '../types/Event.js';

export interface CategorizedEvents {
  now: Event[];
  upcoming: Event[];
}

export const categorizeEvents = (eventsToCat: { [id: string]: Event }): CategorizedEvents => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const todayDateString = now.toISOString().split('T')[0];

  return Object.values(eventsToCat).reduce((acc, event) => {
    const beginDateString = event.dateBegin;
    
    // Check if event is today and qualifies for "Now"
    if (beginDateString === todayDateString) {
      // If no begin hour, it goes to "Now"
      if (!event.hourBegin || event.hourBegin.trim() === '') {
        acc.now.push(event);
        return acc;
      }
      
      // If has begin hour, check if it's currently happening
      if (event.hourBegin && event.hourEnd) {
        const beginTime = parseTime(event.hourBegin);
        const endTime = parseTime(event.hourEnd);
        const currentTime = currentHour * 60 + currentMinute;
        
        if (beginTime <= currentTime && endTime > currentTime) {
          acc.now.push(event);
          return acc;
        }
      }
    }
    
    // All other events go to upcoming
    acc.upcoming.push(event);
    return acc;
  }, { now: [], upcoming: [] } as CategorizedEvents);
};

// Helper function to parse time from string and convert to minutes
const parseTime = (timeString: string): number => {
  if (!timeString || timeString.trim() === '') return 0;
  
  const cleanTime = timeString.trim().toLowerCase();
  
  // Handle AM/PM format
  if (cleanTime.includes('pm') || cleanTime.includes('am')) {
    const isPM = cleanTime.includes('pm');
    const timePart = cleanTime.replace(/[ap]m/g, '').trim();
    const [hourStr, minuteStr] = timePart.split(':');
    let hour = parseInt(hourStr) || 0;
    const minute = parseInt(minuteStr) || 0;
    
    if (isPM && hour !== 12) {
      hour += 12;
    } else if (!isPM && hour === 12) {
      hour = 0;
    }
    
    return hour * 60 + minute;
  }
  
  // 24-hour format
  const [hourStr, minuteStr] = cleanTime.split(':');
  const hour = parseInt(hourStr) || 0;
  const minute = parseInt(minuteStr) || 0;
  
  return hour * 60 + minute;
};

export const getAllEventsSorted = (categorizedEvents: CategorizedEvents): Event[] => {
  const allEvents = [...categorizedEvents.now, ...categorizedEvents.upcoming];
  
  // Sort by date, then by begin hour
  return allEvents.sort((a, b) => {
    // First sort by date
    const dateCompare = new Date(a.dateBegin).getTime() - new Date(b.dateBegin).getTime();
    if (dateCompare !== 0) return dateCompare;
    
    // If same date, sort by begin hour
    const aTime = parseTime(a.hourBegin || '00:00');
    const bTime = parseTime(b.hourBegin || '00:00');
    return aTime - bTime;
  });
};

export const paginateEvents = (events: Event[], currentPage: number, itemsPerPage: number = 6) => {
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvents = events.slice(startIndex, endIndex);
  const totalPages = Math.ceil(events.length / itemsPerPage);
  
  return {
    events: paginatedEvents,
    currentPage,
    totalPages,
    hasNext: currentPage < totalPages - 1,
    hasPrevious: currentPage > 0,
    totalEvents: events.length
  };
};