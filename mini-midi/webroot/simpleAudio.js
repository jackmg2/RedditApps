// Enhanced SimpleAudio.js - Improved Audio Engine with Better Chord System
export class SimpleAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.masterVolume = 0.25; // Slightly lower for better chord balance
        this.isInitialized = false;
        this.reverbNode = null;
        this.compressor = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create audio processing chain
            this.setupAudioProcessing();

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.isInitialized = true;
            console.log('Enhanced audio initialized successfully');
            return true;
        } catch (error) {
            console.error('Audio initialization failed:', error);
            return false;
        }
    }

    setupAudioProcessing() {
        // Create compressor for better dynamic range
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
        this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

        // Create reverb
        this.createReverb();

        // Master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.masterVolume;

        // Connect the chain: compressor -> reverb -> master -> destination
        this.compressor.connect(this.reverbNode);
        this.reverbNode.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);
    }

    createReverb() {
        const convolver = this.audioContext.createConvolver();
        const reverbGain = this.audioContext.createGain();
        const dryGain = this.audioContext.createGain();
        const wetGain = this.audioContext.createGain();

        // Create impulse response for reverb
        const length = this.audioContext.sampleRate * 2; // 2 seconds
        const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay * 0.1;
            }
        }

        convolver.buffer = impulse;

        // Set up wet/dry mix (20% wet, 80% dry)
        dryGain.gain.value = 0.8;
        wetGain.gain.value = 0.2;

        // Create mixer
        this.reverbNode = this.audioContext.createGain();
        
        // Connect reverb chain
        this.reverbNode.connect(dryGain);
        this.reverbNode.connect(convolver);
        convolver.connect(wetGain);
        
        // Output mixer
        const outputMixer = this.audioContext.createGain();
        dryGain.connect(outputMixer);
        wetGain.connect(outputMixer);
        
        // Replace reverb node with the output mixer
        this.reverbNode = outputMixer;
    }

    isAvailable() {
        return this.isInitialized && this.audioContext && this.audioContext.state === 'running';
    }

    getFrequency(noteIndex, octave = 4) {
        // More accurate frequencies based on equal temperament
        const baseFrequencies = [
            261.626, // C4
            293.665, // D4
            329.628, // E4
            349.228, // F4
            391.995, // G4
            440.000, // A4
            493.883, // B4
            523.251  // C5
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
            const filterNode = this.audioContext.createBiquadFilter();
            const filterGain = this.audioContext.createGain();

            // Enhanced oscillator setup
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            // Add subtle detuning for richer sound
            const detuneAmount = (Math.random() - 0.5) * 3; // ±1.5 cents
            oscillator.detune.setValueAtTime(detuneAmount, this.audioContext.currentTime);

            // Improved filter settings
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(frequency * 3, this.audioContext.currentTime);
            filterNode.Q.setValueAtTime(1.5, this.audioContext.currentTime);

            // Filter envelope for more organic sound
            const now = this.audioContext.currentTime;
            filterNode.frequency.setValueAtTime(frequency * 1.5, now);
            filterNode.frequency.exponentialRampToValueAtTime(frequency * 3, now + 0.1);
            filterNode.frequency.exponentialRampToValueAtTime(frequency * 2, now + duration);

            // Connect audio graph
            oscillator.connect(filterNode);
            filterNode.connect(filterGain);
            filterGain.connect(gainNode);
            gainNode.connect(this.compressor);

            // Improved envelope
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(gain, now + 0.01); // Quick attack
            gainNode.gain.exponentialRampToValueAtTime(gain * 0.7, now + 0.1); // Slight decay
            gainNode.gain.setValueAtTime(gain * 0.7, now + duration - 0.1); // Sustain
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release

            filterGain.gain.setValueAtTime(1, now);

            oscillator.start(now);
            oscillator.stop(now + duration);

            oscillator.addEventListener('ended', () => {
                try {
                    oscillator.disconnect();
                    gainNode.disconnect();
                    filterNode.disconnect();
                    filterGain.disconnect();
                } catch (e) { }
            });

            return { oscillator, gainNode, filterNode };
        } catch (error) {
            console.error('Error playing note:', error);
            return null;
        }
    }

    playChord(frequencies, duration = 1.0, chordType = 'major') {
        if (!this.isAvailable()) return null;

        const notes = [];
        const baseGain = 0.08; // Lower gain per note in chord to prevent clipping

        frequencies.forEach((freq, index) => {
            // Use different waveforms for richer chord texture
            const waveforms = ['sawtooth', 'square', 'triangle'];
            const waveform = waveforms[index % waveforms.length];
            
            // Vary gain slightly for each voice
            const noteGain = baseGain * (1 + (Math.random() - 0.5) * 0.2);
            
            // Slight timing offset for more organic feel
            const timeOffset = index * 0.005; // 5ms offset between notes
            
            setTimeout(() => {
                const note = this.playNote(freq, duration, waveform, noteGain);
                notes.push(note);
            }, timeOffset);
        });

        return { notes };
    }

    getChordFrequencies(rootNoteIndex, octave = 4, chordType = 'major') {
        const root = this.getFrequency(rootNoteIndex, octave);

        // More musical chord voicings with better intervals
        switch (chordType) {
            case 'major':
                return [
                    root,                           // Root
                    root * Math.pow(2, 4/12),      // Major third (more precise)
                    root * Math.pow(2, 7/12),      // Perfect fifth
                    root * Math.pow(2, 12/12) * 0.5 // Octave (lower volume)
                ];
            
            case 'minor':
                return [
                    root,                           // Root
                    root * Math.pow(2, 3/12),      // Minor third
                    root * Math.pow(2, 7/12),      // Perfect fifth
                    root * Math.pow(2, 10/12)      // Minor seventh
                ];
            
            case 'seventh':
                return [
                    root,                           // Root
                    root * Math.pow(2, 4/12),      // Major third
                    root * Math.pow(2, 7/12),      // Perfect fifth
                    root * Math.pow(2, 10/12)      // Minor seventh
                ];
            
            case 'sus4':
                return [
                    root,                           // Root
                    root * Math.pow(2, 5/12),      // Perfect fourth
                    root * Math.pow(2, 7/12),      // Perfect fifth
                ];
            
            case 'add9':
                return [
                    root,                           // Root
                    root * Math.pow(2, 4/12),      // Major third
                    root * Math.pow(2, 7/12),      // Perfect fifth
                    root * Math.pow(2, 14/12)      // Ninth (next octave)
                ];
            
            default:
                return [root];
        }
    }

    // Add method to get chord type based on note position and context
    getChordTypeForNote(noteIndex) {
        // Create more musical progression
        const chordTypes = [
            'major',    // C major
            'minor',    // D minor  
            'minor',    // E minor
            'major',    // F major
            'major',    // G major
            'minor',    // A minor
            'seventh',  // B diminished (using seventh for now)
            'major'     // C major
        ];
        
        return chordTypes[noteIndex % 8];
    }
}