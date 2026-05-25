export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  link: string;
  dateBegin: string;
  dateEnd: string;
  hourBegin: string;
  hourEnd: string;
  backgroundColor: string;
  foregroundColor: string;
};

export type CalendarConfig = {
  calendarTitle: string;
  titleUpcoming: string;
  backgroundImageUrl: string;
};

export type InitResponse = {
  type: "init";
  postId: string;
  username: string;
  isModerator: boolean;
  events: Record<string, CalendarEvent>;
  config: CalendarConfig;
};

export type SaveEventRequest = {
  event: CalendarEvent;
};

export type SaveEventResponse = {
  type: "saveEvent";
  success: true;
};

export type DeleteEventRequest = {
  eventId: string;
};

export type DeleteEventResponse = {
  type: "deleteEvent";
  success: true;
};

export type SaveConfigRequest = {
  config: CalendarConfig;
};

export type SaveConfigResponse = {
  type: "saveConfig";
  success: true;
};

export type UploadImageRequest = { dataUrl: string };
export type UploadImageResponse = { mediaUrl: string };

export const ApiEndpoint = {
  Init: "/api/init",
  SaveEvent: "/api/events/save",
  DeleteEvent: "/api/events/delete",
  SaveConfig: "/api/config/save",
  UploadImage: "/api/upload-image",
  OnPostCreate: "/internal/menu/post-create",
  OnFormPostCreate: "/internal/form/post-create",
  OnAppInstall: "/internal/on-app-install",
} as const;

export type ApiEndpoint = (typeof ApiEndpoint)[keyof typeof ApiEndpoint];
