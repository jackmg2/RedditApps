import type { IncomingMessage, ServerResponse } from "node:http";
import { context, media, reddit, redis } from "@devvit/web/server";
import type {
  Form,
  PartialJsonValue,
  TriggerResponse,
  UiResponse,
} from "@devvit/web/shared";
import {
  ApiEndpoint,
  type CalendarEvent,
  type CalendarConfig,
  type InitResponse,
  type SaveEventRequest,
  type SaveEventResponse,
  type DeleteEventRequest,
  type DeleteEventResponse,
  type SaveConfigRequest,
  type SaveConfigResponse,
  type UploadImageRequest,
  type UploadImageResponse,
} from "../shared/api.ts";
import { once } from "node:events";

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`;
    console.error(msg);
    writeJSON<ErrorResponse>(500, { error: msg, status: 500 }, rsp);
  }
}

async function onRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  const url = req.url;

  if (!url || url === "/") {
    writeJSON<ErrorResponse>(404, { error: "not found", status: 404 }, rsp);
    return;
  }

  const endpoint = url as ApiEndpoint;

  let body: ApiResponse | UiResponse | TriggerResponse | ErrorResponse;
  switch (endpoint) {
    case ApiEndpoint.Init:
      body = await onInit();
      break;
    case ApiEndpoint.SaveEvent:
      body = await onSaveEvent(req);
      break;
    case ApiEndpoint.DeleteEvent:
      body = await onDeleteEvent(req);
      break;
    case ApiEndpoint.SaveConfig:
      body = await onSaveConfig(req);
      break;
    case ApiEndpoint.UploadImage:
      body = await onUploadImage(req);
      break;
    case ApiEndpoint.OnPostCreate:
      body = await onMenuNewPost();
      break;
    case ApiEndpoint.OnFormPostCreate:
      body = await onFormPostCreate(req);
      break;
    case ApiEndpoint.OnAppInstall:
      body = await onAppInstall();
      break;
    default:
      endpoint satisfies never;
      body = { error: "not found", status: 404 };
      break;
  }

  writeJSON<PartialJsonValue>(
    "status" in body && typeof body.status === "number" ? body.status : 200,
    body,
    rsp,
  );
}

type ApiResponse =
  | InitResponse
  | SaveEventResponse
  | DeleteEventResponse
  | SaveConfigResponse
  | UploadImageResponse;

type ErrorResponse = {
  error: string;
  status: number;
};

function getPostId(): string {
  if (!context.postId) throw new Error("no post ID");
  return context.postId;
}

function getEventsKey(postId: string): string {
  return `events${postId}`;
}

function getConfigKey(postId: string): string {
  return `config${postId}`;
}

const LEGACY_EVENTS_KEY = "events";

function todayString(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
}

async function getEvents(
  postId: string,
): Promise<Record<string, CalendarEvent>> {
  let raw = await redis.get(getEventsKey(postId));
  if (!raw) {
    raw = await redis.get(LEGACY_EVENTS_KEY);
  }
  if (!raw) return {};

  const parsed = JSON.parse(raw) as Record<string, CalendarEvent>;
  const today = todayString();
  const cleaned: Record<string, CalendarEvent> = {};
  for (const [id, event] of Object.entries(parsed)) {
    if (event.dateEnd >= today) {
      cleaned[id] = event;
    }
  }
  return cleaned;
}

async function getConfig(postId: string): Promise<CalendarConfig> {
  const raw = await redis.get(getConfigKey(postId));
  if (!raw) return { calendarTitle: "Community Calendar", titleUpcoming: "Upcoming events", backgroundImageUrl: "" };
  return JSON.parse(raw) as CalendarConfig;
}

async function checkIsModerator(): Promise<boolean> {
  const username = context.username;
  if (!username) return false;
  try {
    const subreddit = await reddit.getCurrentSubreddit();
    const mods = await reddit.getModerators({ subredditName: subreddit.name }).all();
    return mods.some((m) => m.username === username);
  } catch {
    return false;
  }
}

async function onInit(): Promise<InitResponse> {
  const postId = getPostId();
  const [events, config, isModerator] = await Promise.all([
    getEvents(postId),
    getConfig(postId),
    checkIsModerator(),
  ]);
  return {
    type: "init",
    postId,
    username: context.username ?? "user",
    isModerator,
    events,
    config,
  };
}

async function onSaveEvent(req: IncomingMessage): Promise<SaveEventResponse> {
  const postId = getPostId();
  const { event } = await readJSON<SaveEventRequest>(req);

  if (!event.id?.trim() || !event.title?.trim()) {
    throw new Error("event id and title are required");
  }

  const events = await getEvents(postId);
  events[event.id] = event;
  await redis.set(getEventsKey(postId), JSON.stringify(events));

  return { type: "saveEvent", success: true };
}

async function onDeleteEvent(
  req: IncomingMessage,
): Promise<DeleteEventResponse> {
  const postId = getPostId();
  const { eventId } = await readJSON<DeleteEventRequest>(req);

  const events = await getEvents(postId);
  delete events[eventId];
  await redis.set(getEventsKey(postId), JSON.stringify(events));

  return { type: "deleteEvent", success: true };
}

async function onSaveConfig(req: IncomingMessage): Promise<SaveConfigResponse> {
  const postId = getPostId();
  const { config } = await readJSON<SaveConfigRequest>(req);

  await redis.set(getConfigKey(postId), JSON.stringify(config));

  return { type: "saveConfig", success: true };
}

async function onUploadImage(
  req: IncomingMessage,
): Promise<UploadImageResponse> {
  const isMod = await checkIsModerator();
  if (!isMod) throw new Error("not authorized");
  const { dataUrl } = await readJSON<UploadImageRequest>(req);
  try {
    const { mediaUrl } = await media.upload({ url: dataUrl, type: "image" });
    return { mediaUrl };
  } catch {
    return { mediaUrl: dataUrl };
  }
}

async function onMenuNewPost(): Promise<UiResponse> {
  const form: Form = {
    title: "Create Calendar Post",
    fields: [
      {
        type: "string",
        name: "title",
        label: "Calendar Title",
        defaultValue: "Community Calendar",
        required: true,
      },
    ],
    acceptLabel: "Create",
  };
  return { showForm: { name: "post-create", form } };
}

async function onFormPostCreate(req: IncomingMessage): Promise<UiResponse> {
  const { title } = await readJSON<{ title: string }>(req);
  const postTitle = title?.trim() || "Community Calendar";
  const post = await reddit.submitCustomPost({ title: postTitle });
  const config: CalendarConfig = {
    calendarTitle: postTitle,
    titleUpcoming: "Upcoming events",
    backgroundImageUrl: "",
  };
  await redis.set(getConfigKey(post.id), JSON.stringify(config));
  return {
    showToast: { text: "Calendar post created.", appearance: "success" },
    navigateTo: post.url,
  };
}

async function onAppInstall(): Promise<TriggerResponse> {
  await reddit.submitCustomPost({ title: "Community Calendar" });
  return {};
}

function writeJSON<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json);
  const len = Buffer.byteLength(body);
  rsp.writeHead(status, {
    "Content-Length": len,
    "Content-Type": "application/json",
  });
  rsp.end(body);
}

async function readJSON<T>(req: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  await once(req, "end");
  return JSON.parse(`${Buffer.concat(chunks)}`);
}
