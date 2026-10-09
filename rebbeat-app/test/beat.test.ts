import { describe, expect, it } from 'vitest';
import {
  type Beat,
  INSTRUMENT_IDS,
  MAX_CODE_LENGTH,
  createStarterBeat,
  createTrack,
  formatBeatCode,
  hasActiveStep,
  parseBeatCode,
  resizeBeat,
} from '../src/shared/beat';

const beat = (overrides: Partial<Beat> = {}): Beat => ({
  version: 1,
  bpm: 140,
  steps: 16,
  tracks: [
    createTrack('kick', 16, [0, 4, 8, 12]),
    createTrack('snare', 16, [4, 12]),
    createTrack('hhc', 16, [0, 2, 4, 6, 8, 10, 12, 14]),
    createTrack('cowb', 16, [7]),
  ],
  ...overrides,
});

describe('formatBeatCode', () => {
  it('encodes steps most-significant-bit first, one hex digit per 4 steps', () => {
    expect(formatBeatCode(beat())).toBe(
      'BB1;140;16;kick:8888;snare:0808;hhc:aaaa;cowb:0100'
    );
  });

  it('encodes 32-step patterns with 8 hex digits', () => {
    const long = beat({
      steps: 32,
      tracks: [createTrack('kick', 32, [0, 31])],
    });
    expect(formatBeatCode(long)).toBe('BB1;140;32;kick:80000001');
  });

  it('never serializes mute', () => {
    const b = beat();
    const first = b.tracks[0];
    if (first) first.muted = true;
    expect(formatBeatCode(b)).toBe(formatBeatCode(beat()));
  });

  it('keeps the largest possible beat under the length limit', () => {
    const big = beat({
      bpm: 240,
      steps: 32,
      tracks: Array.from({ length: 8 }, () => createTrack('tomM', 32, [0])),
    });
    expect(formatBeatCode(big).length).toBeLessThanOrEqual(MAX_CODE_LENGTH);
  });
});

describe('parseBeatCode', () => {
  it('round-trips with formatBeatCode', () => {
    const code = formatBeatCode(beat());
    const parsed = parseBeatCode(code);
    expect(parsed).not.toBeNull();
    expect(parsed && formatBeatCode(parsed)).toBe(code);
    expect(parsed?.tracks.every((t) => !t.muted)).toBe(true);
  });

  it('round-trips every instrument', () => {
    for (const id of INSTRUMENT_IDS) {
      const code = `BB1;100;16;${id}:f00f`;
      expect(parseBeatCode(code)?.tracks[0]?.instrument).toBe(id);
    }
  });

  it('reads the spec example', () => {
    const parsed = parseBeatCode(
      'BB1;140;16;kick:8a8a;snare:0808;hhc:ffff;cowb:0100'
    );
    expect(parsed?.bpm).toBe(140);
    expect(parsed?.tracks.map((t) => t.instrument)).toEqual([
      'kick',
      'snare',
      'hhc',
      'cowb',
    ]);
    expect(parsed?.tracks[0]?.steps.slice(0, 8)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('accepts upper-case hex and loose instrument case', () => {
    expect(
      parseBeatCode('BB1;120;16;KICK:AAAA;toml:F000')?.tracks.map(
        (t) => t.instrument
      )
    ).toEqual(['kick', 'tomL']);
  });

  it('extracts the code from a whole pasted comment', () => {
    const comment = [
      'Check out my beat! 🥁',
      '',
      '🥁 **Rebbeat** 🥁',
      '- Tempo: 140 BPM',
      '',
      '**Beat code:**',
      '```',
      'BB1;140;16;kick:8888;snare:0808',
      '```',
      '',
      '*Copy the code above and use "Load" in the post to hear this beat!*',
    ].join('\n');
    expect(parseBeatCode(comment)?.tracks).toHaveLength(2);
  });

  it('ignores surrounding backticks and whitespace, including wrapped lines', () => {
    expect(parseBeatCode('  `BB1;120;16;kick:8888`  ')?.bpm).toBe(120);
    expect(
      parseBeatCode('BB1;120;16;kick:8888;\n  snare:0808')?.tracks
    ).toHaveLength(2);
  });

  it('accepts a code with no tracks', () => {
    expect(parseBeatCode('BB1;90;16')?.tracks).toEqual([]);
  });

  it.each([
    ['empty text', ''],
    ['prose only', 'nice beat!'],
    ['unknown version tag', 'BB2;120;16;kick:8888'],
    ['bpm too low', 'BB1;39;16;kick:8888'],
    ['bpm too high', 'BB1;241;16;kick:8888'],
    ['non-integer bpm', 'BB1;12a;16;kick:8888'],
    ['unsupported step count', 'BB1;120;8;kick:88'],
    ['unknown instrument', 'BB1;120;16;kick:8888;gong:8888'],
    ['hex too short', 'BB1;120;16;kick:888'],
    ['hex too long', 'BB1;120;16;kick:88888'],
    ['non-hex digits', 'BB1;120;16;kick:88zz'],
    ['missing hex', 'BB1;120;16;kick'],
    ['extra colon part', 'BB1;120;16;kick:8888:1'],
    ['reserved accent group (not BB1)', 'BB1;120;16;kick:8888/8080'],
    [
      'too many tracks',
      `BB1;120;16;${Array.from({ length: 9 }, () => 'kick:8888').join(';')}`,
    ],
    ['missing steps', 'BB1;120'],
    ['32 steps with 16-step hex', 'BB1;120;32;kick:8888'],
  ])('rejects %s', (_label, text) => {
    expect(parseBeatCode(text)).toBeNull();
  });

  it('rejects codes over the length limit', () => {
    const padded = `BB1;120;16;kick:8888;${'x'.repeat(MAX_CODE_LENGTH)}`;
    expect(parseBeatCode(padded)).toBeNull();
  });
});

describe('helpers', () => {
  it('starter beat is a playable 16-step demo', () => {
    const starter = createStarterBeat();
    expect(starter.steps).toBe(16);
    expect(starter.tracks.map((t) => t.instrument)).toEqual([
      'kick',
      'snare',
      'hhc',
    ]);
    expect(hasActiveStep(starter)).toBe(true);
    expect(parseBeatCode(formatBeatCode(starter))).not.toBeNull();
  });

  it('hasActiveStep is false for an empty grid', () => {
    expect(hasActiveStep(beat({ tracks: [createTrack('kick', 16)] }))).toBe(
      false
    );
    expect(hasActiveStep(beat({ tracks: [] }))).toBe(false);
  });

  it('resizing 16 → 32 repeats the pattern, 32 → 16 keeps the first half', () => {
    const grown = resizeBeat(beat(), 32);
    expect(formatBeatCode(grown)).toBe(
      'BB1;140;32;kick:88888888;snare:08080808;hhc:aaaaaaaa;cowb:01000100'
    );
    const shrunk = resizeBeat(
      beat({ steps: 32, tracks: [createTrack('kick', 32, [0, 20])] }),
      16
    );
    expect(formatBeatCode(shrunk)).toBe('BB1;140;16;kick:8000');
  });
});
