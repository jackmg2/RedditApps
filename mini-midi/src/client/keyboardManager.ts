// Keyboard input manager with simultaneous key (combo) detection — C on top.
import type { InstrumentSide } from '../shared/api';
import type { SimpleMusicalApp } from './simpleMusicalApp';

export type KeyMapping = {
  angle: number;
  name: string;
  noteIndex: number;
};

type ComboMatch = {
  mapping: KeyMapping;
  side: InstrumentSide;
  keys: string[];
};

const CONTROL_KEYS = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
];

export class KeyboardManager {
  app: SimpleMusicalApp;
  isKeyboardActive = false;

  // Track key states instead of just pressed keys
  keyStates: Record<string, boolean> = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  };

  // Track what combinations have already been triggered
  triggeredCombos = new Set<string>();

  // Timeout for combination detection
  combinationTimeout: number | null = null;
  combinationDelay = 50; // ms to wait for combination keys

  // Key mappings for 8-direction control — C on top
  keyMappings: { notes: Record<string, KeyMapping>; chords: Record<string, KeyMapping> } = {
    // WASD for notes (left instrument) - C at top (W key)
    notes: {
      KeyW: { angle: -Math.PI / 2, name: 'W (Up)', noteIndex: 0 }, // Top (C)
      KeyD: { angle: -Math.PI / 4, name: 'D (Right)', noteIndex: 2 }, // Right (E)
      KeyS: { angle: 0, name: 'S (Down)', noteIndex: 4 }, // Down (G)
      'KeyD+KeyS': { angle: Math.PI / 4, name: 'S+D (Down-Right)', noteIndex: 3 }, // Bottom-Right (F)
      'KeyS+KeyD': { angle: Math.PI / 4, name: 'S+D (Down-Right)', noteIndex: 3 }, // Bottom-Right (F)
      'KeyA+KeyS': { angle: Math.PI / 2, name: 'S+A (Down-Left)', noteIndex: 5 }, // Bottom-Left (A)
      'KeyS+KeyA': { angle: Math.PI / 2, name: 'S+A (Down-Left)', noteIndex: 5 }, // Bottom-Left (A)
      KeyA: { angle: (3 * Math.PI) / 4, name: 'A (Left)', noteIndex: 6 }, // Left (B)
      'KeyA+KeyW': { angle: Math.PI, name: 'A+W (Up-Left)', noteIndex: 7 }, // Up-Left (C')
      'KeyW+KeyA': { angle: Math.PI, name: 'A+W (Up-Left)', noteIndex: 7 }, // Up-Left (C')
      'KeyD+KeyW': { angle: -Math.PI / 4, name: 'W+D (Up-Right)', noteIndex: 1 }, // Top-Right (D)
      'KeyW+KeyD': { angle: -Math.PI / 4, name: 'W+D (Up-Right)', noteIndex: 1 }, // Top-Right (D)
    },

    // Arrow keys for chords (right instrument) - C at top (Up arrow)
    chords: {
      ArrowUp: { angle: -Math.PI / 2, name: '↑ (Up)', noteIndex: 0 }, // Top (C)
      ArrowRight: { angle: -Math.PI / 4, name: '→ (Right)', noteIndex: 2 }, // Right (E)
      ArrowDown: { angle: 0, name: '↓ (Down)', noteIndex: 4 }, // Down (G)
      'ArrowDown+ArrowRight': { angle: Math.PI / 4, name: '↓→ (Down-Right)', noteIndex: 3 },
      'ArrowRight+ArrowDown': { angle: Math.PI / 4, name: '↓→ (Down-Right)', noteIndex: 3 },
      'ArrowDown+ArrowLeft': { angle: Math.PI / 2, name: '↓← (Down)', noteIndex: 5 },
      'ArrowLeft+ArrowDown': { angle: Math.PI / 2, name: '↓← (Down)', noteIndex: 5 },
      ArrowLeft: { angle: (3 * Math.PI) / 4, name: '← (Left)', noteIndex: 6 }, // Left (B)
      'ArrowUp+ArrowLeft': { angle: Math.PI, name: '↑← (Left)', noteIndex: 7 },
      'ArrowLeft+ArrowUp': { angle: Math.PI, name: '↑← (Left)', noteIndex: 7 },
      'ArrowRight+ArrowUp': { angle: -Math.PI / 4, name: '↑→ (Up-Right)', noteIndex: 1 },
      'ArrowUp+ArrowRight': { angle: -Math.PI / 4, name: '↑→ (Up-Right)', noteIndex: 1 },
    },
  };

  lastKeyTime: Record<'notes' | 'chords', number> = { notes: 0, chords: 0 };
  keyDelay = 100; // Minimum ms between key triggers

  constructor(app: SimpleMusicalApp) {
    this.app = app;
    this.setupKeyboardEvents();
  }

  setupKeyboardEvents(): void {
    document.addEventListener('keydown', (e) => {
      // Check if any modal is open - if so, don't handle musical keys
      if (this.isModalOpen()) {
        return; // Let the modal handle the input normally
      }

      // Prevent default behavior for our control keys
      if (this.isControlKey(e.code)) {
        e.preventDefault();
        this.handleKeyDown(e.code);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (this.isModalOpen()) {
        return;
      }

      if (this.isControlKey(e.code)) {
        e.preventDefault();
        this.handleKeyUp(e.code);
      }
    });

    // Show keyboard indicator on first key press
    document.addEventListener(
      'keydown',
      (e) => {
        if (this.isControlKey(e.code) && !this.isKeyboardActive && !this.isModalOpen()) {
          this.isKeyboardActive = true;
          this.showKeyboardIndicator(true);
          this.app.showToast('⌨️ Keyboard controls active! WASD: Notes, Arrows: Chords', 'success');
        }
      },
      { once: true }
    );
  }

  // Check if any modal is currently open
  isModalOpen(): boolean {
    const shareModal = document.getElementById('shareModal');
    const importModal = document.getElementById('importModal');

    return (
      (shareModal !== null && shareModal.style.display === 'block') ||
      (importModal !== null && importModal.style.display === 'block')
    );
  }

  isControlKey(code: string): boolean {
    return CONTROL_KEYS.includes(code);
  }

  handleKeyDown(code: string): void {
    if (this.isModalOpen()) return;

    if (!this.app.isInitialized) {
      // First keypress initializes audio; the next one will play.
      void this.app.ensureAudio();
      return;
    }

    // Update key state
    if (Object.prototype.hasOwnProperty.call(this.keyStates, code)) {
      this.keyStates[code] = true;
    }

    // Clear any existing timeout
    if (this.combinationTimeout !== null) {
      clearTimeout(this.combinationTimeout);
    }

    // Wait a bit for potential combination keys
    this.combinationTimeout = setTimeout(() => {
      this.checkKeyStates();
    }, this.combinationDelay);
  }

  handleKeyUp(code: string): void {
    if (this.isModalOpen()) return;

    // Update key state
    if (Object.prototype.hasOwnProperty.call(this.keyStates, code)) {
      this.keyStates[code] = false;
    }

    // Clear combination timeout
    if (this.combinationTimeout !== null) {
      clearTimeout(this.combinationTimeout);
      this.combinationTimeout = null;
    }

    // Clear triggered combinations when keys are released
    this.triggeredCombos.clear();

    // Clear visual feedback when all keys released
    if (Object.values(this.keyStates).every((state) => !state)) {
      this.clearKeyboardVisuals();
    }
  }

  checkKeyStates(): void {
    if (this.isModalOpen()) return; // Additional safety check

    // Get currently pressed keys
    const pressedKeys = Object.keys(this.keyStates).filter((key) => this.keyStates[key]);

    // Check for combinations first (priority over single keys)
    const combination = this.detectCombinationFromStates(pressedKeys);
    if (combination) {
      const comboKey = combination.keys.join('+');
      if (!this.triggeredCombos.has(comboKey)) {
        this.triggeredCombos.add(comboKey);
        this.triggerNote(combination.mapping, combination.side);
        return;
      }
    }

    // Handle single key presses only if no combinations and not already triggered
    const singleKey = pressedKeys[0];
    if (pressedKeys.length === 1 && singleKey !== undefined) {
      const mapping = this.getSingleKeyMapping(singleKey);
      if (mapping && !this.triggeredCombos.has(singleKey)) {
        this.triggeredCombos.add(singleKey);
        this.triggerNote(mapping.mapping, mapping.side);
      }
    }
  }

  detectCombinationFromStates(pressedKeys: string[]): ComboMatch | null {
    if (pressedKeys.length < 2) return null;

    // Check WASD combinations
    const wasdKeys = pressedKeys.filter((key) => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key));
    const wasdMatch = this.findComboMatch(wasdKeys, this.keyMappings.notes, 'left');
    if (wasdMatch) return wasdMatch;

    // Check Arrow combinations
    const arrowKeys = pressedKeys.filter((key) => key.startsWith('Arrow'));
    return this.findComboMatch(arrowKeys, this.keyMappings.chords, 'right');
  }

  findComboMatch(
    keys: string[],
    mappings: Record<string, KeyMapping>,
    side: InstrumentSide
  ): ComboMatch | null {
    if (keys.length < 2) return null;

    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const keyA = keys[i];
        const keyB = keys[j];
        if (keyA === undefined || keyB === undefined) continue;

        const combo = [keyA, keyB].sort().join('+');
        const mapping = mappings[combo];
        if (mapping) {
          return { mapping, side, keys: [keyA, keyB] };
        }
      }
    }
    return null;
  }

  getSingleKeyMapping(code: string): { mapping: KeyMapping; side: InstrumentSide } | null {
    // Check notes (WASD)
    const noteMapping = this.keyMappings.notes[code];
    if (noteMapping) {
      return { mapping: noteMapping, side: 'left' };
    }

    // Check chords (Arrows)
    const chordMapping = this.keyMappings.chords[code];
    if (chordMapping) {
      return { mapping: chordMapping, side: 'right' };
    }

    return null;
  }

  triggerNote(mapping: KeyMapping, side: InstrumentSide): void {
    if (this.isModalOpen()) return; // Additional safety check

    const notes = this.app.notes;
    if (!notes) return;

    const now = Date.now();
    const lastTime = side === 'left' ? this.lastKeyTime.notes : this.lastKeyTime.chords;

    // Debounce rapid key presses
    if (now - lastTime < this.keyDelay) {
      return;
    }

    // Check if this position is active in current scale
    const activePositions = notes.scaleActivePositions[notes.currentScale];
    if (!activePositions[mapping.noteIndex]) {
      return;
    }

    // Play the note/chord
    const result =
      side === 'left' ? notes.playNote(mapping.noteIndex) : notes.playChord(mapping.noteIndex);

    if (result) {
      // Visual feedback
      this.app.highlightPieSlice(side, mapping.noteIndex);
      this.animateKeyboardFeedback(side, mapping.noteIndex);

      // Update displays
      if (side === 'right') {
        const chordName = notes.getChordNameByIndex(mapping.noteIndex);
        this.app.updateChordDisplay(chordName);
      }

      // Record if recording
      if (this.app.recorder.isRecording) {
        this.app.recorder.recordFrame({
          noteIndex: mapping.noteIndex,
          side,
          octave: notes.currentOctave,
        });
      }

      // Update last time
      if (side === 'left') {
        this.lastKeyTime.notes = now;
      } else {
        this.lastKeyTime.chords = now;
      }
    }
  }

  animateKeyboardFeedback(side: InstrumentSide, noteIndex: number): void {
    const instrumentId = side === 'left' ? 'leftInstrument' : 'rightInstrument';
    const instrument = document.getElementById(instrumentId);

    if (instrument) {
      // Add keyboard glow effect
      instrument.style.boxShadow = '0 0 25px rgba(255, 255, 0, 0.8)';
      instrument.style.borderColor = '#ffff00';

      setTimeout(() => {
        instrument.style.boxShadow = '';
        instrument.style.borderColor = '#3498db';
      }, 200);

      // Animate inner circle
      const innerId = side === 'left' ? 'leftInner' : 'rightInner';
      const inner = document.getElementById(innerId);

      if (inner) {
        // Calculate position based on note index — noteIndex 0 is at top
        const degrees = noteIndex * 45;
        const angle = (degrees * Math.PI) / 180;

        const radius = 60;
        const x = Math.cos(angle - Math.PI / 2) * radius; // -PI/2 to put 0 at top
        const y = Math.sin(angle - Math.PI / 2) * radius;

        inner.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        inner.style.background = 'linear-gradient(135deg, #ffff00, #ffd700)';

        // Reset after animation
        setTimeout(() => {
          inner.style.transform = 'translate(-50%, -50%)';
          inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
        }, 200);
      }
    }
  }

  clearKeyboardVisuals(): void {
    // Reset any keyboard-specific visual effects
    document.querySelectorAll('.instrument').forEach((instrument) => {
      if (instrument instanceof HTMLElement) {
        instrument.style.boxShadow = '';
        instrument.style.borderColor = '#3498db';
      }
    });

    document.querySelectorAll('.instrument-inner').forEach((inner) => {
      if (inner instanceof HTMLElement) {
        inner.style.transform = 'translate(-50%, -50%)';
        inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
      }
    });
  }

  showKeyboardIndicator(show: boolean): void {
    let indicator = document.getElementById('keyboardIndicator');

    if (show && !indicator) {
      indicator = document.createElement('div');
      indicator.id = 'keyboardIndicator';
      indicator.innerHTML = `
        ⌨️ Keyboard Active<br>
        <small style="line-height: 1.4;">
          <strong>WASD:</strong> Notes<br>
          <strong>Arrows:</strong> Chords
        </small>
      `;
      indicator.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: linear-gradient(135deg, #6f42c1, #563d7c);
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease;
        text-align: center;
        line-height: 1.2;
        box-shadow: 0 4px 15px rgba(111, 66, 193, 0.3);
      `;
      document.body.appendChild(indicator);
    } else if (!show && indicator) {
      indicator.remove();
    }
  }

  // Manually disable keyboard control (used when modals open)
  disableKeyboardControl(): void {
    // Clear all current key states
    Object.keys(this.keyStates).forEach((key) => {
      this.keyStates[key] = false;
    });

    // Clear any pending timeouts
    if (this.combinationTimeout !== null) {
      clearTimeout(this.combinationTimeout);
      this.combinationTimeout = null;
    }

    // Clear triggered combinations
    this.triggeredCombos.clear();

    // Clear visual feedback
    this.clearKeyboardVisuals();
  }
}
