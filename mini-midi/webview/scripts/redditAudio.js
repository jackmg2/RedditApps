// webview/scripts/redditAudio.js - Extended audio engine for Reddit
class RedditAudio {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.player = new WebAudioFontPlayer();
        this.player.loader.decodeAfterLoading(audioContext, '_tone_0000_Chaos_sf2_file');
        this.masterVolume = 0.7;
        this.activeNotes = new Map();
        this.activeChords = new Map();
        this.gainNode = this.createMasterGain();
    }

    createMasterGain() {
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.masterVolume;
        gainNode.connect(this.audioContext.destination);
        return gainNode;
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.gainNode.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
    }

    playNote(note) {
        const noteKey = `note_${note.key}`;
        
        // Stop existing note if playing
        if (this.activeNotes.has(noteKey)) {
            this.stopNote(this.activeNotes.get(noteKey));
        }

        note.envelope = this.player.queueWaveTable(
            this.audioContext, 
            this.gainNode, 
            _tone_0000_Chaos_sf2_file, 
            0, 
            note.key, 
            999, 
            1.0 // Use full volume, master gain controls overall volume
        );
        
        this.activeNotes.set(noteKey, note);
        return note;
    }

    stopNote(note) {
        if (note && note.envelope) {
            note.envelope.cancel();
            note.envelope = null;
            
            // Remove from active notes
            for (let [key, activeNote] of this.activeNotes.entries()) {
                if (activeNote === note) {
                    this.activeNotes.delete(key);
                    break;
                }
            }
        }
        return null;
    }

    playChord(chord) {
        const chordKey = `chord_${chord.key.join('_')}`;
        
        // Stop existing chord if playing
        if (this.activeChords.has(chordKey)) {
            this.stopChord(this.activeChords.get(chordKey));
        }

        chord.envelope = [];
        for (let i = 0; i < chord.key.length; i++) {
            const envelope = this.player.queueWaveTable(
                this.audioContext, 
                this.gainNode, 
                _tone_0000_Chaos_sf2_file, 
                0, 
                chord.key[i], 
                999, 
                0.8 // Slightly lower volume for individual notes in chord
            );
            chord.envelope.push(envelope);
        }
        
        this.activeChords.set(chordKey, chord);
        return chord;
    }

    stopChord(chord) {
        if (chord && chord.envelope) {
            for (let i = 0; i < chord.envelope.length; i++) {
                if (chord.envelope[i]) {
                    chord.envelope[i].cancel();
                }
            }
            chord.envelope = [];
            
            // Remove from active chords
            for (let [key, activeChord] of this.activeChords.entries()) {
                if (activeChord === chord) {
                    this.activeChords.delete(key);
                    break;
                }
            }
        }
        return null;
    }

    stopAll() {
        // Stop all active notes
        for (let note of this.activeNotes.values()) {
            this.stopNote(note);
        }
        
        // Stop all active chords
        for (let chord of this.activeChords.values()) {
            this.stopChord(chord);
        }
        
        this.activeNotes.clear();
        this.activeChords.clear();
    }

    // Fade in/out for smooth transitions
    fadeIn(duration = 0.1) {
        const currentTime = this.audioContext.currentTime;
        this.gainNode.gain.setValueAtTime(0, currentTime);
        this.gainNode.gain.linearRampToValueAtTime(this.masterVolume, currentTime + duration);
    }

    fadeOut(duration = 0.1) {
        const currentTime = this.audioContext.currentTime;
        this.gainNode.gain.setValueAtTime(this.masterVolume, currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
    }

    // Get audio context state for debugging
    getAudioState() {
        return {
            state: this.audioContext.state,
            currentTime: this.audioContext.currentTime,
            activeNotes: this.activeNotes.size,
            activeChords: this.activeChords.size,
            masterVolume: this.masterVolume
        };
    }

    // Method for collaborative audio sync
    syncWithCollaborators(audioData) {
        // TODO: Implement collaborative audio synchronization
        // This would sync audio state with other users in the same session
        
        // Example implementation:
        if (audioData.notes) {
            // Sync active notes with collaborators
            for (let noteData of audioData.notes) {
                if (!this.activeNotes.has(noteData.key)) {
                    this.playNote({ key: noteData.noteValue });
                }
            }
        }
        
        if (audioData.chords) {
            // Sync active chords with collaborators
            for (let chordData of audioData.chords) {
                if (!this.activeChords.has(chordData.key)) {
                    this.playChord({ key: chordData.chordValues });
                }
            }
        }
    }

    // Resume audio context if suspended (for mobile browsers)
    async resumeAudioContext() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Check if audio is supported
    isAudioSupported() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    // Create audio visualization data
    getVisualizationData() {
        // This could be extended to provide audio analysis data
        // for visual effects synchronized with the music
        return {
            activeNotesCount: this.activeNotes.size,
            activeChordsCount: this.activeChords.size,
            volume: this.masterVolume,
            timestamp: this.audioContext.currentTime
        };
    }
}

export { RedditAudio };