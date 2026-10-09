// Rebbeat UI: grid rendering, transport, modals, undo/redo and the
// localStorage draft. Audio lives in drumSynth.ts, timing in sequencer.ts.
import { context } from '@devvit/web/client';
import { MAX_SHARE_MESSAGE_LENGTH } from '../shared/api';
import {
  type Beat,
  type InstrumentId,
  INSTRUMENT_IDS,
  INSTRUMENT_NAMES,
  MAX_TRACKS,
  type StepCount,
  type Track,
  clampBpm,
  createStarterBeat,
  createTrack,
  formatBeatCode,
  hasActiveStep,
  parseBeatCode,
  resizeSteps,
} from '../shared/beat';
import { fetchInit, setDefaultBeat, shareBeat } from './apiClient';
import { byId } from './dom';
import { DrumSynth } from './drumSynth';
import { INSTRUMENT_ICONS, UI_ICONS } from './icons';
import {
  type SequencedBeat,
  type SequencedTrack,
  Sequencer,
} from './sequencer';

const HISTORY_LIMIT = 50;
const COALESCE_MS = 1000; // −/+ and long-press BPM changes merge into one undo entry
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 70;
const DRAFT_PREFIX = 'Rebbeat:draft:';

type UiTrack = SequencedTrack;
type UiBeat = SequencedBeat;
type ToastKind = 'info' | 'success' | 'error';
type EditOptions = { coalesce?: string; rerender?: boolean };

let nextTrackId = 1;

const toUiTrack = (t: Track): UiTrack => ({
  id: nextTrackId++,
  instrument: t.instrument,
  steps: [...t.steps],
  muted: t.muted,
});

const toUiBeat = (b: Beat): UiBeat => ({
  version: 1,
  bpm: b.bpm,
  steps: b.steps,
  tracks: b.tracks.map(toUiTrack),
});

