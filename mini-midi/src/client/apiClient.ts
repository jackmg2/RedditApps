// Typed fetch wrappers for the server /api routes.
import type {
  CompositionExport,
  FavoritesResponse,
  InitResponse,
  SaveCompositionResponse,
  SaveFavoriteRequest,
  ShareCompositionRequest,
  ShareCompositionResponse,
  UpdateFavoritesRequest,
} from '../shared/api';

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
};

const postJson = async <T>(url: string, body?: unknown): Promise<T> =>
  request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });

export const fetchInit = async (): Promise<InitResponse> => request('/api/init');

export const saveFavorite = async (req: SaveFavoriteRequest): Promise<FavoritesResponse> =>
  postJson('/api/favorites/save', req);

export const updateFavorites = async (req: UpdateFavoritesRequest): Promise<FavoritesResponse> =>
  postJson('/api/favorites/update', req);

export const clearFavorites = async (): Promise<FavoritesResponse> =>
  postJson('/api/favorites/clear');

export const saveComposition = async (
  composition: CompositionExport
): Promise<SaveCompositionResponse> => postJson('/api/composition/save', { composition });

export const shareComposition = async (
  req: ShareCompositionRequest
): Promise<ShareCompositionResponse> => postJson('/api/composition/share', req);
