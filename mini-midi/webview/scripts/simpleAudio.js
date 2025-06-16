// simpleAudio.js - Simple Web Audio implementation without external dependencies

class SimpleAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeOscillators = new Map();
        this.masterVolume = 0.3;
        this.initializeAudio();
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.audioContext.destination);
        } catch (error) {
            console.error('Web Audio API not supported:', error);
        }
    }

    async resumeAudio() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Create a simple synthesized sound
    playNote(frequency, duration = 0.5, type = 'square') {
        if (!this.audioContext || !this.masterGain) return null;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filterNode = this.audioContext.createBiquadFilter();

        // Chain: oscillator -> filter -> gain -> master
        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Configure oscillator
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        // Configure filter for FF7-like sound
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(2000, this.audioContext.currentTime);
        filterNode.Q.setValueAtTime(1, this.audioContext.currentTime);

        // Configure envelope
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01); // Attack
        gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.1); // Decay
        gainNode.gain.setValueAtTime(0.05, now + duration - 0.1); // Sustain
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release

        // Start and stop
        oscillator.start(now);
        oscillator.stop(now + duration);

        // Clean up
        oscillator.addEventListener('ended', () => {
            oscillator.disconnect();
            gainNode.disconnect();
            filterNode.disconnect();
        });

        return {
            oscillator,
            gainNode,
            stop: () => {
                try {
                    oscillator.stop();
                } catch (e) {
                    // Already stopped
                }
            }
        };
    }

    // Play a chord (multiple frequencies)
    playChord(frequencies, duration = 0.5) {
        const notes = frequencies.map(freq => 
            this.playNote(freq, duration, 'sawtooth')
        );
        
        return {
            notes,
            stop: () => {
                notes.forEach(note => note?.stop());
            }
        };
    }

    // Get frequency for a note
    getFrequency(noteIndex, octave = 4) {
        // C4 = 261.63 Hz (middle C)
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

    // Get chord frequencies
    getChordFrequencies(rootNoteIndex, octave = 4, chordType = 'major') {
        const root = this.getFrequency(rootNoteIndex, octave);
        
        switch (chordType) {
            case 'major':
                return [
                    root,
                    root * Math.pow(2, 4/12), // Major third
                    root * Math.pow(2, 7/12)  // Perfect fifth
                ];
            case 'minor':
                return [
                    root,
                    root * Math.pow(2, 3/12), // Minor third
                    root * Math.pow(2, 7/12)  // Perfect fifth
                ];
            case 'seventh':
                return [
                    root,
                    root * Math.pow(2, 4/12), // Major third
                    root * Math.pow(2, 7/12), // Perfect fifth
                    root * Math.pow(2, 10/12) // Minor seventh
                ];
            default:
                return [root];
        }
    }

    // Set master volume
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(
                this.masterVolume, 
                this.audioContext.currentTime
            );
        }
    }

    // Create a simple drum sound
    playDrum(type = 'kick') {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        
        if (type === 'kick') {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();