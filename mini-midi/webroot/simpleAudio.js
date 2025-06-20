// Enhanced SimpleAudio.js - Improved Audio Engine with Better Chord System
export class SimpleAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.masterVolume = 0.25;
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
            261.626, 293.665, 329.628, 349.228, 391.995, 440.000, 493.883, 523.251
        ];
        const baseFreq = baseFrequencies[noteIndex % 8];
        const octaveMultiplier = Math.pow(2, octave - 4);
        return baseFreq * octaveMultiplier;
    }

    playNote(frequency, duration = 0.5, type = 'square', gain = 0.15) {
        if (!this.isAvailable()) return null;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

            oscillator.connect(gainNode);
            gainNode.connect(this.masterGain);

            oscillator.start(now);
            oscillator.stop(now + duration);

            return { oscillator, gainNode };
        } catch (error) {
            console.error('Error playing note:', error);
            return null;
        }
    }

    playChord(frequencies, duration = 1.0, chordType = 'major') {
        if (!this.isAvailable()) return null;

        const notes = [];
        const baseGain = 0.08;

        frequencies.forEach((freq, index) => {
            const waveforms = ['sawtooth', 'square', 'triangle'];
            const waveform = waveforms[index % waveforms.length];
            const noteGain = baseGain * (1 + (Math.random() - 0.5) * 0.2);

            setTimeout(() => {
                const note = this.playNote(freq, duration, waveform, noteGain);
                notes.push(note);
            }, index * 0.005);
        });

        return { notes };
    }
}
