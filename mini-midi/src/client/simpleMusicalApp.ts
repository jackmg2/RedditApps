import type { CompositionExport, InstrumentSide, ScaleName } from '../shared/api';
import { fetchInit, saveComposition, shareComposition } from './apiClient';
import { byId } from './dom';
import { GamepadManager } from './gamepadManager';
import { KeyboardManager } from './keyboardManager';
import { SimpleAudio } from './simpleAudio';
import type { CompositionFrame } from '../shared/api';
import { SimpleNotes } from './simpleNotes';
import { SimpleRecorder } from './simpleRecorder';

export type ToastKind = 'info' | 'success' | 'error';

// A point in viewport coordinates — satisfied by both MouseEvent and Touch.
type ViewportPoint = { clientX: number; clientY: number };

type ActiveTouch = {
  id: number;
  innerCircle: HTMLElement;
  element: HTMLElement;
};

type ActiveInstrument = {
  side: InstrumentSide;
  innerCircle: HTMLElement;
  element: HTMLElement;
};

const SIDES: InstrumentSide[] = ['left', 'right'];

export class SimpleMusicalApp {
  audio = new SimpleAudio();
  // SimpleNotes never touches a running AudioContext directly — every play call
  // guards on audio.isAvailable() — so it can exist before audio is initialized.
  notes: SimpleNotes = new SimpleNotes(this.audio);
  recorder = new SimpleRecorder();
  gamepad: GamepadManager;
  keyboard: KeyboardManager;
  isInitialized = false;
  isMouseDown = false;
  currentInstrument: ActiveInstrument | null = null;
  activeTouches: Record<InstrumentSide, ActiveTouch | null> = {
    left: null,
    right: null,
  };
  favoriteNotes: string[] = [];
  audioInitPromise: Promise<boolean> | null = null;

  constructor() {
    this.gamepad = new GamepadManager(this);
    this.keyboard = new KeyboardManager(this);

    this.setupEventListeners();

    // The play interface is visible immediately; render the scale UI right away.
    this.notes.updateScaleUI();

    // Load server-side state right away.
    void this.loadInitialData();
  }

