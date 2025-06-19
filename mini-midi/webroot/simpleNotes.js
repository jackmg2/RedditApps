// Enhanced SimpleNotes.js - Improved Notes System with Scale Support
export class SimpleNotes {
    constructor(audio) {
        this.audio = audio;
        this.currentOctave = 4;
        this.lastChordTime = 0;
        this.chordDelay = 50; // Minimum ms between chord changes to prevent audio chaos
        this.currentScale = 'major'; // Default scale
        
        // Define musical scales (semitones from root)
        this.scales = {
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],  // All 12 notes
            major: [0, 2, 4, 5, 7, 9, 11, 12],                   // Major scale
            minor: [0, 2, 3, 5, 7, 8, 10, 12],                   // Natural minor
            pentatonic: [0, 2, 4, 7, 9, 12, 14, 16],             // Major pentatonic
            blues: [0, 3, 5, 6, 7, 10, 12, 15],                  // Blues scale
            dorian: [0, 2, 3, 5, 7, 9, 10, 12],                  // Dorian mode
            mixolydian: [0, 2, 4, 5, 7, 9, 10, 12]               // Mixolydian mode
        };

        // Define which of the 8 positions are active for each scale
        this.scaleActivePositions = {
            chromatic: [true, true, true, true, true, true, true, true],  // All active
            major: [true, true, true, true, true, true, true, true],      // All map to major scale
            minor: [true, true, true, true, true, true, true, true],      // All map to minor scale
            pentatonic: [true, true, true, false, true, true, false, true], // Skip 4th and 7th
            blues: [true, false, true, true, true, false, true, true],    // Skip 2nd and 6th
            dorian: [true, true, true, true, true, true, true, true],     // All active
            mixolydian: [true, true, true, true, true, true, true, true]  // All active
        };

