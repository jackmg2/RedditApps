export type InstrumentSide = 'left' | 'right';

export type CompositionFrame = {
  timestamp: number; // ms offset from recording start
  noteIndex: number; // 0-7 segment index
  side: InstrumentSide;
  octave: number;
};

export type CompositionExport = {
  version: string; // '1.0' — embedded in shared base64 codes, do not change
  created: number;
  duration: number; // ms
  frameCount: number;
  data: CompositionFrame[];
};

export type ScaleName =
  | 'chromatic'
  | 'major'
  | 'minor'
  | 'pentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian';

// GET /api/init
export type InitResponse = {
  type: 'init';
  postId: string;
  favoriteNotes: string[];
};

// POST /api/favorites/save
export type SaveFavoriteRequest = { note: string; action: 'add' | 'remove' };
// POST /api/favorites/update
export type UpdateFavoritesRequest = { favoriteNotes: string[] };
// POST /api/favorites/clear takes no body. All three respond with:
export type FavoritesResponse = { type: 'favorites'; favoriteNotes: string[] };

// POST /api/composition/save
export type SaveCompositionRequest = { composition: CompositionExport };
export type SaveCompositionResponse = { type: 'compositionSaved' };

// POST /api/composition/share
export type ShareCompositionRequest = {
  encodedComposition: string; // base64(JSON(CompositionExport))
  message: string;
  duration: number; // ms
  noteCount: number;
  scale: ScaleName;
  scaleDisplayName: string;
  octave: number;
};
export type ShareCompositionResponse = {
  type: 'compositionShared';
  commentId: string;
};

export type ApiErrorResponse = { status: 'error'; message: string };
