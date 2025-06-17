// SimpleAudio.js - Audio Engine for FF7 Musical Interface
export class SimpleAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.masterVolume = 0.3;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.audioContext.destination);

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.isInitialized = true;
            console.log('Audio initialized successfully');
            return true;
        } catch (error) {
            console.error('Audio initialization failed:', error);
            return false;
        }
    }

    isAvailable() {
        return this.isInitialized && this.audioContext && this.audioContext.state === 'running';
    }

    getFrequency(noteIndex, octave = 4) {
        const baseFrequencies = [
            261.63, // C
            293.66, // D
            329.63, // E
            349.23, // F
            392.00, // G
            440.00, // A
            493.88, // B
            523.25  // C (next octave)
        ];
        const baseFreq = baseFrequencies[noteIndex % 8];
        const octaveMultiplier = Math.pow(2, octave - 4);
        return baseFreq * octaveMultiplier;
    }

    playNote(frequency, duration = 0.5, type = 'square') {
        if (!this.isAvailable()) return null;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filterNode = this.audioContext.createBiquadFilter();

            oscillator.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(this.masterGain);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(2000, this.audioContext.currentTime);
            filterNode.Q.setValueAtTime(1, this.audioContext.currentTime);

            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
            gainNode.gain.setValueAtTime(0.05, now + duration - 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

            oscillator.start(now);
            oscillator.stop(now + duration);

            oscillator.addEventListener('ended', () => {
                try {
                    oscillator.disconnect();
                    gainNode.disconnect();
                    filterNode.disconnect();
                } catch (e) { }
            });

            return { oscillator, gainNode };
        } catch (error) {
            console.error('Error playing note:', error);
            return null;
        }
    }

    playChord(frequencies, duration = 0.8) {
        const notes = frequencies.map(freq => this.playNote(freq, duration, 'sawtooth'));
        return { notes };
    }

    getChordFrequencies(rootNoteIndex, octave = 4, chordType = 'major') {
        const root = this.getFrequency(rootNoteIndex, octave);

        switch (chordType) {
            case 'major':
                return [
                    root,
                    root * Math.pow(2, 4 / 12), // major third
                    root * Math.pow(2, 7 / 12)  // perfect fifth
                ];
            case 'minor':
                return [
                    root,
                    root * Math.pow(2, 3 / 12), // minor third
                    root * Math.pow(2, 7 / 12)  // perfect fifth
                ];
            default:
                return [root];
        }
    }
}