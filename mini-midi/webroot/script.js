// Simplified FF7 Musical Interface
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

// Simple Notes System
class SimpleNotes {
    constructor(audio) {
        this.audio = audio;
        this.currentOctave = 4;
    }

    angleToNoteIndex(angle) {
        let degrees = (angle * 180 / Math.PI + 360) % 360;
        degrees = (degrees + 90) % 360;
        return Math.floor(degrees / 45);
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

// Simple Recorder
class SimpleRecorder {
    constructor() {
        this.isRecording = false;
        this.isPlaying = false;
        this.recording = [];
        this.startTime = null;
        this.recordingTimer = null;
        this.playbackTimeouts = [];
        this.playbackStartTime = null;
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

    startPlayback(notes, onNotePlay, onComplete) {
        if (this.isPlaying || !this.hasRecording()) return false;

        this.isPlaying = true;
        this.playbackStartTime = Date.now();
        this.playbackTimeouts = [];

        // Sort recording by timestamp to ensure correct order
        const sortedRecording = [...this.recording].sort((a, b) => a.timestamp - b.timestamp);

        // Schedule each note to play at the correct time
        sortedRecording.forEach(frame => {
            const timeout = setTimeout(() => {
                if (this.isPlaying && notes) {
                    // Play the note
                    if (frame.side === 'left') {
                        notes.playNote(frame.noteIndex);
                    } else {
                        notes.playChord(frame.noteIndex);
                    }

                    // Call callback for visual feedback
                    if (onNotePlay) {
                        onNotePlay(frame);
                    }
                }
            }, frame.timestamp);

            this.playbackTimeouts.push(timeout);
        });

        // Schedule completion callback
        const duration = this.recording[this.recording.length - 1]?.timestamp || 0;
        const completionTimeout = setTimeout(() => {
            this.stopPlayback();
            if (onComplete) {
                onComplete();
            }
        }, duration + 500); // Add small buffer

        this.playbackTimeouts.push(completionTimeout);

        // Update time display during playback
        this.updatePlaybackTime();

        return true;
    }

    stopPlayback() {
        if (!this.isPlaying) return false;

        this.isPlaying = false;

        // Clear all scheduled timeouts
        this.playbackTimeouts.forEach(timeout => clearTimeout(timeout));
        this.playbackTimeouts = [];

        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
        }

        return true;
    }

    updateRecordingTime() {
        this.recordingTimer = setInterval(() => {
            if (!this.isRecording && !this.isPlaying) return;

            const elapsed = this.isRecording
                ? Date.now() - this.startTime
                : Date.now() - this.playbackStartTime;

            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);

            const timeElement = document.getElementById('recordingTime');
            if (timeElement) {
                timeElement.textContent =
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    updatePlaybackTime() {
        this.recordingTimer = setInterval(() => {
            if (!this.isPlaying) return;

            const elapsed = Date.now() - this.playbackStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);

            const timeElement = document.getElementById('recordingTime');
            if (timeElement) {
                timeElement.textContent =
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 100); // Update more frequently during playback
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

    importRecording(compositionData) {
        try {
            if (!compositionData || !compositionData.data || !Array.isArray(compositionData.data)) {
                return false;
            }

            this.recording = compositionData.data;
            return true;
        } catch (error) {
            console.error('Error importing recording:', error);
            return false;
        }
    }
}

// Gamepad Manager
class GamepadManager {
    constructor(app) {
        this.app = app;
        this.gamepadIndex = null;
        this.isGamepadActive = false;
        this.deadZone = 0.15; // Ignore small stick movements
        this.lastLeftPosition = { x: 0, y: 0 };
        this.lastRightPosition = { x: 0, y: 0 };
        this.pollRate = 60; // Hz
        this.isPolling = false;
        this.lastNoteTime = { left: 0, right: 0 };
        this.noteDelay = 100; // Minimum ms between notes
        this.isGamepadControlActive = { left: false, right: false };

        this.setupGamepadEvents();
    }

    setupGamepadEvents() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
            this.isGamepadActive = true;
            this.startPolling();
            this.app.showToast('🎮 Gamepad connected! Use sticks to play.', 'success');
            this.showGamepadIndicator(true);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected:', e.gamepad.id);
            if (e.gamepad.index === this.gamepadIndex) {
                this.isGamepadActive = false;
                this.stopPolling();
                this.app.showToast('🎮 Gamepad disconnected', 'info');
                this.showGamepadIndicator(false);
            }
        });
    }

    startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.pollGamepad();
    }

    stopPolling() {
        this.isPolling = false;
    }

    pollGamepad() {
        if (!this.isPolling || !this.isGamepadActive) return;

        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.gamepadIndex];

        if (gamepad && this.app.isInitialized) {
            // Left stick (axes 0 and 1) controls left instrument (notes)
            const leftX = gamepad.axes[0] || 0;
            const leftY = gamepad.axes[1] || 0;

            // Right stick (axes 2 and 3) controls right instrument (chords)
            const rightX = gamepad.axes[2] || 0;
            const rightY = gamepad.axes[3] || 0;

            this.handleStickInput('left', leftX, leftY);
            this.handleStickInput('right', rightX, rightY);
        }

        // Continue polling
        requestAnimationFrame(() => this.pollGamepad());
    }

    handleStickInput(side, x, y) {
        const magnitude = Math.sqrt(x * x + y * y);

        // Apply deadzone
        if (magnitude < this.deadZone) {
            this.isGamepadControlActive[side] = false;
            // Only reset visual if not in playback and mouse isn't active
            if (!this.app.recorder.isPlaying && !this.app.isMouseDown) {
                this.resetInstrumentVisual(side);
            }
            return;
        }

        // Don't interfere with mouse control or playback
        if (this.app.isMouseDown || this.app.recorder.isPlaying) {
            return;
        }

        this.isGamepadControlActive[side] = true;

        // Normalize to unit circle if outside
        const normalizedX = magnitude > 1 ? x / magnitude : x;
        const normalizedY = magnitude > 1 ? y / magnitude : y;

        // Check if position changed significantly
        const lastPos = side === 'left' ? this.lastLeftPosition : this.lastRightPosition;
        const distance = Math.sqrt(
            Math.pow(normalizedX - lastPos.x, 2) +
            Math.pow(normalizedY - lastPos.y, 2)
        );

        // Update visual feedback
        this.updateInstrumentVisual(side, normalizedX, normalizedY);

        // Play note if enough time has passed and position changed enough
        const now = Date.now();
        const lastTime = side === 'left' ? this.lastNoteTime.left : this.lastNoteTime.right;

        if (distance > 0.3 && (now - lastTime) > this.noteDelay) {
            if (this.app.notes) {
                const result = this.app.notes.handleInstrumentTouch(normalizedX, normalizedY, side);

                if (result && this.app.recorder.isRecording) {
                    const angle = Math.atan2(normalizedY, normalizedX);
                    const noteIndex = this.app.notes.angleToNoteIndex(angle);
                    const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];

                    // Debug logging
                    console.log(`Gamepad ${side}: angle=${(angle * 180 / Math.PI).toFixed(1)}°, noteIndex=${noteIndex} (${noteNames[noteIndex]}), pos=(${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)})`);

                    this.app.recorder.recordFrame({
                        noteIndex,
                        side,
                        octave: this.app.notes.currentOctave
                    });
                }
            }

            // Update last position and time
            if (side === 'left') {
                this.lastLeftPosition = { x: normalizedX, y: normalizedY };
                this.lastNoteTime.left = now;
            } else {
                this.lastRightPosition = { x: normalizedX, y: normalizedY };
                this.lastNoteTime.right = now;
            }
        }
    }

    updateInstrumentVisual(side, x, y) {
        const instrumentId = side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const innerId = side === 'left' ? 'leftInner' : 'rightInner';

        const instrument = document.getElementById(instrumentId);
        const inner = document.getElementById(innerId);

        if (instrument && inner) {
            // Add gamepad glow effect
            instrument.style.boxShadow = '0 0 25px rgba(0, 255, 0, 0.6)';

            // Move inner circle based on stick position
            const maxDistance = 60; // Maximum movement from center
            const moveX = x * maxDistance;
            const moveY = y * maxDistance;

            inner.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
            inner.style.background = 'linear-gradient(135deg, #00ff00, #00cc00)';
        }
    }

    resetInstrumentVisual(side) {
        // Don't reset if mouse is controlling this instrument
        if (this.app.isMouseDown || this.app.recorder.isPlaying) {
            return;
        }

        const instrumentId = side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const innerId = side === 'left' ? 'leftInner' : 'rightInner';

        const instrument = document.getElementById(instrumentId);
        const inner = document.getElementById(innerId);

        if (instrument && inner) {
            // Remove gamepad glow
            instrument.style.boxShadow = '';

            // Reset inner circle
            inner.style.transform = 'translate(-50%, -50%)';
            inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
        }
    }

    // Method to temporarily disable gamepad control
    disableGamepadControl(side) {
        this.isGamepadControlActive[side] = false;
        this.resetInstrumentVisual(side);
    }

    // Method to check if gamepad is controlling a specific side
    isControlling(side) {
        return this.isGamepadControlActive[side];
    }

    showGamepadIndicator(show) {
        let indicator = document.getElementById('gamepadIndicator');

        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.id = 'gamepadIndicator';
            indicator.innerHTML = '🎮 Gamepad Active';
            indicator.style.cssText = `
                        position: fixed;
                        top: 70px;
                        right: 20px;
                        background: linear-gradient(135deg, #28a745, #20c997);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: bold;
                        z-index: 1000;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        backdrop-filter: blur(10px);
                        animation: fadeIn 0.3s ease;
                    `;
            document.body.appendChild(indicator);
        } else if (!show && indicator) {
            indicator.remove();
        }
    }

