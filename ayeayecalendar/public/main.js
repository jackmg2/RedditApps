// src/shared/api.ts
var ApiEndpoint = {
  Init: "/api/init",
  SaveEvent: "/api/events/save",
  DeleteEvent: "/api/events/delete",
  SaveConfig: "/api/config/save",
  UploadImage: "/api/upload-image",
  OnPostCreate: "/internal/menu/post-create",
  OnFormPostCreate: "/internal/form/post-create",
  OnModAction: "/internal/triggers/on-mod-action",
  OnAppUpgrade: "/internal/triggers/on-app-upgrade"
};

// src/client/state.ts
var state = {
  postId: "",
  username: "",
  isModerator: false,
  events: {},
  config: { calendarTitle: "Community Calendar", titleUpcoming: "Upcoming events", backgroundImageUrl: "" },
  editMode: false,
  activeModal: null,
  editingEventId: null
};

// src/client/dom.ts
var calTitleEl = document.querySelector(".cal-title");
var calHeader = document.querySelector(".cal-header");
var bgOverlay = document.getElementById("bg-overlay");
var modControls = document.getElementById("mod-controls");
var editToggleBtn = document.getElementById("edit-toggle-btn");
var modToolbar = document.getElementById("mod-toolbar");
var addEventBtn = document.getElementById("add-event-btn");
var setBgBtn = document.getElementById("set-bg-btn");
var loadingEl = document.getElementById("loading");
var emptyStateEl = document.getElementById("empty-state");
var emptyAddHint = document.getElementById("empty-add-hint");
var eventsContainer = document.getElementById("events-container");
var toastEl = document.getElementById("toast");
var modalOverlay = document.getElementById("modal-overlay");
var modalTitle = document.getElementById("modal-title");
var modalBody = document.getElementById("modal-body");
var modalCloseBtn = document.getElementById("modal-close-btn");

