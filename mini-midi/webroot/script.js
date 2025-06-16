// Complete self-contained JavaScript - no external modules
        console.log('FF7 Musical Interface loading...');

        // Simple Audio Engine
        class SimpleAudio {
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
                        } catch (e) {}
                    });

                    return { oscillator, gainNode };
                } catch (error) {
                    console.error('Error playing note:', error);
                    return null;
                }
            }

            playChord(frequencies, duration = 0.5) {
                const notes = frequencies.map(freq => this.playNote(freq, duration, 'sawtooth'));
                return { notes };
            }

            getChordFrequencies(rootNoteIndex, octave = 4, chordType = 'major') {
                const root = this.getFrequency(rootNoteIndex, octave);
                
                switch (chordType) {
                    case 'major':
                        return [
                            root,
                            root * Math.pow(2, 4/12),
                            root * Math.pow(2, 7/12)
                        ];
                    case 'minor':
                        return [
                            root,
                            root * Math.pow(2, 3/12),
                            root * Math.pow(2, 7/12)
                        ];
                    default:
                        return [root];
                }
            }
        }

        // Simple Notes System
        class SimpleNotes {
            constructor(audio) {
                this.audio = audio;
                this.currentOctave = 4;
                this.currentChord = 4;
                this.currentLeftTone = 0;
                this.currentRightTone = 0;
                this.chordTypes = ['major', 'major', 'major', 'minor'];
            }

            angleToNoteIndex(angle) {
                let degrees = (angle * 180 / Math.PI + 360) % 360;
                degrees = (degrees + 45) % 360;
                return Math.floor(degrees / 45);
            }

            handleInstrumentTouch(x, y, side) {
                const angle = Math.atan2(y, x);
                const noteIndex = this.angleToNoteIndex(angle);
                const distance = Math.sqrt(x * x + y * y);
                
                if (distance > 0.3) {
                    if (side === 'left') {
                        return this.playChord(noteIndex);
                    } else {
                        return this.playNote(noteIndex);
                    }
                }
                return null;
            }

            playNote(noteIndex) {
                if (!this.audio.isAvailable()) return null;
                
                let frequency = this.audio.getFrequency(noteIndex, this.currentOctave);
                
                if (this.currentRightTone === 1) {
                    frequency = frequency * Math.pow(2, 1/12);
                }
                
                return this.audio.playNote(frequency, 0.8);
            }

            playChord(noteIndex) {
                if (!this.audio.isAvailable()) return null;
                
                const chordType = this.chordTypes[this.currentLeftTone];
                const frequencies = this.audio.getChordFrequencies(noteIndex, this.currentChord, chordType);
                return this.audio.playChord(frequencies, 1.0);
            }

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

            setLeftTone(toneType) {
                this.currentLeftTone = toneType;
                return this.currentLeftTone;
            }

            setRightTone(toneType) {
                this.currentRightTone = toneType;
                return this.currentRightTone;
            }
        }

        // Simple Recorder
        class SimpleRecorder {
            constructor() {
                this.isRecording = false;
                this.recording = [];
                this.startTime = null;
                this.recordingTimer = null;
            }

            startRecording() {
                if (this.isRecording) return false;
                
                this.isRecording = true;
                this.recording = [];
                this.startTime = Date.now();
                
                this.updateRecordingTime();
                return true;
            }

            stopRecording() {
                if (!this.isRecording) return false;
                
                this.isRecording = false;
                clearInterval(this.recordingTimer);
                return true;
            }

            recordFrame(data) {
                if (!this.isRecording) return false;
                
                const timestamp = Date.now() - this.startTime;
                this.recording.push({ timestamp, ...data });
                return true;
            }

            hasRecording() {
                return this.recording.length > 0;
            }

            getRecording() {
                return this.recording;
            }

            updateRecordingTime() {
                this.recordingTimer = setInterval(() => {
                    if (!this.isRecording) return;
                    
                    const elapsed = Date.now() - this.startTime;
                    const minutes = Math.floor(elapsed / 60000);
                    const seconds = Math.floor((elapsed % 60000) / 1000);
                    
                    const timeElement = document.getElementById('recordingTime');
                    if (timeElement) {
                        timeElement.textContent = 
                            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    }
                }, 1000);
            }

            exportRecording() {
                if (!this.hasRecording()) return null;
                
                return {
                    version: '1.0',
                    created: Date.now(),
                    duration: this.recording[this.recording.length - 1]?.timestamp || 0,
                    frameCount: this.recording.length,
                    data: this.recording
                };
            }
        }

        // Main Application
        class SimpleMusicalApp {
            constructor() {
                this.audio = new SimpleAudio();
                this.notes = null;
                this.recorder = new SimpleRecorder();
                this.currentOctave = 4;
                this.currentChord = 4;
                this.leftTone = 0;
                this.rightTone = 0;
                this.isInitialized = false;

                console.log('App initialized, setting up event listeners...');
                this.setupEventListeners();
            }

            async initializeAudio() {
                console.log('Initializing audio...');
                const success = await this.audio.initialize();
                if (success) {
                    this.notes = new SimpleNotes(this.audio);
                    this.isInitialized = true;
                    console.log('Audio and notes initialized');
                    return true;
                } else {
                    console.error('Failed to initialize audio');
                    return false;
                }
            }

            setupEventListeners() {
                console.log('Setting up event listeners...');
                
                // Start button
                const startBtn = document.getElementById('startBtn');
                if (startBtn) {
                    startBtn.addEventListener('click', async () => {
                        console.log('Start button clicked');
                        const success = await this.initializeAudio();
                        if (success) {
                            this.startInterface();
                        } else {
                            this.showToast('Audio initialization failed. Please try again.', 'error');
                        }
                    });
                } else {
                    console.error('Start button not found');
                }

                // Recording controls
                document.getElementById('recordBtn')?.addEventListener('click', () => {
                    this.toggleRecording();
                });

                document.getElementById('playBtn')?.addEventListener('click', () => {
                    this.showToast('Playback not implemented yet', 'info');
                });

                document.getElementById('stopBtn')?.addEventListener('click', () => {
                    this.recorder.stopRecording();
                    this.updateRecordingUI(false);
                });

                // Reddit buttons
                document.getElementById('saveBtn')?.addEventListener('click', () => {
                    this.saveComposition();
                });

                document.getElementById('shareBtn')?.addEventListener('click', () => {
                    this.openShareModal();
                });

                document.getElementById('collaborateBtn')?.addEventListener('click', () => {
                    this.startCollaboration();
                });

                // Modal controls
                document.getElementById('cancelShare')?.addEventListener('click', () => {
                    this.closeShareModal();
                });

                document.getElementById('confirmShare')?.addEventListener('click', () => {
                    this.shareComposition();
                });

                // Tone buttons
                document.querySelectorAll('.tone-button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        this.toggleTone(e.target);
                    });
                });

                // Instrument controls
                document.getElementById('leftInstrument')?.addEventListener('mousedown', (e) => {
                    this.handleInstrumentInteraction(e, 'left');
                });

                document.getElementById('rightInstrument')?.addEventListener('mousedown', (e) => {
                    this.handleInstrumentInteraction(e, 'right');
                });

                // Touch support
                document.getElementById('leftInstrument')?.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.handleInstrumentInteraction(e.touches[0], 'left');
                });

                document.getElementById('rightInstrument')?.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.handleInstrumentInteraction(e.touches[0], 'right');
                });

                // Octave and chord controls
                document.getElementById('octaveUp')?.addEventListener('click', () => {
                    this.changeOctave(1);
                });

                document.getElementById('octaveDown')?.addEventListener('click', () => {
                    this.changeOctave(-1);
                });

                document.getElementById('octaveReset')?.addEventListener('click', () => {
                    this.resetOctave();
                });

                document.getElementById('chordUp')?.addEventListener('click', () => {
                    this.changeChord(1);
                });

                document.getElementById('chordDown')?.addEventListener('click', () => {
                    this.changeChord(-1);
                });

                document.getElementById('chordReset')?.addEventListener('click', () => {
                    this.resetChord();
                });

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    this.handleKeydown(e);
                });

                console.log('Event listeners set up complete');
            }

            startInterface() {
                console.log('Starting interface...');
                document.getElementById('startMessage').style.display = 'none';
                document.getElementById('playerInterface').style.display = 'block';
                this.updateDisplay();
                this.showToast('Musical interface ready! 🎵', 'success');
            }

            handleInstrumentInteraction(event, side) {
                if (!this.notes || !this.isInitialized) {
                    console.log('Audio not initialized yet');
                    return;
                }

                const rect = event.target.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const x = (event.clientX - centerX) / (rect.width / 2);
                const y = (event.clientY - centerY) / (rect.height / 2);
                
                console.log(`Playing ${side} instrument at (${x.toFixed(2)}, ${y.toFixed(2)})`);
                
                const result = this.notes.handleInstrumentTouch(x, y, side);
                
                if (result && this.recorder.isRecording) {
                    const angle = Math.atan2(y, x);
                    const noteIndex = this.notes.angleToNoteIndex(angle);
                    
                    this.recorder.recordFrame({
                        noteIndex,
                        side,
                        octave: this.notes.currentOctave,
                        chord: this.notes.currentChord,
                        leftTone: this.notes.currentLeftTone,
                        rightTone: this.notes.currentRightTone
                    });
                }
                
                this.animateInstrument(event.target, side);
            }

            animateInstrument(element, side) {
                element.style.transform = 'scale(0.95)';
                element.style.boxShadow = '0 0 20px rgba(0, 212, 255, 0.8)';
                
                setTimeout(() => {
                    element.style.transform = '';
                    element.style.boxShadow = '';
                }, 150);
            }

            toggleTone(button) {
                document.querySelectorAll('.tone-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                button.classList.add('active');
                
                const tone = parseInt(button.dataset.tone) || 0;
                if (button.id.startsWith('left')) {
                    this.leftTone = tone;
                    if (this.notes) this.notes.setLeftTone(tone);
                } else {
                    this.rightTone = tone;
                    if (this.notes) this.notes.setRightTone(tone);
                }
            }

            changeOctave(direction) {
                if (!this.notes) return;
                
                if (direction > 0) {
                    this.notes.incrementOctave();
                } else {
                    this.notes.decrementOctave();
                }
                
                this.currentOctave = this.notes.currentOctave;
                this.updateOctaveDisplay();
            }

            resetOctave() {
                if (!this.notes) return;
                
                this.notes.resetOctave();
                this.currentOctave = this.notes.currentOctave;
                this.updateOctaveDisplay();
            }

            changeChord(direction) {
                if (!this.notes) return;
                
                if (direction > 0) {
                    this.notes.incrementChord();
                } else {
                    this.notes.decrementChord();
                }
                
                this.currentChord = this.notes.currentChord;
                this.updateChordDisplay();
            }

            resetChord() {
                if (!this.notes) return;
                
                this.notes.resetChord();
                this.currentChord = this.notes.currentChord;
                this.updateChordDisplay();
            }

            updateOctaveDisplay() {
                for (let i = 0; i <= 5; i++) {
                    const dot = document.getElementById(`octave${i}`);
                    if (dot) {
                        dot.classList.toggle('active', i === this.currentOctave - 1);
                    }
                }
            }

            updateChordDisplay() {
                for (let i = 0; i <= 8; i++) {
                    const dot = document.getElementById(`chord${i}`);
                    if (dot) {
                        dot.classList.toggle('active', i === this.currentChord - 1);
                    }
                }
            }

            updateDisplay() {
                this.updateOctaveDisplay();
                this.updateChordDisplay();
            }

            handleKeydown(e) {
                if (!this.notes) return;

                switch (e.code) {
                    case 'Space':
                        e.preventDefault();
                        const randomNote = Math.floor(Math.random() * 8);
                        this.notes.playNote(randomNote);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        this.changeOctave(1);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.changeOctave(-1);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.changeChord(-1);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.changeChord(1);
                        break;
                    case 'KeyR':
                        e.preventDefault();
                        this.toggleRecording();
                        break;
                }
            }

            toggleRecording() {
                if (this.recorder.isRecording) {
                    this.recorder.stopRecording();
                    this.updateRecordingUI(false);
                    this.showToast('Recording stopped', 'info');
                } else {
                    this.recorder.startRecording();
                    this.updateRecordingUI(true);
                    this.showToast('Recording started', 'success');
                }
            }

            updateRecordingUI(isRecording) {
                const recordBtn = document.getElementById('recordBtn');
                if (recordBtn) {
                    if (isRecording) {
                        recordBtn.textContent = '⏹ Stop';
                        recordBtn.className = 'btn btn-stop';
                        document.getElementById('mainContainer').classList.add('recording');
                    } else {
                        recordBtn.textContent = '● Record';
                        recordBtn.className = 'btn btn-record';
                        document.getElementById('mainContainer').classList.remove('recording');
                    }
                }
            }

            saveComposition() {
                if (!this.recorder.hasRecording()) {
                    this.showToast('Please record a composition first!', 'info');
                    return;
                }

                const composition = this.recorder.exportRecording();
                try {
                    window.parent?.postMessage({
                        type: 'saveComposition',
                        data: composition
                    }, '*');
                    
                    this.showToast('Composition saved!', 'success');
                } catch (error) {
                    this.showToast('Error saving composition', 'error');
                }
            }

            openShareModal() {
                if (!this.recorder.hasRecording()) {
                    this.showToast('Please record a composition first!', 'info');
                    return;
                }
                
                document.getElementById('shareModal').style.display = 'block';
            }

            closeShareModal() {
                document.getElementById('shareModal').style.display = 'none';
                document.getElementById('shareMessage').value = '';
            }

            shareComposition() {
                const message = document.getElementById('shareMessage').value;
                const composition = this.recorder.exportRecording();
                
                try {
                    window.parent?.postMessage({
                        type: 'shareComposition',
                        data: {
                            composition,
                            message: message || 'Check out my musical creation!'
                        }
                    }, '*');
                    
                    this.showToast('Composition shared!', 'success');
                    this.closeShareModal();
                } catch (error) {
                    this.showToast('Error sharing composition', 'error');
                }
            }

            startCollaboration() {
                try {
                    const sessionId = `collab_${Date.now()}`;
                    window.parent?.postMessage({
                        type: 'joinCollaboration',
                        data: { sessionId }
                    }, '*');
                    
                    document.body.classList.add('collaborative-mode');
                    this.showToast('Collaboration started!', 'success');
                } catch (error) {
                    this.showToast('Error starting collaboration', 'error');
                }
            }

            showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                
                const container = document.getElementById('toastContainer');
                container.appendChild(toast);
                
                setTimeout(() => {
                    toast.classList.add('show');
                }, 100);
                
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        toast.remove();
                    }, 300);
                }, 3000);
            }
        }

        // Initialize the app
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM loaded, initializing app...');
            try {
                const app = new SimpleMusicalApp();
                console.log('App created successfully');
                
                // Test if start button is visible
                const startBtn = document.getElementById('startBtn');
                if (startBtn) {
                    console.log('Start button found and visible');
                } else {
                    console.error('Start button not found!');
                }
            } catch (error) {
                console.error('Error initializing app:', error);
            }
        });

        // Handle messages from Reddit
        window.addEventListener('message', (event) => {
            console.log('Received message from Reddit:', event.data);
        });

        console.log('Script loaded successfully');