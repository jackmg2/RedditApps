import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { context } from "@devvit/web/server";
import type {
  Form,
  OnModActionRequest,
  OnPostCreateRequest,
  OnPostDeleteRequest,
  OnPostFlairUpdateRequest,
  PartialJsonValue,
  TriggerResponse,
  UiResponse,
} from "@devvit/web/shared";
import {
  ApiEndpoint,
  type UserItemsResponse,
} from "../shared/api.ts";
import { once } from "node:events";
import {
  applyTrackingConfig,
  getReviewView,
  getTrackingConfigView,
  getUserItems,
  handleTriggerModAction,
  handleTriggerPostFlairUpdate,
  postHistoryCommentForPost,
  removeCompletionForDeletedPost,
  runBackfillChunk,
  setContributionTitleForPost,
  setRequestedByUsersForPost,
  trackTriggerPostAndComment,
  type BackfillTaskData,
} from "./tracking.ts";
import { parseUsernameList } from "./tracking/text.ts";

const MAX_JSON_BODY_BYTES = 128 * 1024;

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    const requestId = randomUUID();
    console.error(
      `server error ${requestId}; ${err instanceof Error ? err.stack : err}`,
    );
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : "internal server error";
    writeJSON<ErrorResponse>(status, { error: message, status }, rsp);
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

  const parsedUrl = new URL(url, "https://devvit.local");
  const endpoint = parsedUrl.pathname as ApiEndpoint;
  if (endpoint.startsWith("/internal/")) {
    console.log(`Incoming internal request: ${(req.method ?? "GET").toUpperCase()} ${endpoint}`);
  }

  let body: ApiResponse | UiResponse | ErrorResponse;
  switch (endpoint) {
    case ApiEndpoint.UserItems:
      requireMethod(req, "GET");
      body = await onUserItems(parsedUrl);
      break;
    case ApiEndpoint.OnAppInstall:
      requireMethod(req, "POST");
      body = await onAppInstall();
      break;
    case ApiEndpoint.OnTrackedPostCreate:
      requireMethod(req, "POST");
      body = await onTrackedPostCreate(req);
      break;
    case ApiEndpoint.OnTrackedPostFlairUpdate:
      requireMethod(req, "POST");
      body = await onTrackedPostFlairUpdate(req);
      break;
    case ApiEndpoint.OnTrackedPostDelete:
      requireMethod(req, "POST");
      body = await onTrackedPostDelete(req);
      break;
    case ApiEndpoint.OnTrackedModAction:
      requireMethod(req, "POST");
      body = await onTrackedModAction(req);
      break;
    case ApiEndpoint.OnTrackedBackfill:
      requireMethod(req, "POST");
      body = await onTrackedBackfill(req);
      break;
    case ApiEndpoint.OnTrackingConfigOpen:
      requireMethod(req, "POST");
      body = await onOpenTrackingConfig();
      break;
    case ApiEndpoint.OnTrackingConfigSubmit:
      requireMethod(req, "POST");
      body = await onSubmitTrackingConfig(req);
      break;
    case ApiEndpoint.OnPostCommentManual:
      requireMethod(req, "POST");
      body = await onPostCommentManual(req);
      break;
    case ApiEndpoint.OnReviewOpen:
      requireMethod(req, "POST");
      body = await onOpenReview(req);
      break;
    case ApiEndpoint.OnSetTitleSubmit:
      requireMethod(req, "POST");
      body = await onSubmitSetTitle(req);
      break;
    case ApiEndpoint.OnSetUsersSubmit:
      requireMethod(req, "POST");
      body = await onSubmitSetUsers(req);
      break;
    default:
      endpoint satisfies never;
      body = { error: "not found", status: 404 };
      break;
  }

  writeJSON<PartialJsonValue>("status" in body ? body.status : 200, body, rsp);
}

type ApiResponse = UserItemsResponse | TriggerResponse;

type ErrorResponse = {
  error: string;
  status: number;
};

