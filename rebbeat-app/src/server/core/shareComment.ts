// Pure helpers for the share-as-comment endpoint (unit tested, no Devvit imports).
import {
  DEFAULT_SHARE_MESSAGE,
  MAX_SHARE_MESSAGE_LENGTH,
} from '../../shared/api';
import { type Beat, formatBeatCode, trackNames } from '../../shared/beat';

/**
 * Plain-text message: one paragraph, at most 200 characters, and nothing that
 * markdown would turn into a heading, quote, list or code fence (a fence would
 * swallow the beat code block below it).
 */
export const sanitizeShareMessage = (raw: unknown): string => {
  const text = typeof raw === 'string' ? raw : '';
  const flat = text
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s#>*+-]+/, '')
    .trim();
  const clipped = Array.from(flat)
    .slice(0, MAX_SHARE_MESSAGE_LENGTH)
    .join('')
    .trim();
  return clipped || DEFAULT_SHARE_MESSAGE;
};

export const buildShareComment = (
  beat: Beat,
  message: string,
  username: string
): string => {
  const tracks = trackNames(beat).join(', ') || 'none';
  const length = beat.steps === 16 ? '' : `\n- Length: ${beat.steps} steps`;
  return `${message}

🥁 **Rebbeat** 🥁
- Tempo: ${beat.bpm} BPM
- Tracks: ${tracks}${length}
- Created by: u/${username}

**Beat code:**
\`\`\`
${formatBeatCode(beat)}
\`\`\`

*Copy the code above and use "Load" in the post to hear this beat!*`;
};
