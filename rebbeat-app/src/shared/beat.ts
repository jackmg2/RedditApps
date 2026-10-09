// Beat model and the BB1 share code. Shared by the client (UI, draft
// storage, Load) and the server (validates codes before posting a comment).

// Palette order (spec §6): 4 per row in the instrument picker.
export const INSTRUMENT_IDS = [
  'kick',
  'snare',
  'clap',
  'rim',
  'hhc',
  'hho',
  'crash',
  'ride',
  'tomL',
  'tomM',
  'tomH',
  'cowb',
  'shak',
  'clav',
  'bass',
  'blip',
] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export const INSTRUMENT_NAMES: Record<InstrumentId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  rim: 'Rimshot',
  hhc: 'Closed hat',
  hho: 'Open hat',
  crash: 'Crash',
  ride: 'Ride',
  tomL: 'Low tom',
  tomM: 'Mid tom',
  tomH: 'High tom',
  cowb: 'Cowbell',
  shak: 'Shaker',
  clav: 'Clave',
  bass: 'Bass pluck',
  blip: 'Blip',
};

export const STEP_COUNTS = [16, 32] as const;
export type StepCount = (typeof STEP_COUNTS)[number];

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 120;
export const MAX_TRACKS = 8;
export const MAX_CODE_LENGTH = 200;
export const CODE_TAG = 'BB1';

export type Track = {
  instrument: InstrumentId;
  steps: boolean[]; // length === Beat.steps
  muted: boolean; // UI only, never serialized
};

export type Beat = {
  version: 1;
  bpm: number; // MIN_BPM..MAX_BPM integer
  steps: StepCount;
  tracks: Track[]; // 0..MAX_TRACKS
};

// Lower-cased lookup so `TOML:…` or `Kick:…` still resolve to a known id.
const ID_BY_LOWER = new Map<string, InstrumentId>(
  INSTRUMENT_IDS.map((id) => [id.toLowerCase(), id])
);

export const isInstrumentId = (value: string): value is InstrumentId =>
  ID_BY_LOWER.get(value.toLowerCase()) === value;

export const isStepCount = (value: number): value is StepCount =>
  value === 16 || value === 32;

export const clampBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

export const createTrack = (
  instrument: InstrumentId,
  steps: StepCount,
  active: readonly number[] = []
): Track => {
  const cells = new Array<boolean>(steps).fill(false);
  for (const i of active) {
    if (i >= 0 && i < steps) cells[i] = true;
  }
  return { instrument, steps: cells, muted: false };
};

// Starter kit (spec §11 decision): a short demo beat members can edit right away.
export const createStarterBeat = (): Beat => ({
  version: 1,
  bpm: DEFAULT_BPM,
  steps: 16,
  tracks: [
    createTrack('kick', 16, [0, 4, 8, 10, 12]),
    createTrack('snare', 16, [4, 12]),
    createTrack('hhc', 16, [0, 2, 4, 6, 8, 10, 12, 14]),
  ],
});

export const hasActiveStep = (beat: Beat): boolean =>
  beat.tracks.some((t) => t.steps.some(Boolean));

export const countActiveSteps = (beat: Beat): number =>
  beat.tracks.reduce((n, t) => n + t.steps.filter(Boolean).length, 0);

export const cloneBeat = (beat: Beat): Beat => ({
  ...beat,
  tracks: beat.tracks.map((t) => ({ ...t, steps: [...t.steps] })),
});

/**
 * Change a track's pattern length. Growing repeats the existing pattern so
 * the loop sounds the same; shrinking keeps the first `steps` cells.
 */
export const resizeSteps = (
  cells: readonly boolean[],
  steps: StepCount
): boolean[] =>
  Array.from(
    { length: steps },
    (_, i) => (cells.length > 0 ? cells[i % cells.length] : false) ?? false
  );

