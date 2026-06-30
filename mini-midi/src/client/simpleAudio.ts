// Web Audio engine: layered oscillators per note, master compressor/filter,
// synthetic reverb and feedback delay sends.
export type NoteHandle = {
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  filter: BiquadFilterNode;
};

export type ChordHandle = {
  notes: NoteHandle[];
  chordGain: GainNode;
  chordFilter: BiquadFilterNode;
};

export class SimpleAudio {
  audioContext: AudioContext | null = null;
  masterGain: GainNode | null = null;
  masterVolume = 0.3;
  isInitialized = false;

  compressor: DynamicsCompressorNode | null = null;
  reverb: ConvolverNode | null = null;
  reverbGain: GainNode | null = null;
  delay: DelayNode | null = null;
  delayGain: GainNode | null = null;
  delayFeedback: GainNode | null = null;
  masterFilter: BiquadFilterNode | null = null;

  async initialize(): Promise<boolean> {
    try {
      const ctx = new AudioContext();
      this.audioContext = ctx;

      this.setupMasterEffects(ctx);

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.isInitialized = true;
      console.log('Enhanced audio initialized successfully');
      return true;
    } catch (error) {
      console.error('Audio initialization failed:', error);
      return false;
    }
  }

  setupMasterEffects(ctx: AudioContext): void {
    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = this.masterVolume;

    // Compressor for better dynamics
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Master filter for warmth
    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.value = 12000;
    masterFilter.Q.value = 0.7;

    const { reverb, reverbGain } = this.createReverb(ctx);
    const { delay, delayGain, delayFeedback } = this.createDelay(ctx);

    // Connect effects chain: input -> reverb/delay -> compressor -> filter -> master -> output
    reverbGain.connect(compressor);
    delayGain.connect(compressor);
    compressor.connect(masterFilter);
    masterFilter.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.masterGain = masterGain;
    this.compressor = compressor;
    this.masterFilter = masterFilter;
    this.reverb = reverb;
    this.reverbGain = reverbGain;
    this.delay = delay;
    this.delayGain = delayGain;
    this.delayFeedback = delayFeedback;
  }

  createReverb(ctx: AudioContext): { reverb: ConvolverNode; reverbGain: GainNode } {
    const reverb = ctx.createConvolver();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;

    // Create artificial reverb impulse response
    const length = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
      }
    }

    reverb.buffer = buffer;
    reverb.connect(reverbGain);
    return { reverb, reverbGain };
  }

  createDelay(ctx: AudioContext): {
    delay: DelayNode;
    delayGain: GainNode;
    delayFeedback: GainNode;
  } {
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.2;

    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.15;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.3;

    // Create delay feedback loop
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayGain);
    return { delay, delayGain, delayFeedback };
  }

  isAvailable(): boolean {
    return this.isInitialized && this.audioContext !== null && this.audioContext.state === 'running';
  }

  getFrequency(noteIndex: number, octave = 4): number {
    const baseFrequencies = [
      261.626, 293.665, 329.628, 349.228, 391.995, 440.0, 493.883, 523.251,
    ];
    const baseFreq = baseFrequencies[noteIndex % 8] ?? 261.626;
    const octaveMultiplier = Math.pow(2, octave - 4);
    return baseFreq * octaveMultiplier;
  }

  playNote(
    frequency: number,
    duration = 0.8,
    type: OscillatorType = 'sawtooth',
    gain = 0.12
  ): NoteHandle | null {
    const ctx = this.audioContext;
    if (!this.isAvailable() || !ctx || !this.compressor || !this.reverb || !this.delay) {
      return null;
    }

    try {
      // Create a more complex note with multiple oscillators
      const noteGain = ctx.createGain();
      const noteFilter = ctx.createBiquadFilter();

      // Main oscillator
      const mainOsc = ctx.createOscillator();
      const mainGain = ctx.createGain();

      // Sub oscillator (octave below)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();

      // Harmonic oscillator (perfect fifth)
      const harmOsc = ctx.createOscillator();
      const harmGain = ctx.createGain();

      const now = ctx.currentTime;

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
      noteGain.connect(this.reverb); // Reverb send
      noteGain.connect(this.delay); // Delay send

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
        filter: noteFilter,
      };
    } catch (error) {
      console.error('Error playing note:', error);
      return null;
    }
  }

  playChord(frequencies: number[], duration = 1.2): ChordHandle | null {
    const ctx = this.audioContext;
    if (!this.isAvailable() || !ctx || !this.compressor || !this.reverb || !this.delay) {
      return null;
    }

    const notes: NoteHandle[] = [];
    const baseGain = 0.06; // Lower gain for chords to prevent muddiness

    // Create a chord-level filter and gain for cohesion
    const chordGain = ctx.createGain();
    const chordFilter = ctx.createBiquadFilter();
    const chordCompressor = ctx.createDynamicsCompressor();

    // Configure chord-level processing
    chordFilter.type = 'lowpass';
    chordFilter.frequency.value = 3000;
    chordFilter.Q.value = 0.8;

    chordCompressor.threshold.value = -18;
    chordCompressor.ratio.value = 6;
    chordCompressor.attack.value = 0.01;
    chordCompressor.release.value = 0.1;

    const now = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      // Vary oscillator types for richer harmony
      const waveforms: OscillatorType[] = ['sawtooth', 'triangle', 'sine', 'square'];
      const waveform = waveforms[index % waveforms.length] ?? 'sawtooth';

      // Slight timing offset for more natural sound
      const startTime = now + index * 0.008;

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
    chordGain.connect(this.reverb); // Reverb
    chordGain.connect(this.delay); // Delay

    return { notes, chordGain, chordFilter };
  }

  createChordNote(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    startTime: number
  ): NoteHandle | null {
    const ctx = this.audioContext;
    if (!ctx) return null;

    try {
      // Create dual-oscillator setup for richer chord tones
      const noteGain = ctx.createGain();
      const noteFilter = ctx.createBiquadFilter();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc1Gain = ctx.createGain();
      const osc2Gain = ctx.createGain();

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
        filter: noteFilter,
      };
    } catch (error) {
      console.error('Error creating chord note:', error);
      return null;
    }
  }

  // Utility methods to adjust master effects
  setReverbAmount(amount: number): void {
    if (this.reverbGain && this.audioContext) {
      this.reverbGain.gain.setValueAtTime(amount, this.audioContext.currentTime);
    }
  }

  setDelayAmount(amount: number): void {
    if (this.delayGain && this.audioContext) {
      this.delayGain.gain.setValueAtTime(amount, this.audioContext.currentTime);
    }
  }

  setMasterFilter(frequency: number): void {
    if (this.masterFilter && this.audioContext) {
      this.masterFilter.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    }
  }
}