// node_modules/@devvit/protos/json/devvit/ui/effects/v1alpha/effect.js
var EffectType;
(function(EffectType2) {
  EffectType2[EffectType2["EFFECT_REALTIME_SUB"] = 0] = "EFFECT_REALTIME_SUB";
  EffectType2[EffectType2["EFFECT_RERENDER_UI"] = 1] = "EFFECT_RERENDER_UI";
  EffectType2[EffectType2["EFFECT_RELOAD_PART"] = 2] = "EFFECT_RELOAD_PART";
  EffectType2[EffectType2["EFFECT_SHOW_FORM"] = 3] = "EFFECT_SHOW_FORM";
  EffectType2[EffectType2["EFFECT_SHOW_TOAST"] = 4] = "EFFECT_SHOW_TOAST";
  EffectType2[EffectType2["EFFECT_NAVIGATE_TO_URL"] = 5] = "EFFECT_NAVIGATE_TO_URL";
  EffectType2[EffectType2["EFFECT_SET_INTERVALS"] = 7] = "EFFECT_SET_INTERVALS";
  EffectType2[EffectType2["EFFECT_CREATE_ORDER"] = 8] = "EFFECT_CREATE_ORDER";
  EffectType2[EffectType2["EFFECT_WEB_VIEW"] = 9] = "EFFECT_WEB_VIEW";
  EffectType2[EffectType2["EFFECT_CAN_RUN_AS_USER"] = 11] = "EFFECT_CAN_RUN_AS_USER";
  EffectType2[EffectType2["EFFECT_TELEMETRY"] = 12] = "EFFECT_TELEMETRY";
  EffectType2[EffectType2["EFFECT_UPDATE_REQUEST_CONTEXT"] = 13] = "EFFECT_UPDATE_REQUEST_CONTEXT";
  EffectType2[EffectType2["EFFECT_SCREENSHOT_RESPONSE"] = 14] = "EFFECT_SCREENSHOT_RESPONSE";
  EffectType2[EffectType2["EFFECT_LOGIN_PROMPT"] = 15] = "EFFECT_LOGIN_PROMPT";
  EffectType2[EffectType2["EFFECT_PROMOTED_TELEMETRY"] = 16] = "EFFECT_PROMOTED_TELEMETRY";
  EffectType2[EffectType2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(EffectType || (EffectType = {}));

// node_modules/@devvit/protos/json/devvit/ui/effects/web_view/v1alpha/immersive_mode.js
var WebViewImmersiveMode;
(function(WebViewImmersiveMode2) {
  WebViewImmersiveMode2[WebViewImmersiveMode2["UNSPECIFIED"] = 0] = "UNSPECIFIED";
  WebViewImmersiveMode2[WebViewImmersiveMode2["INLINE_MODE"] = 1] = "INLINE_MODE";
  WebViewImmersiveMode2[WebViewImmersiveMode2["IMMERSIVE_MODE"] = 2] = "IMMERSIVE_MODE";
  WebViewImmersiveMode2[WebViewImmersiveMode2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(WebViewImmersiveMode || (WebViewImmersiveMode = {}));

// node_modules/@devvit/protos/json/devvit/ui/effects/web_view/v1alpha/post_message.js
var WebViewInternalMessageScope;
(function(WebViewInternalMessageScope2) {
  WebViewInternalMessageScope2[WebViewInternalMessageScope2["CLIENT"] = 0] = "CLIENT";
  WebViewInternalMessageScope2[WebViewInternalMessageScope2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(WebViewInternalMessageScope || (WebViewInternalMessageScope = {}));

// node_modules/@devvit/shared-types/client/emit-effect.js
var webViewInternalMessageType = "devvit-internal";
var emitEffect = (effect, requestId) => {
  const message = {
    ...effect,
    realtimeEffect: effect.realtime,
    // to-do: remove deprecated field.
    id: requestId,
    scope: WebViewInternalMessageScope.CLIENT,
    type: webViewInternalMessageType
  };
  if (effect.showToast || effect.navigateToUrl) {
    message.effect = effect;
  }
  parent.postMessage(message, "*");
};

// node_modules/@devvit/client/effects/web-view-mode.js
var modeListeners = /* @__PURE__ */ new Set();
function getWebViewMode() {
  return webViewMode(devvit.webViewMode);
}
function initWebViewMode() {
  addEventListener("message", onWebViewMessage);
}
function onWebViewMessage(ev) {
  if (ev.data?.type !== "devvit-message")
    return;
  if (!ev.data?.data?.immersiveModeEvent)
    return;
  const mode = getWebViewMode();
  for (const listener of modeListeners)
    listener(mode);
}
function webViewMode(mode) {
  switch (mode) {
    case WebViewImmersiveMode.IMMERSIVE_MODE:
      return "expanded";
    case WebViewImmersiveMode.INLINE_MODE:
    case WebViewImmersiveMode.UNRECOGNIZED:
    case WebViewImmersiveMode.UNSPECIFIED:
    case void 0:
      return "inline";
    default:
      mode;
      throw Error(`${mode} not a WebViewImmersiveMode`);
  }
}

// node_modules/@devvit/client/clientContext.js
var context = globalThis.devvit?.context;

// node_modules/@devvit/shared-types/thing-navigation.js
function resolveNavigationInput(thingOrUrl) {
  if (typeof thingOrUrl === "string") {
    return thingOrUrl;
  }
  const { url, permalink } = thingOrUrl;
  if (permalink === void 0) {
    return url;
  }
  try {
    if (new URL(url).pathname !== permalink) {
      return new URL(permalink, "https://www.reddit.com").toString();
    }
  } catch {
    return new URL(permalink, "https://www.reddit.com").toString();
  }
  return url;
}

// node_modules/@devvit/client/effects/navigate-to.js
function navigateTo(url) {
  const inputUrl = resolveNavigationInput(url);
  let normalizedUrl;
  try {
    normalizedUrl = new URL(inputUrl).toString();
  } catch {
    throw new TypeError(`Invalid URL: ${inputUrl}`);
  }
  void emitEffect({
    navigateToUrl: {
      url: normalizedUrl
    },
    type: 5
  });
}

// node_modules/@devvit/protos/json/reddit/devvit/app_permission/v1/app_permission.js
var ConsentStatus;
(function(ConsentStatus2) {
  ConsentStatus2[ConsentStatus2["CONSENT_STATUS_UNKNOWN"] = 0] = "CONSENT_STATUS_UNKNOWN";
  ConsentStatus2[ConsentStatus2["REVOKED"] = 1] = "REVOKED";
  ConsentStatus2[ConsentStatus2["GRANTED"] = 2] = "GRANTED";
  ConsentStatus2[ConsentStatus2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(ConsentStatus || (ConsentStatus = {}));
var Scope;
(function(Scope2) {
  Scope2[Scope2["SCOPE_UNKNOWN"] = 0] = "SCOPE_UNKNOWN";
  Scope2[Scope2["SUBMIT_POST"] = 1] = "SUBMIT_POST";
  Scope2[Scope2["SUBMIT_COMMENT"] = 2] = "SUBMIT_COMMENT";
  Scope2[Scope2["SUBSCRIBE_TO_SUBREDDIT"] = 3] = "SUBSCRIBE_TO_SUBREDDIT";
  Scope2[Scope2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(Scope || (Scope = {}));

// node_modules/@devvit/protos/json/devvit/ui/effects/web_view/v1alpha/context.js
var Client;
(function(Client2) {
  Client2[Client2["CLIENT_UNSPECIFIED"] = 0] = "CLIENT_UNSPECIFIED";
  Client2[Client2["ANDROID"] = 1] = "ANDROID";
  Client2[Client2["IOS"] = 2] = "IOS";
  Client2[Client2["SHREDDIT"] = 3] = "SHREDDIT";
  Client2[Client2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(Client || (Client = {}));
var Height;
(function(Height2) {
  Height2[Height2["HEIGHT_UNSPECIFIED"] = 0] = "HEIGHT_UNSPECIFIED";
  Height2[Height2["REGULAR"] = 1] = "REGULAR";
  Height2[Height2["TALL"] = 2] = "TALL";
  Height2[Height2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(Height || (Height = {}));

// node_modules/@devvit/shared-types/tid.js
var T_PREFIX;
(function(T_PREFIX2) {
  T_PREFIX2["COMMENT"] = "t1_";
  T_PREFIX2["ACCOUNT"] = "t2_";
  T_PREFIX2["LINK"] = "t3_";
  T_PREFIX2["MESSAGE"] = "t4_";
  T_PREFIX2["SUBREDDIT"] = "t5_";
  T_PREFIX2["AWARD"] = "t6_";
})(T_PREFIX || (T_PREFIX = {}));

// node_modules/@devvit/shared-types/web-view-scripts-constants.js
var devvitScriptFileName = "devvit.v1.min.js";
var devvitScriptUrl = `https://webview.devvit.net/scripts/${devvitScriptFileName}`;

// node_modules/jwt-decode/build/esm/index.js
var InvalidTokenError = class extends Error {
};
InvalidTokenError.prototype.name = "InvalidTokenError";

// node_modules/@devvit/protos/json/devvit/ui/form_builder/v1alpha/type.js
var FormFieldType;
(function(FormFieldType2) {
  FormFieldType2[FormFieldType2["STRING"] = 0] = "STRING";
  FormFieldType2[FormFieldType2["PARAGRAPH"] = 1] = "PARAGRAPH";
  FormFieldType2[FormFieldType2["NUMBER"] = 2] = "NUMBER";
  FormFieldType2[FormFieldType2["BOOLEAN"] = 3] = "BOOLEAN";
  FormFieldType2[FormFieldType2["LIST"] = 4] = "LIST";
  FormFieldType2[FormFieldType2["SELECTION"] = 5] = "SELECTION";
  FormFieldType2[FormFieldType2["GROUP"] = 6] = "GROUP";
  FormFieldType2[FormFieldType2["IMAGE"] = 7] = "IMAGE";
  FormFieldType2[FormFieldType2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(FormFieldType || (FormFieldType = {}));

// node_modules/@devvit/protos/json/devvit/events/v1alpha/events.js
var EventSource;
(function(EventSource2) {
  EventSource2[EventSource2["UNKNOWN_EVENT_SOURCE"] = 0] = "UNKNOWN_EVENT_SOURCE";
  EventSource2[EventSource2["USER"] = 1] = "USER";
  EventSource2[EventSource2["ADMIN"] = 2] = "ADMIN";
  EventSource2[EventSource2["MODERATOR"] = 3] = "MODERATOR";
  EventSource2[EventSource2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(EventSource || (EventSource = {}));
var DeletionReason;
(function(DeletionReason2) {
  DeletionReason2[DeletionReason2["UNSPECIFIED_DELETION_REASON"] = 0] = "UNSPECIFIED_DELETION_REASON";
  DeletionReason2[DeletionReason2["SPAM"] = 1] = "SPAM";
  DeletionReason2[DeletionReason2["LEGAL"] = 2] = "LEGAL";
  DeletionReason2[DeletionReason2["OTHER"] = 3] = "OTHER";
  DeletionReason2[DeletionReason2["UNKNOWN"] = 4] = "UNKNOWN";
  DeletionReason2[DeletionReason2["EXPLICIT_CONTENT"] = 5] = "EXPLICIT_CONTENT";
  DeletionReason2[DeletionReason2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(DeletionReason || (DeletionReason = {}));

// node_modules/@devvit/protos/json/devvit/reddit/v2alpha/postv2.js
var CrowdControlLevel;
(function(CrowdControlLevel2) {
  CrowdControlLevel2[CrowdControlLevel2["OFF"] = 0] = "OFF";
  CrowdControlLevel2[CrowdControlLevel2["LENIENT"] = 1] = "LENIENT";
  CrowdControlLevel2[CrowdControlLevel2["MEDIUM"] = 2] = "MEDIUM";
  CrowdControlLevel2[CrowdControlLevel2["STRICT"] = 3] = "STRICT";
  CrowdControlLevel2[CrowdControlLevel2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(CrowdControlLevel || (CrowdControlLevel = {}));
var DistinguishType;
(function(DistinguishType2) {
  DistinguishType2[DistinguishType2["NULL_VALUE"] = 0] = "NULL_VALUE";
  DistinguishType2[DistinguishType2["ADMIN"] = 1] = "ADMIN";
  DistinguishType2[DistinguishType2["GOLD"] = 2] = "GOLD";
  DistinguishType2[DistinguishType2["GOLD_AUTO"] = 3] = "GOLD_AUTO";
  DistinguishType2[DistinguishType2["YES"] = 4] = "YES";
  DistinguishType2[DistinguishType2["SPECIAL"] = 5] = "SPECIAL";
  DistinguishType2[DistinguishType2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(DistinguishType || (DistinguishType = {}));

// node_modules/@devvit/protos/json/devvit/reddit/v2alpha/subredditv2.js
var SubredditType;
(function(SubredditType2) {
  SubredditType2[SubredditType2["ARCHIVED"] = 0] = "ARCHIVED";
  SubredditType2[SubredditType2["EMPLOYEES_ONLY"] = 1] = "EMPLOYEES_ONLY";
  SubredditType2[SubredditType2["GOLD_ONLY"] = 2] = "GOLD_ONLY";
  SubredditType2[SubredditType2["GOLD_RESTRICTED"] = 3] = "GOLD_RESTRICTED";
  SubredditType2[SubredditType2["PRIVATE"] = 4] = "PRIVATE";
  SubredditType2[SubredditType2["PUBLIC"] = 5] = "PUBLIC";
  SubredditType2[SubredditType2["RESTRICTED"] = 6] = "RESTRICTED";
  SubredditType2[SubredditType2["USER"] = 7] = "USER";
  SubredditType2[SubredditType2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(SubredditType || (SubredditType = {}));
var SubredditRating;
(function(SubredditRating2) {
  SubredditRating2[SubredditRating2["UNKNOWN_SUBREDDIT_RATING"] = 0] = "UNKNOWN_SUBREDDIT_RATING";
  SubredditRating2[SubredditRating2["E"] = 1] = "E";
  SubredditRating2[SubredditRating2["M1"] = 2] = "M1";
  SubredditRating2[SubredditRating2["M2"] = 3] = "M2";
  SubredditRating2[SubredditRating2["D"] = 4] = "D";
  SubredditRating2[SubredditRating2["V"] = 5] = "V";
  SubredditRating2[SubredditRating2["X"] = 6] = "X";
  SubredditRating2[SubredditRating2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(SubredditRating || (SubredditRating = {}));
var SubredditTypeV2;
(function(SubredditTypeV22) {
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_UNSPECIFIED"] = 0] = "SUBREDDIT_TYPE_UNSPECIFIED";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_UNKNOWN"] = 1] = "SUBREDDIT_TYPE_UNKNOWN";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_ARCHIVED"] = 2] = "SUBREDDIT_TYPE_ARCHIVED";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_EMPLOYEES_ONLY"] = 3] = "SUBREDDIT_TYPE_EMPLOYEES_ONLY";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_GOLD_ONLY"] = 4] = "SUBREDDIT_TYPE_GOLD_ONLY";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_GOLD_RESTRICTED"] = 5] = "SUBREDDIT_TYPE_GOLD_RESTRICTED";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_PRIVATE"] = 6] = "SUBREDDIT_TYPE_PRIVATE";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_PUBLIC"] = 7] = "SUBREDDIT_TYPE_PUBLIC";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_RESTRICTED"] = 8] = "SUBREDDIT_TYPE_RESTRICTED";
  SubredditTypeV22[SubredditTypeV22["SUBREDDIT_TYPE_USER"] = 9] = "SUBREDDIT_TYPE_USER";
  SubredditTypeV22[SubredditTypeV22["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(SubredditTypeV2 || (SubredditTypeV2 = {}));
var SubredditRatingV2;
(function(SubredditRatingV22) {
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_UNSPECIFIED"] = 0] = "SUBREDDIT_RATING_UNSPECIFIED";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_UNKNOWN"] = 1] = "SUBREDDIT_RATING_UNKNOWN";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_E"] = 2] = "SUBREDDIT_RATING_E";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_M1"] = 3] = "SUBREDDIT_RATING_M1";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_M2"] = 4] = "SUBREDDIT_RATING_M2";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_D"] = 5] = "SUBREDDIT_RATING_D";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_V"] = 6] = "SUBREDDIT_RATING_V";
  SubredditRatingV22[SubredditRatingV22["SUBREDDIT_RATING_X"] = 7] = "SUBREDDIT_RATING_X";
  SubredditRatingV22[SubredditRatingV22["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(SubredditRatingV2 || (SubredditRatingV2 = {}));

// node_modules/@devvit/shared-types/shared/form.js
var SettingScope;
(function(SettingScope2) {
  SettingScope2["Installation"] = "installation";
  SettingScope2["App"] = "app";
})(SettingScope || (SettingScope = {}));

// node_modules/@devvit/client/index.js
initWebViewMode();

// node_modules/@devvit/protos/json/devvit/ui/effect_types/v1alpha/create_order.js
var OrderResultStatus;
(function(OrderResultStatus2) {
  OrderResultStatus2[OrderResultStatus2["STATUS_CANCELLED"] = 0] = "STATUS_CANCELLED";
  OrderResultStatus2[OrderResultStatus2["STATUS_SUCCESS"] = 1] = "STATUS_SUCCESS";
  OrderResultStatus2[OrderResultStatus2["STATUS_ERROR"] = 2] = "STATUS_ERROR";
  OrderResultStatus2[OrderResultStatus2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(OrderResultStatus || (OrderResultStatus = {}));

// node_modules/@devvit/protos/json/devvit/ui/effects/v1alpha/realtime_subscriptions.js
var RealtimeSubscriptionStatus;
(function(RealtimeSubscriptionStatus2) {
  RealtimeSubscriptionStatus2[RealtimeSubscriptionStatus2["REALTIME_SUBSCRIBED"] = 0] = "REALTIME_SUBSCRIBED";
  RealtimeSubscriptionStatus2[RealtimeSubscriptionStatus2["REALTIME_UNSUBSCRIBED"] = 1] = "REALTIME_UNSUBSCRIBED";
  RealtimeSubscriptionStatus2[RealtimeSubscriptionStatus2["UNRECOGNIZED"] = -1] = "UNRECOGNIZED";
})(RealtimeSubscriptionStatus || (RealtimeSubscriptionStatus = {}));

// src/shared/time.ts
function parseTimeToMinutes(s) {
  if (!s) return null;
  const t = s.trim();
  const colonMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(t);
  if (colonMatch) {
    let h = parseInt(colonMatch[1] ?? "0", 10);
    const m = parseInt(colonMatch[2] ?? "0", 10);
    const meridiem = (colonMatch[3] ?? "").toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return h * 60 + m;
  }
  const hourMeridiemMatch = /^(\d{1,2})\s*(am|pm)$/i.exec(t);
  if (hourMeridiemMatch) {
    let h = parseInt(hourMeridiemMatch[1] ?? "0", 10);
    const meridiem = (hourMeridiemMatch[2] ?? "").toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return h * 60;
  }
  const hourOnlyMatch = /^(\d{1,2})$/.exec(t);
  if (hourOnlyMatch) {
    return parseInt(hourOnlyMatch[1] ?? "0", 10) * 60;
  }
  return null;
}
function isValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
function tzOffsetMinutes(epochMs, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(epochMs);
  const num = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = num("hour");
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(
    num("year"),
    num("month") - 1,
    num("day"),
    hour,
    num("minute"),
    num("second")
  );
  return Math.round((asUTC - epochMs) / 6e4);
}
function zonedTimeToEpochMs(dateStr, minutes, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wallAsUTC = Date.UTC(
    y ?? 1970,
    (m ?? 1) - 1,
    d ?? 1,
    Math.floor(minutes / 60),
    minutes % 60
  );
  const guess = wallAsUTC - tzOffsetMinutes(wallAsUTC, tz) * 6e4;
  return wallAsUTC - tzOffsetMinutes(guess, tz) * 6e4;
}
function resolveEventInstants(event) {
  const tz = event.timezone ?? "";
  if (!isValidTimeZone(tz)) return null;
  const beginMinutes = parseTimeToMinutes(event.hourBegin);
  if (beginMinutes === null) return null;
  const startMs = zonedTimeToEpochMs(event.dateBegin, beginMinutes, tz);
  const endMinutes = parseTimeToMinutes(event.hourEnd);
  if (endMinutes === null) return { startMs, endMs: startMs + 60 * 6e4 };
  let endMs = zonedTimeToEpochMs(event.dateEnd, endMinutes, tz);
  if (endMs <= startMs) endMs += 24 * 60 * 6e4;
  return { startMs, endMs };
}

// src/client/utils.ts
function todayString() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE");
}
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
function isNowEvent(event) {
  const instants = resolveEventInstants(event);
  if (instants) {
    const now2 = Date.now();
    return now2 >= instants.startMs && now2 <= instants.endMs;
  }
  const today = todayString();
  if (event.dateBegin !== today) return false;
  const beginMinutes = parseTimeToMinutes(event.hourBegin);
  if (beginMinutes === null) return true;
  const now = /* @__PURE__ */ new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = parseTimeToMinutes(event.hourEnd) ?? beginMinutes + 60;
  return currentMinutes >= beginMinutes && currentMinutes <= endMinutes;
}
function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aInstants = resolveEventInstants(a);
    const bInstants = resolveEventInstants(b);
    if (aInstants && bInstants) return aInstants.startMs - bInstants.startMs;
    if (a.dateBegin < b.dateBegin) return -1;
    if (a.dateBegin > b.dateBegin) return 1;
    return (parseTimeToMinutes(a.hourBegin) ?? 0) - (parseTimeToMinutes(b.hourBegin) ?? 0);
  });
}
function formatDate(dateStr) {
  const d = /* @__PURE__ */ new Date(`${dateStr}T00:00`);
  return d.toLocaleDateString(void 0, {
    month: "numeric",
    day: "numeric",
    year: "numeric"
  });
}
function formatDateRange(dateBegin, dateEnd) {
  if (dateBegin === dateEnd) return formatDate(dateBegin);
  return `${formatDate(dateBegin)} \u2013 ${formatDate(dateEnd)}`;
}
function formatEventWhen(event) {
  const instants = resolveEventInstants(event);
  if (!instants) {
    let text2 = formatDateRange(event.dateBegin, event.dateEnd);
    if (event.hourBegin) {
      text2 += ` \xB7 ${event.hourBegin}`;
      if (event.hourEnd) text2 += ` \u2013 ${event.hourEnd}`;
    }
    return { text: text2 };
  }
  const start = new Date(instants.startMs);
  const end = new Date(instants.endMs);
  const dateOptions = {
    month: "numeric",
    day: "numeric",
    year: "numeric"
  };
  const timeOptions = { hour: "numeric", minute: "2-digit" };
  const hasEnd = parseTimeToMinutes(event.hourEnd) !== null;
  const startDate = start.toLocaleDateString(void 0, dateOptions);
  const endDate = end.toLocaleDateString(void 0, dateOptions);
  let text = hasEnd && startDate !== endDate ? `${startDate} \u2013 ${endDate}` : startDate;
  text += ` \xB7 ${start.toLocaleTimeString(void 0, timeOptions)}`;
  if (hasEnd) text += ` \u2013 ${end.toLocaleTimeString(void 0, timeOptions)}`;
  text += " \xB7 your time";
  let tooltip = `${event.hourBegin}`;
  if (event.hourEnd) tooltip += ` \u2013 ${event.hourEnd}`;
  tooltip += ` ${event.timezone}`;
  return { text, tooltip };
}
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = /* @__PURE__ */ new Date(`${s}T00:00`);
  return !isNaN(d.getTime());
}
function isValidHex(s) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s);
}
function validateEvent(data) {
  if (!data.title?.trim()) return "Title is required.";
  if (!isValidDate(data.dateBegin ?? ""))
    return "Start date must be a valid YYYY-MM-DD date.";
  if (!isValidDate(data.dateEnd ?? ""))
    return "End date must be a valid YYYY-MM-DD date.";
  if ((data.dateEnd ?? "") < (data.dateBegin ?? ""))
    return "End date must be on or after start date.";
  if (data.timezone && !isValidTimeZone(data.timezone))
    return "Time zone must be a valid time zone.";
  if (data.timezone && data.hourBegin && parseTimeToMinutes(data.hourBegin) === null)
    return "Start time not recognized \u2014 use a format like 2:00 PM.";
  if (data.link && !data.link.startsWith("https://"))
    return "Link must start with https:// or be empty.";
  if (data.backgroundColor && !isValidHex(data.backgroundColor))
    return "Background color must be a valid hex color (e.g. #FF0000).";
  if (data.foregroundColor && !isValidHex(data.foregroundColor))
    return "Foreground color must be a valid hex color (e.g. #FFFFFF).";
  return null;
}

// src/client/toast.ts
var toastTimer = null;
function showToast(message, isError = false) {
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "error");
  if (isError) toastEl.classList.add("error");
  toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
    toastTimer = null;
  }, 3e3);
}

// src/client/forms.ts
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxWidth = 800;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}
function pickAndUploadImage(urlInputId, statusId) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    document.body.removeChild(fileInput);
    if (!file) return;
    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = "Uploading\u2026";
    try {
      const dataUrl = await compressImage(file);
      const response = await fetch(ApiEndpoint.UploadImage, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { mediaUrl } = await response.json();
      const urlInput = document.getElementById(urlInputId);
      if (urlInput) urlInput.value = mediaUrl;
      if (statusEl) statusEl.textContent = "Done";
    } catch {
      if (statusEl) statusEl.textContent = "Upload failed";
    }
  });
  fileInput.click();
}
function openModal(title) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  state.activeModal = null;
  state.editingEventId = null;
}
modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
eventsContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset["action"];
  const eventId = btn.dataset["eventId"] ?? "";
  e.stopPropagation();
  if (action === "edit") openEditEventModal(eventId);
  else if (action === "delete") void deleteEvent(eventId);
});
function openAddEventModal() {
  state.activeModal = "addEvent";
  state.editingEventId = null;
  const today = todayString();
  const defaults = {
    id: generateId(),
    title: "",
    description: "",
    link: "",
    dateBegin: today,
    dateEnd: today,
    hourBegin: "",
    hourEnd: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    backgroundColor: "#101720",
    foregroundColor: "#F0FFF0"
  };
  openModal("Add Event");
  renderEventForm(defaults, false);
}
function openEditEventModal(eventId) {
  const event = state.events[eventId];
  if (!event) return;
  state.activeModal = "editEvent";
  state.editingEventId = eventId;
  openModal("Edit Event");
  renderEventForm(event, true);
}
function renderEventForm(event, isEdit) {
  modalBody.innerHTML = "";
  if (isEdit) {
    const idNote = document.createElement("p");
    idNote.className = "form-id-note";
    idNote.textContent = `ID: ${event.id}`;
    modalBody.appendChild(idNote);
  }
  const fields = [
    {
      id: "f-title",
      label: "Title *",
      type: "text",
      value: event.title,
      required: true
    },
    {
      id: "f-description",
      label: "Description",
      type: "textarea",
      value: event.description,
      placeholder: "Optional"
    },
    {
      id: "f-link",
      label: "Link",
      type: "url",
      value: event.link,
      placeholder: "https://\u2026"
    },
    {
      id: "f-dateBegin",
      label: "Start Date *",
      type: "date",
      value: event.dateBegin,
      required: true
    },
    {
      id: "f-dateEnd",
      label: "End Date *",
      type: "date",
      value: event.dateEnd,
      required: true
    },
    {
      id: "f-hourBegin",
      label: "Start Time",
      type: "text",
      value: event.hourBegin,
      placeholder: "e.g. 2:00 PM"
    },
    {
      id: "f-hourEnd",
      label: "End Time",
      type: "text",
      value: event.hourEnd,
      placeholder: "e.g. 4:00 PM"
    },
    {
      id: "f-timezone",
      label: "Time Zone",
      type: "select",
      value: event.timezone ?? ""
    },
    {
      id: "f-backgroundColor",
      label: "Background Color",
      type: "text",
      value: event.backgroundColor,
      placeholder: "#101720"
    },
    {
      id: "f-foregroundColor",
      label: "Text Color",
      type: "text",
      value: event.foregroundColor,
      placeholder: "#F0FFF0"
    }
  ];
  for (const field of fields) {
    const group = document.createElement("div");
    group.className = "form-group";
    const label = document.createElement("label");
    label.className = "form-label";
    label.htmlFor = field.id;
    label.textContent = field.label;
    group.appendChild(label);
    if (field.type === "textarea") {
      const input = document.createElement("textarea");
      input.className = "form-input";
      input.id = field.id;
      input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
      group.appendChild(input);
    } else if (field.type === "select") {
      group.appendChild(buildTimeZoneSelect(field.id, field.value));
    } else {
      const input = document.createElement("input");
      input.className = "form-input";
      input.id = field.id;
      input.type = field.type === "date" ? "text" : field.type;
      input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.required) input.required = true;
      group.appendChild(input);
    }
    modalBody.appendChild(group);
  }
  const errorEl = document.createElement("div");
  errorEl.className = "form-error hidden";
  errorEl.id = "form-error";
  modalBody.appendChild(errorEl);
  const actions = document.createElement("div");
  actions.className = "form-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.type = "button";
  saveBtn.textContent = isEdit ? "Save Changes" : "Add Event";
  saveBtn.addEventListener("click", () => void submitEventForm(event.id, isEdit, saveBtn));
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modalBody.appendChild(actions);
}
function buildTimeZoneSelect(id, value) {
  if (typeof Intl.supportedValuesOf !== "function") {
    const input = document.createElement("input");
    input.className = "form-input";
    input.id = id;
    input.type = "text";
    input.value = value;
    input.placeholder = "e.g. America/New_York";
    return input;
  }
  const select = document.createElement("select");
  select.className = "form-input";
  select.id = id;
  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "None (show times as written)";
  select.appendChild(noneOption);
  const groups = /* @__PURE__ */ new Map();
  for (const tz of Intl.supportedValuesOf("timeZone")) {
    const slash = tz.indexOf("/");
    const region = slash === -1 ? "Other" : tz.slice(0, slash);
    let group = groups.get(region);
    if (!group) {
      group = document.createElement("optgroup");
      group.label = region;
      groups.set(region, group);
      select.appendChild(group);
    }
    const option = document.createElement("option");
    option.value = tz;
    option.textContent = slash === -1 ? tz : tz.slice(slash + 1).replace(/_/g, " ");
    group.appendChild(option);
  }
  select.value = value;
  if (value && select.value !== value) {
    const extra = document.createElement("option");
    extra.value = value;
    extra.textContent = value;
    select.appendChild(extra);
    select.value = value;
  }
  return select;
}
function getFormValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
async function submitEventForm(originalId, isEdit, saveBtn) {
  const errorEl = document.getElementById("form-error");
  const draft = {
    id: isEdit ? originalId : generateId(),
    title: getFormValue("f-title"),
    description: getFormValue("f-description"),
    link: getFormValue("f-link"),
    dateBegin: getFormValue("f-dateBegin"),
    dateEnd: getFormValue("f-dateEnd"),
    hourBegin: getFormValue("f-hourBegin"),
    hourEnd: getFormValue("f-hourEnd"),
    timezone: getFormValue("f-timezone"),
    backgroundColor: getFormValue("f-backgroundColor"),
    foregroundColor: getFormValue("f-foregroundColor")
  };
  const validationError = validateEvent(draft);
  if (validationError) {
    errorEl.textContent = validationError;
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving\u2026";
  try {
    const response = await fetch(ApiEndpoint.SaveEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: draft })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    state.events[draft.id] = draft;
    closeModal();
    showToast(isEdit ? "Event updated successfully" : "Event added successfully");
    render();
  } catch (err) {
    errorEl.textContent = `Save failed: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.classList.remove("hidden");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = isEdit ? "Save Changes" : "Add Event";
  }
}
async function deleteEvent(eventId) {
  try {
    const response = await fetch(ApiEndpoint.DeleteEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    delete state.events[eventId];
    showToast("Event removed");
    render();
  } catch (err) {
    showToast(
      `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      true
    );
  }
}
function openSettingsModal() {
  state.activeModal = "settings";
  openModal("Settings");
  const titleGroup = document.createElement("div");
  titleGroup.className = "form-group";
  const titleLabel = document.createElement("label");
  titleLabel.className = "form-label";
  titleLabel.htmlFor = "f-cal-title";
  titleLabel.textContent = "Calendar Title";
  titleGroup.appendChild(titleLabel);
  const titleInput = document.createElement("input");
  titleInput.className = "form-input";
  titleInput.id = "f-cal-title";
  titleInput.type = "text";
  titleInput.placeholder = "Community Calendar";
  titleInput.value = state.config.calendarTitle;
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);
  const bgGroup = document.createElement("div");
  bgGroup.className = "form-group";
  const bgLabel = document.createElement("label");
  bgLabel.className = "form-label";
  bgLabel.htmlFor = "f-bg-url";
  bgLabel.textContent = "Background Image URL";
  bgGroup.appendChild(bgLabel);
  const inputRow = document.createElement("div");
  inputRow.className = "input-with-action";
  const input = document.createElement("input");
  input.className = "form-input";
  input.id = "f-bg-url";
  input.type = "url";
  input.placeholder = "https://\u2026";
  input.value = state.config.backgroundImageUrl;
  inputRow.appendChild(input);
  const pickBtn = document.createElement("button");
  pickBtn.className = "btn btn-secondary";
  pickBtn.type = "button";
  pickBtn.textContent = "Choose file";
  pickBtn.addEventListener("click", () => pickAndUploadImage("f-bg-url", "f-bg-url-status"));
  inputRow.appendChild(pickBtn);
  bgGroup.appendChild(inputRow);
  const statusEl = document.createElement("span");
  statusEl.className = "input-status";
  statusEl.id = "f-bg-url-status";
  bgGroup.appendChild(statusEl);
  modalBody.appendChild(bgGroup);
  const errorEl = document.createElement("div");
  errorEl.className = "form-error hidden";
  errorEl.id = "bg-form-error";
  modalBody.appendChild(errorEl);
  const actions = document.createElement("div");
  actions.className = "form-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => void submitSettingsForm());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modalBody.appendChild(actions);
}
async function submitSettingsForm() {
  const calTitleInput = document.getElementById("f-cal-title");
  const bgInput = document.getElementById("f-bg-url");
  const errorEl = document.getElementById("bg-form-error");
  const newConfig = {
    ...state.config,
    calendarTitle: calTitleInput.value.trim() || "Community Calendar",
    backgroundImageUrl: bgInput.value.trim()
  };
  try {
    const response = await fetch(ApiEndpoint.SaveConfig, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: newConfig })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    state.config = newConfig;
    closeModal();
    showToast("Settings saved");
    render();
  } catch (err) {
    errorEl.textContent = `Save failed: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.classList.remove("hidden");
  }
}

// src/client/toolbar.ts
function initToolbar() {
  addEventBtn.addEventListener("click", openAddEventModal);
  setBgBtn.addEventListener("click", openSettingsModal);
}
function setToolbarVisible(visible) {
  modToolbar.classList.toggle("hidden", !visible);
}

// src/client/render.ts
function buildEventCard(event) {
  const isLive = isNowEvent(event);
  const isClickable = !!event.link && !state.editMode;
  const card = document.createElement("div");
  card.className = `event-card${isClickable ? " clickable" : ""}`;
  card.style.backgroundColor = event.backgroundColor || "#101720";
  card.style.color = event.foregroundColor || "#F0FFF0";
  if (isClickable) {
    card.addEventListener("click", () => {
      navigateTo(event.link);
    });
  }
  const header = document.createElement("div");
  header.className = "event-card-header";
  const titleRow = document.createElement("div");
  titleRow.className = "event-title-row";
  if (isLive) {
    const badge = document.createElement("span");
    badge.className = "live-badge";
    badge.innerHTML = '<span class="live-dot"></span>LIVE';
    titleRow.appendChild(badge);
  }
  const titleEl = document.createElement("span");
  titleEl.className = "event-title";
  titleEl.textContent = event.title;
  titleRow.appendChild(titleEl);
  header.appendChild(titleRow);
  if (state.editMode) {
    const actions = document.createElement("div");
    actions.className = "event-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-edit";
    editBtn.textContent = "Edit";
    editBtn.dataset["action"] = "edit";
    editBtn.dataset["eventId"] = event.id;
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "Remove";
    removeBtn.dataset["action"] = "delete";
    removeBtn.dataset["eventId"] = event.id;
    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    header.appendChild(actions);
  }
  card.appendChild(header);
  const meta = document.createElement("div");
  meta.className = "event-meta";
  const when = formatEventWhen(event);
  meta.textContent = when.text;
  if (when.tooltip) meta.title = when.tooltip;
  card.appendChild(meta);
  if (event.description) {
    const desc = document.createElement("div");
    desc.className = "event-description";
    desc.textContent = event.description;
    card.appendChild(desc);
  }
  return card;
}
function render() {
  const allEvents = sortEvents(Object.values(state.events));
  const nowEvents = allEvents.filter(isNowEvent);
  const upcomingEvents = allEvents.filter((e) => !isNowEvent(e));
  const combined = [...nowEvents, ...upcomingEvents];
  loadingEl.classList.add("hidden");
  const title = state.config.calendarTitle || "Community Calendar";
  calTitleEl.textContent = title;
  document.title = title;
  if (state.config.backgroundImageUrl) {
    bgOverlay.style.backgroundImage = `url(${JSON.stringify(state.config.backgroundImageUrl)})`;
    bgOverlay.classList.add("visible");
  } else {
    bgOverlay.style.backgroundImage = "";
    bgOverlay.classList.remove("visible");
  }
  if (state.isModerator) {
    modControls.classList.remove("hidden");
    editToggleBtn.innerHTML = state.editMode ? "&#10003;" : "&#9998;";
    editToggleBtn.classList.toggle("active", state.editMode);
    calHeader.classList.toggle("edit-mode", state.editMode);
    setToolbarVisible(state.editMode);
  } else {
    modControls.classList.add("hidden");
  }
  if (combined.length === 0) {
    eventsContainer.classList.add("hidden");
    emptyStateEl.classList.remove("hidden");
    emptyAddHint.classList.toggle(
      "hidden",
      !(state.isModerator && !state.editMode)
    );
  } else {
    emptyStateEl.classList.add("hidden");
    eventsContainer.classList.remove("hidden");
    eventsContainer.innerHTML = "";
    if (nowEvents.length > 0) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = "Happening now";
      eventsContainer.appendChild(label);
      for (const event of nowEvents) {
        eventsContainer.appendChild(buildEventCard(event));
      }
    }
    if (upcomingEvents.length > 0) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = state.config.titleUpcoming;
      eventsContainer.appendChild(label);
      for (const event of upcomingEvents) {
        eventsContainer.appendChild(buildEventCard(event));
      }
    }
  }
}

// src/client/main.ts
editToggleBtn.addEventListener("click", () => {
  state.editMode = !state.editMode;
  render();
});
initToolbar();
async function init() {
  try {
    const response = await fetch(ApiEndpoint.Init);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.postId = data.postId;
    state.username = data.username;
    state.isModerator = data.isModerator;
    state.events = data.events;
    state.config = data.config;
    render();
  } catch (err) {
    loadingEl.textContent = `Failed to load calendar: ${err instanceof Error ? err.message : String(err)}`;
  }
}
init();
//# sourceMappingURL=main.js.map
