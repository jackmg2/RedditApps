// Typed fetch wrappers for the server /api routes.
import type {
  InitResponse,
  SetDefaultBeatRequest,
  SetDefaultBeatResponse,
  ShareBeatRequest,
  ShareBeatResponse,
} from '../shared/api';

// Carries the server's `{ status: 'error', message }` text when there is one.
export class ApiError extends Error {}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Request to ${url} failed with status ${res.status}`;
    try {
      const body: unknown = await res.json();
      if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
      ) {
        message = body.message;
      }
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(message);
  }
  return res.json();
};

const postJson = async <T>(url: string, body?: unknown): Promise<T> =>
  request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });

export const fetchInit = async (): Promise<InitResponse> =>
  request('/api/init');

export const shareBeat = async (
  req: ShareBeatRequest
): Promise<ShareBeatResponse> => postJson('/api/beat/share', req);

export const setDefaultBeat = async (
  req: SetDefaultBeatRequest
): Promise<SetDefaultBeatResponse> => postJson('/api/beat/default', req);