        // Scale-appropriate chord progressions
        this.scaleChords = {
            major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'],
            minor: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major', 'minor'],
            pentatonic: ['major', 'minor', 'major', 'major', 'minor', 'major', 'minor', 'major'],
            blues: ['dominant7', 'minor', 'major', 'dominant7', 'dominant7', 'minor', 'major', 'dominant7'],
            dorian: ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major', 'minor'],
            mixolydian: ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'],
            chromatic: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major']
        };
    }

    setScale(scaleName) {
        if (this.scales[scaleName]) {
            this.currentScale = scaleName;
            console.log(`Scale changed to: ${scaleName}`);
            this.updateScaleUI();
            return true;
        }
        return false;
    }

    changeScale(direction) {
        const scaleNames = Object.keys(this.scales);
        const currentIndex = scaleNames.indexOf(this.currentScale);
        
        let newIndex;
        if (direction > 0) {
            // Next scale
            newIndex = (currentIndex + 1) % scaleNames.length;
        } else {
            // Previous scale
            newIndex = (currentIndex - 1 + scaleNames.length) % scaleNames.length;
        }
        
        const newScale = scaleNames[newIndex];
        this.currentScale = newScale;
        console.log(`Scale changed to: ${newScale}`);
        this.updateScaleUI();
        return newScale;
    }

    updateScaleUI() {
        const activePositions = this.scaleActivePositions[this.currentScale];
        
        // Update both instruments
        ['leftInstrument', 'rightInstrument'].forEach(instrumentId => {
            const instrument = document.getElementById(instrumentId);
            if (!instrument) return;
            
            for (let i = 0; i < 8; i++) {
                const isActive = activePositions[i];
                
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
                if (externalLabel) {
                    if (isActive) {
                        externalLabel.classList.remove('disabled');
                        externalLabel.style.display = '';
                    } else {
                        externalLabel.classList.add('disabled');
                        externalLabel.style.display = 'none';
                    }
                }
            }
        });
    }

    getCurrentScale() {
        return this.currentScale;
    }

    // Get frequency for a note index within the current scale
    getScaleFrequency(noteIndex, octave = 4) {
        const scaleIntervals = this.scales[this.currentScale];
        const scaleNote = scaleIntervals[noteIndex % scaleIntervals.length];
        
        // Calculate octave adjustment if we go beyond the scale length
        const octaveAdjustment = Math.floor(noteIndex / scaleIntervals.length);
        const actualOctave = octave + octaveAdjustment;
        
        // Base frequency for C4
        const baseFreq = 261.626; // C4
        
        // Calculate frequency using equal temperament
        const semitones = scaleNote;
        const frequency = baseFreq * Math.pow(2, (actualOctave - 4) + (semitones / 12));
        
        return frequency;
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
            // Check if this position is active in the current scale
            const activePositions = this.scaleActivePositions[this.currentScale];
            if (!activePositions[noteIndex]) {
                console.log(`Note position ${noteIndex} is disabled in ${this.currentScale} scale`);
                return null; // Don't play disabled notes
            }
            
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

        const frequency = this.getScaleFrequency(noteIndex, this.currentOctave);
        
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

        // Get appropriate chord type for the current scale
        const chordType = this.getChordTypeForScale(noteIndex);
        
        // Use slightly lower octave for chords to avoid muddiness in higher frequencies
        const chordOctave = Math.max(3, this.currentOctave - 1);
        
        const frequencies = this.getScaleChordFrequencies(noteIndex, chordOctave, chordType);
        
        console.log(`Playing ${chordType} chord on note ${noteIndex} in ${this.currentScale} scale, frequencies:`, frequencies.map(f => f.toFixed(1)));
        
        return this.audio.playChord(frequencies, 1.2, chordType);
    }

    getChordTypeForScale(noteIndex) {
        const scaleChords = this.scaleChords[this.currentScale] || this.scaleChords.major;
        return scaleChords[noteIndex % scaleChords.length];
    }

    getScaleChordFrequencies(rootNoteIndex, octave = 4, chordType = 'major') {
        const root = this.getScaleFrequency(rootNoteIndex, octave);
        const scaleIntervals = this.scales[this.currentScale];

        // Build chord using scale degrees instead of chromatic intervals
        switch (chordType) {
            case 'major':
                return [
                    root,                                           // Root (1st)
                    this.getScaleFrequency(rootNoteIndex + 2, octave), // Third (3rd)
                    this.getScaleFrequency(rootNoteIndex + 4, octave), // Fifth (5th)
                    this.getScaleFrequency(rootNoteIndex + 7, octave)  // Octave (8th)
                ];
            
            case 'minor':
                return [
                    root,                                           // Root
                    this.getScaleFrequency(rootNoteIndex + 2, octave), // Minor third
                    this.getScaleFrequency(rootNoteIndex + 4, octave), // Fifth
                    this.getScaleFrequency(rootNoteIndex + 6, octave)  // Minor seventh
                ];
            
            case 'diminished':
                return [
                    root,                                           // Root
                    this.getScaleFrequency(rootNoteIndex + 2, octave), // Minor third
                    this.getScaleFrequency(rootNoteIndex + 4, octave)  // Diminished fifth
                ];
            
            case 'dominant7':
            case 'seventh':
                return [
                    root,                                           // Root
                    this.getScaleFrequency(rootNoteIndex + 2, octave), // Third
                    this.getScaleFrequency(rootNoteIndex + 4, octave), // Fifth
                    this.getScaleFrequency(rootNoteIndex + 6, octave)  // Seventh
                ];
            
            default:
                return [root];
        }
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

    // Get note name for display (updated for scales)
    getNoteNameByIndex(noteIndex) {
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];
        const scaleIntervals = this.scales[this.currentScale];
        
        // For chromatic, use all note names, for scales use scale degrees
        if (this.currentScale === 'chromatic') {
            return noteNames[noteIndex % 12];
        } else {
            // Map to scale degree names
            const scaleDegreeNames = ['1', '2', '3', '4', '5', '6', '7', '8'];
            return scaleDegreeNames[noteIndex % scaleIntervals.length];
        }
    }

    // Get chord name for display (updated for scales)
    getChordNameByIndex(noteIndex) {
        const chordType = this.getChordTypeForScale(noteIndex);
        const noteName = this.getNoteNameByIndex(noteIndex);
        
        const chordSuffixes = {
            'major': '',
            'minor': 'm',
            'diminished': '°',
            'dominant7': '7',
            'seventh': '7'
        };
        
        return noteName + (chordSuffixes[chordType] || '');
    }
}