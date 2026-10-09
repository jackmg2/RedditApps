import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHARE_MESSAGE,
  MAX_SHARE_MESSAGE_LENGTH,
} from '../src/shared/api';
import { createTrack, parseBeatCode } from '../src/shared/beat';
import {
  buildShareComment,
  sanitizeShareMessage,
} from '../src/server/core/shareComment';

describe('sanitizeShareMessage', () => {
  it('falls back to the default message', () => {
    expect(sanitizeShareMessage('')).toBe(DEFAULT_SHARE_MESSAGE);
    expect(sanitizeShareMessage('   ')).toBe(DEFAULT_SHARE_MESSAGE);
    expect(sanitizeShareMessage(undefined)).toBe(DEFAULT_SHARE_MESSAGE);
    expect(sanitizeShareMessage(42)).toBe(DEFAULT_SHARE_MESSAGE);
    expect(sanitizeShareMessage('# > -')).toBe(DEFAULT_SHARE_MESSAGE);
  });

  it('strips leading heading, quote and list markers', () => {
    expect(sanitizeShareMessage('# Big title')).toBe('Big title');
    expect(sanitizeShareMessage('> quoted')).toBe('quoted');
    expect(sanitizeShareMessage('- item')).toBe('item');
    expect(sanitizeShareMessage('  ##>- mixed')).toBe('mixed');
  });

  it('flattens newlines so later lines cannot become markdown blocks', () => {
    expect(sanitizeShareMessage('first line\n# heading\n> quote')).toBe(
      'first line # heading > quote'
    );
  });

  it('removes backticks so a fence cannot swallow the beat code', () => {
    expect(sanitizeShareMessage('```oops')).toBe("'''oops");
  });

  it('clips to 200 characters without splitting emoji', () => {
    const long = '🥁'.repeat(250);
    const clipped = sanitizeShareMessage(long);
    expect(Array.from(clipped)).toHaveLength(MAX_SHARE_MESSAGE_LENGTH);
    expect(clipped.startsWith('🥁')).toBe(true);
  });
});

describe('buildShareComment', () => {
  it('lays out the comment as specified', () => {
    const beat = parseBeatCode(
      'BB1;140;16;kick:8888;snare:0808;hhc:aaaa;cowb:0100'
    );
    if (!beat) throw new Error('fixture failed to parse');
    expect(buildShareComment(beat, 'Hello', 'drummer')).toBe(
      [
        'Hello',
        '',
        '🥁 **Rebbeat** 🥁',
        '- Tempo: 140 BPM',
        '- Tracks: Kick, Snare, Closed hat, Cowbell',
        '- Created by: u/drummer',
        '',
        '**Beat code:**',
        '```',
        'BB1;140;16;kick:8888;snare:0808;hhc:aaaa;cowb:0100',
        '```',
        '',
        '*Copy the code above and use "Load" in the post to hear this beat!*',
      ].join('\n')
    );
  });

  it('mentions the length for 32-step beats and round-trips through the parser', () => {
    const beat = {
      version: 1 as const,
      bpm: 100,
      steps: 32 as const,
      tracks: [createTrack('clap', 32, [4])],
    };
    const text = buildShareComment(beat, 'x', 'u');
    expect(text).toContain('- Length: 32 steps');
    expect(parseBeatCode(text)?.steps).toBe(32);
  });
});