const cloneUi = (b: UiBeat): UiBeat => ({
  ...b,
  tracks: b.tracks.map((t) => ({ ...t, steps: [...t.steps] })),
});

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatElapsed = (seconds: number): string => {
  const cs = Math.floor(seconds * 100);
  return `${pad2(Math.floor(cs / 6000) % 100)}:${pad2(Math.floor(cs / 100) % 60)}:${pad2(cs % 100)}`;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const isUiIcon = (name: string): name is keyof typeof UI_ICONS =>
  name in UI_ICONS;

const currentPostId = (): string => {
  try {
    return context.postId || 'local';
  } catch {
    return 'local';
  }
};

export class BeatApp {
  private beat: UiBeat;
  private readonly synth = new DrumSynth();
  private readonly sequencer: Sequencer;
  private readonly draftKey = DRAFT_PREFIX + currentPostId();

  private undoStack: UiBeat[] = [];
  private redoStack: UiBeat[] = [];
  private lastCoalesce: string | undefined;
  private lastEditAt = 0;

  private canShare = false;
  private canSetDefault = false;
  private audioFailed = false;
  private sharing = false;
  private savingDefault = false;
  /** The post's moderator-set default beat (BB1), or null for the starter kit. */
  private defaultCode: string | null = null;
  /** The opening beat came from this member's draft, not the post default. */
  private readonly fromDraft: boolean;

  private cellEls: HTMLButtonElement[][] = [];
  private stepLabels: HTMLElement[] = [];
  private meterBars: HTMLElement[] = [];
  private shownStep = -1;
  private rafId = 0;
  private activeRow = -1;
  private focusPos = { track: 0, step: 0 };
  private menuTrackId: number | null = null;
  private openModalEl: HTMLElement | null = null;
  private returnFocus: HTMLElement | null = null;
  private repeatTimer: ReturnType<typeof setTimeout> | undefined;
  private bpmEditing = false;

  private readonly els = {
    playBtn: byId('playBtn', HTMLButtonElement),
    elapsed: byId('elapsed', HTMLSpanElement),
    meter: byId('meter', HTMLDivElement),
    bpmDown: byId('bpmDown', HTMLButtonElement),
    bpmUp: byId('bpmUp', HTMLButtonElement),
    bpmValue: byId('bpmValue', HTMLButtonElement),
    bpmInput: byId('bpmInput', HTMLInputElement),
    undoBtn: byId('undoBtn', HTMLButtonElement),
    redoBtn: byId('redoBtn', HTMLButtonElement),
    steps16: byId('steps16', HTMLButtonElement),
    steps32: byId('steps32', HTMLButtonElement),
    loadBtn: byId('loadBtn', HTMLButtonElement),
    shareBtn: byId('shareBtn', HTMLButtonElement),
    moreBtn: byId('moreBtn', HTMLButtonElement),
    moreMenu: byId('moreMenu', HTMLDivElement),
    clearBtn: byId('clearBtn', HTMLButtonElement),
    loadDefaultBtn: byId('loadDefaultBtn', HTMLButtonElement),
    setDefaultBtn: byId('setDefaultBtn', HTMLButtonElement),
    resetDefaultBtn: byId('resetDefaultBtn', HTMLButtonElement),
    gridScroll: byId('gridScroll', HTMLDivElement),
    grid: byId('grid', HTMLDivElement),
    pickerModal: byId('pickerModal', HTMLDivElement),
    pickerGrid: byId('pickerGrid', HTMLDivElement),
    trackModal: byId('trackModal', HTMLDivElement),
    trackTitle: byId('trackTitle', HTMLDivElement),
    trackPreview: byId('trackPreview', HTMLButtonElement),
    trackMute: byId('trackMute', HTMLButtonElement),
    trackMuteLabel: byId('trackMuteLabel', HTMLSpanElement),
    trackUp: byId('trackUp', HTMLButtonElement),
    trackDown: byId('trackDown', HTMLButtonElement),
    trackRemove: byId('trackRemove', HTMLButtonElement),
    shareModal: byId('shareModal', HTMLDivElement),
    shareCode: byId('shareCode', HTMLTextAreaElement),
    copyBtn: byId('copyBtn', HTMLButtonElement),
    commentSection: byId('commentSection', HTMLDivElement),
    shareMessage: byId('shareMessage', HTMLTextAreaElement),
    shareCount: byId('shareCount', HTMLSpanElement),
    postCommentBtn: byId('postCommentBtn', HTMLButtonElement),
    loadModal: byId('loadModal', HTMLDivElement),
    loadCode: byId('loadCode', HTMLTextAreaElement),
    confirmLoadBtn: byId('confirmLoadBtn', HTMLButtonElement),
    toasts: byId('toastContainer', HTMLDivElement),
  };

  constructor() {
    const draft = this.loadDraft();
    this.fromDraft = draft !== null;
    this.beat = draft ?? toUiBeat(createStarterBeat());
    this.sequencer = new Sequencer(this.synth, () => this.beat);

    this.injectIcons();
    this.buildPicker();
    this.renderGrid();
    this.renderTransport();
    this.bindEvents();

    void this.loadInit();
  }

  // ---------------------------------------------------------------------------
  // Server + persistence
  // ---------------------------------------------------------------------------

  private async loadInit(): Promise<void> {
    try {
      const init = await fetchInit();
      this.canShare = init.canShare;
      this.canSetDefault = init.canSetDefault;
      this.defaultCode = init.defaultBeat;
      this.renderDefaultMenu();
      this.showPostDefault();
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  /** The beat a fresh visitor starts from: the post default, else the starter kit. */
  private defaultBeat(): UiBeat {
    const parsed = this.defaultCode ? parseBeatCode(this.defaultCode) : null;
    return toUiBeat(parsed ?? createStarterBeat());
  }

  /**
   * A first-time visitor opened on the starter kit while /init was loading.
   * Swap in the post's default unless they already touched the grid. Not an
   * edit and not saved as a draft, so a later default change still reaches them.
   */
  private showPostDefault(): void {
    if (this.fromDraft || this.undoStack.length > 0 || !this.defaultCode)
      return;
    this.beat = this.defaultBeat();
    this.activeRow = -1;
    this.focusPos = { track: 0, step: 0 };
    this.renderGrid();
    this.renderTransport();
    this.synth.pruneTracks(new Set(this.beat.tracks.map((t) => t.id)));
  }

  private renderDefaultMenu(): void {
    this.els.setDefaultBtn.hidden = !this.canSetDefault;
    this.els.resetDefaultBtn.hidden =
      !this.canSetDefault || this.defaultCode === null;
  }

  // The working beat survives an accidental close. Browser storage can be
  // unavailable (private mode, blocked site data), so every access is guarded.
  private saveDraft(): void {
    try {
      localStorage.setItem(
        this.draftKey,
        JSON.stringify({
          code: formatBeatCode(this.beat),
          muted: this.beat.tracks.map((t) => t.muted),
        })
      );
    } catch {
      // Draft is a convenience only.
    }
  }

  private loadDraft(): UiBeat | null {
    try {
      const raw = localStorage.getItem(this.draftKey);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (
        !data ||
        typeof data !== 'object' ||
        !('code' in data) ||
        typeof data.code !== 'string'
      ) {
        return null;
      }
      const parsed = parseBeatCode(data.code);
      if (!parsed) return null;
      const muted =
        'muted' in data && Array.isArray(data.muted) ? data.muted : [];
      parsed.tracks.forEach((t, i) => {
        t.muted = muted[i] === true;
      });
      return toUiBeat(parsed);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Editing + history
  // ---------------------------------------------------------------------------

  private edit(
    mutate: () => void,
    { coalesce, rerender = true }: EditOptions = {}
  ): void {
    const now = performance.now();
    const merge =
      coalesce !== undefined &&
      coalesce === this.lastCoalesce &&
      now - this.lastEditAt < COALESCE_MS;
    if (!merge) {
      this.undoStack.push(cloneUi(this.beat));
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastCoalesce = coalesce;
    this.lastEditAt = now;
    mutate();
    this.afterChange(rerender);
  }

  private afterChange(rerender: boolean): void {
    if (rerender) this.renderGrid();
    this.renderTransport();
    this.saveDraft();
    this.synth.pruneTracks(new Set(this.beat.tracks.map((t) => t.id)));
  }

  /** Mute is not history: keep the current mute state of tracks that still exist. */
  private restore(snapshot: UiBeat): void {
    const mutedById = new Map(this.beat.tracks.map((t) => [t.id, t.muted]));
    for (const t of snapshot.tracks) {
      t.muted = mutedById.get(t.id) ?? t.muted;
      this.synth.setTrackMuted(t.id, t.muted);
    }
    this.beat = snapshot;
    this.lastCoalesce = undefined;
    this.afterChange(true);
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(cloneUi(this.beat));
    this.restore(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneUi(this.beat));
    this.restore(next);
  }

  private trackIndex(id: number | null): number {
    return this.beat.tracks.findIndex((t) => t.id === id);
  }

  private toggleCell(trackIdx: number, step: number): void {
    const track = this.beat.tracks[trackIdx];
    if (!track || step >= this.beat.steps) return;
    this.edit(
      () => {
        track.steps[step] = !track.steps[step];
      },
      { rerender: false }
    );
    const cell = this.cellEls[trackIdx]?.[step];
    cell?.setAttribute('aria-checked', String(track.steps[step]));
    this.setActiveRow(trackIdx);
    // Audible feedback while stopped; during playback the loop plays it.
    if (
      track.steps[step] &&
      !track.muted &&
      !this.sequencer.isPlaying &&
      this.ensureAudio()
    ) {
      this.synth.play(track.instrument, track.id);
    }
  }

  private addTrack(instrument: InstrumentId): void {
    if (this.beat.tracks.length >= MAX_TRACKS) {
      this.toast(`A beat can have up to ${MAX_TRACKS} tracks`, 'info');
      return;
    }
    const track = toUiTrack(createTrack(instrument, this.beat.steps));
    this.returnFocus = null;
    this.closeModal();
    this.edit(() => {
      this.beat.tracks.push(track);
    });
    this.els.grid.querySelector<HTMLElement>('.add-btn')?.focus();
    if (this.ensureAudio()) this.synth.play(instrument, track.id);
  }

  private removeTrack(id: number): void {
    const idx = this.trackIndex(id);
    const track = this.beat.tracks[idx];
    if (!track) return;
    this.edit(() => {
      this.beat.tracks.splice(idx, 1);
    });
    if (this.activeRow >= this.beat.tracks.length) this.activeRow = -1;
    this.toast(
      `Removed ${INSTRUMENT_NAMES[track.instrument]} (undo to restore)`,
      'info'
    );
  }

  private moveTrack(id: number, delta: -1 | 1): void {
    const idx = this.trackIndex(id);
    const target = idx + delta;
    const track = this.beat.tracks[idx];
    if (!track || target < 0 || target >= this.beat.tracks.length) return;
    this.edit(() => {
      this.beat.tracks.splice(idx, 1);
      this.beat.tracks.splice(target, 0, track);
    });
    this.activeRow = target;
  }

  private toggleMute(id: number): void {
    const track = this.beat.tracks[this.trackIndex(id)];
    if (!track) return;
    track.muted = !track.muted;
    this.synth.setTrackMuted(track.id, track.muted);
    this.renderGrid();
    this.saveDraft();
  }

  private setBpm(value: number): void {
    const bpm = clampBpm(value);
    if (!Number.isFinite(bpm) || bpm === this.beat.bpm) return;
    this.edit(
      () => {
        this.beat.bpm = bpm;
      },
      { coalesce: 'bpm', rerender: false }
    );
  }

  private setSteps(steps: StepCount): void {
    if (steps === this.beat.steps) return;
    this.edit(() => {
      this.beat.steps = steps;
      for (const t of this.beat.tracks) t.steps = resizeSteps(t.steps, steps);
    });
  }

  private loadDefault(): void {
    const loaded = this.defaultBeat();
    if (formatBeatCode(loaded) === formatBeatCode(this.beat)) {
      this.toast('This is already the default beat', 'info');
      return;
    }
    this.edit(() => {
      this.beat = loaded;
    });
    this.activeRow = -1;
    this.toast('Back to the default beat', 'success');
  }

  /** Moderators only: the server re-checks the 'posts' permission. */
  private async saveDefault(code: string | null): Promise<void> {
    if (this.savingDefault) return;
    if (code !== null && !hasActiveStep(this.beat)) {
      this.toast('Add a few hits before making this the default beat', 'info');
      return;
    }
    this.savingDefault = true;
    try {
      const res = await setDefaultBeat({ code });
      this.defaultCode = res.defaultBeat;
      this.renderDefaultMenu();
      this.toast(
        code === null
          ? 'New visitors will start from the demo beat'
          : 'Saved! New visitors will start from this beat 🥁',
        'success'
      );
    } catch (error) {
      console.error('Error saving default beat:', error);
      this.toast(
        error instanceof Error
          ? error.message
          : 'Failed to save the default beat',
        'error'
      );
    } finally {
      this.savingDefault = false;
    }
  }

  private clearSteps(): void {
    if (!hasActiveStep(this.beat)) {
      this.toast('The grid is already empty', 'info');
      return;
    }
    this.edit(() => {
      for (const t of this.beat.tracks) t.steps.fill(false);
    });
  }

  // ---------------------------------------------------------------------------
  // Audio + transport
  // ---------------------------------------------------------------------------

  /** Create/resume the AudioContext; call from user gestures only. */
  private ensureAudio(): boolean {
    if (this.synth.ctx) {
      if (this.synth.ctx.state !== 'running' && !document.hidden)
        this.synth.resume();
      return true;
    }
    if (this.audioFailed) return false;
    if (this.synth.init()) return true;
    this.audioFailed = true;
    this.toast(
      "Audio couldn't start. You can still edit and share your beat.",
      'error'
    );
    return false;
  }

  togglePlay(): void {
    if (this.sequencer.isPlaying) this.stop();
    else this.play();
  }

  private play(): void {
    if (!this.ensureAudio() || !this.sequencer.start()) return;
    this.renderTransport();
    const frame = () => {
      this.showStep(this.sequencer.currentStep());
      this.els.elapsed.textContent = formatElapsed(this.sequencer.elapsed());
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (!this.sequencer.isPlaying) return;
    this.sequencer.stop();
    cancelAnimationFrame(this.rafId);
    this.showStep(-1);
    this.els.elapsed.textContent = formatElapsed(0);
    this.renderTransport();
  }

  /** Inline posts share the feed: go quiet when hidden or scrolled away. */
  private silence(): void {
    this.stop();
    this.synth.suspend();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private injectIcons(): void {
    for (const node of document.querySelectorAll<HTMLElement>('[data-icon]')) {
      const name = node.dataset.icon ?? '';
      if (isUiIcon(name)) node.innerHTML = UI_ICONS[name];
    }
    this.els.undoBtn.innerHTML = UI_ICONS.undo;
    this.els.redoBtn.innerHTML = UI_ICONS.redo;
    this.els.bpmDown.innerHTML = UI_ICONS.minus;
    this.els.bpmUp.innerHTML = UI_ICONS.plus;
    this.els.moreBtn.innerHTML = UI_ICONS.more;
  }

  private buildPicker(): void {
    const items = INSTRUMENT_IDS.map((id) => {
      const btn = el('button', 'picker-item');
      btn.type = 'button';
      btn.dataset.instrument = id;
      const icon = el('span', 'picker-icon');
      icon.innerHTML = INSTRUMENT_ICONS[id];
      btn.append(icon, el('span', 'picker-name', INSTRUMENT_NAMES[id]));
      return btn;
    });
    this.els.pickerGrid.replaceChildren(...items);
  }

  private renderTransport(): void {
    const playing = this.sequencer.isPlaying;
    const { playBtn } = this.els;
    playBtn.innerHTML = playing ? UI_ICONS.stop : UI_ICONS.play;
    playBtn.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Stop' : 'Play');
    playBtn.setAttribute('aria-pressed', String(playing));

    if (!this.bpmEditing) this.els.bpmValue.textContent = String(this.beat.bpm);
    this.els.steps16.setAttribute(
      'aria-checked',
      String(this.beat.steps === 16)
    );
    this.els.steps32.setAttribute(
      'aria-checked',
      String(this.beat.steps === 32)
    );
    this.els.undoBtn.disabled = this.undoStack.length === 0;
    this.els.redoBtn.disabled = this.redoStack.length === 0;
  }

  private renderGrid(): void {
    const { steps, tracks } = this.beat;
    const { grid } = this.els;
    grid.style.setProperty('--steps', String(steps));
    grid.classList.toggle('is-long', steps > 16);

    const rows: HTMLElement[] = [];

    const header = el('div', 'row header-row');
    header.append(el('div', 'track-cell track-head', 'TRACKS'));
    this.stepLabels = [];
    for (let s = 0; s < steps; s++) {
      const isBeat = s % 4 === 0;
      const label = el(
        'div',
        `step-label${isBeat ? ' beat-start' : ''}`,
        isBeat ? String(s + 1) : '·'
      );
      label.setAttribute('aria-hidden', 'true');
      header.append(label);
      this.stepLabels.push(label);
    }
    rows.push(header);

    // Keep the roving-tabindex cell inside the grid after structural changes.
    this.focusPos.track = Math.min(
      this.focusPos.track,
      Math.max(0, tracks.length - 1)
    );
    this.focusPos.step = Math.min(this.focusPos.step, steps - 1);

    this.cellEls = tracks.map((track, ti) => {
      const name = INSTRUMENT_NAMES[track.instrument];
      const row = el('div', 'row track-row');
      row.classList.toggle('is-active', ti === this.activeRow);
      row.classList.toggle('is-muted', track.muted);

      const head = el('div', 'track-cell');
      const btn = el('button', 'track-btn');
      btn.type = 'button';
      btn.dataset.trackId = String(track.id);
      btn.innerHTML = INSTRUMENT_ICONS[track.instrument];
      btn.title = name;
      btn.setAttribute(
        'aria-label',
        `${name}${track.muted ? ', muted' : ''}: track options`
      );
      head.append(btn);
      row.append(head);

      const cells = track.steps.map((on, si) => {
        const cell = el('button', 'cell');
        cell.type = 'button';
        cell.classList.toggle('beat-start', si % 4 === 0);
        cell.classList.toggle('alt-beat', Math.floor(si / 4) % 2 === 1);
        cell.setAttribute('role', 'switch');
        cell.setAttribute('aria-checked', String(on));
        cell.setAttribute('aria-label', `${name}, step ${si + 1}`);
        cell.dataset.track = String(ti);
        cell.dataset.step = String(si);
        cell.tabIndex =
          ti === this.focusPos.track && si === this.focusPos.step ? 0 : -1;
        row.append(cell);
        return cell;
      });
      rows.push(row);
      return cells;
    });

    const addRow = el('div', 'row add-row');
    const addHead = el('div', 'track-cell');
    const addBtn = el('button', 'track-btn add-btn');
    addBtn.type = 'button';
    addBtn.innerHTML = UI_ICONS.plus;
    const full = tracks.length >= MAX_TRACKS;
    addBtn.setAttribute(
      'aria-label',
      full ? `Add instrument (maximum ${MAX_TRACKS} reached)` : 'Add instrument'
    );
    addBtn.setAttribute('aria-disabled', String(full));
    addHead.append(addBtn);
    addRow.append(addHead, el('div', 'add-fill'));
    rows.push(addRow);

    grid.replaceChildren(...rows);

    const step = this.shownStep;
    this.shownStep = -1;
    this.renderMeter();
    this.showStep(step);
  }

  private renderMeter(): void {
    const { steps } = this.beat;
    if (this.meterBars.length !== steps) {
      this.meterBars = Array.from({ length: steps }, () => el('span', 'bar'));
      this.els.meter.replaceChildren(...this.meterBars);
      this.els.meter.classList.toggle('is-long', steps > 16);
    }
  }

  private showStep(step: number): void {
    if (step === this.shownStep) return;
    const prev = this.shownStep;
    if (prev >= 0) {
      this.stepLabels[prev]?.classList.remove('is-current');
      for (const row of this.cellEls) row[prev]?.classList.remove('is-current');
    }
    if (step >= 0) {
      this.stepLabels[step]?.classList.add('is-current');
      for (const row of this.cellEls) row[step]?.classList.add('is-current');
    }
    this.meterBars.forEach((bar, i) => {
      bar.classList.toggle('on', step >= 0 && i <= step);
      bar.classList.toggle('now', i === step);
    });
    this.shownStep = step;
  }

  private setActiveRow(trackIdx: number): void {
    if (trackIdx === this.activeRow) return;
    const rows = this.els.grid.querySelectorAll('.track-row');
    rows[this.activeRow]?.classList.remove('is-active');
    rows[trackIdx]?.classList.add('is-active');
    this.activeRow = trackIdx;
  }

  private focusCell(trackIdx: number, step: number): void {
    const cell = this.cellEls[trackIdx]?.[step];
    if (!cell) return;
    this.cellEls[this.focusPos.track]?.[this.focusPos.step]?.setAttribute(
      'tabindex',
      '-1'
    );
    cell.tabIndex = 0;
    this.focusPos = { track: trackIdx, step };
    cell.focus();
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------------------------------------------------------------------------
  // Modals, menus, toasts
  // ---------------------------------------------------------------------------

  private openModal(modal: HTMLElement, focus?: HTMLElement): void {
    this.closeModal();
    this.closeMoreMenu();
    this.returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    modal.hidden = false;
    this.openModalEl = modal;
    (
      focus ??
      modal.querySelector<HTMLElement>(
        'button:not([disabled]), textarea, input'
      )
    )?.focus();
  }

  private closeModal(): void {
    if (!this.openModalEl) return;
    this.openModalEl.hidden = true;
    this.openModalEl = null;
    const back = this.returnFocus;
    this.returnFocus = null;
    if (back?.isConnected) back.focus();
  }

  /** Keep Tab inside the open dialog. */
  private trapFocus(e: KeyboardEvent): void {
    if (!this.openModalEl) return;
    const focusables = [
      ...this.openModalEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input'
      ),
    ].filter((n) => n.offsetParent !== null);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private openPicker(): void {
    if (this.beat.tracks.length >= MAX_TRACKS) {
      this.toast(
        `A beat can have up to ${MAX_TRACKS} tracks. Remove one first.`,
        'info'
      );
      return;
    }
    this.openModal(this.els.pickerModal);
  }

  private openTrackMenu(id: number): void {
    const track = this.beat.tracks[this.trackIndex(id)];
    if (!track) return;
    this.menuTrackId = id;
    this.renderTrackMenu();
    this.openModal(this.els.trackModal, this.els.trackPreview);
  }

  private renderTrackMenu(): void {
    const idx = this.trackIndex(this.menuTrackId);
    const track = this.beat.tracks[idx];
    if (!track) return;
    const icon = el('span', 'btn-icon');
    icon.innerHTML = INSTRUMENT_ICONS[track.instrument];
    this.els.trackTitle.replaceChildren(
      icon,
      INSTRUMENT_NAMES[track.instrument]
    );
    this.els.trackMuteLabel.textContent = track.muted ? 'Unmute' : 'Mute';
    this.els.trackMute.setAttribute('aria-pressed', String(track.muted));
    this.els.trackUp.disabled = idx === 0;
    this.els.trackDown.disabled = idx === this.beat.tracks.length - 1;
  }

  /** After a structural change the old track button is gone; return focus to the new one. */
  private refocusTrackButton(id: number): void {
    this.returnFocus = this.els.grid.querySelector<HTMLElement>(
      `.track-btn[data-track-id="${id}"]`
    );
  }

  private toggleMoreMenu(): void {
    const open = this.els.moreMenu.hidden;
    this.els.moreMenu.hidden = !open;
    this.els.moreBtn.setAttribute('aria-expanded', String(open));
    if (open) this.els.clearBtn.focus();
  }

  private closeMoreMenu(): void {
    this.els.moreMenu.hidden = true;
    this.els.moreBtn.setAttribute('aria-expanded', 'false');
  }

  private openShare(): void {
    if (!hasActiveStep(this.beat)) {
      this.toast('Add a few hits before sharing your beat', 'info');
      return;
    }
    const { shareCode, commentSection, postCommentBtn } = this.els;
    shareCode.value = formatBeatCode(this.beat);
    commentSection.hidden = !this.canShare;
    postCommentBtn.hidden = !this.canShare;
    this.updateShareCount();
    this.openModal(this.els.shareModal, shareCode);
    shareCode.select();
  }

  private updateShareCount(): void {
    this.els.shareCount.textContent = String(
      Math.min(
        Array.from(this.els.shareMessage.value).length,
        MAX_SHARE_MESSAGE_LENGTH
      )
    );
  }

  private async copyCode(): Promise<void> {
    const { shareCode } = this.els;
    try {
      // The clipboard API may be missing or blocked inside the Devvit iframe.
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(shareCode.value);
      this.toast('Beat code copied!', 'success');
    } catch {
      shareCode.focus();
      shareCode.select();
      this.toast('Select the code and copy it', 'info');
    }
  }

  private async postComment(): Promise<void> {
    if (this.sharing) return;
    this.sharing = true;
    this.els.postCommentBtn.disabled = true;
    try {
      await shareBeat({
        code: this.els.shareCode.value,
        message: this.els.shareMessage.value,
      });
      this.els.shareMessage.value = '';
      this.closeModal();
      this.toast('Beat shared as a comment! 🥁', 'success');
    } catch (error) {
      console.error('Error sharing beat:', error);
      // Keep the modal open so the code can still be copied by hand.
      this.toast(
        error instanceof Error ? error.message : 'Failed to share your beat',
        'error'
      );
    } finally {
      this.sharing = false;
      this.els.postCommentBtn.disabled = false;
    }
  }

  private openLoad(): void {
    this.els.loadCode.value = '';
    this.openModal(this.els.loadModal, this.els.loadCode);
  }

  private confirmLoad(): void {
    const parsed = parseBeatCode(this.els.loadCode.value);
    if (!parsed) {
      this.toast("That doesn't look like a Rebbeat code", 'error');
      return;
    }
    const loaded = toUiBeat(parsed);
    this.edit(() => {
      this.beat = loaded;
    });
    this.activeRow = -1;
    this.closeModal();
    const n = loaded.tracks.length;
    this.toast(
      `Loaded ${n} track${n === 1 ? '' : 's'} at ${loaded.bpm} BPM`,
      'success'
    );
  }

  toast(message: string, kind: ToastKind = 'info'): void {
    const node = el('div', `toast ${kind}`, message);
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    this.els.toasts.append(node);
    setTimeout(() => node.classList.add('show'), 20);
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 300);
    }, 3000);
  }

  // ---------------------------------------------------------------------------
  // BPM editing
  // ---------------------------------------------------------------------------

  private startBpmEdit(): void {
    const { bpmValue, bpmInput } = this.els;
    this.bpmEditing = true;
    bpmInput.value = String(this.beat.bpm);
    bpmValue.hidden = true;
    bpmInput.hidden = false;
    bpmInput.focus();
    bpmInput.select();
  }

  private endBpmEdit(commit: boolean): void {
    if (!this.bpmEditing) return;
    const { bpmValue, bpmInput } = this.els;
    this.bpmEditing = false;
    if (commit && bpmInput.value.trim() !== '') {
      const value = Number(bpmInput.value);
      if (Number.isFinite(value)) this.setBpm(value);
    }
    bpmInput.hidden = true;
    bpmValue.hidden = false;
    this.renderTransport();
    bpmValue.focus();
  }

  private bindRepeat(button: HTMLButtonElement, delta: number): void {
    const stepOnce = () => this.setBpm(this.beat.bpm + delta);
    const stopRepeat = () => clearTimeout(this.repeatTimer);
    const repeat = () => {
      stepOnce();
      this.repeatTimer = setTimeout(repeat, REPEAT_INTERVAL_MS);
    };
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      stepOnce();
      stopRepeat();
      this.repeatTimer = setTimeout(repeat, REPEAT_DELAY_MS);
    });
    for (const type of [
      'pointerup',
      'pointerleave',
      'pointercancel',
      'blur',
    ] as const) {
      button.addEventListener(type, stopRepeat);
    }
    // Keyboard activation (detail 0) has no pointerdown.
    button.addEventListener('click', (e) => {
      if (e.detail === 0) stepOnce();
    });
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    const e = this.els;

    // AudioContext needs a user gesture; piggyback on the first ones.
    for (const type of ['click', 'keydown', 'touchend'] as const) {
      document.addEventListener(type, () => this.ensureAudioQuietly(), {
        capture: true,
      });
    }

    e.playBtn.addEventListener('click', () => this.togglePlay());
    e.undoBtn.addEventListener('click', () => this.undo());
    e.redoBtn.addEventListener('click', () => this.redo());
    e.steps16.addEventListener('click', () => this.setSteps(16));
    e.steps32.addEventListener('click', () => this.setSteps(32));
    e.loadBtn.addEventListener('click', () => this.openLoad());
    e.shareBtn.addEventListener('click', () => this.openShare());
    e.moreBtn.addEventListener('click', () => this.toggleMoreMenu());
    e.clearBtn.addEventListener('click', () => {
      this.closeMoreMenu();
      this.clearSteps();
    });
    e.loadDefaultBtn.addEventListener('click', () => {
      this.closeMoreMenu();
      this.loadDefault();
    });
    e.setDefaultBtn.addEventListener('click', () => {
      this.closeMoreMenu();
      void this.saveDefault(formatBeatCode(this.beat));
    });
    e.resetDefaultBtn.addEventListener('click', () => {
      this.closeMoreMenu();
      void this.saveDefault(null);
    });

    e.bpmValue.addEventListener('click', () => this.startBpmEdit());
    e.bpmInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.endBpmEdit(true);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        this.endBpmEdit(false);
      }
    });
    e.bpmInput.addEventListener('blur', () => this.endBpmEdit(true));
    this.bindRepeat(e.bpmDown, -1);
    this.bindRepeat(e.bpmUp, 1);

    // Grid: one delegated listener for cells, track icons and the + row.
    e.grid.addEventListener('click', (ev) => {
      const btn =
        ev.target instanceof Element ? ev.target.closest('button') : null;
      if (!btn) return;
      if (btn.classList.contains('cell')) {
        const t = Number(btn.dataset.track);
        const s = Number(btn.dataset.step);
        this.cellEls[this.focusPos.track]?.[this.focusPos.step]?.setAttribute(
          'tabindex',
          '-1'
        );
        btn.tabIndex = 0;
        this.focusPos = { track: t, step: s };
        this.toggleCell(t, s);
      } else if (btn.classList.contains('add-btn')) {
        this.openPicker();
      } else if (btn.dataset.trackId) {
        this.openTrackMenu(Number(btn.dataset.trackId));
      }
    });
    e.grid.addEventListener('keydown', (ev) => this.onGridKey(ev));

    e.pickerGrid.addEventListener('click', (ev) => {
      const btn =
        ev.target instanceof Element ? ev.target.closest('button') : null;
      const id = btn?.dataset.instrument;
      const instrument = INSTRUMENT_IDS.find((x) => x === id);
      if (instrument) this.addTrack(instrument);
    });

    e.trackPreview.addEventListener('click', () => {
      const track = this.beat.tracks[this.trackIndex(this.menuTrackId)];
      if (track && this.ensureAudio())
        this.synth.play(track.instrument, track.id);
    });
    e.trackMute.addEventListener('click', () => {
      if (this.menuTrackId === null) return;
      this.toggleMute(this.menuTrackId);
      this.refocusTrackButton(this.menuTrackId);
      this.renderTrackMenu();
    });
    e.trackUp.addEventListener('click', () => this.moveFromMenu(-1));
    e.trackDown.addEventListener('click', () => this.moveFromMenu(1));
    e.trackRemove.addEventListener('click', () => {
      if (this.menuTrackId === null) return;
      const id = this.menuTrackId;
      this.returnFocus = null;
      this.closeModal();
      this.removeTrack(id);
      this.els.grid.querySelector<HTMLElement>('.add-btn')?.focus();
    });

    e.copyBtn.addEventListener('click', () => void this.copyCode());
    e.shareMessage.addEventListener('input', () => this.updateShareCount());
    e.postCommentBtn.addEventListener('click', () => void this.postComment());
    e.confirmLoadBtn.addEventListener('click', () => this.confirmLoad());

    for (const modal of [
      e.pickerModal,
      e.trackModal,
      e.shareModal,
      e.loadModal,
    ]) {
      modal.addEventListener('click', (ev) => {
        const target = ev.target instanceof Element ? ev.target : null;
        if (target === modal || target?.closest('[data-close]'))
          this.closeModal();
      });
    }

    document.addEventListener('click', (ev) => {
      if (this.els.moreMenu.hidden) return;
      const target = ev.target instanceof Node ? ev.target : null;
      if (
        !this.els.moreMenu.contains(target) &&
        !this.els.moreBtn.contains(target)
      )
        this.closeMoreMenu();
    });

    document.addEventListener('keydown', (ev) => this.onKey(ev));
    // Swallow the keyup of a Space we used for play/stop so no button activates.
    document.addEventListener('keyup', (ev) => {
      if (ev.key === ' ' && this.spaceIsTransport(ev)) ev.preventDefault();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.silence();
      else this.synth.resume();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) this.silence();
      }).observe(document.body);
    }
  }

  private ensureAudioQuietly(): void {
    if (!this.audioFailed) this.ensureAudio();
  }

  private moveFromMenu(delta: -1 | 1): void {
    if (this.menuTrackId === null) return;
    this.moveTrack(this.menuTrackId, delta);
    this.refocusTrackButton(this.menuTrackId);
    this.renderTrackMenu();
  }

  /** Space plays/stops unless it would type, or activate a keyboard-focused control. */
  private spaceIsTransport(ev: KeyboardEvent): boolean {
    if (this.openModalEl || isTypingTarget(ev.target)) return false;
    const target = ev.target;
    if (target instanceof HTMLButtonElement) {
      // A button focused by a mouse click is not :focus-visible; Space then
      // means play/stop rather than "click that button again".
      try {
        return !target.matches(':focus-visible');
      } catch {
        return false;
      }
    }
    return true;
  }

  private onKey(ev: KeyboardEvent): void {
    if (this.openModalEl) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.closeModal();
      } else if (ev.key === 'Tab') {
        this.trapFocus(ev);
      }
      return;
    }
    if (ev.key === 'Escape' && !this.els.moreMenu.hidden) {
      this.closeMoreMenu();
      this.els.moreBtn.focus();
      return;
    }
    if (isTypingTarget(ev.target)) return;

    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();
    if (mod && key === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && key === 'y') {
      ev.preventDefault();
      this.redo();
      return;
    }
    if (ev.key === ' ' && !mod && this.spaceIsTransport(ev)) {
      ev.preventDefault();
      if (!ev.repeat) this.togglePlay();
    }
  }

  private onGridKey(ev: KeyboardEvent): void {
    const target = ev.target;
    if (
      !(target instanceof HTMLButtonElement) ||
      !target.classList.contains('cell')
    )
      return;
    let t = Number(target.dataset.track);
    let s = Number(target.dataset.step);
    switch (ev.key) {
      case 'ArrowLeft':
        s = Math.max(0, s - 1);
        break;
      case 'ArrowRight':
        s = Math.min(this.beat.steps - 1, s + 1);
        break;
      case 'ArrowUp':
        t = Math.max(0, t - 1);
        break;
      case 'ArrowDown':
        t = Math.min(this.beat.tracks.length - 1, t + 1);
        break;
      case 'Home':
        s = 0;
        break;
      case 'End':
        s = this.beat.steps - 1;
        break;
      default:
        return;
    }
    ev.preventDefault();
    this.focusCell(t, s);
  }
}
