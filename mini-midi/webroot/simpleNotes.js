// SimpleNotes.js - Notes System for FF7 Musical Interface
export class SimpleNotes {
    constructor(audio) {
        this.audio = audio;
        this.currentOctave = 4;
    }

    angleToNoteIndex(angle) {
        // Convert angle to degrees and normalize to 0-360
        let degrees = (angle * 180 / Math.PI + 360) % 360;
        
        // Adjust for the pie slice layout - flip by 180° since it's opposite
        // note-0 is at -22.5° (337.5°), note-1 at 22.5°, etc.
        // Each slice spans 45 degrees
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
        return this.audio.playNote(frequency, 0.6);
    }

    playChord(noteIndex) {
        if (!this.audio.isAvailable()) return null;

        const frequencies = this.audio.getChordFrequencies(noteIndex, this.currentOctave, 'major');
        return this.audio.playChord(frequencies, 1.0);
    }
}