export const resizeBeat = (beat: Beat, steps: StepCount): Beat => ({
  ...beat,
  steps,
  tracks: beat.tracks.map((t) => ({
    ...t,
    steps: resizeSteps(t.steps, steps),
  })),
});

export const trackNames = (beat: Beat): string[] =>
  beat.tracks.map((t) => INSTRUMENT_NAMES[t.instrument]);

// ---------------------------------------------------------------------------
// BB1 share code:  BB1;<bpm>;<steps>;<inst>:<hex>[;<inst>:<hex>]*
// Hex digit k covers steps 4k..4k+3, most significant bit first, so `8888`
// is a hit on every beat and the leftmost digit is steps 1–4.
// ---------------------------------------------------------------------------

const stepsToHex = (steps: readonly boolean[]): string => {
  let hex = '';
  for (let k = 0; k < steps.length; k += 4) {
    let digit = 0;
    for (let j = 0; j < 4; j++) {
      if (steps[k + j]) digit |= 8 >> j;
    }
    hex += digit.toString(16);
  }
  return hex;
};

const hexToSteps = (hex: string, steps: StepCount): boolean[] | null => {
  if (hex.length !== steps / 4 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const cells: boolean[] = [];
  for (const ch of hex) {
    const digit = parseInt(ch, 16);
    for (let j = 0; j < 4; j++) cells.push((digit & (8 >> j)) !== 0);
  }
  return cells;
};

export const formatBeatCode = (beat: Beat): string =>
  [
    CODE_TAG,
    String(beat.bpm),
    String(beat.steps),
    ...beat.tracks.map((t) => `${t.instrument}:${stepsToHex(t.steps)}`),
  ].join(';');

// Finds the first code-looking token. Segments are alphanumeric (with an
// optional `:` part) separated by `;`, with whitespace tolerated around the
// separators, so a code wrapped by a phone or pasted with its whole comment
// (fences, prose before and after) is still found. Anything inside a segment
// that is not alphanumeric ends the token; validation below then decides.
const TOKEN_RE = /BB\d+(?:\s*;\s*[A-Za-z0-9]+(?::[A-Za-z0-9]+)?)*/i;

const isUintString = (s: string): boolean => /^\d{1,4}$/.test(s);

export const parseBeatCode = (text: string): Beat | null => {
  const match = TOKEN_RE.exec(text);
  if (!match) return null;
  // A token cut mid-segment (`kick:8888:1`, `kick:8888/8080`) is not a BB1
  // code with trailing prose: reject it rather than drop part of a track.
  const next = text.charAt(match.index + match[0].length);
  if (/[A-Za-z0-9:/]/.test(next)) return null;

  const code = match[0].replace(/\s+/g, '');
  if (code.length > MAX_CODE_LENGTH) return null;

  const [tag, bpmText, stepsText, ...trackParts] = code.split(';');
  // A BB1 parser must reject other versions rather than guess.
  if (tag?.toUpperCase() !== CODE_TAG) return null;
  if (bpmText === undefined || stepsText === undefined) return null;
  if (!isUintString(bpmText) || !isUintString(stepsText)) return null;

  const bpm = Number(bpmText);
  const steps = Number(stepsText);
  if (bpm < MIN_BPM || bpm > MAX_BPM || !isStepCount(steps)) return null;
  if (trackParts.length > MAX_TRACKS) return null;

  const tracks: Track[] = [];
  for (const part of trackParts) {
    const [rawId, hex, ...rest] = part.split(':');
    if (rawId === undefined || hex === undefined || rest.length > 0)
      return null;
    // Unknown instruments invalidate the whole code: no silent dropping.
    const instrument = ID_BY_LOWER.get(rawId.toLowerCase());
    if (!instrument) return null;
    const cells = hexToSteps(hex, steps);
    if (!cells) return null;
    tracks.push({ instrument, steps: cells, muted: false });
  }

  return { version: 1, bpm, steps, tracks };
};
