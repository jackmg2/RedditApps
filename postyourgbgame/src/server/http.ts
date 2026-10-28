import type {IncomingMessage, ServerResponse} from 'node:http'
import type {PartialJsonValue} from '@devvit/web/shared'
import type {ErrorCode, ErrorRsp} from '../shared/api.ts'

/** Thrown by handlers; rendered as `{error, message}` with `status`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly extra: {existingPostUrl?: string}

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    extra: {existingPostUrl?: string} = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.extra = extra
  }

  toJson(): ErrorRsp {
    return {error: this.code, message: this.message, ...this.extra}
  }
}

export const defaultBodyLimit = 512 * 1024

/** Reads a JSON body, rejecting anything larger than `maxBytes`. */
export async function readJson<T>(
  req: IncomingMessage,
  maxBytes: number = defaultBodyLimit,
): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > maxBytes)
      throw new ApiError(413, 'BAD_REQUEST', 'Request body too large.')
    chunks.push(buf)
  }
  if (size === 0) return {} as T
  try {
    return JSON.parse(`${Buffer.concat(chunks)}`) as T
  } catch {
    throw new ApiError(400, 'BAD_REQUEST', 'Malformed JSON body.')
  }
}

export function writeJson(
  status: number,
  json: unknown,
  rsp: ServerResponse,
  headers: {[name: string]: string} = {},
): void {
  const body = JSON.stringify(json as PartialJsonValue)
  rsp.writeHead(status, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json',
    ...headers,
  })
  rsp.end(body)
}

const base64Re = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Strict base64 decode: canonical alphabet, correct padding, and a decoded
 * length equal to `expectedBytes` when given (spec §10).
 */
export function decodeBase64Strict(
  b64: unknown,
  expectedBytes?: number,
): Buffer | undefined {
  if (typeof b64 !== 'string' || b64.length % 4 !== 0 || !base64Re.test(b64))
    return
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  const decodedLen = (b64.length / 4) * 3 - pad
  if (expectedBytes !== undefined && decodedLen !== expectedBytes) return
  const buf = Buffer.from(b64, 'base64')
  return buf.length === decodedLen ? buf : undefined
}
