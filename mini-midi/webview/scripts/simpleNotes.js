// simpleNotes.js - Simple notes system without external dependencies

class SimpleNotes {
    constructor(audio) {
        this.audio = audio;
        this.currentOctave = 4;
        this.currentChord = 4;
        this.currentLeftTone = 0;
        this.currentRightTone = 0;
        
        // Note definitions
        this.noteNames = {
            western: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C\''],
            solfege: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do\'']
        };
        
        // Chord types based on left tone selection
        this.chordTypes = [
            'major',    // 0 - default
            'major',    // 1 - tones
            'major',    // 2 - semitones  
            'minor'     // 3 - minor
        ];
        
        this.activeNotes = new Set();
        this.activeChords = new Set();
    }

    // Get note name based on index and naming system
    getNoteName(noteIndex, namingSystem = 'western') {
        if (noteIndex < 0 || noteIndex >= 8) return '';
        return this.noteNames[namingSystem][noteIndex];
    }

    // Calculate note index from angle (for circular interface)
    angleToNoteIndex(angle) {
        // Convert angle (-π to π) to note index (0-7)
        let degrees = (angle * 180 / Math.PI + 360) % 360;
        
        // Map to 8 segments around the circle
        // Starting from top (270°) and going clockwise
        degrees = (degrees + 45) % 360; // Offset to align with UI
        return Math.floor(degrees / 45);
    }

    // Play a single note
    playNote(noteIndex, side = 'right') {
        if (!this.audio.isAvailable()) return null;

        const frequency = this.audio.getFrequency(noteIndex, this.currentOctave);
        
        // Apply tone modifications
        let modifiedFreq = frequency;
        if (side === 'right' && this.currentRightTone === 1) {
            // Semitones - shift up by half step
            modifiedFreq = frequency * Math.pow(2, 1/12);
        }
        
        const note = this.audio.playNote(modifiedFreq, 0.8);
        
        if (note) {
            const noteKey = `${side}_${noteIndex}`;
            this.activeNotes.add(noteKey);
            
            // Clean up when note ends
            note.oscillator.addEventListener('ended', () => {
                this.activeNotes.delete(noteKey);
            });
        }
        
        return note;
    }

    // Play a chord
    playChord(noteIndex, side = 'left') {
        if (!this.audio.isAvailable()) return null;

        const chordType = this.chordTypes[this.currentLeftTone];
        const frequencies = this.audio.getChordFrequencies(
            noteIndex, 
            this.currentChord, 
            chordType
        );
        
        const chord = this.audio.playChord(frequencies, 1.0);
        
        if (chord) {
            const chordKey = `${side}_chord_${noteIndex}`;
            this.activeChords.add(chordKey);
            
            // Clean up when chord ends
            setTimeout(() => {
                this.activeChords.delete(chordKey);
            }, 1000);
        }
        
        return chord;
    }

    // Handle instrument interaction
    handleInstrumentTouch(x, y, side) {
        // Calculate angle from center
        const angle = Math.atan2(y, x);
        const noteIndex = this.angleToNoteIndex(angle);
        
        // Calculate distance from center (for future use)
        const distance = Math.sqrt(x * x + y * y);
        
        if (distance > 0.3) { // Only play if touch is outside center area
            if (side === 'left') {
                return this.playChord(noteIndex, side);
            } else {
                return this.playNote(noteIndex, side);
            }
        }
        
        return null;
    }

    // Octave controls
    incrementOctave() {
        this.currentOctave = Math.min(6, this.currentOctave + 1);
        return this.currentOctave;
    }

    decrementOctave() {
        this.currentOctave = Math.max(1, this.currentOctave - 1);
        return this.currentOctave;
    }

    resetOctave() {
        this.currentOctave = 4;
        return this.currentOctave;
    }

    // Chord controls
    incrementChord() {
        this.currentChord = Math.min(9, this.currentChord + 1);
        return this.currentChord;
    }

    decrementChord() {
        this.currentChord = Math.max(1, this.currentChord - 1);
        return this.currentChord;
    }

    resetChord() {
        this.currentChord = 4;
        return this.currentChord;
    }

    // Tone controls
    setLeftTone(toneType) {
        this.currentLeftTone = toneType;
        return this.currentLeftTone;
    }

    setRightTone(toneType) {
        this.currentRightTone = toneType;
        return this.currentRightTone;
    }

    // Get current state
    getState() {
        return {
            octave: this.currentOctave,
            chord: this.currentChord,
            leftTone: this.currentLeftTone,
            rightTone: this.currentRightTone,
            activeNotes: Array.from(this.activeNotes),
            activeChords: Array.from(this.activeChords)
        };
    }

    // Set state (for playback)
    setState(state) {
        this.currentOctave = state.octave || 4;
        this.currentChord = state.chord || 4;
        this.currentLeftTone = state.leftTone || 0;
        this.currentRightTone = state.rightTone || 0;
    }

    // Stop all active sounds
    stopAll() {
        this.audio.stopAll();
        this.activeNotes.clear();
        this.activeChords.clear();
    }

    // Get note info for UI display
    getNoteInfo(noteIndex, namingSystem = 'western') {
        const noteName = this.getNoteName(noteIndex, namingSystem);
        const frequency = this.audio.getFrequency(noteIndex, this.currentOctave);
        
        return {
            name: noteName,
            frequency: Math.round(frequency * 100) / 100,
            octave: this.currentOctave,
            index: noteIndex
        };
    }

    // Get chord info for UI display
    getChordInfo(noteIndex) {
        const chordType = this.chordTypes[this.currentLeftTone];
        const rootNote = this.getNoteName(noteIndex);
        const frequencies = this.audio.getChordFrequencies(
            noteIndex, 
            this.currentChord, 
            chordType
        );
        
        return {
            root: rootNote,
            type: chordType,
            frequencies: frequencies.map(f => Math.round(f * 100) / 100),
            chord: this.currentChord
        };
    }

    // Scale detection for advanced users
    getCurrentScale() {
        const scaleTypes = {
            0: 'Ionian (Major)',
            1: 'Dorian',
            2: 'Phrygian', 
            3: 'Lydian',
            4: 'Mixolydian',
            5: 'Aeolian (Minor)',
            6: 'Locrian'
        };
        
        return scaleTypes[this.currentChord % 7] || 'Custom';
    }

    // Generate a simple melody pattern
    generateMelodyPattern() {
        const patterns = [
            [0, 2, 4, 2], // C-E-G-E
            [0, 1, 2, 3], // C-D-E-F
            [4, 3, 2, 1], // G-F-E-D
            [0, 4, 3, 0], // C-G-F-C
            [2, 4, 6, 4]  // E-G-B-G
        ];
        
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    // Auto-play a pattern (for demo purposes)
    async playPattern(pattern, tempo = 500) {
        for (let i = 0; i < pattern.length; i++) {
            this.playNote(pattern[i]);
            await new Promise(resolve => setTimeout(resolve, tempo));
        }
    }
}

export { SimpleNotes };