    detectGamepad() {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                this.gamepadIndex = i;
                this.isGamepadActive = true;
                this.startPolling();
                this.showGamepadIndicator(true);
                console.log('Detected existing gamepad:', gamepads[i].id);
                return true;
            }
        }
        return false;
    }
}

// Main Application
class SimpleMusicalApp {
    constructor() {
        this.audio = new SimpleAudio();
        this.notes = null;
        this.recorder = new SimpleRecorder();
        this.gamepad = new GamepadManager(this);
        this.isInitialized = false;
        this.isMouseDown = false;
        this.currentInstrument = null;

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
        }

        // Recording controls
        document.getElementById('recordBtn')?.addEventListener('click', () => {
            this.toggleRecording();
        });

        document.getElementById('playBtn')?.addEventListener('click', () => {
            this.togglePlayback();
        });

        document.getElementById('stopBtn')?.addEventListener('click', () => {
            if (this.recorder.isRecording) {
                this.recorder.stopRecording();
                this.updateRecordingUI(false);
                this.showToast('Recording stopped', 'info');
            } else if (this.recorder.isPlaying) {
                this.stopPlayback();
            }
        });

        document.getElementById('shareBtn')?.addEventListener('click', () => {
            this.openShareModal();
        });

        document.getElementById('importBtn')?.addEventListener('click', () => {
            this.openImportModal();
        });