  async loadInitialData(): Promise<void> {
    try {
      const init = await fetchInit();
      this.favoriteNotes = init.favoriteNotes;
      console.log('Initial data loaded:', init);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  // Lazily start the AudioContext on the first user gesture. new AudioContext()
  // runs synchronously inside the triggering handler, so user activation applies.
  ensureAudio(): Promise<boolean> {
    if (this.isInitialized) return Promise.resolve(true);
    this.audioInitPromise ??= this.audio.initialize().then((ok) => {
      if (ok) {
        this.isInitialized = true;
      } else {
        this.audioInitPromise = null; // allow retry on the next gesture
        this.showToast('Audio initialization failed. Please try again.', 'error');
      }
      return ok;
    });
    return this.audioInitPromise;
  }

  setupEventListeners(): void {
    // Recording controls
    document.getElementById('recordBtn')?.addEventListener('click', () => {
      this.toggleRecording();
    });

    document.getElementById('playBtn')?.addEventListener('click', () => {
      this.togglePlayback();
    });

    document.getElementById('shareBtn')?.addEventListener('click', () => {
      this.openShareModal();
    });

    document.getElementById('importBtn')?.addEventListener('click', () => {
      this.openImportModal();
    });

    // Modal controls
    document.getElementById('cancelShare')?.addEventListener('click', () => {
      this.closeShareModal();
    });

    document.getElementById('confirmShare')?.addEventListener('click', () => {
      void this.shareComposition();
    });

    document.getElementById('cancelImport')?.addEventListener('click', () => {
      this.closeImportModal();
    });

    document.getElementById('confirmImport')?.addEventListener('click', () => {
      this.importComposition();
    });

    document.getElementById('octaveUp')?.addEventListener('click', () => {
      if (this.notes) {
        const newOctave = this.notes.changeOctave(1);
        this.updateOctaveDisplay(newOctave);
      }
    });

    document.getElementById('octaveDown')?.addEventListener('click', () => {
      if (this.notes) {
        const newOctave = this.notes.changeOctave(-1);
        this.updateOctaveDisplay(newOctave);
      }
    });

    document.getElementById('scalePrev')?.addEventListener('click', () => {
      if (this.notes) {
        const newScale = this.notes.changeScale(-1);
        this.updateScaleDisplay(newScale);
        const progressionInfo = this.notes.getScaleProgressionInfo();
        this.showToast(
          `🎵 ${this.getScaleDisplayName(newScale)}: ${progressionInfo.description}`,
          'success'
        );
      }
    });

    document.getElementById('scaleNext')?.addEventListener('click', () => {
      if (this.notes) {
        const newScale = this.notes.changeScale(1);
        this.updateScaleDisplay(newScale);
        const progressionInfo = this.notes.getScaleProgressionInfo();
        this.showToast(
          `🎵 ${this.getScaleDisplayName(newScale)}: ${progressionInfo.description}`,
          'success'
        );
      }
    });

    // Inline posts share the feed with other content: silence the app when it
    // scrolls out of view or the tab is hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.recorder.isPlaying) {
          this.stopPlayback();
        }
        void this.audio.audioContext?.suspend();
      } else if (this.isInitialized) {
        void this.audio.audioContext?.resume();
      }
    });

    // Instrument controls with mouse tracking
    this.setupInstrumentControls();
    this.setupInstrumentHoverEffects();
  }

  updateOctaveDisplay(octave: number): void {
    const display = document.getElementById('octaveDisplay');
    if (display) {
      display.textContent = `Oct: ${octave}`;
    }
  }

  updateScaleDisplay(scale: ScaleName): void {
    const display = document.getElementById('scaleDisplay');
    if (display) {
      display.textContent = this.getScaleDisplayName(scale);
    }
  }

  getScaleDisplayName(scale: ScaleName): string {
    const scaleNames: Record<ScaleName, string> = {
      chromatic: 'Chromatic',
      major: 'Major ✨',
      minor: 'Minor 🌙',
      pentatonic: 'Pentatonic 🎸',
      blues: 'Blues 🎷',
      dorian: 'Dorian 🎹',
      mixolydian: 'Mixolydian 🎺',
    };
    return scaleNames[scale];
  }

  updateChordDisplay(chordName: string): void {
    const display = document.getElementById('lastChordPlayed');
    if (display) {
      display.textContent = chordName;
      display.classList.add('active');

      // Remove active class after animation
      setTimeout(() => {
        display.classList.remove('active');
      }, 600);
    }
  }

  setupInstrumentControls(): void {
    const leftInstrument = byId('leftInstrument', HTMLElement);
    const rightInstrument = byId('rightInstrument', HTMLElement);
    const leftInner = byId('leftInner', HTMLElement);
    const rightInner = byId('rightInner', HTMLElement);

    // Mouse down events (desktop)
    leftInstrument.addEventListener('mousedown', (e) => {
      this.handleInstrumentStart(e, 'left', leftInner, leftInstrument);
    });

    rightInstrument.addEventListener('mousedown', (e) => {
      this.handleInstrumentStart(e, 'right', rightInner, rightInstrument);
    });

    // Enhanced touch events with multi-touch support
    leftInstrument.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleTouchStart(e, 'left', leftInner, leftInstrument);
    });

    rightInstrument.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleTouchStart(e, 'right', rightInner, rightInstrument);
    });

    // Touch move handlers live on the instruments, NOT on document: in inline
    // mode a document-level preventDefault would hijack feed scrolling. Touch
    // events are delivered to the element where the touch started, so this
    // still tracks drags that leave the circle.
    [leftInstrument, rightInstrument].forEach((instrument) => {
      instrument.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          this.handleTouchMove(e);
        },
        { passive: false }
      );
    });

    // Global touch end - clean up ended touches
    document.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e);
    });

    // Global mouse events for tracking (desktop)
    document.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    document.addEventListener('mouseup', () => {
      this.handleInstrumentEnd();
    });
  }

  handleTouchStart(
    event: TouchEvent,
    side: InstrumentSide,
    innerCircle: HTMLElement,
    instrumentElement: HTMLElement
  ): void {
    if (!this.isInitialized) {
      // First touch: initialize audio, then replay this gesture once ready.
      void this.ensureAudio().then((ok) => {
        if (ok) this.handleTouchStart(event, side, innerCircle, instrumentElement);
      });
      return;
    }

    const touch = Array.from(event.touches).find((t) => {
      const element = document.elementFromPoint(t.clientX, t.clientY);
      return element !== null && instrumentElement.contains(element);
    });

    if (touch) {
      this.activeTouches[side] = {
        id: touch.identifier,
        innerCircle,
        element: instrumentElement,
      };

      this.updateInnerCirclePosition(touch, innerCircle);
      this.playInstrumentAt(touch, side, instrumentElement);
    }
  }

  handleTouchMove(event: TouchEvent): void {
    SIDES.forEach((side) => {
      const activeTouch = this.activeTouches[side];
      if (!activeTouch) return;

      const currentTouch = Array.from(event.touches).find(
        (t) => t.identifier === activeTouch.id
      );

      if (currentTouch) {
        const rect = activeTouch.element.getBoundingClientRect();

        if (
          currentTouch.clientX >= rect.left &&
          currentTouch.clientX <= rect.right &&
          currentTouch.clientY >= rect.top &&
          currentTouch.clientY <= rect.bottom
        ) {
          this.updateInnerCirclePosition(currentTouch, activeTouch.innerCircle);
          this.playInstrumentAt(currentTouch, side, activeTouch.element);
        }
      }
    });
  }

  handleTouchEnd(event: TouchEvent): void {
    SIDES.forEach((side) => {
      const activeTouch = this.activeTouches[side];
      if (!activeTouch) return;

      const touchStillActive = Array.from(event.touches).some(
        (t) => t.identifier === activeTouch.id
      );

      if (!touchStillActive) {
        activeTouch.innerCircle.style.transform = 'translate(-50%, -50%)';
        this.activeTouches[side] = null;
      }
    });

    const hasActiveTouches = SIDES.some((side) => this.activeTouches[side] !== null);
    if (!hasActiveTouches) {
      this.clearActivePieSlices();
    }
  }

  handleInstrumentStart(
    event: MouseEvent,
    side: InstrumentSide,
    innerCircle: HTMLElement,
    instrumentElement: HTMLElement
  ): void {
    if (!this.isInitialized) {
      // First click: initialize audio, then replay this gesture once ready.
      void this.ensureAudio().then((ok) => {
        if (ok) this.handleInstrumentStart(event, side, innerCircle, instrumentElement);
      });
      return;
    }

    this.isMouseDown = true;
    this.currentInstrument = { side, innerCircle, element: instrumentElement };

    this.updateInnerCirclePosition(event, innerCircle);
    this.playInstrumentAt(event, side, instrumentElement);
  }

  handleMouseMove(event: MouseEvent): void {
    if (!this.isMouseDown || !this.currentInstrument) return;

    const { innerCircle, element, side } = this.currentInstrument;
    const rect = element.getBoundingClientRect();

    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      this.updateInnerCirclePosition(event, innerCircle);
      this.playInstrumentAt(event, side, element);
    }
  }

  handleInstrumentEnd(): void {
    if (this.currentInstrument) {
      this.currentInstrument.innerCircle.style.transform = 'translate(-50%, -50%)';
      this.currentInstrument = null;
    }
    this.isMouseDown = false;
    this.clearActivePieSlices();
  }

  updateInnerCirclePosition(point: ViewportPoint, innerCircle: HTMLElement): void {
    const parent = innerCircle.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = point.clientX - centerX;
    const y = point.clientY - centerY;

    const maxDistance = rect.width / 2 - 60;
    const distance = Math.sqrt(x * x + y * y);

    if (distance > maxDistance) {
      const angle = Math.atan2(y, x);
      const constrainedX = Math.cos(angle) * maxDistance;
      const constrainedY = Math.sin(angle) * maxDistance;
      innerCircle.style.transform = `translate(calc(-50% + ${constrainedX}px), calc(-50% + ${constrainedY}px))`;
    } else {
      innerCircle.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
  }

  playInstrumentAt(point: ViewportPoint, side: InstrumentSide, instrumentElement: HTMLElement): void {
    if (!this.notes) return;

    const rect = instrumentElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = (point.clientX - centerX) / (rect.width / 2);
    const y = (point.clientY - centerY) / (rect.height / 2);

    const result = this.notes.handleInstrumentTouch(x, y, side);

    if (result) {
      const angle = Math.atan2(y, x);
      const noteIndex = this.notes.angleToNoteIndex(angle);

      // Highlight the corresponding pie slice
      this.highlightPieSlice(side, noteIndex);

      // Update UI based on instrument type
      if (side === 'right') {
        const chordName = this.notes.getChordNameByIndex(noteIndex);
        const progressionInfo = this.notes.getScaleProgressionInfo();
        const romanNumeral = progressionInfo.chordNames[noteIndex] ?? '';
        this.updateChordDisplay(`${chordName} (${romanNumeral})`);
      }

      if (this.recorder.isRecording) {
        this.recorder.recordFrame({
          noteIndex,
          side,
          octave: this.notes.currentOctave,
        });
      }
    }

    this.animateInstrument(instrumentElement);
  }

  highlightPieSlice(side: InstrumentSide, noteIndex: number): void {
    // Clear previous highlights for this instrument
    const instrumentId = side === 'left' ? 'leftInstrument' : 'rightInstrument';
    const instrument = document.getElementById(instrumentId);

    if (instrument) {
      // Remove active class from all inner elements in this instrument
      instrument.querySelectorAll('.segment .inner').forEach((inner) => {
        inner.classList.remove('active');
      });

      // Remove active class from all external note labels in this instrument
      instrument.querySelectorAll('.external-note-label').forEach((label) => {
        label.classList.remove('active');
      });

      // Add active class to the current slice's inner element
      const activeSlice = instrument.querySelector(`.note-${noteIndex}`);
      if (activeSlice) {
        const innerElement = activeSlice.querySelector('.segment .inner');
        if (innerElement) {
          innerElement.classList.add('active');

          // Remove active class after a short delay
          setTimeout(() => {
            innerElement.classList.remove('active');
          }, 400);
        }
      }

      // Animate the external note label
      const externalLabel = instrument.querySelector(`[data-note-index="${noteIndex}"]`);
      if (externalLabel) {
        externalLabel.classList.add('active');

        // Remove active class after animation
        setTimeout(() => {
          externalLabel.classList.remove('active');
        }, 600);
      }
    }
  }

  clearActivePieSlices(): void {
    document.querySelectorAll('.segment .inner.active').forEach((inner) => {
      inner.classList.remove('active');
    });

    document.querySelectorAll('.external-note-label.active').forEach((label) => {
      label.classList.remove('active');
    });
  }

  setupInstrumentHoverEffects(): void {
    document.querySelectorAll('.instrument').forEach((instrument) => {
      const noteIndicators = instrument.querySelectorAll('.note-indicator');

      noteIndicators.forEach((indicator, index) => {
        const externalLabel = instrument.querySelector(`[data-note-index="${index}"]`);

        if (externalLabel) {
          indicator.addEventListener('mouseenter', () => {
            externalLabel.classList.add('hover');
          });

          indicator.addEventListener('mouseleave', () => {
            externalLabel.classList.remove('hover');
          });
        }
      });
    });
  }

  animateInstrument(element: HTMLElement): void {
    element.style.boxShadow = '0 0 30px rgba(0, 212, 255, 1)';

    setTimeout(() => {
      element.style.boxShadow = '';
    }, 150);
  }

  togglePlayback(): void {
    if (this.recorder.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback(): void {
    if (!this.recorder.hasRecording()) {
      this.showToast('No recording to play!', 'info');
      return;
    }

    if (this.recorder.isRecording) {
      this.showToast('Stop recording first!', 'info');
      return;
    }

    const success = this.recorder.startPlayback(
      this.notes,
      (frame) => {
        this.onNotePlayback(frame);
      },
      () => {
        this.onPlaybackComplete();
      }
    );

    if (success) {
      this.updatePlaybackUI(true);
    }
  }

  stopPlayback(): void {
    this.recorder.stopPlayback();
    this.updatePlaybackUI(false);
    this.clearActivePieSlices();
  }

  onNotePlayback(frame: CompositionFrame): void {
    const instrumentId = frame.side === 'left' ? 'leftInstrument' : 'rightInstrument';
    const instrument = document.getElementById(instrumentId);

    if (instrument) {
      this.animateInstrument(instrument);
      this.highlightPieSlice(frame.side, frame.noteIndex);

      if (frame.side === 'right' && this.notes) {
        const chordName = this.notes.getChordNameByIndex(frame.noteIndex);
        const progressionInfo = this.notes.getScaleProgressionInfo();
        const romanNumeral = progressionInfo.chordNames[frame.noteIndex] ?? '';
        this.updateChordDisplay(`${chordName} (${romanNumeral})`);
      }

      const innerId = frame.side === 'left' ? 'leftInner' : 'rightInner';
      const inner = document.getElementById(innerId);

      if (inner) {
        const degrees = frame.noteIndex * 45;
        const angle = (degrees * Math.PI) / 180;

        const radius = 60;
        const x = Math.cos(angle - Math.PI / 2) * radius;
        const y = Math.sin(angle - Math.PI / 2) * radius;

        inner.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        inner.style.background =
          frame.side === 'left'
            ? 'linear-gradient(135deg, #00d4ff, #3498db)'
            : 'linear-gradient(135deg, #8e44ad, #9b59b6)';

        setTimeout(() => {
          inner.style.transform = 'translate(-50%, -50%)';
          inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
        }, 150);
      }
    }
  }

  onPlaybackComplete(): void {
    this.updatePlaybackUI(false);
    this.showToast('Playback complete!', 'success');
    this.clearActivePieSlices();

    const timeElement = document.getElementById('recordingTime');
    if (timeElement) {
      timeElement.textContent = '00:00';
    }
  }

  updatePlaybackUI(isPlaying: boolean): void {
    const playBtn = byId('playBtn', HTMLButtonElement);
    const recordBtn = byId('recordBtn', HTMLButtonElement);

    if (isPlaying) {
      playBtn.textContent = '⏸ Pause';
      playBtn.className = 'btn btn-stop';
      recordBtn.disabled = true;
    } else {
      playBtn.textContent = '▶ Play';
      playBtn.className = 'btn btn-play';
      recordBtn.disabled = false;
    }
  }

  toggleRecording(): void {
    if (this.recorder.isPlaying) {
      this.showToast('Stop playback first!', 'info');
      return;
    }

    if (this.recorder.isRecording) {
      this.recorder.stopRecording();
      this.updateRecordingUI(false);
    } else {
      this.recorder.startRecording();
      this.updateRecordingUI(true);
    }
  }

  updateRecordingUI(isRecording: boolean): void {
    const recordBtn = byId('recordBtn', HTMLButtonElement);
    const playBtn = byId('playBtn', HTMLButtonElement);
    const mainContainer = byId('mainContainer', HTMLElement);

    if (isRecording) {
      recordBtn.textContent = '⏹ Stop';
      recordBtn.className = 'btn btn-stop';
      mainContainer.classList.add('recording');
      playBtn.disabled = true;
    } else {
      recordBtn.textContent = '● Record';
      recordBtn.className = 'btn btn-record';
      mainContainer.classList.remove('recording');
      playBtn.disabled = false;
    }
  }

  // TODO: not wired to any button yet (same as the legacy app) — kept so a Save
  // button can be added without server work.
  async saveComposition(): Promise<void> {
    if (!this.recorder.hasRecording()) {
      this.showToast('Please record a composition first!', 'info');
      return;
    }

    const composition = this.recorder.exportRecording();
    if (!composition) return;

    try {
      this.showToast('Saving composition...', 'info');
      await saveComposition(composition);
      this.showToast('Composition saved successfully! 🎵', 'success');
    } catch (error) {
      console.error('Error saving composition:', error);
      this.showToast('Failed to save composition', 'error');
    }
  }

  openImportModal(): void {
    byId('importModal', HTMLElement).style.display = 'block';
    this.keyboard.disableKeyboardControl();
  }

  closeImportModal(): void {
    byId('importModal', HTMLElement).style.display = 'none';
    byId('importData', HTMLTextAreaElement).value = '';
  }

  importComposition(): void {
    const importData = byId('importData', HTMLTextAreaElement).value.trim();

    if (!importData) {
      this.showToast('Please paste composition data!', 'info');
      return;
    }

    try {
      let compositionData: CompositionExport;
      try {
        const decodedData = atob(importData);
        compositionData = JSON.parse(decodedData);
      } catch {
        compositionData = JSON.parse(importData);
      }

      const success = this.recorder.importRecording(compositionData);

      if (success) {
        this.showToast('Composition imported successfully!', 'success');
        this.closeImportModal();

        const duration = Math.floor(compositionData.duration / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        this.showToast(
          `Loaded ${compositionData.frameCount} notes (${minutes}:${seconds
            .toString()
            .padStart(2, '0')})`,
          'info'
        );
      } else {
        this.showToast('Invalid composition data!', 'error');
      }
    } catch (error) {
      console.error('Import error:', error);
      this.showToast('Failed to import - invalid format!', 'error');
    }
  }

  openShareModal(): void {
    if (!this.recorder.hasRecording()) {
      this.showToast('Please record a composition first!', 'info');
      return;
    }

    byId('shareModal', HTMLElement).style.display = 'block';
    this.keyboard.disableKeyboardControl();
  }

  closeShareModal(): void {
    byId('shareModal', HTMLElement).style.display = 'none';
    byId('shareMessage', HTMLTextAreaElement).value = '';
  }

  async shareComposition(): Promise<void> {
    const message = byId('shareMessage', HTMLTextAreaElement).value;
    const composition = this.recorder.exportRecording();

    if (!composition || !this.notes) {
      this.showToast('No composition to share!', 'error');
      this.closeShareModal();
      return;
    }

    // The base64 round-trip must stay unchanged so codes shared from the legacy
    // app keep importing correctly.
    const encodedData = btoa(JSON.stringify(composition));
    const currentScale = this.notes.getCurrentScale();
    const currentOctave = this.notes.getCurrentOctave();

    this.showToast('Sharing composition...', 'info');
    this.closeShareModal();

    try {
      await shareComposition({
        encodedComposition: encodedData,
        message: message || 'Check out my musical creation! 🎵',
        duration: composition.duration,
        noteCount: composition.frameCount,
        scale: currentScale,
        scaleDisplayName: this.getScaleDisplayName(currentScale),
        octave: currentOctave,
      });
      this.showToast('Composition shared as comment! 🎵', 'success');
    } catch (error) {
      console.error('Error sharing composition:', error);
      this.showToast('Failed to share composition', 'error');
    }
  }

  showToast(message: string, type: ToastKind = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    const container = document.getElementById('toastContainer');
    if (!container) return;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
}