type SchedulerTaskRequest<T> = {
  name: string;
  data: T;
};

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function onUserItems(url: URL): Promise<UserItemsResponse | ErrorResponse> {
  const username = url.searchParams.get("username");
  if (!username) {
    return {
      error: "missing required query parameter: username",
      status: 400,
    };
  }

  if (url.searchParams.has("refresh")) {
    return {
      error: "manual refresh is disabled on the public API",
      status: 403,
    };
  }

  return getUserItems(username, false);
}

async function onAppInstall(): Promise<TriggerResponse> {
  return {};
}

async function onTrackedPostCreate(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  const event = assertPostCreateEvent(await readJSON(req));
  const result = await trackTriggerPostAndComment(
    event.post,
    event.author?.name,
    event.subreddit?.name ?? postSubredditName(event.post),
  );

  console.log(`Tracked post create: ${JSON.stringify(result)}`);
  return {};
}

async function onTrackedPostFlairUpdate(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  console.log("Tracked post flair update trigger received");
  const event = assertPostFlairUpdateEvent(await readJSON(req));
  const result = await handleTriggerPostFlairUpdate(
    event.post,
    event.author?.name,
    event.subreddit?.name ?? postSubredditName(event.post),
  );

  console.log(`Tracked post flair update: ${JSON.stringify(result)}`);
  return {};
}

async function onTrackedPostDelete(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  const event = assertPostDeleteEvent(await readJSON(req));
  const result = await removeCompletionForDeletedPost(
    event.postId,
    event.author?.name,
    event.subreddit?.name,
  );

  console.log(`Tracked post delete: ${JSON.stringify(result)}`);
  return {};
}

async function onTrackedModAction(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  const event = assertModActionEvent(await readJSON(req));
  const result = await handleTriggerModAction(
    event.action,
    event.targetComment?.id,
    event.targetPost?.id,
    event.subreddit?.name,
  );

  console.log(`Tracked mod action: ${JSON.stringify(result)}`);
  return {};
}

async function onTrackedBackfill(req: IncomingMessage): Promise<TriggerResponse> {
  const event = assertBackfillTask(await readJSON(req));
  await runBackfillChunk(event.data);

  return {};
}

async function onOpenTrackingConfig(): Promise<UiResponse> {
  const view = await getTrackingConfigView();

  const flairOptions = view.flairTemplates.map((text) => ({
    label: text,
    value: text,
  }));
  const untrackOptions = view.removableFlairs.map((text) => ({
    label: text,
    value: text,
  }));
  const trackedSummary = view.trackedRules.length
    ? view.trackedRules
        .map(
          (rule) =>
            `${rule.flairText} (${rule.trackContributors ? "usernames" : "sentences"})`,
        )
        .join(", ")
    : "none";

  const form: Form = {
    title: "Configure tracking",
    description:
      `Currently tracked: ${trackedSummary}. ` +
      "Pick flairs and a mode, then submit. Submit again to configure flairs that need a different mode.",
    acceptLabel: "Save",
    fields: [
      {
        type: "select",
        name: "flairs",
        label: "Flairs to track",
        helpText: "Posts with these flairs will be tracked.",
        multiSelect: true,
        options: flairOptions,
      },
      {
        type: "select",
        name: "mode",
        label: "Tracking mode",
        defaultValue: ["sentences"],
        options: [
          { label: "Match sentences in title", value: "sentences" },
          { label: "Track quoted usernames (requested by)", value: "usernames" },
        ],
      },
      {
        type: "paragraph",
        name: "sentences",
        label: "Sentences to match (one per line)",
        helpText:
          "Sentence mode only. Leave empty to track every post with the selected flair(s).",
      },
      ...(untrackOptions.length > 0
        ? [
            {
              type: "select" as const,
              name: "untrack",
              label: "Stop tracking these flairs",
              helpText: "Removes the manual rule for the selected flair(s).",
              multiSelect: true,
              options: untrackOptions,
            },
          ]
        : []),
    ],
  };

  return { showForm: { name: "trackingConfig", form } };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return typeof value === "string" ? [value] : [];
}

