import { Event } from '../types/Event.js';

export interface CategorizedEvents {
  today: Event[];
  thisMonth: Event[];
  future: Event[];
}

export const categorizeEvents = (eventsToCat: { [id: string]: Event }): CategorizedEvents => {
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
    } else if ((beginDate.getTime() <= today.getTime() && endDate.getTime() >= today.getTime()) && 
               endDate > today && beginDate.getTime() !== endDate.getTime()) {
      acc.thisMonth.push(event);
    } else if (beginDate > today) {
      acc.future.push(event);
    }

    return acc;
  }, { today: [], thisMonth: [], future: [] } as CategorizedEvents);
};