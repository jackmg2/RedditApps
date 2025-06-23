// Enhanced SimpleAudio.js - Dramatically Improved Audio Engine with Rich Sound
export class SimpleAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.masterVolume = 0.3;
        this.isInitialized = false;
        
        // Enhanced audio components
        this.compressor = null;
        this.reverb = null;
        this.reverbGain = null;
        this.delay = null;
        this.delayGain = null;
        this.delayFeedback = null;
        this.masterFilter = null;
        
        // Reverb impulse response buffer
        this.reverbBuffer = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master effects chain
            await this.setupMasterEffects();
            
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

    async setupMasterEffects() {
        // Master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.masterVolume;

        // Compressor for better dynamics
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;

        // Master filter for warmth
        this.masterFilter = this.audioContext.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.frequency.value = 12000;
        this.masterFilter.Q.value = 0.7;

        // Create reverb
        await this.createReverb();
        
        // Create delay
        this.createDelay();

        // Connect effects chain: input -> reverb/delay -> compressor -> filter -> master -> output
        this.reverbGain.connect(this.compressor);
        this.delayGain.connect(this.compressor);
        this.compressor.connect(this.masterFilter);
        this.masterFilter.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);
    }

    async createReverb() {
        this.reverb = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = 0.3;

        // Create artificial reverb impulse response
        const length = this.audioContext.sampleRate * 2; // 2 seconds
        const buffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
            }
        }
        
        this.reverb.buffer = buffer;
        this.reverb.connect(this.reverbGain);
    }

    createDelay() {
        this.delay = this.audioContext.createDelay(0.5);
        this.delay.delayTime.value = 0.2;
        
        this.delayGain = this.audioContext.createGain();
        this.delayGain.gain.value = 0.15;
        
        this.delayFeedback = this.audioContext.createGain();
        this.delayFeedback.gain.value = 0.3;
        
        // Create delay feedback loop
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        this.delay.connect(this.delayGain);
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

    playNote(frequency, duration = 0.8, type = 'sawtooth', gain = 0.12) {
        if (!this.isAvailable()) return null;

        try {
            // Create a more complex note with multiple oscillators
            const noteGain = this.audioContext.createGain();
            const noteFilter = this.audioContext.createBiquadFilter();
            
            // Main oscillator
            const mainOsc = this.audioContext.createOscillator();
            const mainGain = this.audioContext.createGain();
            
            // Sub oscillator (octave below)
            const subOsc = this.audioContext.createOscillator();
            const subGain = this.audioContext.createGain();
            
            // Harmonic oscillator (perfect fifth)
            const harmOsc = this.audioContext.createOscillator();
            const harmGain = this.audioContext.createGain();

            const now = this.audioContext.currentTime;

            // Configure main oscillator
            mainOsc.type = type;
            mainOsc.frequency.setValueAtTime(frequency, now);
            mainGain.gain.setValueAtTime(gain * 0.7, now);

            // Configure sub oscillator
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(frequency * 0.5, now);
            subGain.gain.setValueAtTime(gain * 0.3, now);

            // Configure harmonic oscillator (perfect fifth)
            harmOsc.type = 'triangle';
            harmOsc.frequency.setValueAtTime(frequency * 1.5, now);
            harmGain.gain.setValueAtTime(gain * 0.15, now);

            // Filter for warmth
            noteFilter.type = 'lowpass';
            noteFilter.frequency.setValueAtTime(frequency * 4, now);
            noteFilter.frequency.exponentialRampToValueAtTime(frequency * 2, now + duration * 0.3);
            noteFilter.Q.value = 1.5;

            // Enhanced ADSR envelope
            const attackTime = 0.02;
            const decayTime = 0.1;
            const sustainLevel = 0.6;
            const releaseTime = duration * 0.7;

            noteGain.gain.setValueAtTime(0, now);
            noteGain.gain.linearRampToValueAtTime(1, now + attackTime);
            noteGain.gain.exponentialRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            // Connect oscillators
            mainOsc.connect(mainGain);
            subOsc.connect(subGain);
            harmOsc.connect(harmGain);
            
            mainGain.connect(noteFilter);
            subGain.connect(noteFilter);
            harmGain.connect(noteFilter);
            
            noteFilter.connect(noteGain);
            
            // Send to both dry and wet signals
            noteGain.connect(this.compressor); // Dry signal
            noteGain.connect(this.reverb);    // Reverb send
            noteGain.connect(this.delay);     // Delay send

            // Start and stop oscillators
            mainOsc.start(now);
            subOsc.start(now);
            harmOsc.start(now);
            
            mainOsc.stop(now + duration);
            subOsc.stop(now + duration);
            harmOsc.stop(now + duration);

            return { 
                oscillators: [mainOsc, subOsc, harmOsc], 
                gainNode: noteGain,
                filter: noteFilter
            };
        } catch (error) {
            console.error('Error playing note:', error);
            return null;
        }
    }

    playChord(frequencies, duration = 1.2, chordType = 'major') {
        if (!this.isAvailable()) return null;

        const notes = [];
        const baseGain = 0.06; // Lower gain for chords to prevent muddiness
        
        // Create a chord-level filter and gain for cohesion
        const chordGain = this.audioContext.createGain();
        const chordFilter = this.audioContext.createBiquadFilter();
        const chordCompressor = this.audioContext.createDynamicsCompressor();
        
        // Configure chord-level processing
        chordFilter.type = 'lowpass';
        chordFilter.frequency.value = 3000;
        chordFilter.Q.value = 0.8;
        
        chordCompressor.threshold.value = -18;
        chordCompressor.ratio.value = 6;
        chordCompressor.attack.value = 0.01;
        chordCompressor.release.value = 0.1;
        
        const now = this.audioContext.currentTime;

        frequencies.forEach((freq, index) => {
            // Vary oscillator types for richer harmony
            const waveforms = ['sawtooth', 'triangle', 'sine', 'square'];
            const waveform = waveforms[index % waveforms.length];
            
            // Slight timing offset for more natural sound
            const startTime = now + (index * 0.008);
            
            // Individual note gain based on harmonic position
            const noteGain = baseGain * (1 - index * 0.1) * (0.8 + Math.random() * 0.4);
            
            setTimeout(() => {
                const note = this.createChordNote(freq, duration, waveform, noteGain, startTime);
                if (note) {
                    note.gainNode.connect(chordFilter);
                    notes.push(note);
                }
            }, index * 8);
        });

        // Chord-level envelope
        chordGain.gain.setValueAtTime(0, now);
        chordGain.gain.linearRampToValueAtTime(1, now + 0.05);
        chordGain.gain.exponentialRampToValueAtTime(0.7, now + 0.2);
        chordGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // Connect chord processing chain
        chordFilter.connect(chordCompressor);
        chordCompressor.connect(chordGain);
        
        // Send to effects
        chordGain.connect(this.compressor); // Dry
        chordGain.connect(this.reverb);     // Reverb
        chordGain.connect(this.delay);      // Delay

        return { notes, chordGain, chordFilter };
    }

    createChordNote(frequency, duration, type, gain, startTime) {
        try {
            // Create dual-oscillator setup for richer chord tones
            const noteGain = this.audioContext.createGain();
            const noteFilter = this.audioContext.createBiquadFilter();
            
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const osc1Gain = this.audioContext.createGain();
            const osc2Gain = this.audioContext.createGain();

            // Main oscillator
            osc1.type = type;
            osc1.frequency.setValueAtTime(frequency, startTime);
            osc1Gain.gain.setValueAtTime(gain * 0.8, startTime);

            // Slightly detuned second oscillator for chorus effect
            osc2.type = type === 'sawtooth' ? 'triangle' : 'sine';
            osc2.frequency.setValueAtTime(frequency * 1.003, startTime); // Slight detune
            osc2Gain.gain.setValueAtTime(gain * 0.4, startTime);

            // Filter for each note
            noteFilter.type = 'lowpass';
            noteFilter.frequency.setValueAtTime(frequency * 3, startTime);
            noteFilter.Q.value = 0.7;

            // Individual note envelope
            const attackTime = 0.03 + Math.random() * 0.02;
            const releaseTime = duration * 0.8;

            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(1, startTime + attackTime);
            noteGain.gain.exponentialRampToValueAtTime(0.6, startTime + 0.15);
            noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            // Connect
            osc1.connect(osc1Gain);
            osc2.connect(osc2Gain);
            osc1Gain.connect(noteFilter);
            osc2Gain.connect(noteFilter);
            noteFilter.connect(noteGain);

            // Start oscillators
            osc1.start(startTime);
            osc2.start(startTime);
            osc1.stop(startTime + duration);
            osc2.stop(startTime + duration);

            return { 
                oscillators: [osc1, osc2], 
                gainNode: noteGain,
                filter: noteFilter
            };
        } catch (error) {
            console.error('Error creating chord note:', error);
            return null;
        }
    }

    // Utility method to adjust master effects
    setReverbAmount(amount) {
        if (this.reverbGain) {
            this.reverbGain.gain.setValueAtTime(amount, this.audioContext.currentTime);
        }
    }

    setDelayAmount(amount) {
        if (this.delayGain) {
            this.delayGain.gain.setValueAtTime(amount, this.audioContext.currentTime);
        }
    }

    setMasterFilter(frequency) {
        if (this.masterFilter) {
            this.masterFilter.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        }
    }
}