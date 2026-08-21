// src/shared/api.ts
var ApiEndpoint = {
  Init: "/api/init",
  Save: "/api/save",
  Click: "/api/click",
  Impression: "/api/impression",
  Analytics: "/api/analytics",
  Settings: "/api/settings",
  DeleteBoard: "/api/board",
  UploadImage: "/api/upload-image",
  Migrate: "/api/migrate",
  OnPostCreate: "/internal/menu/post-create",
  OnFormCreateDashboard: "/internal/form/create-dashboard",
  OnModAction: "/internal/triggers/mod-action",
  OnAppUpgrade: "/internal/triggers/app-upgrade"
};

// src/client/api.ts
async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}
async function apiGet(endpoint) {
  const res = await fetch(endpoint);
  return res.json();
}

// src/client/dom.ts
var appEl = document.getElementById("app");
var pageTitleEl = document.getElementById("page-title");
var pageCountEl = document.getElementById("page-count");
var prevBtn = document.getElementById("prev-page");
var nextBtn = document.getElementById("next-page");
var editToggleBtn = document.getElementById("edit-toggle");
var editToolbarEl = document.getElementById("edit-toolbar");
var gridEl = document.getElementById("grid");
var emptyStateEl = document.getElementById("empty-state");
var modalOverlay = document.getElementById("modal-overlay");
var modalCard = document.getElementById("modal-card");
var modalTitle = document.getElementById("modal-title");
var modalCloseBtn = document.getElementById("modal-close-btn");
var modalBody = document.getElementById("modal-body");
var migrateBtnEl = document.getElementById("btn-migrate");
function showEmpty(msg) {
  gridEl.classList.add("hidden");
  emptyStateEl.classList.remove("hidden");
  document.getElementById("empty-msg").textContent = msg;
}

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
function todayStringInZone(tz) {
  try {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", tz ? { timeZone: tz } : {});
  } catch {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE");
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

// src/client/state.ts
var state = null;
function setState(s) {
  state = s;
}

// src/client/helpers.ts
function newId() {
  return crypto.randomUUID();
}
function isLinkEmpty(link) {
  return !link.uri && !link.title && !link.image;
}
function getActiveLinks(cell) {
  return cell.links.filter((l) => !isLinkEmpty(l));
}
function weightedRandom(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
function newLink() {
  return {
    id: newId(),
    uri: "",
    title: "",
    image: "",
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.5,
    description: "",
    clickCount: 0
  };
}
function newCell() {
  return {
    id: newId(),
    displayName: "",
    rotationEnabled: false,
    impressionCount: 0,
    variantImpressions: {},
    currentEditingIndex: 0,
    links: [newLink()],
    weights: [1]
  };
}
function currentPage() {
  if (!state) return null;
  const { board, pages } = state.boardState;
  const pageId = board.pageIds[state.currentPageIndex];
  return pageId ? pages[pageId] ?? null : null;
}
function getVariantIndex(cell) {
  if (!state) return 0;
  const activeLinks = getActiveLinks(cell);
  if (activeLinks.length < 2 || !cell.rotationEnabled) return 0;
  if (!state.variantSelections.has(cell.id)) {
    const activeWeights = cell.weights.filter(
      (_, i) => i < cell.links.length && !isLinkEmpty(cell.links[i])
    );
    const chosen = weightedRandom(
      activeWeights.length > 0 ? activeWeights : activeLinks.map(() => 1)
    );
    state.variantSelections.set(cell.id, chosen);
  }
  return state.variantSelections.get(cell.id) ?? 0;
}
function colorWithOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${opacity})`;
}
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/client/calendar.ts
function todayString() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE");
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
  return null;
}
function isCalendarPage(page) {
  return (page.type ?? "grid") === "calendar";
}
function getPageEvents(page) {
  return Object.values(page.events ?? {});
}
function newCalendarEvent() {
  const today = todayString();
  return {
    id: newId(),
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
}
function isExpired(event) {
  return event.dateEnd < todayStringInZone(event.timezone);
}
function renderEventCardHTML(event, isEditMode) {
  const isLive = isNowEvent(event);
  const clickable = !!event.link && !isEditMode;
  const liveBadge = isLive ? `<span class="cal-live-badge"><span class="cal-live-dot"></span>LIVE</span>` : "";
  const expiredTag = isEditMode && isExpired(event) ? `<span class="cal-expired-tag">Expired</span>` : "";
  const when = formatEventWhen(event);
  const metaTitle = when.tooltip ? ` title="${escHtml(when.tooltip)}"` : "";
  const description = event.description ? `<div class="cal-event-description">${escHtml(event.description)}</div>` : "";
  const actions = isEditMode ? `<div class="cal-event-actions">
         <button class="btn-secondary" data-action="cal-edit" data-event-id="${escHtml(event.id)}">Edit</button>
         <button class="btn-primary danger" data-action="cal-del" data-event-id="${escHtml(event.id)}">Remove</button>
       </div>` : "";
  return `<div class="cal-event-card${clickable ? " clickable" : ""}" data-event-id="${escHtml(event.id)}" data-uri="${escHtml(event.link)}" style="background-color:${escHtml(event.backgroundColor || "#101720")};color:${escHtml(event.foregroundColor || "#F0FFF0")}">
    <div class="cal-event-card-header">
      <div class="cal-event-title-row">${liveBadge}${expiredTag}<span class="cal-event-title">${escHtml(event.title)}</span></div>
    </div>
    <div class="cal-event-meta"${metaTitle}>${escHtml(when.text)}</div>
    ${description}
    ${actions}
  </div>`;
}
function renderCalendarHTML(page) {
  const isEditMode = state?.isEditMode ?? false;
  let events = sortEvents(getPageEvents(page));
  if (!isEditMode) {
    events = events.filter((e) => !isExpired(e));
  }
  const nowEvents = events.filter(isNowEvent);
  const upcomingEvents = events.filter((e) => !isNowEvent(e));
  const addBtn = isEditMode ? `<button class="btn-secondary cal-add-event-btn" data-action="cal-add">+ Add event</button>` : "";
  if (nowEvents.length === 0 && upcomingEvents.length === 0) {
    return `${addBtn}<p class="cal-empty">No upcoming events.</p>`;
  }
  const nowSection = nowEvents.length > 0 ? `<div class="cal-section-label">Happening now</div>` + nowEvents.map((e) => renderEventCardHTML(e, isEditMode)).join("") : "";
  const upcomingSection = upcomingEvents.length > 0 ? `<div class="cal-section-label">Upcoming</div>` + upcomingEvents.map((e) => renderEventCardHTML(e, isEditMode)).join("") : "";
  return `${addBtn}${nowSection}${upcomingSection}`;
}

// src/client/modals.ts
function openModal(title) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBody.innerHTML = "";
}
function setupModalOverlay() {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalCloseBtn.addEventListener("click", closeModal);
}
function showConfirmDialog(message, onConfirm) {
  openModal("Confirm");
  modalBody.innerHTML = `
    <p class="confirm-msg">${escHtml(message)}</p>
    <div class="form-buttons">
      <button class="btn-cancel" id="confirm-cancel">Cancel</button>
      <button class="btn-primary danger" id="confirm-ok">Confirm</button>
    </div>`;
  document.getElementById("confirm-cancel").addEventListener("click", closeModal);
  document.getElementById("confirm-ok").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}
function showAddPageDialog(onCreate) {
  openModal("Add Page");
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="ap-title" value="New Page">
    </div>
    <div class="form-group">
      <label>Page Type</label>
      <select id="ap-type">
        <option value="grid" selected>Link grid</option>
        <option value="calendar">Event calendar</option>
      </select>
    </div>
    <div class="form-buttons">
      <button class="btn-cancel" id="ap-cancel">Cancel</button>
      <button class="btn-primary" id="ap-create">Create</button>
    </div>`;
  document.getElementById("ap-cancel").addEventListener("click", closeModal);
  document.getElementById("ap-create").addEventListener("click", () => {
    const title = document.getElementById("ap-title").value.trim() || "New Page";
    const type = document.getElementById("ap-type").value;
    closeModal();
    onCreate(title, type);
  });
}
function showInfoPopup(description) {
  openModal("Info");
  modalBody.innerHTML = `
    <p class="info-popup-text">${escHtml(description)}</p>
    <div class="form-buttons">
      <button class="btn-primary" id="info-close">Close</button>
    </div>`;
  document.getElementById("info-close").addEventListener("click", closeModal);
}

// src/client/render.ts
function renderPage() {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const { board } = state.boardState;
  pageTitleEl.textContent = page.title;
  const total = board.pageIds.length;
  pageCountEl.textContent = total > 1 ? `${state.currentPageIndex + 1} / ${total}` : "";
  prevBtn.disabled = state.currentPageIndex === 0;
  nextBtn.disabled = state.currentPageIndex === total - 1;
  appEl.style.backgroundColor = page.backgroundColor;
  appEl.style.backgroundImage = page.backgroundImage ? `url(${page.backgroundImage})` : "none";
  appEl.classList.toggle("edit-mode", state.isEditMode);
  editToolbarEl.classList.toggle("hidden", !state.isEditMode);
  gridEl.classList.toggle("calendar-view", isCalendarPage(page));
  if (isCalendarPage(page)) {
    gridEl.innerHTML = renderCalendarHTML(page);
    return;
  }
  gridEl.style.setProperty("--grid-cols", String(page.columns));
  const numRows = Math.ceil(page.cellIds.length / page.columns);
  const colActionsHTML = state.isEditMode ? `<div class="col-actions-row">
         <div class="col-actions-spacer"></div>
         <div class="col-headers">${Array.from({ length: page.columns }, (_, colIdx) => `<div class="col-actions" data-col="${colIdx}">
              <button class="col-action-btn" data-action="col-add-before" title="Add column before">+</button>
              <button class="col-action-btn col-action-remove" data-action="col-remove" title="Remove column">&minus;</button>
              <button class="col-action-btn" data-action="col-add-after" title="Add column after">+</button>
            </div>`).join("")}
         </div>
       </div>` : "";
  const cells = page.cellIds.map((id) => state.boardState.cells[id]);
  gridEl.innerHTML = colActionsHTML + Array.from({ length: numRows }, (_, rowIdx) => {
    const rowCells = cells.slice(rowIdx * page.columns, (rowIdx + 1) * page.columns);
    const actionsHTML = state.isEditMode ? `<div class="row-actions" data-row="${rowIdx}">
           <button class="row-action-btn" data-action="row-add-before" title="Add row before">+</button>
           <button class="row-action-btn row-action-remove" data-action="row-remove" title="Remove row">&minus;</button>
           <button class="row-action-btn" data-action="row-add-after" title="Add row after">+</button>
         </div>` : "";
    return `<div class="row-wrapper">${actionsHTML}<div class="row-cells">${rowCells.map((cell) => renderCellHTML(cell)).join("")}</div></div>`;
  }).join("");
  if (!state.isEditMode) {
    const activeCellIds = cells.filter((c) => c && getActiveLinks(c).length > 0).map((c) => c.id);
    if (activeCellIds.length > 0) {
      apiPost(ApiEndpoint.Impression, {
        cellIds: activeCellIds
      }).catch(() => void 0);
    }
  }
}
function renderCellHTML(cell) {
  if (!cell) return `<div class="cell empty"></div>`;
  const activeLinks = getActiveLinks(cell);
  if (activeLinks.length === 0) {
    if (state?.isEditMode) {
      return `<div class="cell empty" data-cell-id="${cell.id}" data-action="edit-cell"></div>`;
    }
    return `<div class="cell empty"></div>`;
  }
  let linkIdx;
  if (state?.isEditMode) {
    linkIdx = cell.currentEditingIndex;
  } else {
    linkIdx = getVariantIndex(cell);
  }
  const safeIdx = Math.min(linkIdx, cell.links.length - 1);
  const link = cell.links[safeIdx] ?? activeLinks[0];
  const variantCount = activeLinks.length;
  const variantLabel = state?.isEditMode && variantCount > 1 ? `<span class="variant-badge">${safeIdx + 1}/${variantCount}</span>` : "";
  const bg = link.image ? `<img class="cell-bg-blur" src="${escHtml(link.image)}" alt="" aria-hidden="true" loading="lazy">
       <img class="cell-bg" src="${escHtml(link.image)}" alt="" loading="lazy">` : `<div class="cell-color-bg"></div>`;
  const titleBar = link.title ? `<div class="cell-title-bar" style="background-color: ${colorWithOpacity(link.backgroundColor, link.backgroundOpacity)}">
         <span class="cell-title-text" style="color:${escHtml(link.textColor)}">${escHtml(link.title)}</span>
       </div>` : "";
  const infoBtn = link.description ? `<button class="info-btn" data-action="info" data-description="${escHtml(link.description)}" title="Info">i</button>` : "";
  const editControls = state?.isEditMode ? `<div class="cell-edit-controls">
         <button class="cell-edit-btn rotate" data-action="rotate" title="Next variant">&#8635;</button>
         <button class="cell-edit-btn add-variant" data-action="add-variant" title="Add variant">+</button>
         <button class="cell-edit-btn del-variant" data-action="del-variant" title="Delete variant">&times;</button>
       </div>` : "";
  const uri = link.uri;
  return `<div class="cell active" data-cell-id="${cell.id}" data-link-id="${link.id}" data-uri="${escHtml(uri)}">
    ${bg}
    ${titleBar}
    ${infoBtn}
    ${variantLabel}
    ${editControls}
  </div>`;
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
      const { mediaUrl } = await apiPost(
        ApiEndpoint.UploadImage,
        { dataUrl }
      );
      const urlInput = document.getElementById(urlInputId);
      if (urlInput) urlInput.value = mediaUrl;
      if (statusEl) statusEl.textContent = "Done";
    } catch {
      if (statusEl) statusEl.textContent = "Upload failed";
    }
  });
  fileInput.click();
}
function openCellForm(cellId, linkIndex) {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const safeIdx = Math.min(linkIndex, cell.links.length - 1);
  const link = cell.links[safeIdx] ?? newLink();
  const totalClicks = cell.links.reduce((sum, l) => sum + (l.clickCount ?? 0), 0);
  const pctHtml = cell.links.length > 1 ? `<div class="analytics-row">
        <span class="analytics-label">% des clics (cellule)</span>
        <span class="analytics-value">${totalClicks > 0 ? Math.round((link.clickCount ?? 0) / totalClicks * 100) : 0}%</span>
      </div>` : "";
  openModal(`Edit Link (variant ${safeIdx + 1}/${cell.links.length})`);
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="fl-title" value="${escHtml(link.title)}">
    </div>
    <div class="form-group">
      <label>URL</label>
      <input type="text" id="fl-url" value="${escHtml(link.uri)}" placeholder="https://...">
    </div>
    <div class="form-group">
      <label>Image URL</label>
      <div class="input-with-action">
        <input type="text" id="fl-image" value="${escHtml(link.image)}" placeholder="https://...">
        <button type="button" id="fl-image-pick" class="btn-secondary">Choose file</button>
      </div>
      <span id="fl-image-status" class="input-status"></span>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Text Color</label>
        <input type="color" id="fl-text-color" value="${link.textColor}">
      </div>
      <div class="form-group">
        <label>BG Color</label>
        <input type="color" id="fl-bg-color" value="${link.backgroundColor}">
      </div>
    </div>
    <div class="form-group">
      <label>BG Opacity (0\u20131)</label>
      <input type="number" id="fl-opacity" min="0" max="1" step="0.05" value="${link.backgroundOpacity}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="fl-description">${escHtml(link.description)}</textarea>
    </div>
    <div class="form-group">
      <label>Variant Weight</label>
      <input type="number" id="fl-weight" min="1" step="1" value="${cell.weights[safeIdx] ?? 1}">
    </div>
    <div class="form-stats">
      <div class="analytics-row">
        <span class="analytics-label">Clics</span>
        <span class="analytics-value">${link.clickCount ?? 0}</span>
      </div>
      ${pctHtml}
    </div>
    <div class="form-buttons">
      <button class="btn-cancel" id="fl-cancel">Cancel</button>
      <button class="btn-primary" id="fl-save">Save</button>
    </div>`;
  document.getElementById("fl-cancel").addEventListener("click", closeModal);
  document.getElementById("fl-save").addEventListener("click", () => {
    saveCellForm(cellId, safeIdx);
  });
  document.getElementById("fl-image-pick").addEventListener("click", () => {
    pickAndUploadImage("fl-image", "fl-image-status");
  });
}
function saveCellForm(cellId, linkIndex) {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const title = document.getElementById("fl-title").value.trim();
  const uri = document.getElementById("fl-url").value.trim();
  const image = document.getElementById("fl-image").value.trim();
  const textColor = document.getElementById("fl-text-color").value;
  const backgroundColor = document.getElementById("fl-bg-color").value;
  const backgroundOpacity = parseFloat(
    document.getElementById("fl-opacity").value
  );
  const description = document.getElementById("fl-description").value.trim();
  const weight = Math.max(
    1,
    parseInt(document.getElementById("fl-weight").value, 10) || 1
  );
  const safeIdx = Math.min(linkIndex, cell.links.length - 1);
  const existing = cell.links[safeIdx];
  if (!existing) return;
  existing.title = title;
  existing.uri = uri;
  existing.image = image;
  existing.textColor = textColor;
  existing.backgroundColor = backgroundColor;
  existing.backgroundOpacity = Number.isFinite(backgroundOpacity) ? Math.max(0, Math.min(1, backgroundOpacity)) : 0.5;
  existing.description = description;
  while (cell.weights.length <= safeIdx) cell.weights.push(1);
  cell.weights[safeIdx] = weight;
  const activeLinks = getActiveLinks(cell);
  cell.rotationEnabled = activeLinks.length >= 2;
  state.isDirty = true;
  closeModal();
  renderPage();
}
function timeZoneSelectHTML(value) {
  if (typeof Intl.supportedValuesOf !== "function") {
    return `<input type="text" id="fe-timezone" value="${escHtml(value)}" placeholder="e.g. America/New_York">`;
  }
  const zones = Intl.supportedValuesOf("timeZone");
  let found = !value;
  let html = `<select id="fe-timezone"><option value=""${value ? "" : " selected"}>None (show times as written)</option>`;
  let openRegion = "";
  for (const tz of zones) {
    const slash = tz.indexOf("/");
    const region = slash === -1 ? "Other" : tz.slice(0, slash);
    if (region !== openRegion) {
      if (openRegion) html += "</optgroup>";
      html += `<optgroup label="${escHtml(region)}">`;
      openRegion = region;
    }
    const label = slash === -1 ? tz : tz.slice(slash + 1).replace(/_/g, " ");
    const selected = tz === value ? " selected" : "";
    if (selected) found = true;
    html += `<option value="${escHtml(tz)}"${selected}>${escHtml(label)}</option>`;
  }
  if (openRegion) html += "</optgroup>";
  if (!found) {
    html += `<option value="${escHtml(value)}" selected>${escHtml(value)}</option>`;
  }
  return html + "</select>";
}
function openEventForm(page, eventId) {
  const existing = eventId ? page.events?.[eventId] : void 0;
  const event = existing ?? newCalendarEvent();
  openModal(existing ? "Edit Event" : "Add Event");
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="fe-title" value="${escHtml(event.title)}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="fe-description">${escHtml(event.description)}</textarea>
    </div>
    <div class="form-group">
      <label>Link (optional)</label>
      <input type="text" id="fe-link" value="${escHtml(event.link)}" placeholder="https://...">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Start Date</label>
        <input type="date" id="fe-date-begin" value="${escHtml(event.dateBegin)}">
      </div>
      <div class="form-group">
        <label>End Date</label>
        <input type="date" id="fe-date-end" value="${escHtml(event.dateEnd)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Start Time (optional)</label>
        <input type="text" id="fe-hour-begin" value="${escHtml(event.hourBegin)}" placeholder="e.g. 2:00 PM">
      </div>
      <div class="form-group">
        <label>End Time (optional)</label>
        <input type="text" id="fe-hour-end" value="${escHtml(event.hourEnd)}" placeholder="e.g. 4:00 PM">
      </div>
    </div>
    <div class="form-group">
      <label>Time Zone</label>
      ${timeZoneSelectHTML(event.timezone ?? "")}
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>BG Color</label>
        <input type="color" id="fe-bg-color" value="${event.backgroundColor}">
      </div>
      <div class="form-group">
        <label>Text Color</label>
        <input type="color" id="fe-fg-color" value="${event.foregroundColor}">
      </div>
    </div>
    <div class="form-error hidden" id="fe-error"></div>
    <div class="form-buttons">
      <button class="btn-cancel" id="fe-cancel">Cancel</button>
      <button class="btn-primary" id="fe-save">Save</button>
    </div>`;
  document.getElementById("fe-cancel").addEventListener("click", closeModal);
  document.getElementById("fe-save").addEventListener("click", () => {
    const draft = {
      id: event.id,
      title: document.getElementById("fe-title").value.trim(),
      description: document.getElementById("fe-description").value.trim(),
      link: document.getElementById("fe-link").value.trim(),
      dateBegin: document.getElementById("fe-date-begin").value,
      dateEnd: document.getElementById("fe-date-end").value,
      hourBegin: document.getElementById("fe-hour-begin").value.trim(),
      hourEnd: document.getElementById("fe-hour-end").value.trim(),
      timezone: document.getElementById("fe-timezone").value.trim(),
      backgroundColor: document.getElementById("fe-bg-color").value,
      foregroundColor: document.getElementById("fe-fg-color").value
    };
    const error = validateEvent(draft);
    const errorEl = document.getElementById("fe-error");
    if (error) {
      errorEl.textContent = error;
      errorEl.classList.remove("hidden");
      return;
    }
    page.events = page.events ?? {};
    page.events[draft.id] = draft;
    if (state) state.isDirty = true;
    closeModal();
    renderPage();
  });
}
function openPageForm(page) {
  openModal("Edit Page");
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="fp-title" value="${escHtml(page.title)}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Background Color</label>
        <input type="color" id="fp-bg" value="${page.backgroundColor}">
      </div>
      <div class="form-group">
        <label>Foreground Color</label>
        <input type="color" id="fp-fg" value="${page.foregroundColor}">
      </div>
    </div>
    <div class="form-group">
      <label>Background Image (leave empty to clear)</label>
      <div class="input-with-action">
        <input type="text" id="fp-bg-image" value="${escHtml(page.backgroundImage)}" placeholder="https://...">
        <button type="button" id="fp-bg-image-pick" class="btn-secondary">Choose file</button>
      </div>
      <span id="fp-bg-image-status" class="input-status"></span>
    </div>
    <div class="form-buttons">
      <button class="btn-cancel" id="fp-cancel">Cancel</button>
      <button class="btn-primary" id="fp-save">Save</button>
    </div>`;
  document.getElementById("fp-cancel").addEventListener("click", closeModal);
  document.getElementById("fp-bg-image-pick").addEventListener("click", () => {
    pickAndUploadImage("fp-bg-image", "fp-bg-image-status");
  });
  document.getElementById("fp-save").addEventListener("click", () => {
    page.title = document.getElementById("fp-title").value.trim() || page.title;
    page.backgroundColor = document.getElementById("fp-bg").value;
    page.foregroundColor = document.getElementById("fp-fg").value;
    page.backgroundImage = document.getElementById("fp-bg-image").value.trim();
    if (state) state.isDirty = true;
    closeModal();
    renderPage();
  });
}

// src/client/variants.ts
function rotateCellVariant(cellId) {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const count = cell.links.length;
  cell.currentEditingIndex = (cell.currentEditingIndex + 1) % count;
  state.isDirty = true;
  renderPage();
}
function addCellVariant(cellId) {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const newL = newLink();
  cell.links.push(newL);
  cell.weights.push(1);
  cell.currentEditingIndex = cell.links.length - 1;
  const activeLinks = getActiveLinks(cell);
  cell.rotationEnabled = activeLinks.length >= 2;
  state.isDirty = true;
  openCellForm(cellId, cell.currentEditingIndex);
}
function deleteCellVariant(cellId) {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const idx = cell.currentEditingIndex;
  if (cell.links.length <= 1) {
    cell.links[0] = newLink();
    cell.weights[0] = 1;
    cell.rotationEnabled = false;
    cell.currentEditingIndex = 0;
  } else {
    cell.links.splice(idx, 1);
    cell.weights.splice(idx, 1);
    cell.currentEditingIndex = Math.min(idx, cell.links.length - 1);
    const activeLinks = getActiveLinks(cell);
    cell.rotationEnabled = activeLinks.length >= 2;
  }
  state.isDirty = true;
  renderPage();
}

// src/client/grid.ts
function insertRowBefore(rowIndex) {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const newCells = Array.from({ length: page.columns }, () => newCell());
  for (const cell of newCells) state.boardState.cells[cell.id] = cell;
  page.cellIds.splice(rowIndex * page.columns, 0, ...newCells.map((c) => c.id));
  state.isDirty = true;
  renderPage();
}
function removeRowAt(rowIndex) {
  if (!state) return;
  const page = currentPage();
  if (!page || page.cellIds.length <= page.columns) return;
  const removed = page.cellIds.splice(rowIndex * page.columns, page.columns);
  for (const id of removed) delete state.boardState.cells[id];
  state.isDirty = true;
  renderPage();
}
function insertRowAfter(rowIndex) {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const newCells = Array.from({ length: page.columns }, () => newCell());
  for (const cell of newCells) state.boardState.cells[cell.id] = cell;
  page.cellIds.splice((rowIndex + 1) * page.columns, 0, ...newCells.map((c) => c.id));
  state.isDirty = true;
  renderPage();
}
function insertColumnBefore(colIndex) {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const oldCols = page.columns;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds = [];
  for (let row = 0; row < numRows; row++) {
    const rowCells = page.cellIds.slice(row * oldCols, (row + 1) * oldCols);
    const cell = newCell();
    state.boardState.cells[cell.id] = cell;
    rowCells.splice(colIndex, 0, cell.id);
    newCellIds.push(...rowCells);
  }
  page.cellIds = newCellIds;
  page.columns = oldCols + 1;
  state.isDirty = true;
  renderPage();
}
function removeColumnAt(colIndex) {
  if (!state) return;
  const page = currentPage();
  if (!page || page.columns <= 1) return;
  const oldCols = page.columns;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds = [];
  for (let row = 0; row < numRows; row++) {
    const rowCells = page.cellIds.slice(row * oldCols, (row + 1) * oldCols);
    const [removed] = rowCells.splice(colIndex, 1);
    if (removed) delete state.boardState.cells[removed];
    newCellIds.push(...rowCells);
  }
  page.cellIds = newCellIds;
  page.columns = oldCols - 1;
  state.isDirty = true;
  renderPage();
}
function insertColumnAfter(colIndex) {
  insertColumnBefore(colIndex + 1);
}
function addPage(position) {
  showAddPageDialog((title, type) => createPage(position, title, type));
}
function createPage(position, title, type) {
  if (!state) return;
  const cells = type === "grid" ? Array.from({ length: 16 }, () => newCell()) : [];
  const page = {
    id: newId(),
    title,
    backgroundColor: "#000000",
    foregroundColor: "#FFFFFF",
    backgroundImage: "",
    columns: type === "grid" ? 4 : 1,
    cellIds: cells.map((c) => c.id),
    type,
    ...type === "calendar" ? { events: {} } : {}
  };
  for (const cell of cells) {
    state.boardState.cells[cell.id] = cell;
  }
  state.boardState.pages[page.id] = page;
  const insertAt = position === "before" ? state.currentPageIndex : state.currentPageIndex + 1;
  state.boardState.board.pageIds.splice(insertAt, 0, page.id);
  if (position === "after") state.currentPageIndex++;
  state.isDirty = true;
  renderPage();
}
function removePage() {
  if (!state) return;
  const { board } = state.boardState;
  if (board.pageIds.length <= 1) {
    alert("Cannot remove the only page.");
    return;
  }
  showConfirmDialog("Remove this page and all its content?", () => {
    if (!state) return;
    const pageId = board.pageIds[state.currentPageIndex];
    if (!pageId) return;
    const page = state.boardState.pages[pageId];
    if (page) {
      for (const cellId of page.cellIds) {
        delete state.boardState.cells[cellId];
      }
    }
    delete state.boardState.pages[pageId];
    board.pageIds.splice(state.currentPageIndex, 1);
    state.currentPageIndex = Math.min(
      state.currentPageIndex,
      board.pageIds.length - 1
    );
    state.isDirty = true;
    renderPage();
  });
}

// src/client/events.ts
function setupGridEvents() {
  gridEl.addEventListener("click", (e) => {
    if (!state) return;
    const target = e.target;
    const page = currentPage();
    if (page && isCalendarPage(page)) {
      const action2 = target.closest("[data-action]")?.dataset.action;
      const eventId = target.closest("[data-event-id]")?.dataset.eventId;
      if (state.isEditMode) {
        if (action2 === "cal-add") {
          openEventForm(page);
        } else if (action2 === "cal-edit" && eventId) {
          openEventForm(page, eventId);
        } else if (action2 === "cal-del" && eventId) {
          showConfirmDialog("Remove this event?", () => {
            if (!state) return;
            delete page.events?.[eventId];
            state.isDirty = true;
            renderPage();
          });
        }
      } else {
        const card = target.closest(".cal-event-card");
        const uri = card?.dataset.uri ?? "";
        if (uri) navigateTo(uri);
      }
      return;
    }
    const colActionBtn = target.closest(".col-action-btn");
    if (colActionBtn && state.isEditMode) {
      e.stopPropagation();
      const colActionsEl = colActionBtn.closest(".col-actions");
      const colIndex = parseInt(colActionsEl?.dataset.col ?? "0");
      if (colActionBtn.dataset.action === "col-add-before") insertColumnBefore(colIndex);
      else if (colActionBtn.dataset.action === "col-remove") removeColumnAt(colIndex);
      else if (colActionBtn.dataset.action === "col-add-after") insertColumnAfter(colIndex);
      return;
    }
    const rowActionBtn = target.closest(".row-action-btn");
    if (rowActionBtn && state.isEditMode) {
      e.stopPropagation();
      const rowActionsEl = rowActionBtn.closest(".row-actions");
      const rowIndex = parseInt(rowActionsEl?.dataset.row ?? "0");
      if (rowActionBtn.dataset.action === "row-add-before") insertRowBefore(rowIndex);
      else if (rowActionBtn.dataset.action === "row-remove") removeRowAt(rowIndex);
      else if (rowActionBtn.dataset.action === "row-add-after") insertRowAfter(rowIndex);
      return;
    }
    const cellEl = target.closest(".cell");
    if (!cellEl) return;
    const cellId = cellEl.dataset.cellId;
    const action = target.closest("[data-action]")?.dataset.action;
    if (!cellId) return;
    const cell = state.boardState.cells[cellId];
    if (state.isEditMode) {
      if (action === "rotate") {
        e.stopPropagation();
        rotateCellVariant(cellId);
      } else if (action === "add-variant") {
        e.stopPropagation();
        addCellVariant(cellId);
      } else if (action === "del-variant") {
        e.stopPropagation();
        deleteCellVariant(cellId);
      } else {
        const activeLinks = cell ? getActiveLinks(cell) : [];
        const linkIdx = cell ? cell.currentEditingIndex : 0;
        openCellForm(cellId, Math.min(linkIdx, activeLinks.length > 0 ? activeLinks.length - 1 : 0));
      }
    } else {
      if (action === "info") {
        e.stopPropagation();
        const desc = target.closest("[data-action='info']")?.dataset.description ?? "";
        showInfoPopup(desc);
      } else {
        const uri = cellEl.dataset.uri ?? "";
        const linkId = cellEl.dataset.linkId ?? "";
        if (uri && linkId) {
          handleCellClick(cellId, linkId, uri);
        }
      }
    }
  });
}
function setupNavigation() {
  prevBtn.addEventListener("click", () => {
    if (!state || state.currentPageIndex === 0) return;
    state.currentPageIndex--;
    state.variantSelections.clear();
    renderPage();
  });
  nextBtn.addEventListener("click", () => {
    if (!state) return;
    const total = state.boardState.board.pageIds.length;
    if (state.currentPageIndex >= total - 1) return;
    state.currentPageIndex++;
    state.variantSelections.clear();
    renderPage();
  });
}
function setupEditToggle() {
  editToggleBtn.addEventListener("click", () => {
    if (!state) return;
    if (state.isEditMode) {
      exitEditMode();
    } else {
      state.isEditMode = true;
      editToggleBtn.classList.add("active");
      editToggleBtn.innerHTML = "&#10003;";
      editToggleBtn.title = "Save and exit edit mode";
      renderPage();
    }
  });
}
function handleCellClick(cellId, linkId, uri) {
  apiPost(ApiEndpoint.Click, {
    cellId,
    linkId
  }).catch(() => void 0);
  navigateTo(uri);
}
async function exitEditMode() {
  if (!state) return;
  if (state.isDirty) {
    try {
      await apiPost(ApiEndpoint.Save, {
        boardState: state.boardState
      });
    } catch {
      alert("Failed to save changes. Please try again.");
      return;
    }
    state.isDirty = false;
  }
  state.isEditMode = false;
  state.variantSelections.clear();
  editToggleBtn.classList.remove("active");
  editToggleBtn.innerHTML = "&#9998;";
  editToggleBtn.title = "Edit board";
  renderPage();
}

// src/client/analytics.ts
async function openAnalyticsModal() {
  openModal("Analytics");
  modalBody.innerHTML = `<p style="text-align:center;color:#8b949e;font-size:0.85em">Loading analytics\u2026</p>`;
  try {
    const data = await apiGet(ApiEndpoint.Analytics);
    if (data.type !== "analytics") {
      modalBody.innerHTML = `<p style="color:#f85149">Failed to load analytics.</p>`;
      return;
    }
    const { data: analytics, abTests } = data;
    const fmt = (n) => n.toFixed(1);
    modalBody.innerHTML = `
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="overview">Overview</button>
        <button class="tab-btn" data-tab="abtests">A/B Tests</button>
        <button class="tab-btn" data-tab="pages">Pages</button>
      </div>

      <!-- Overview tab -->
      <div class="tab-panel active" id="tab-overview">
        <div class="analytics-row"><span class="analytics-label">Total Clicks</span><span class="analytics-value">${analytics.totalClicks}</span></div>
        <div class="analytics-row"><span class="analytics-label">Total Impressions</span><span class="analytics-value">${analytics.totalImpressions}</span></div>
        <div class="analytics-row"><span class="analytics-label">Overall CTR</span><span class="analytics-value">${fmt(analytics.ctr)}%</span></div>
        <div class="analytics-row"><span class="analytics-label">Active A/B Tests</span><span class="analytics-value">${analytics.activeABTests}</span></div>
        ${analytics.mostClickedPageTitle ? `<div class="analytics-row"><span class="analytics-label">Most Clicked Page</span><span class="analytics-value">${escHtml(analytics.mostClickedPageTitle)}</span></div>` : ""}
      </div>

      <!-- A/B Tests tab -->
      <div class="tab-panel" id="tab-abtests">
        ${abTests.length === 0 ? '<p style="color:#8b949e;font-size:0.85em;padding:8px 0">No active A/B tests.</p>' : abTests.map((test) => `
          <div class="ab-test-item">
            ${test.isSignificant ? '<span class="significant-badge">Significant</span>' : ""}
            ${test.variants.map((v) => `
              <div class="ab-variant-row ${v.isBest ? "best" : ""}">
                <span>${escHtml(v.title) || "(untitled)"}</span>
                <span>${v.clicks} clicks / ${fmt(v.ctr)}% CTR</span>
              </div>`).join("")}
          </div>`).join("")}
      </div>

      <!-- Pages tab -->
      <div class="tab-panel" id="tab-pages">
        ${analytics.pages.map((p) => `
          <div style="margin-bottom:10px">
            <strong style="font-size:0.85em">${escHtml(p.title)}</strong>
            <div class="analytics-row"><span class="analytics-label">Clicks</span><span class="analytics-value">${p.totalClicks}</span></div>
            <div class="analytics-row"><span class="analytics-label">Impressions</span><span class="analytics-value">${p.totalImpressions}</span></div>
            <div class="analytics-row"><span class="analytics-label">CTR</span><span class="analytics-value">${fmt(p.ctr)}%</span></div>
            <div class="analytics-row"><span class="analytics-label">Active Cells</span><span class="analytics-value">${p.activeCellCount}</span></div>
          </div>`).join("")}
      </div>

      <div class="form-buttons">
        <button class="btn-primary" id="analytics-close">Close</button>
      </div>`;
    document.getElementById("analytics-close").addEventListener("click", closeModal);
    modalBody.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modalBody.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        modalBody.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const tabId = `tab-${btn.dataset.tab}`;
        document.getElementById(tabId)?.classList.add("active");
      });
    });
  } catch {
    modalBody.innerHTML = `<p style="color:#f85149">Failed to load analytics.</p>`;
  }
}

// src/client/toolbar.ts
function setupToolbar() {
  document.getElementById("btn-edit-page").addEventListener("click", () => {
    const page = currentPage();
    if (page) openPageForm(page);
  });
  document.getElementById("btn-add-page-before").addEventListener("click", () => {
    addPage("before");
  });
  document.getElementById("btn-add-page-after").addEventListener("click", () => {
    addPage("after");
  });
  document.getElementById("btn-remove-page").addEventListener("click", () => {
    removePage();
  });
  document.getElementById("btn-analytics").addEventListener("click", () => {
    openAnalyticsModal();
  });
}

// src/client/main.ts
async function init() {
  try {
    const data = await apiGet(ApiEndpoint.Init);
    if (data.needsMigration && data.isEditor) {
      showEmpty("This post uses the legacy data format.");
      migrateBtnEl.classList.remove("hidden");
      migrateBtnEl.addEventListener("click", async () => {
        migrateBtnEl.disabled = true;
        migrateBtnEl.textContent = "Migrating\u2026";
        try {
          const result = await apiPost(ApiEndpoint.Migrate, {});
          migrateBtnEl.classList.add("hidden");
          emptyStateEl.classList.add("hidden");
          gridEl.classList.remove("hidden");
          setState({
            boardState: result.boardState,
            currentPageIndex: 0,
            isEditMode: false,
            username: data.username,
            isEditor: data.isEditor,
            isModerator: data.isModerator,
            isDirty: false,
            variantSelections: /* @__PURE__ */ new Map()
          });
          editToggleBtn.classList.remove("hidden");
          setupToolbar();
          renderPage();
        } catch (e) {
          migrateBtnEl.disabled = false;
          migrateBtnEl.textContent = "Migrate Legacy Data";
          console.error("Migration failed", e);
        }
      }, { once: true });
      return;
    }
    if (data.type !== "init" || !data.boardState) {
      showEmpty("No board found for this post.");
      return;
    }
    setState({
      boardState: data.boardState,
      currentPageIndex: 0,
      isEditMode: false,
      username: data.username,
      isEditor: data.isEditor,
      isModerator: data.isModerator,
      isDirty: false,
      variantSelections: /* @__PURE__ */ new Map()
    });
    if (data.isEditor) {
      editToggleBtn.classList.remove("hidden");
    }
    setupToolbar();
    renderPage();
  } catch (e) {
    console.error("Init failed", e);
    showEmpty("Failed to load board.");
  }
}
setupGridEvents();
setupNavigation();
setupEditToggle();
setupModalOverlay();
init();
//# sourceMappingURL=main.js.map