        // Modal controls
        document.getElementById('cancelShare')?.addEventListener('click', () => {
            this.closeShareModal();
        });

        document.getElementById('confirmShare')?.addEventListener('click', () => {
            this.shareComposition();
        });

        document.getElementById('cancelImport')?.addEventListener('click', () => {
            this.closeImportModal();
        });

        document.getElementById('confirmImport')?.addEventListener('click', () => {
            this.importComposition();
        });

        // Instrument controls with mouse tracking
        this.setupInstrumentControls();

        console.log('Event listeners set up complete');
    }

    setupInstrumentControls() {
        const leftInstrument = document.getElementById('leftInstrument');
        const rightInstrument = document.getElementById('rightInstrument');
        const leftInner = document.getElementById('leftInner');
        const rightInner = document.getElementById('rightInner');

        // Mouse down events
        leftInstrument?.addEventListener('mousedown', (e) => {
            this.handleInstrumentStart(e, 'left', leftInner);
        });

        rightInstrument?.addEventListener('mousedown', (e) => {
            this.handleInstrumentStart(e, 'right', rightInner);
        });

        // Touch events
        leftInstrument?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInstrumentStart(e.touches[0], 'left', leftInner);
        });

        rightInstrument?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInstrumentStart(e.touches[0], 'right', rightInner);
        });

        // Global mouse events for tracking
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        document.addEventListener('mouseup', () => {
            this.handleInstrumentEnd();
        });

        document.addEventListener('touchmove', (e) => {
            if (this.isMouseDown) {
                e.preventDefault();
                this.handleMouseMove(e.touches[0]);
            }
        });

        document.addEventListener('touchend', () => {
            this.handleInstrumentEnd();
        });
    }

    handleInstrumentStart(event, side, innerCircle) {
        if (!this.notes || !this.isInitialized) {
            console.log('Audio not initialized yet');
            return;
        }

        this.isMouseDown = true;
        this.currentInstrument = { side, innerCircle, element: event.target.closest('.instrument') };

        this.updateInnerCirclePosition(event, innerCircle);
        this.playInstrumentAt(event, side);
    }

    handleMouseMove(event) {
        if (!this.isMouseDown || !this.currentInstrument) return;

        const { innerCircle, element } = this.currentInstrument;
        const rect = element.getBoundingClientRect();

        // Check if mouse is still over the instrument
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {

            this.updateInnerCirclePosition(event, innerCircle);
            this.playInstrumentAt(event, this.currentInstrument.side);
        }
    }

    handleInstrumentEnd() {
        if (this.currentInstrument) {
            // Reset inner circle to center
            this.currentInstrument.innerCircle.style.transform = 'translate(-50%, -50%)';
            this.currentInstrument = null;
        }
        this.isMouseDown = false;
    }

    updateInnerCirclePosition(event, innerCircle) {
        const rect = innerCircle.parentElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const x = event.clientX - centerX;
        const y = event.clientY - centerY;

        // Constrain movement within the circle (with some padding)
        const maxDistance = rect.width / 2 - 60; // Leave space for the inner circle
        const distance = Math.sqrt(x * x + y * y);

        if (distance > maxDistance) {
            const angle = Math.atan2(y, x);
            const constrainedX = Math.cos(angle) * maxDistance;
            const constrainedY = Math.sin(angle) * maxDistance;
            innerCircle.style.transform = `translate(calc(-50% + ${constrainedX}px), calc(-50% + ${constrainedY}px))`;
        } else {
            innerCircle.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        }
    }

    playInstrumentAt(event, side) {
        const rect = event.target.closest('.instrument').getBoundingClientRect();
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
                octave: this.notes.currentOctave
            });
        }

        this.animateInstrument(event.target.closest('.instrument'));
    }

    animateInstrument(element) {
        // Just add a subtle glow effect without moving the element
        element.style.boxShadow = '0 0 30px rgba(0, 212, 255, 1)';

        setTimeout(() => {
            element.style.boxShadow = '';
        }, 150);
    }

    startInterface() {
        console.log('Starting interface...');
        document.getElementById('startMessage').style.display = 'none';
        document.getElementById('playerInterface').style.display = 'block';
        this.showToast('Musical interface ready! 🎵', 'success');

        // Notify Reddit that webview is ready
        try {
            window.parent?.postMessage({
                type: 'webViewReady'
            }, '*');
        } catch (error) {
            console.log('Could not notify parent of readiness:', error);
        }
    }

    togglePlayback() {
        if (this.recorder.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        if (!this.recorder.hasRecording()) {
            this.showToast('No recording to play!', 'info');
            return;
        }

        if (this.recorder.isRecording) {
            this.showToast('Stop recording first!', 'info');
            return;
        }

        const success = this.recorder.startPlayback(
            this.notes,
            (frame) => this.onNotePlayback(frame),
            () => this.onPlaybackComplete()
        );

        if (success) {
            this.updatePlaybackUI(true);
            this.showToast('Playing recording...', 'success');
        }
    }

    stopPlayback() {
        this.recorder.stopPlayback();
        this.updatePlaybackUI(false);
        this.showToast('Playback stopped', 'info');
    }

    onNotePlayback(frame) {
        // Visual feedback during playback
        const instrumentId = frame.side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const instrument = document.getElementById(instrumentId);

        if (instrument) {
            this.animateInstrument(instrument);

            // Briefly move the inner circle to show which note is being played
            const innerId = frame.side === 'left' ? 'leftInner' : 'rightInner';
            const inner = document.getElementById(innerId);

            if (inner) {
                // Calculate position based on note index
                const angle = (frame.noteIndex * 45 - 90) * Math.PI / 180; // Convert to radians, start from top
                const radius = 60; // Distance from center
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                inner.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
                inner.style.background = 'linear-gradient(135deg, #00d4ff, #3498db)';

                // Reset after a short time
                setTimeout(() => {
                    inner.style.transform = 'translate(-50%, -50%)';
                    inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
                }, 150);
            }
        }
    }

    onPlaybackComplete() {
        this.updatePlaybackUI(false);
        this.showToast('Playback complete!', 'success');

        // Reset time display
        const timeElement = document.getElementById('recordingTime');
        if (timeElement) {
            timeElement.textContent = '00:00';
        }
    }

    updatePlaybackUI(isPlaying) {
        const playBtn = document.getElementById('playBtn');
        const recordBtn = document.getElementById('recordBtn');

        if (playBtn) {
            if (isPlaying) {
                playBtn.textContent = '⏸ Pause';
                playBtn.className = 'btn btn-stop';
                // Disable record button during playback
                if (recordBtn) recordBtn.disabled = true;
            } else {
                playBtn.textContent = '▶ Play';
                playBtn.className = 'btn btn-play';
                // Re-enable record button
                if (recordBtn) recordBtn.disabled = false;
            }
        }
    }

    toggleRecording() {
        if (this.recorder.isPlaying) {
            this.showToast('Stop playback first!', 'info');
            return;
        }

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
        const playBtn = document.getElementById('playBtn');

        if (recordBtn) {
            if (isRecording) {
                recordBtn.textContent = '⏹ Stop';
                recordBtn.className = 'btn btn-stop';
                document.getElementById('mainContainer').classList.add('recording');
                // Disable play button during recording
                if (playBtn) playBtn.disabled = true;
            } else {
                recordBtn.textContent = '● Record';
                recordBtn.className = 'btn btn-record';
                document.getElementById('mainContainer').classList.remove('recording');
                // Re-enable play button
                if (playBtn) playBtn.disabled = false;
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
            // Send composition data to Reddit backend
            window.parent?.postMessage({
                type: 'saveComposition',
                data: composition
            }, '*');

            this.showToast('Saving composition...', 'info');
        } catch (error) {
            console.error('Error saving composition:', error);
            this.showToast('Error saving composition', 'error');
        }
    }

    openImportModal() {
        document.getElementById('importModal').style.display = 'block';
    }

    closeImportModal() {
        document.getElementById('importModal').style.display = 'none';
        document.getElementById('importData').value = '';
    }

    importComposition() {
        const importData = document.getElementById('importData').value.trim();

        if (!importData) {
            this.showToast('Please paste composition data!', 'info');
            return;
        }

        try {
            // Try to decode base64 first (new format)
            let compositionData;
            try {
                const decodedData = atob(importData);
                compositionData = JSON.parse(decodedData);
            } catch (e) {
                // If base64 fails, try direct JSON parse (legacy format)
                compositionData = JSON.parse(importData);
            }

            const success = this.recorder.importRecording(compositionData);

            if (success) {
                this.showToast('Composition imported successfully!', 'success');
                this.closeImportModal();

                // Show duration info
                const duration = Math.floor(compositionData.duration / 1000);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                this.showToast(
                    `Loaded ${compositionData.frameCount} notes (${minutes}:${seconds.toString().padStart(2, '0')})`,
                    'info'
                );
            } else {
                this.showToast('Invalid composition data!', 'error');
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Failed to import - invalid format!', 'error');
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

        if (!composition) {
            this.showToast('No composition to share!', 'error');
            this.closeShareModal();
            return;
        }

        try {
            // Encode composition data as base64 for compact sharing
            const encodedData = btoa(JSON.stringify(composition));

            // Send to Reddit backend to create comment
            window.parent?.postMessage({
                type: 'shareComposition',
                data: {
                    encodedComposition: encodedData,
                    message: message || 'Check out my musical creation! 🎵',
                    duration: composition.duration,
                    noteCount: composition.frameCount
                }
            }, '*');

            this.showToast('Sharing composition...', 'info');
            this.closeShareModal();
        } catch (error) {
            console.error('Error sharing composition:', error);
            this.showToast('Error sharing composition', 'error');
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
        window.musicalApp = app; // Make globally accessible for message handling
        console.log('App created successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Handle messages from Reddit
window.addEventListener('message', (event) => {
    console.log('Received message from Reddit:', event.data);

    // Handle Devvit system messages
    if (event.data.type === 'devvit-message' && event.data.data?.message) {
        const message = event.data.data.message;

        switch (message.type) {
            case 'initialData':
                // Handle initial data if needed
                console.log('Received initial data:', message.data);
                break;
            case 'updateFavorites':
                // Handle favorites update if needed
                console.log('Favorites updated:', message.data);
                break;
        }
    }
});

console.log('Script loaded successfully');