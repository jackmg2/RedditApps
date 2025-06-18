// Enhanced SimpleNotes.js - Improved Notes System with Better Chords
export class SimpleNotes {
    constructor(audio) {
        this.audio = audio;
        this.currentOctave = 4;
        this.lastChordTime = 0;
        this.chordDelay = 50; // Minimum ms between chord changes to prevent audio chaos
    }

    angleToNoteIndex(angle) {
        // Convert angle to degrees and normalize to 0-360
        let degrees = (angle * 180 / Math.PI + 360) % 360;
        
        // Adjust for the pie slice layout - flip by 180° since it's opposite
        degrees = (degrees + 22.5 + 180) % 360;
        
        // Calculate which slice (0-7)
        const noteIndex = Math.floor(degrees / 45);
        
        console.log(`Angle: ${(angle * 180 / Math.PI).toFixed(1)}°, Adjusted: ${degrees.toFixed(1)}°, Note Index: ${noteIndex}`);
        
        return noteIndex;
    }

    handleInstrumentTouch(x, y, side) {
        const angle = Math.atan2(y, x);
        const noteIndex = this.angleToNoteIndex(angle);
        const distance = Math.sqrt(x * x + y * y);

        if (distance > 0.3) {
            if (side === 'left') {
                return this.playNote(noteIndex);
            } else {
                return this.playChord(noteIndex);
            }
        }
        return null;
    }

    playNote(noteIndex) {
        if (!this.audio.isAvailable()) return null;

        const frequency = this.audio.getFrequency(noteIndex, this.currentOctave);
        
        // Use different waveforms based on note for variety
        const waveforms = ['square', 'sawtooth', 'triangle'];
        const waveform = waveforms[noteIndex % 3];
        
        return this.audio.playNote(frequency, 0.6, waveform, 0.12);
    }

    playChord(noteIndex) {
        if (!this.audio.isAvailable()) return null;

        // Prevent chord spam
        const now = Date.now();
        if (now - this.lastChordTime < this.chordDelay) {
            return null;
        }
        this.lastChordTime = now;

        // Get appropriate chord type for musical context
        const chordType = this.audio.getChordTypeForNote(noteIndex);
        
        // Use slightly lower octave for chords to avoid muddiness in higher frequencies
        const chordOctave = Math.max(3, this.currentOctave - 1);
        
        const frequencies = this.audio.getChordFrequencies(noteIndex, chordOctave, chordType);
        
        console.log(`Playing ${chordType} chord on note ${noteIndex}, frequencies:`, frequencies.map(f => f.toFixed(1)));
        
        return this.audio.playChord(frequencies, 1.2, chordType);
    }

    // Add method to change octave
    changeOctave(direction) {
        if (direction > 0 && this.currentOctave < 6) {
            this.currentOctave++;
        } else if (direction < 0 && this.currentOctave > 2) {
            this.currentOctave--;
        }
        console.log(`Octave changed to: ${this.currentOctave}`);
        return this.currentOctave;
    }

    getCurrentOctave() {
        return this.currentOctave;
    }

    // Get note name for display
    getNoteNameByIndex(noteIndex) {
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];
        return noteNames[noteIndex % 8];
    }

    // Get chord name for display
    getChordNameByIndex(noteIndex) {
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];
        const chordType = this.audio.getChordTypeForNote(noteIndex);
        const note = noteNames[noteIndex % 8];
        
        const chordSuffixes = {
            'major': '',
            'minor': 'm',
            'seventh': '7',
            'sus4': 'sus4',
            'add9': 'add9'
        };
        
        return note + (chordSuffixes[chordType] || '');
    }
}