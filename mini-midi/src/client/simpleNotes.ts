// Scale-based chord progression system — C on top of the circle.
import type { ScaleName } from '../shared/api';
import type { ChordHandle, NoteHandle, SimpleAudio } from './simpleAudio';

export type ChordType =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'dominant7'
  | 'minor7'
  | 'major7'
  | 'sus4'
  | 'add9';

export type ChordProgression = {
  chordTypes: ChordType[];
  chordNames: string[];
  description: string;
};

export const SCALE_ORDER: ScaleName[] = [
  'chromatic',
  'major',
  'minor',
  'pentatonic',
  'blues',
  'dorian',
  'mixolydian',
];

export class SimpleNotes {
  audio: SimpleAudio;
  currentOctave = 4;
  lastChordTime = 0;
  chordDelay = 50; // Minimum ms between chord changes to prevent audio chaos
  currentScale: ScaleName = 'major';

  // Musical scales (semitones from root)
  scales: Record<ScaleName, number[]> = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // All 12 notes
    major: [0, 2, 4, 5, 7, 9, 11, 12], // Major scale
    minor: [0, 2, 3, 5, 7, 8, 10, 12], // Natural minor
    pentatonic: [0, 2, 4, 7, 9, 12, 14, 16], // Major pentatonic
    blues: [0, 3, 5, 6, 7, 10, 12, 15], // Blues scale
    dorian: [0, 2, 3, 5, 7, 9, 10, 12], // Dorian mode
    mixolydian: [0, 2, 4, 5, 7, 9, 10, 12], // Mixolydian mode
  };

  // Which of the 8 positions are active for each scale
  scaleActivePositions: Record<ScaleName, boolean[]> = {
    chromatic: [true, true, true, true, true, true, true, true],
    major: [true, true, true, true, true, true, true, true],
    minor: [true, true, true, true, true, true, true, true],
    pentatonic: [true, true, true, false, true, true, false, true], // Skip 4th and 7th
    blues: [true, false, true, true, true, false, true, true], // Skip 2nd and 6th
    dorian: [true, true, true, true, true, true, true, true],
    mixolydian: [true, true, true, true, true, true, true, true],
  };

  // Scale-appropriate chord progressions with Roman numeral analysis
  scaleChordProgressions: Record<ScaleName, ChordProgression> = {
    major: {
      // I-ii-iii-IV-V-vi-vii°-I (Major scale harmonization)
      chordTypes: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'],
      chordNames: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'I'],
      description: 'Classic major scale harmony - bright and uplifting',
    },
    minor: {
      // i-ii°-III-iv-v-VI-VII-i (Natural minor harmonization)
      chordTypes: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major', 'minor'],
      chordNames: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII', 'i'],
      description: 'Natural minor harmony - dark and emotional',
    },
    pentatonic: {
      // Simplified harmony emphasizing I, IV, V
      chordTypes: ['major', 'minor', 'major', 'major', 'major', 'minor', 'major', 'major'],
      chordNames: ['I', 'ii', 'III', 'IV', 'V', 'vi', 'V', 'I'],
      description: 'Folk-inspired harmony - simple and singable',
    },
    blues: {
      // Blues harmony with dominant 7ths
      chordTypes: [
        'dominant7',
        'minor',
        'dominant7',
        'dominant7',
        'dominant7',
        'minor',
        'dominant7',
        'dominant7',
      ],
      chordNames: ['I7', 'ii', 'iii7', 'IV7', 'V7', 'vi', 'vii7', 'I7'],
      description: 'Blues harmony - gritty and soulful',
    },
    dorian: {
      // Dorian harmony emphasizing the characteristic iv chord
      chordTypes: ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major', 'minor'],
      chordNames: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII', 'i'],
      description: 'Dorian harmony - melancholic yet hopeful',
    },
    mixolydian: {
      // Mixolydian harmony with characteristic bVII
      chordTypes: ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'],
      chordNames: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'bVII', 'I'],
      description: 'Mixolydian harmony - modal and mystical',
    },
    chromatic: {
      // Chromatic allows for more complex harmony
      chordTypes: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'],
      chordNames: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'I'],
      description: 'Chromatic harmony - anything goes!',
    },
  };

  // Chord quality definitions for building actual chords
  chordIntervals: Record<ChordType, number[]> = {
    major: [0, 4, 7], // Root, Major 3rd, Perfect 5th
    minor: [0, 3, 7], // Root, Minor 3rd, Perfect 5th
    diminished: [0, 3, 6], // Root, Minor 3rd, Diminished 5th
    dominant7: [0, 4, 7, 10], // Root, Major 3rd, Perfect 5th, Minor 7th
    minor7: [0, 3, 7, 10], // Root, Minor 3rd, Perfect 5th, Minor 7th
    major7: [0, 4, 7, 11], // Root, Major 3rd, Perfect 5th, Major 7th
    sus4: [0, 5, 7], // Root, Perfect 4th, Perfect 5th
    add9: [0, 4, 7, 14], // Root, Major 3rd, Perfect 5th, 9th
  };

  constructor(audio: SimpleAudio) {
    this.audio = audio;
  }

  setScale(scaleName: ScaleName): boolean {
    this.currentScale = scaleName;
    console.log(`Scale changed to: ${scaleName}`);
    console.log(`Chord progression: ${this.scaleChordProgressions[scaleName].description}`);
    this.updateScaleUI();
    return true;
  }

  changeScale(direction: number): ScaleName {
    const currentIndex = SCALE_ORDER.indexOf(this.currentScale);

    let newIndex: number;
    if (direction > 0) {
      newIndex = (currentIndex + 1) % SCALE_ORDER.length;
    } else {
      newIndex = (currentIndex - 1 + SCALE_ORDER.length) % SCALE_ORDER.length;
    }

    const newScale = SCALE_ORDER[newIndex] ?? 'major';
    this.currentScale = newScale;
    console.log(`Scale changed to: ${newScale}`);
    console.log(`Chord progression: ${this.scaleChordProgressions[newScale].description}`);
    this.updateScaleUI();
    return newScale;
  }

  updateScaleUI(): void {
    const activePositions = this.scaleActivePositions[this.currentScale];

    // Update both instruments
    ['leftInstrument', 'rightInstrument'].forEach((instrumentId) => {
      const instrument = document.getElementById(instrumentId);
      if (!instrument) return;

      for (let i = 0; i < 8; i++) {
        const isActive = activePositions[i] ?? false;

        // Update pie slice
        const noteIndicator = instrument.querySelector(`.note-${i}`);
        if (noteIndicator) {
          const segment = noteIndicator.querySelector('.segment .inner');
          if (segment) {
            if (isActive) {
              segment.classList.remove('disabled');
            } else {
              segment.classList.add('disabled');
            }
          }
        }

        // Update external label
        const externalLabel = instrument.querySelector(`[data-note-index="${i}"]`);
        if (externalLabel instanceof HTMLElement) {
          if (isActive) {
            externalLabel.classList.remove('disabled');
            externalLabel.style.display = '';

            // Update label with chord name for right instrument
            if (instrumentId === 'rightInstrument') {
              externalLabel.textContent = this.getChordNameByIndex(i);
            }
          } else {
            externalLabel.classList.add('disabled');
            externalLabel.style.display = 'none';
          }
        }
      }
    });
  }

  getCurrentScale(): ScaleName {
    return this.currentScale;
  }

  // Get frequency for a note index within the current scale
  getScaleFrequency(noteIndex: number, octave = 4): number {
    const scaleIntervals = this.scales[this.currentScale];
    const scaleNote = scaleIntervals[noteIndex % scaleIntervals.length] ?? 0;

    // Calculate octave adjustment if we go beyond the scale length
    const octaveAdjustment = Math.floor(noteIndex / scaleIntervals.length);
    const actualOctave = octave + octaveAdjustment;

    // Base frequency for C4
    const baseFreq = 261.626; // C4

    // Calculate frequency using equal temperament
    return baseFreq * Math.pow(2, actualOctave - 4 + scaleNote / 12);
  }

  angleToNoteIndex(angle: number): number {
    // Convert angle to degrees and normalize to 0-360
    let degrees = ((angle * 180) / Math.PI + 360) % 360;

    // Adjust for C being at top (12 o'clock) - add 90° to make top = 0°
    degrees = (degrees + 90 + 22.5) % 360;

    // Calculate which slice (0-7)
    return Math.floor(degrees / 45);
  }

  handleInstrumentTouch(
    x: number,
    y: number,
    side: 'left' | 'right'
  ): NoteHandle | ChordHandle | null {
    const angle = Math.atan2(y, x);
    const noteIndex = this.angleToNoteIndex(angle);
    const distance = Math.sqrt(x * x + y * y);

    if (distance > 0.3) {
      // Check if this position is active in the current scale
      const activePositions = this.scaleActivePositions[this.currentScale];
      if (!activePositions[noteIndex]) {
        console.log(`Note position ${noteIndex} is disabled in ${this.currentScale} scale`);
        return null; // Don't play disabled notes
      }

      if (side === 'left') {
        return this.playNote(noteIndex);
      }
      return this.playChord(noteIndex);
    }
    return null;
  }

  playNote(noteIndex: number): NoteHandle | null {
    if (!this.audio.isAvailable()) return null;

    const frequency = this.getScaleFrequency(noteIndex, this.currentOctave);

    // Use different waveforms based on note for variety
    const waveforms: OscillatorType[] = ['square', 'sawtooth', 'triangle'];
    const waveform = waveforms[noteIndex % 3] ?? 'sawtooth';

    return this.audio.playNote(frequency, 0.6, waveform, 0.12);
  }

  playChord(noteIndex: number): ChordHandle | null {
    if (!this.audio.isAvailable()) return null;

    // Prevent chord spam
    const now = Date.now();
    if (now - this.lastChordTime < this.chordDelay) {
      return null;
    }
    this.lastChordTime = now;

    // Get appropriate chord type for the current scale and position
    const chordProgression = this.scaleChordProgressions[this.currentScale];
    const chordType =
      chordProgression.chordTypes[noteIndex % chordProgression.chordTypes.length] ?? 'major';

    // Use slightly lower octave for chords to avoid muddiness in higher frequencies
    const chordOctave = Math.max(3, this.currentOctave - 1);

    const frequencies = this.buildScaleChord(noteIndex, chordOctave, chordType);

    return this.audio.playChord(frequencies, 1.2);
  }

  // Build chords using the scale and chord type
  buildScaleChord(rootNoteIndex: number, octave = 4, chordType: ChordType = 'major'): number[] {
    const rootFreq = this.getScaleFrequency(rootNoteIndex, octave);
    const intervals = this.chordIntervals[chordType];

    return intervals.map((interval) => rootFreq * Math.pow(2, interval / 12));
  }

  changeOctave(direction: number): number {
    if (direction > 0 && this.currentOctave < 6) {
      this.currentOctave++;
    } else if (direction < 0 && this.currentOctave > 2) {
      this.currentOctave--;
    }
    console.log(`Octave changed to: ${this.currentOctave}`);
    return this.currentOctave;
  }

  getCurrentOctave(): number {
    return this.currentOctave;
  }

  // Get note name for display
  getNoteNameByIndex(noteIndex: number): string {
    const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];

    if (this.currentScale === 'chromatic') {
      return noteNames[noteIndex % 12] ?? '—';
    }

    // For pentatonic and blues, show only active notes
    if (this.currentScale === 'pentatonic' || this.currentScale === 'blues') {
      const activePositions = this.scaleActivePositions[this.currentScale];
      if (!activePositions[noteIndex]) {
        return '—'; // Show dash for inactive positions
      }
    }
    return noteNames[noteIndex % 8] ?? '—';
  }

  // Get chord name based on scale position and chord progression
  getChordNameByIndex(noteIndex: number): string {
    const chordProgression = this.scaleChordProgressions[this.currentScale];
    const chordType = chordProgression.chordTypes[noteIndex] ?? 'major';
    const rootNote = this.getNoteNameByIndex(noteIndex);

    return `${rootNote}${this.getChordSuffix(chordType)}`;
  }

  // Helper to get chord suffix symbols
  getChordSuffix(chordType: ChordType): string {
    const suffixes: Record<ChordType, string> = {
      major: '',
      minor: 'm',
      diminished: '°',
      dominant7: '7',
      minor7: 'm7',
      major7: 'M7',
      sus4: 'sus4',
      add9: 'add9',
    };
    return suffixes[chordType];
  }

  // Get the current scale's chord progression info for UI display
  getScaleProgressionInfo(): ChordProgression {
    return this.scaleChordProgressions[this.currentScale];
  }
}
