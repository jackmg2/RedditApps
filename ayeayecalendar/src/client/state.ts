import type { CalendarEvent, CalendarConfig } from "../shared/api.ts";

export interface AppState {
  postId: string;
  username: string;
  isModerator: boolean;
  events: Record<string, CalendarEvent>;
  config: CalendarConfig;
  editMode: boolean;
  activeModal: "addEvent" | "editEvent" | "settings" | null;
  editingEventId: string | null;
}

export const state: AppState = {
  postId: "",
  username: "",
  isModerator: false,
  events: {},
  config: { calendarTitle: "Community Calendar", titleUpcoming: "Upcoming events", backgroundImageUrl: "" },
  editMode: false,
  activeModal: null,
  editingEventId: null,
};

