import type {ErrorRsp} from '../../shared/api.ts'

export type ApiResult<T> =
  | {ok: true; data: T}
  | {ok: false; status: number; error: ErrorRsp}

/** JSON fetch against the app server; never throws. */
export async function api<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  opts: {keepalive?: boolean} = {},
): Promise<ApiResult<T>> {
  let rsp: Response
  try {
    rsp = await fetch(path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      ...(opts.keepalive ? {keepalive: true} : {}),
    })
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: {
        error: 'SERVER_ERROR',
        message: `Network error: ${err instanceof Error ? err.message : err}`,
      },
    }
  }

  let json: unknown
  try {
    json = await rsp.json()
  } catch {
    json = undefined
  }
  if (rsp.ok) return {ok: true, data: json as T}
  const error =
    json && typeof json === 'object' && 'error' in json
      ? (json as ErrorRsp)
      : ({
          error: 'SERVER_ERROR',
          message: `HTTP ${rsp.status} ${rsp.statusText}`,
        } satisfies ErrorRsp)
  return {ok: false, status: rsp.status, error}
}
