import { type Beat, formatBeatCode, trackNames } from '../../shared/beat';

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
