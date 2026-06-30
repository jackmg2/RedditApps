import type { IncomingMessage, ServerResponse } from "node:http";
import { context, media, reddit, redis, settings } from "@devvit/web/server";
import type { PartialJsonValue, UiResponse } from "@devvit/web/shared";
import { once } from "node:events";
import {
  ApiEndpoint,
  type AnalyticsResponse,
  type Board,
  type BoardState,
  type Cell,
  type ClickRequest,
  type ClickResponse,
  type DeleteResponse,
  type ImpressionRequest,
  type ImpressionResponse,
  type InitResponse,
  type LinkVariant,
  type Page,
  type PageAnalytics,
  type ABTestInfo,
  type ABVariantInfo,
  type SaveRequest,
  type SaveResponse,
  type SettingsResponse,
  type SettingsUpdateRequest,
  type UploadImageRequest,
  type UploadImageResponse,
  type MigrateResponse,
} from "../shared/api.ts";

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`;
    console.error(msg);
    writeJSON(500, { error: msg, status: 500 }, rsp);
  }
}

async function onRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  const url = req.url;
  const method = req.method ?? "GET";

  if (!url || url === "/") {
    writeJSON(404, { error: "not found", status: 404 }, rsp);
    return;
  }

  let response: PartialJsonValue;

  if (method === "GET" && url === ApiEndpoint.Init) {
    response = await onInit();
  } else if (method === "POST" && url === ApiEndpoint.Save) {
    response = await onSave(req);
  } else if (method === "POST" && url === ApiEndpoint.Click) {
    response = await onClick(req);
  } else if (method === "POST" && url === ApiEndpoint.Impression) {
    response = await onImpression(req);
  } else if (method === "GET" && url === ApiEndpoint.Analytics) {
    response = await onAnalytics();
  } else if (method === "GET" && url === ApiEndpoint.Settings) {
    response = await onGetSettings();
  } else if (method === "POST" && url === ApiEndpoint.Settings) {
    response = await onUpdateSettings(req);
  } else if (method === "DELETE" && url === ApiEndpoint.DeleteBoard) {
    response = await onDeleteBoard();
  } else if (method === "POST" && url === ApiEndpoint.UploadImage) {
    response = await onUploadImage(req);
  } else if (method === "POST" && url === ApiEndpoint.OnPostCreate) {
    response = onMenuNewPost();
  } else if (method === "POST" && url === ApiEndpoint.OnFormCreateDashboard) {
    response = await onFormCreateDashboard(req);
  } else if (method === "POST" && url === ApiEndpoint.Migrate) {
    response = await onMigrate();
  } else if (method === "POST" && url === ApiEndpoint.OnModAction) {
    response = await onModAction(req);
  } else if (method === "POST" && url === ApiEndpoint.OnAppUpgrade) {
    response = await onAppUpgrade();
  } else {
    response = { error: "not found", status: 404 };
  }

  const status =
    typeof response === "object" &&
    response !== null &&
    "status" in response &&
    typeof (response as Record<string, unknown>).status === "number"
      ? ((response as Record<string, unknown>).status as number)
      : 200;

  writeJSON(status, response, rsp);
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getBoardKey(postId: string): string {
  return `linker_${postId}`;
}

async function getBoardState(postId: string): Promise<BoardState | null> {
  let data: string | undefined;
  try {
    data = await redis.get(getBoardKey(postId));
  } catch (err) {
    if (err instanceof Error && err.message.includes("WRONGTYPE")) return null;
    throw err;
  }
  if (!data) return null;
  return JSON.parse(data) as BoardState;
}

async function saveBoardState(
  postId: string,
  boardState: BoardState,
): Promise<void> {
  await redis.set(getBoardKey(postId), JSON.stringify(boardState));
}

function getPostId(): string {
  if (!context.postId) throw new Error("no post ID");
  return context.postId;
}

// ─── Entity factories ─────────────────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID();
}

function newLink(): LinkVariant {
  return {
    id: newId(),
    uri: "",
    title: "",
    image: "",
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.5,
    description: "",
    clickCount: 0,
  };
}

function newCell(): Cell {
  return {
    id: newId(),
    displayName: "",
    rotationEnabled: false,
    impressionCount: 0,
    variantImpressions: {},
    currentEditingIndex: 0,
    links: [newLink()],
    weights: [1],
  };
}

function createBoardState(postId: string, title: string): BoardState {
  const cells: Cell[] = Array.from({ length: 16 }, () => newCell());
  const page: Page = {
    id: newId(),
    title,
    backgroundColor: "#000000",
    foregroundColor: "#FFFFFF",
    backgroundImage: "",
    columns: 4,
    cellIds: cells.map((c) => c.id),
  };
  const board: Board = {
    id: newId(),
    postId,
    pageIds: [page.id],
  };
  const pages: Record<string, Page> = { [page.id]: page };
  const cellsRecord: Record<string, Cell> = {};
  for (const cell of cells) {
    cellsRecord[cell.id] = cell;
  }
  return { board, pages, cells: cellsRecord };
}

// ─── Permission helpers ───────────────────────────────────────────────────────

function isLinkEmpty(link: LinkVariant): boolean {
  return !link.uri && !link.title && !link.image;
}

async function checkEditorAccess(): Promise<{
  isEditor: boolean;
  isModerator: boolean;
}> {
  const username = context.username;
  if (!username) return { isEditor: false, isModerator: false };

  let isModerator = false;
  try {
    const mods = await reddit
      .getModerators({ subredditName: context.subredditName, username })
      .all();
    isModerator = mods.length > 0;
  } catch {
    // Mod check failed; assume not a mod
  }

  if (isModerator) return { isEditor: true, isModerator: true };

  try {
    const whitelist = (await settings.get<string>("editWhitelist")) ?? "";
    const whitelistNames = whitelist
      .split(";")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    const isWhitelisted = whitelistNames.includes(username.toLowerCase());
    return { isEditor: isWhitelisted, isModerator: false };
  } catch {
    return { isEditor: false, isModerator: false };
  }
}

// ─── Endpoint handlers ────────────────────────────────────────────────────────

async function onInit(): Promise<InitResponse> {
  const postId = getPostId();
  const [boardState, { isEditor, isModerator }] = await Promise.all([
    getBoardState(postId),
    checkEditorAccess(),
  ]);
  let needsMigration = false;
  if (!boardState) {
    const keyType = await redis.type(getBoardKey(postId));
    needsMigration = keyType === "hash";
  }
  return {
    type: "init",
    boardState,
    username: context.username ?? "user",
    isEditor,
    isModerator,
    needsMigration,
  };
}

async function onSave(req: IncomingMessage): Promise<SaveResponse> {
  const { isEditor } = await checkEditorAccess();
  if (!isEditor) throw new Error("not authorized");
  const { boardState } = await readJSON<SaveRequest>(req);
  await saveBoardState(getPostId(), boardState);
  return { type: "save" };
}

async function onClick(req: IncomingMessage): Promise<ClickResponse> {
  const { cellId, linkId } = await readJSON<ClickRequest>(req);
  const postId = getPostId();
  const boardState = await getBoardState(postId);
  if (!boardState) return { type: "click" };

  const cell = boardState.cells[cellId];
  if (cell) {
    cell.variantImpressions[linkId] =
      (cell.variantImpressions[linkId] ?? 0) + 1;
    const link = cell.links.find((l) => l.id === linkId);
    if (link) link.clickCount++;
    await saveBoardState(postId, boardState);
  }
  return { type: "click" };
}

async function onImpression(
  req: IncomingMessage,
): Promise<ImpressionResponse> {
  const { cellIds } = await readJSON<ImpressionRequest>(req);
  const postId = getPostId();
  const boardState = await getBoardState(postId);
  if (!boardState) return { type: "impression" };

  for (const cellId of cellIds) {
    const cell = boardState.cells[cellId];
    if (cell) cell.impressionCount++;
  }
  await saveBoardState(postId, boardState);
  return { type: "impression" };
}

async function onAnalytics(): Promise<AnalyticsResponse> {
  const { isEditor } = await checkEditorAccess();
  if (!isEditor) throw new Error("not authorized");

  const boardState = await getBoardState(getPostId());
  if (!boardState) throw new Error("board not found");

  const { board, pages, cells } = boardState;

  let totalClicks = 0;
  let totalImpressions = 0;
  let activeABTests = 0;
  let mostClickedPageClicks = 0;
  let mostClickedPageTitle = "";
  let mostClickedCellClicks = 0;
  let mostClickedCellId = "";

  const pageAnalytics: PageAnalytics[] = [];
  const abTests: ABTestInfo[] = [];

  for (const pageId of board.pageIds) {
    const page = pages[pageId];
    if (!page) continue;

    let pageClicks = 0;
    let pageImpressions = 0;
    let activeCellCount = 0;
    const cellMetrics: {
      cellId: string;
      clicks: number;
      row: number;
      col: number;
    }[] = [];

    for (let i = 0; i < page.cellIds.length; i++) {
      const cellId = page.cellIds[i];
      if (!cellId) continue;
      const cell = cells[cellId];
      if (!cell) continue;

      const activeLinks = cell.links.filter((l) => !isLinkEmpty(l));
      if (activeLinks.length === 0) continue;
      activeCellCount++;

      const cellClicks = cell.links.reduce(
        (sum, l) => sum + (l.clickCount ?? 0),
        0,
      );
      const cellImpressions = cell.impressionCount ?? 0;
      pageClicks += cellClicks;
      pageImpressions += cellImpressions;
      totalClicks += cellClicks;
      totalImpressions += cellImpressions;

      const row = Math.floor(i / page.columns);
      const col = i % page.columns;
      cellMetrics.push({ cellId, clicks: cellClicks, row, col });

      if (cellClicks > mostClickedCellClicks) {
        mostClickedCellClicks = cellClicks;
        mostClickedCellId = cellId;
      }

      // A/B test analysis
      if (cell.rotationEnabled && activeLinks.length >= 2) {
        activeABTests++;
        const totalWeight = cell.weights.reduce((a, b) => a + b, 0);
        const variants: ABVariantInfo[] = cell.links.map((link, idx) => {
          const linkImpressions = cell.variantImpressions[link.id] ?? 0;
          const linkClicks = link.clickCount ?? 0;
          const weight = cell.weights[idx] ?? 1;
          const ctr =
            linkImpressions > 0 ? (linkClicks / linkImpressions) * 100 : 0;
          const weightRatio = totalWeight > 0 ? weight / totalWeight : 0;
          const actualShare =
            cellImpressions > 0 ? linkImpressions / cellImpressions : 0;
          return {
            linkId: link.id,
            title: link.title,
            impressions: linkImpressions,
            clicks: linkClicks,
            ctr,
            weight,
            weightRatio,
            actualShare,
            isBest: false,
          };
        });

        let bestIdx = 0;
        for (let vi = 1; vi < variants.length; vi++) {
          if ((variants[vi]?.ctr ?? 0) > (variants[bestIdx]?.ctr ?? 0))
            bestIdx = vi;
        }
        const bestVariant = variants[bestIdx];
        if (bestVariant) bestVariant.isBest = true;

        const isSignificant =
          (bestVariant?.impressions ?? 0) > 100 &&
          variants
            .filter((_, vi) => vi !== bestIdx)
            .every((o) => (bestVariant?.ctr ?? 0) > o.ctr * 1.1);

        abTests.push({ cellId, variants, isSignificant });
      }
    }

    if (pageClicks > mostClickedPageClicks) {
      mostClickedPageClicks = pageClicks;
      mostClickedPageTitle = page.title;
    }

    const numRows = Math.ceil(page.cellIds.length / page.columns);
    const heatmapRows = Array.from<number>({ length: numRows }).fill(0);
    const heatmapCols = Array.from<number>({ length: page.columns }).fill(0);
    for (const { clicks, row, col } of cellMetrics) {
      if (row < heatmapRows.length) heatmapRows[row] = (heatmapRows[row] ?? 0) + clicks;
      if (col < heatmapCols.length) heatmapCols[col] = (heatmapCols[col] ?? 0) + clicks;
    }

    const topCells = [...cellMetrics]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 3)
      .map(({ cellId, clicks }) => ({ cellId, clicks }));

    pageAnalytics.push({
      pageId,
      title: page.title,
      totalClicks: pageClicks,
      totalImpressions: pageImpressions,
      ctr:
        pageImpressions > 0 ? (pageClicks / pageImpressions) * 100 : 0,
      activeCellCount,
      topCells,
      heatmapRows,
      heatmapCols,
    });
  }

  return {
    type: "analytics",
    data: {
      totalClicks,
      totalImpressions,
      ctr:
        totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      mostClickedPageTitle,
      mostClickedCellId,
      activeABTests,
      pages: pageAnalytics,
    },
    abTests,
  };
}

async function onGetSettings(): Promise<SettingsResponse> {
  const { isEditor } = await checkEditorAccess();
  if (!isEditor) throw new Error("not authorized");
  const editWhitelist = (await settings.get<string>("editWhitelist")) ?? "";
  return { type: "settings", editWhitelist };
}

async function onUpdateSettings(
  req: IncomingMessage,
): Promise<SettingsResponse> {
  const { isModerator } = await checkEditorAccess();
  if (!isModerator) throw new Error("not authorized");
  const { editWhitelist } = await readJSON<SettingsUpdateRequest>(req);
  // Settings are managed by Devvit's settings system; whitelist is stored in Redis
  // as a fallback since settings.set is not available in @devvit/settings
  const postId = getPostId();
  await redis.set(`whitelist_${postId}`, editWhitelist);
  return { type: "settings", editWhitelist };
}

async function onUploadImage(
  req: IncomingMessage,
): Promise<UploadImageResponse> {
  const { isEditor } = await checkEditorAccess();
  if (!isEditor) throw new Error("not authorized");
  const { dataUrl } = await readJSON<UploadImageRequest>(req);
  try {
    const { mediaUrl } = await media.upload({ url: dataUrl, type: "image" });
    return { mediaUrl };
  } catch {
    return { mediaUrl: dataUrl };
  }
}

async function onDeleteBoard(): Promise<DeleteResponse> {
  const { isModerator } = await checkEditorAccess();
  if (!isModerator) throw new Error("not authorized");
  const postId = getPostId();
  await redis.del(getBoardKey(postId));
  try {
    await reddit.remove(context.postId!, false);
  } catch {
    // Post removal failed; data already deleted
  }
  return { type: "delete" };
}

async function onMigrate(): Promise<MigrateResponse> {
  const { isEditor } = await checkEditorAccess();
  if (!isEditor) throw new Error("not authorized");
  const postId = getPostId();
  const linkerKey = getBoardKey(postId);

  const boardId = (await redis.hGet(linkerKey, "id")) ?? newId();
  const pageIdsStr = (await redis.hGet(linkerKey, "pageIds")) ?? "";
  const pageIds = pageIdsStr.split(",").filter((s) => s.length > 0);

  const pages: Record<string, Page> = {};
  const cells: Record<string, Cell> = {};
  const allCellKeys: string[] = [];

  for (const pageId of pageIds) {
    const pageKey = `page_${postId}_${pageId}`;
    const cellIdsStr = (await redis.hGet(pageKey, "cellIds")) ?? "";
    const cellIds = cellIdsStr.split(",").filter((s) => s.length > 0);

    pages[pageId] = {
      id: pageId,
      title: (await redis.hGet(pageKey, "title")) ?? "",
      backgroundColor: (await redis.hGet(pageKey, "backgroundColor")) ?? "#000000",
      foregroundColor: (await redis.hGet(pageKey, "foregroundColor")) ?? "#FFFFFF",
      backgroundImage: (await redis.hGet(pageKey, "backgroundImage")) ?? "",
      columns: parseInt((await redis.hGet(pageKey, "columns")) ?? "4", 10),
      cellIds,
    };

    for (const cellId of cellIds) {
      const cellKey = `cell_${postId}_${cellId}`;
      allCellKeys.push(cellKey);
      cells[cellId] = {
        id: cellId,
        displayName: (await redis.hGet(cellKey, "displayName")) ?? "",
        rotationEnabled: (await redis.hGet(cellKey, "rotationEnabled")) === "true",
        impressionCount: parseInt((await redis.hGet(cellKey, "impressionCount")) ?? "0", 10),
        currentEditingIndex: parseInt((await redis.hGet(cellKey, "currentEditingIndex")) ?? "0", 10),
        links: JSON.parse((await redis.hGet(cellKey, "links")) ?? "[]"),
        weights: JSON.parse((await redis.hGet(cellKey, "weights")) ?? "[]"),
        variantImpressions: JSON.parse((await redis.hGet(cellKey, "variantImpressions")) ?? "{}"),
      };
    }
  }

  const board: Board = { id: boardId, postId, pageIds };
  const boardState: BoardState = { board, pages, cells };

  const pageKeys = pageIds.map((pid) => `page_${postId}_${pid}`);
  await redis.del(linkerKey, ...pageKeys, ...allCellKeys);
  await saveBoardState(postId, boardState);

  return { type: "migrate", boardState };
}

// ─── Mod-removal cleanup ────────────────────────────────────────────────────

type ModActionPayload = {
  action?: string;
  targetPost?: { id?: string };
  modAction?: { action?: string; targetPost?: { id?: string } };
};

// Mod-removal actions we mirror by permanently deleting our own post.
const REMOVAL_ACTIONS = new Set(["removelink", "spamlink"]);

// Permanently author-deletes a Linker post and clears its orphaned Redis data.
// Shared by the live mod-action trigger and the on-upgrade backfill sweep.
async function deleteLinkerPost(postId: string): Promise<void> {
  try {
    const post = await reddit.getPostById(postId);
    await post.delete(); // author-delete — cannot be approved back
  } catch (err) {
    console.error(`deleteLinkerPost: delete failed for ${postId};`, err);
  }
  try {
    await redis.del(getBoardKey(postId), `whitelist_${postId}`);
  } catch (err) {
    console.error(`deleteLinkerPost: redis cleanup failed for ${postId};`, err);
  }
}

async function onModAction(
  req: IncomingMessage,
): Promise<{ status: number }> {
  const body = await readJSON<ModActionPayload>(req);
  // Payload may arrive flattened or wrapped under `modAction`.
  const event = body.modAction ?? body;
  const action = event.action;
  const postId = event.targetPost?.id;

  // This trigger fires for every mod action in the subreddit, so filter hard.
  if (!action || !REMOVAL_ACTIONS.has(action) || !postId) {
    return { status: 200 };
  }

  // Only act on our own Linker posts (those with a board in Redis).
  const boardState = await getBoardState(postId);
  if (!boardState) return { status: 200 };

  await deleteLinkerPost(postId);
  return { status: 200 };
}

// Backfill sweep run on app upgrade: the live trigger only catches removals
// going forward, so this catches posts moderators removed beforehand. Redis has
// no global key scan, so we discover past removals via the subreddit mod log.
async function onAppUpgrade(): Promise<{ status: number }> {
  const subredditName = context.subredditName;
  if (!subredditName) return { status: 200 };

  const ids = new Set<string>();
  for (const type of ["removelink", "spamlink"] as const) {
    try {
      const actions = await reddit
        .getModerationLog({ subredditName, type, limit: 1000 })
        .all();
      for (const a of actions) {
        if (a.target?.id) ids.add(a.target.id);
      }
    } catch (err) {
      console.error(`onAppUpgrade: mod log fetch failed (${type});`, err);
    }
  }

  for (const postId of ids) {
    // Only our posts (those with a board in Redis); skips already-cleaned ones.
    const boardState = await getBoardState(postId);
    if (!boardState) continue;
    await deleteLinkerPost(postId);
  }

  return { status: 200 };
}

function onMenuNewPost(): UiResponse {
  return {
    showForm: {
      name: "createDashboard",
      form: {
        title: "Create Community Dashboard",
        acceptLabel: "Create",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Post title",
            helpText: "Used as the post title and the first page title.",
            required: true,
            defaultValue: "Community Links",
          },
        ],
      },
    },
  };
}

async function onFormCreateDashboard(req: IncomingMessage): Promise<UiResponse> {
  const body = await readJSON<{
    title?: string;
    values?: { title?: string };
    results?: Record<string, { stringValue?: string }>;
  }>(req);
  const raw = (
    body.title ??
    body.values?.title ??
    body.results?.title?.stringValue ??
    ""
  ).trim();
  const title = raw.length > 0 ? raw : "Community Links";

  const post = await reddit.submitCustomPost({ title });
  const boardState = createBoardState(post.id, title);
  await saveBoardState(post.id, boardState);
  return {
    showToast: { text: "Community Links board created!", appearance: "success" },
    navigateTo: post.url,
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

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
  req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  await once(req, "end");
  return JSON.parse(`${Buffer.concat(chunks)}`) as T;
}