async function onSubmitTrackingConfig(
  req: IncomingMessage,
): Promise<UiResponse> {
  const payload = await readJSON(req);
  const root = isRecord(payload) ? payload : {};
  // Devvit form submissions arrive as { values: {...} }; fall back to a flat body.
  const values = isRecord(root.values) ? root.values : root;

  const flairs = toStringArray(values.flairs);
  const mode = toStringArray(values.mode)[0] === "usernames" ? "usernames" : "sentences";
  const sentences = String(values.sentences ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const untrack = toStringArray(values.untrack);

  const result = await applyTrackingConfig(
    { flairs, mode, sentences, untrack },
    context.username,
  );

  return {
    showToast: {
      text: result.reason,
      appearance: result.ok ? "success" : "neutral",
    },
  };
}

async function onPostCommentManual(req: IncomingMessage): Promise<UiResponse> {
  const payload = await readJSON(req);
  // Post menu actions arrive as a MenuItemRequest carrying the target thing id.
  if (!isRecord(payload) || typeof payload.targetId !== "string") {
    throw new HttpError(400, "invalid post menu payload");
  }

  const result = await postHistoryCommentForPost(payload.targetId);

  return {
    showToast: {
      text: result.reason,
      appearance: result.ok ? "success" : "neutral",
    },
  };
}

const REMOVE_TITLE_VALUE = "__none__";

function postIdField(targetId: string): Form["fields"][number] {
  return {
    type: "string",
    name: "postId",
    label: "Post ID (do not edit)",
    disabled: true,
    defaultValue: targetId,
  };
}

/**
 * Mode-aware post menu action. Sentence-mode posts get the title form;
 * username-mode (requested-by) posts get the usernames form.
 */
async function onOpenReview(req: IncomingMessage): Promise<UiResponse> {
  const payload = await readJSON(req);
  if (!isRecord(payload) || typeof payload.targetId !== "string") {
    throw new HttpError(400, "invalid post menu payload");
  }
  const targetId = payload.targetId;
  const view = await getReviewView(targetId);

  if (!view.tracked) {
    return {
      showToast: {
        text: "This post's flair isn't configured for tracking.",
        appearance: "neutral",
      },
    };
  }

  if (view.trackContributors) {
    const form: Form = {
      title: "Set requested-by users",
      description: `Post: ${view.postTitle}`,
      acceptLabel: "Save",
      fields: [
        {
          type: "paragraph",
          name: "usernames",
          label: "Requested-by users",
          helpText: "One or more usernames, comma or space separated (u/ optional).",
          defaultValue: view.currentContributors.map((name) => `u/${name}`).join(", "),
        },
        postIdField(targetId),
      ],
    };
    return { showForm: { name: "setRequestedByUsers", form, data: { postId: targetId } } };
  }

  const titleOptions = [
    ...view.sentences.map((sentence) => ({ label: sentence, value: sentence })),
    { label: "None — remove this contribution", value: REMOVE_TITLE_VALUE },
  ];
  const currentIsSentence =
    view.currentName !== undefined && view.sentences.includes(view.currentName);

  const form: Form = {
    title: "Set contribution title",
    description:
      `Post: ${view.postTitle}` +
      (view.currentName ? ` — currently tracked as "${view.currentName}".` : "."),
    acceptLabel: "Save",
    fields: [
      {
        type: "select",
        name: "title",
        label: "Contribution title",
        helpText:
          "Pick a configured title, or choose None to remove this contribution.",
        ...(currentIsSentence ? { defaultValue: [view.currentName as string] } : {}),
        options: titleOptions,
      },
      {
        type: "string",
        name: "customTitle",
        label: "Custom title (optional)",
        helpText: "If filled, this overrides the dropdown above.",
        ...(currentIsSentence ? {} : view.currentName ? { defaultValue: view.currentName } : {}),
      },
      postIdField(targetId),
    ],
  };

  return { showForm: { name: "setContributionTitle", form, data: { postId: targetId } } };
}

function submissionPostId(values: Record<string, unknown>): string {
  const postId =
    (typeof values.postId === "string" && values.postId) || context.postId;
  if (!postId) {
    throw new HttpError(400, "missing post id for form submission");
  }
  return postId;
}

async function onSubmitSetTitle(req: IncomingMessage): Promise<UiResponse> {
  const payload = await readJSON(req);
  const root = isRecord(payload) ? payload : {};
  const values = isRecord(root.values) ? root.values : root;

  const postId = submissionPostId(values);

  const customTitle = String(values.customTitle ?? "").trim();
  const selected = toStringArray(values.title)[0];

  let title: string | null;
  if (customTitle) {
    title = customTitle;
  } else if (selected === REMOVE_TITLE_VALUE) {
    title = null;
  } else if (selected) {
    title = selected;
  } else {
    return {
      showToast: {
        text: "No title selected; nothing changed.",
        appearance: "neutral",
      },
    };
  }

  const result = await setContributionTitleForPost(postId, title, context.username);

  return {
    showToast: {
      text: result.reason,
      appearance: result.ok ? "success" : "neutral",
    },
  };
}

async function onSubmitSetUsers(req: IncomingMessage): Promise<UiResponse> {
  const payload = await readJSON(req);
  const root = isRecord(payload) ? payload : {};
  const values = isRecord(root.values) ? root.values : root;

  const postId = submissionPostId(values);
  const usernames = parseUsernameList(String(values.usernames ?? ""));

  const result = await setRequestedByUsersForPost(postId, usernames, context.username);

  return {
    showToast: {
      text: result.reason,
      appearance: result.ok ? "success" : "neutral",
    },
  };
}

function requireMethod(req: IncomingMessage, method: string): void {
  if ((req.method ?? "GET").toUpperCase() !== method) {
    throw new HttpError(405, "method not allowed");
  }
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

async function readJSON(req: IncomingMessage): Promise<unknown> {
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "request body too large");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  let tooLarge = false;
  req.on("data", (chunk: Uint8Array) => {
    total += chunk.byteLength;
    if (total > MAX_JSON_BODY_BYTES) {
      tooLarge = true;
      return;
    }
    chunks.push(chunk);
  });
  await once(req, "end");
  if (tooLarge) {
    throw new HttpError(413, "request body too large");
  }
  try {
    return JSON.parse(`${Buffer.concat(chunks)}`);
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Trigger post payloads carry `subredditName` at runtime (see hasPostPayload),
// even though the PostV2 type does not declare it.
function postSubredditName(post: unknown): string | undefined {
  if (isRecord(post) && typeof post.subredditName === "string") {
    return post.subredditName;
  }
  return undefined;
}

function hasName(value: unknown): value is { name: string } {
  return isRecord(value) && typeof value.name === "string";
}

function hasPostPayload(value: unknown): value is {
  id: string;
  title?: string;
  permalink?: string;
  createdAt?: number;
  linkFlair?: { text?: string };
  selftext?: string;
  subredditName?: string;
} {
  return (
    isRecord(value) &&
    typeof value.id === "string"
  );
}

function assertPostCreateEvent(value: unknown): OnPostCreateRequest {
  if (!isRecord(value) || !hasPostPayload(value.post)) {
    throw new HttpError(400, "invalid post create payload");
  }
  return value as OnPostCreateRequest;
}

function assertPostFlairUpdateEvent(value: unknown): OnPostFlairUpdateRequest {
  if (!isRecord(value) || !hasPostPayload(value.post)) {
    throw new HttpError(400, "invalid post flair update payload");
  }
  return value as OnPostFlairUpdateRequest;
}

function assertPostDeleteEvent(value: unknown): OnPostDeleteRequest {
  if (
    !isRecord(value) ||
    typeof value.postId !== "string" ||
    !hasName(value.subreddit)
  ) {
    throw new HttpError(400, "invalid post delete payload");
  }
  return value as OnPostDeleteRequest;
}

function assertModActionEvent(value: unknown): OnModActionRequest {
  if (!isRecord(value) || !hasName(value.subreddit)) {
    throw new HttpError(400, "invalid mod action payload");
  }
  return value as OnModActionRequest;
}

function assertBackfillTask(
  value: unknown,
): SchedulerTaskRequest<BackfillTaskData> {
  if (
    !isRecord(value) ||
    value.name !== "trackingBackfill" ||
    !isRecord(value.data) ||
    typeof value.data.username !== "string" ||
    typeof value.data.subredditName !== "string"
  ) {
    throw new HttpError(400, "invalid backfill payload");
  }
  return value as SchedulerTaskRequest<BackfillTaskData>;
}
