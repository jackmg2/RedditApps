// Inline SVG icons (24px grid, 1.5px stroke, currentColor). Static markup
// only — safe to assign through innerHTML.
import type { InstrumentId } from '../shared/beat';

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

// Side view of a drum: top ellipse, body, lugs.
const drum = (rx: number, top: number, bottom: number): string => {
  const left = 12 - rx;
  return (
    `<ellipse cx="12" cy="${top}" rx="${rx}" ry="2.6"/>` +
    `<path d="M${left} ${top}V${bottom}a${rx} 2.6 0 0 0 ${2 * rx} 0V${top}"/>` +
    `<path d="M12 ${top + 2.6}V${bottom + 2.6}M${left + rx * 0.45} ${top + 2.2}V${bottom + 2.2}M${12 + rx * 0.55} ${top + 2.2}V${bottom + 2.2}"/>`
  );
};

const STAND = '<path d="M12 12v8M8.5 20.5h7"/>';

export const INSTRUMENT_ICONS: Record<InstrumentId, string> = {
  kick: svg(
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10.5" r="2.6"/><path d="M8.8 17.2l2-3.4M15.2 17.2l-2-3.4"/>'
  ),
  snare: svg(
    '<ellipse cx="12" cy="8" rx="8" ry="2.6"/><path d="M4 8v8a8 2.6 0 0 0 16 0V8"/><path d="M4.5 11.2l3.7 5.6 3.8-5 3.8 5 3.7-5.6"/>'
  ),
  clap: svg(
    '<rect x="5.2" y="9.5" width="5.6" height="11" rx="2.8" transform="rotate(-16 8 15)"/><rect x="13.2" y="9.5" width="5.6" height="11" rx="2.8" transform="rotate(16 16 15)"/><path d="M12 2.8v3M7.2 4.2l1.4 2.4M16.8 4.2l-1.4 2.4"/>'
  ),
  rim: svg(
    '<ellipse cx="12" cy="14" rx="8.5" ry="3"/><path d="M3.5 14v2.5a8.5 3 0 0 0 17 0V14"/><path d="M4 4.5l10.5 9"/>'
  ),
  hhc: svg(
    '<path d="M12 4v8"/><ellipse cx="12" cy="9.4" rx="8.5" ry="2.2"/><path d="M3.5 11.2a8.5 2.2 0 0 0 17 0"/>' +
      STAND
  ),
  hho: svg(
    '<path d="M12 3v9"/><ellipse cx="12" cy="6.5" rx="8.5" ry="2.2"/><ellipse cx="12" cy="11.5" rx="8.5" ry="2.2"/>' +
      STAND
  ),
  crash: svg(
    '<ellipse cx="12" cy="8.5" rx="9" ry="2.6" transform="rotate(-12 12 8.5)"/><circle cx="12" cy="8.3" r="1.2"/><path d="M12 11v9.5M8.5 20.5h7"/>'
  ),
  ride: svg(
    '<ellipse cx="12" cy="10" rx="9.5" ry="2.8"/><path d="M9.6 9.6a2.4 1.8 0 0 1 4.8 0"/><path d="M12 12.8v7.7M8.5 20.5h7"/>'
  ),
  tomL: svg(drum(8.5, 6, 16)),
  tomM: svg(drum(7, 7.5, 15)),
  tomH: svg(drum(5.5, 9, 14.5)),
  cowb: svg(
    '<path d="M8.6 5h6.8l3.4 13.2a1 1 0 0 1-1 1.3H6.2a1 1 0 0 1-1-1.3z"/><path d="M10.5 5V3h3v2"/><path d="M8 15.5h8"/>'
  ),
  shak: svg(
    '<ellipse cx="13" cy="13.5" rx="5.2" ry="7.6" transform="rotate(32 13 13.5)"/><path d="M4.8 6.4L3.2 4.8M8 4.6L7.4 2.6M3.4 9.6l-2-.6"/><circle cx="12" cy="13" r=".6"/><circle cx="14.6" cy="11" r=".6"/><circle cx="14" cy="15.4" r=".6"/>'
  ),
  clav: svg(
    '<rect x="2.5" y="10.8" width="19" height="2.6" rx="1.3" transform="rotate(-28 12 12)"/><rect x="2.5" y="10.8" width="19" height="2.6" rx="1.3" transform="rotate(28 12 12)"/>'
  ),
  bass: svg('<path d="M2.5 16L7.5 8v8l4.5-8v8l4.5-8v8l5-4"/>'),
  blip: svg(
    '<path d="M9 18V6.2l10-2V16"/><circle cx="6.6" cy="18" r="2.4"/><circle cx="16.6" cy="16" r="2.4"/>'
  ),
};

export const UI_ICONS = {
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  stop: svg(
    '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>'
  ),
  undo: svg(
    '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'
  ),
  redo: svg(
    '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  more: svg(
    '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'
  ),
  share: svg(
    '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'
  ),
  load: svg(
    '<path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'
  ),
  speaker: svg(
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'
  ),
  mute: svg(
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'
  ),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  trash: svg('<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>'),
};
