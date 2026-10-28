import type {IncomingMessage, ServerResponse} from 'node:http'
import {Internal} from '../shared/api.ts'
import {ApiError, writeJson} from './http.ts'
import {
  routeGetRom,
  routeGetSave,
  routePutSave,
  routeRomMeta,
  routeUpload,
  routeUploadConfig,
} from './routes/api.ts'
import {
  onFormBlocklist,
  onFormCreateRomPost,
  onMenuBlocklist,
  onMenuUpload,
  onSchedulerAccountSweep,
  onSchedulerDraftExpiry,
  onSweepRemovedAppPosts,
  onTriggerModAction,
  onTriggerPostDelete,
  onValidateMaxRomSize,
  onValidateMaxRomsPerUser,
  onValidateWikiPage,
} from './routes/internal.ts'

type Handler = (
  req: IncomingMessage,
  params: string[],
  query: URLSearchParams,
) => Promise<unknown> | unknown

type Route = {method: 'GET' | 'POST' | 'PUT'; path: RegExp; handler: Handler}

const t3 = '(t3_[a-z0-9]+)'

function exact(path: string): RegExp {
  return new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

const routes: Route[] = [
  // Player / upload (spec §6).
  {
    method: 'GET',
    path: new RegExp(`^/api/rom/${t3}/upload$`),
    handler: (_, [id]) => routeUploadConfig(id ?? ''),
  },
  {
    method: 'POST',
    path: new RegExp(`^/api/rom/${t3}/upload$`),
    handler: (req, [id]) => routeUpload(id ?? '', req),
  },
  {
    method: 'GET',
    path: new RegExp(`^/api/rom/${t3}/meta$`),
    handler: (_, [id]) => routeRomMeta(id ?? ''),
  },
  {
    method: 'GET',
    path: new RegExp(`^/api/rom/${t3}$`),
    handler: (_, [id]) => routeGetRom(id ?? ''),
  },
  {
    method: 'GET',
    path: new RegExp(`^/api/rom/${t3}/save$`),
    handler: (_, [id]) => routeGetSave(id ?? ''),
  },
  {
    method: 'PUT',
    path: new RegExp(`^/api/rom/${t3}/save$`),
    handler: (req, [id]) => routePutSave(id ?? '', req),
  },
  // Devvit-invoked.
  {
    method: 'POST',
    path: exact(Internal.MenuUpload),
    handler: () => onMenuUpload(),
  },
  {
    method: 'POST',
    path: exact(Internal.MenuBlocklist),
    handler: () => onMenuBlocklist(),
  },
  {
    method: 'POST',
    path: exact(Internal.FormCreateRomPost),
    handler: req => onFormCreateRomPost(req),
  },
  {
    method: 'POST',
    path: exact(Internal.FormBlocklist),
    handler: req => onFormBlocklist(req),
  },
  {
    method: 'POST',
    path: exact(Internal.TriggerPostDelete),
    handler: req => onTriggerPostDelete(req),
  },
  {
    method: 'POST',
    path: exact(Internal.TriggerModAction),
    handler: req => onTriggerModAction(req),
  },
  {
    method: 'POST',
    path: exact(Internal.TriggerAppUpgrade),
    handler: () => onSweepRemovedAppPosts(),
  },
  {
    method: 'POST',
    path: exact(Internal.SchedulerAccountSweep),
    handler: () => onSchedulerAccountSweep(),
  },
  {
    method: 'POST',
    path: exact(Internal.SchedulerRemovedPostsSweep),
    handler: () => onSweepRemovedAppPosts(),
  },
  {
    method: 'POST',
    path: exact(Internal.SchedulerDraftExpiry),
    handler: req => onSchedulerDraftExpiry(req),
  },
  {
    method: 'POST',
    path: exact(Internal.ValidateMaxRomSize),
    handler: req => onValidateMaxRomSize(req),
  },
  {
    method: 'POST',
    path: exact(Internal.ValidateMaxRomsPerUser),
    handler: req => onValidateMaxRomsPerUser(req),
  },
  {
    method: 'POST',
    path: exact(Internal.ValidateWikiPage),
    handler: req => onValidateWikiPage(req),
  },
]

export async function onReq(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const matches = routes
      .map(route => ({route, m: route.path.exec(url.pathname)}))
      .filter(({m}) => m)
    const hit = matches.find(({route}) => route.method === req.method)
    if (!hit) {
      writeJson(
        matches.length ? 405 : 404,
        {error: 'NOT_FOUND', message: 'not found'},
        rsp,
      )
      return
    }
    const params = hit.m?.slice(1) ?? []
    const result = await hit.route.handler(req, params, url.searchParams)
    // ROM bytes and saves are cached in memory by the client only.
    writeJson(200, result ?? {}, rsp, {'Cache-Control': 'no-store'})
  } catch (err) {
    if (err instanceof ApiError) {
      writeJson(err.status, err.toJson(), rsp)
      return
    }
    console.error(`server error; ${err instanceof Error ? err.stack : err}`)
    writeJson(
      500,
      {error: 'SERVER_ERROR', message: 'Something went wrong.'},
      rsp,
    )
  }
}
