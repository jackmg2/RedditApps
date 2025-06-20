// Enhanced SimpleMusicalApp.js - Updated to show chord progressions
import { SimpleAudio } from './simpleAudio.js';
import { SimpleNotes } from './simpleNotes.js';
import { SimpleRecorder } from './simpleRecorder.js';
import { GamepadManager } from './gamepadManager.js';
import { KeyboardManager } from './keyboardManager.js';

export class SimpleMusicalApp {
    constructor() {
        this.audio = new SimpleAudio();
        this.notes = null;
        this.recorder = new SimpleRecorder();
        this.gamepad = new GamepadManager(this);
        this.keyboard = new KeyboardManager(this);
        this.isInitialized = false;
        this.isMouseDown = false;
        this.currentInstrument = null;
        // Initialize touch tracking
        this.activeTouches = {
            left: null,
            right: null
        };

        console.log('App initialized with enhanced chord progressions, setting up event listeners...');
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

        document.getElementById('octaveUp')?.addEventListener('click', () => {
            if (this.notes) {
                const newOctave = this.notes.changeOctave(1);
                this.updateOctaveDisplay(newOctave);
                this.showToast(`Octave: ${newOctave}`, 'info');
            }
        });

        document.getElementById('octaveDown')?.addEventListener('click', () => {
            if (this.notes) {
                const newOctave = this.notes.changeOctave(-1);
                this.updateOctaveDisplay(newOctave);
                this.showToast(`Octave: ${newOctave}`, 'info');
            }
        });

        // Scale navigation - UPDATED to show chord progression info
        document.getElementById('scalePrev')?.addEventListener('click', () => {
            if (this.notes) {
                const newScale = this.notes.changeScale(-1);
                this.updateScaleDisplay(newScale);
                const progressionInfo = this.notes.getScaleProgressionInfo();
                this.showToast(`🎵 ${this.getScaleDisplayName(newScale)}: ${progressionInfo.description}`, 'success');
            }
        });

        document.getElementById('scaleNext')?.addEventListener('click', () => {
            if (this.notes) {
                const newScale = this.notes.changeScale(1);
                this.updateScaleDisplay(newScale);
                const progressionInfo = this.notes.getScaleProgressionInfo();
                this.showToast(`🎵 ${this.getScaleDisplayName(newScale)}: ${progressionInfo.description}`, 'success');
            }
        });

        // Instrument controls with mouse tracking
        this.setupInstrumentControls();
        this.setupInstrumentHoverEffects();

        console.log('Event listeners set up complete');
    }

    updateOctaveDisplay(octave) {
        const display = document.getElementById('octaveDisplay');
        if (display) {
            display.textContent = `Oct: ${octave}`;
        }
    }

    updateScaleDisplay(scale) {
        const display = document.getElementById('scaleDisplay');
        if (display) {
            display.textContent = this.getScaleDisplayName(scale);
        }
    }

    getScaleDisplayName(scale) {
        const scaleNames = {
            'chromatic': 'Chromatic',
            'major': 'Major ✨',
            'minor': 'Minor 🌙',
            'pentatonic': 'Pentatonic 🎸',
            'blues': 'Blues 🎷',
            'dorian': 'Dorian 🎹',
            'mixolydian': 'Mixolydian 🎺'
        };
        return scaleNames[scale] || scale;
    }

    updateChordDisplay(chordName) {
        const display = document.getElementById('lastChordPlayed');
        if (display) {
            display.textContent = chordName;
            display.classList.add('active');

            // Remove active class after animation
            setTimeout(() => {
                display.classList.remove('active');
            }, 600);
        }
    }

    // [Rest of the methods remain the same - setupInstrumentControls, etc.]
    setupInstrumentControls() {
        const leftInstrument = document.getElementById('leftInstrument');
        const rightInstrument = document.getElementById('rightInstrument');
        const leftInner = document.getElementById('leftInner');
        const rightInner = document.getElementById('rightInner');

        // Track active touches for each instrument
        this.activeTouches = {
            left: null,
            right: null
        };

        // Mouse down events (desktop)
        leftInstrument?.addEventListener('mousedown', (e) => {
            this.handleInstrumentStart(e, 'left', leftInner);
        });

        rightInstrument?.addEventListener('mousedown', (e) => {
            this.handleInstrumentStart(e, 'right', rightInner);
        });

        // Enhanced touch events with multi-touch support
        leftInstrument?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e, 'left', leftInner, leftInstrument);
        });

        rightInstrument?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e, 'right', rightInner, rightInstrument);
        });

        // Global touch move - handle all active touches
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouchMove(e);
        }, { passive: false });

        // Global touch end - clean up ended touches
        document.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        });

        // Global mouse events for tracking (desktop)
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        document.addEventListener('mouseup', () => {
            this.handleInstrumentEnd();
        });
    }

    // [Touch and mouse handling methods remain the same...]
    handleTouchStart(event, side, innerCircle, instrumentElement) {
        if (!this.notes || !this.isInitialized) {
            console.log('Audio not initialized yet');
            return;
        }

        const touch = Array.from(event.touches).find(t => {
            const element = document.elementFromPoint(t.clientX, t.clientY);
            return element && instrumentElement.contains(element);
        });

        if (touch) {
            this.activeTouches[side] = {
                id: touch.identifier,
                innerCircle,
                element: instrumentElement
            };

            this.updateInnerCirclePosition(touch, innerCircle);
            this.playInstrumentAt(touch, side);
        }
    }

    handleTouchMove(event) {
        Object.keys(this.activeTouches).forEach(side => {
            const activeTouch = this.activeTouches[side];
            if (!activeTouch) return;

            const currentTouch = Array.from(event.touches).find(t =>
                t.identifier === activeTouch.id
            );

            if (currentTouch) {
                const rect = activeTouch.element.getBoundingClientRect();

                if (currentTouch.clientX >= rect.left && currentTouch.clientX <= rect.right &&
                    currentTouch.clientY >= rect.top && currentTouch.clientY <= rect.bottom) {

                    this.updateInnerCirclePosition(currentTouch, activeTouch.innerCircle);
                    this.playInstrumentAt(currentTouch, side);
                }
            }
        });
    }

    handleTouchEnd(event) {
        Object.keys(this.activeTouches).forEach(side => {
            const activeTouch = this.activeTouches[side];
            if (!activeTouch) return;

            const touchStillActive = Array.from(event.touches).some(t =>
                t.identifier === activeTouch.id
            );

            if (!touchStillActive) {
                activeTouch.innerCircle.style.transform = 'translate(-50%, -50%)';
                this.activeTouches[side] = null;
            }
        });

        const hasActiveTouches = Object.values(this.activeTouches).some(touch => touch !== null);
        if (!hasActiveTouches) {
            this.clearActivePieSlices();
        }
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

        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {

            this.updateInnerCirclePosition(event, innerCircle);
            this.playInstrumentAt(event, this.currentInstrument.side);
        }
    }

    handleInstrumentEnd() {
        if (this.currentInstrument) {
            this.currentInstrument.innerCircle.style.transform = 'translate(-50%, -50%)';
            this.currentInstrument = null;
        }
        this.isMouseDown = false;
        this.clearActivePieSlices();
    }

    updateInnerCirclePosition(event, innerCircle) {
        const rect = innerCircle.parentElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const x = event.clientX - centerX;
        const y = event.clientY - centerY;

        const maxDistance = rect.width / 2 - 60;
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

        if (result) {
            const angle = Math.atan2(y, x);
            const noteIndex = this.notes.angleToNoteIndex(angle);

            // Highlight the corresponding pie slice
            this.highlightPieSlice(side, noteIndex);

            // Update UI based on instrument type
            if (side === 'left') {
                // For notes, could show note name
                const noteName = this.notes.getNoteNameByIndex(noteIndex);
                console.log(`Playing note: ${noteName}`);
            } else {
                // For chords, show chord name with enhanced info
                const chordName = this.notes.getChordNameByIndex(noteIndex);
                const progressionInfo = this.notes.getScaleProgressionInfo();
                const romanNumeral = progressionInfo.chordNames[noteIndex];
                this.updateChordDisplay(`${chordName} (${romanNumeral})`);
                console.log(`Playing chord: ${chordName} (${romanNumeral})`);
            }

            if (this.recorder.isRecording) {
                this.recorder.recordFrame({
                    noteIndex,
                    side,
                    octave: this.notes.currentOctave
                });
            }
        }

        this.animateInstrument(event.target.closest('.instrument'));
    }

    highlightPieSlice(side, noteIndex) {
        // Clear previous highlights for this instrument
        const instrumentId = side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const instrument = document.getElementById(instrumentId);

        if (instrument) {
            // Remove active class from all inner elements in this instrument
            const allInnerElements = instrument.querySelectorAll('.segment .inner');
            allInnerElements.forEach(inner => inner.classList.remove('active'));

            // Remove active class from all external note labels in this instrument
            const allExternalLabels = instrument.querySelectorAll('.external-note-label');
            allExternalLabels.forEach(label => label.classList.remove('active'));

            // Add active class to the current slice's inner element
            const activeSlice = instrument.querySelector(`.note-${noteIndex}`);
            if (activeSlice) {
                const innerElement = activeSlice.querySelector('.segment .inner');
                if (innerElement) {
                    innerElement.classList.add('active');

                    // Remove active class after a short delay
                    setTimeout(() => {
                        innerElement.classList.remove('active');
                    }, 400);
                }
            }

            // Animate the external note label
            const externalLabel = instrument.querySelector(`[data-note-index="${noteIndex}"]`);
            if (externalLabel) {
                externalLabel.classList.add('active');

                // Remove active class after animation
                setTimeout(() => {
                    externalLabel.classList.remove('active');
                }, 600);
            }
        }
    }

    clearActivePieSlices() {
        const allInnerElements = document.querySelectorAll('.segment .inner.active');
        allInnerElements.forEach(inner => inner.classList.remove('active'));

        const allExternalLabels = document.querySelectorAll('.external-note-label.active');
        allExternalLabels.forEach(label => label.classList.remove('active'));
    }

    setupInstrumentHoverEffects() {
        const instruments = document.querySelectorAll('.instrument');

        instruments.forEach(instrument => {
            const noteIndicators = instrument.querySelectorAll('.note-indicator');

            noteIndicators.forEach((indicator, index) => {
                const externalLabel = instrument.querySelector(`[data-note-index="${index}"]`);

                if (externalLabel) {
                    indicator.addEventListener('mouseenter', () => {
                        externalLabel.classList.add('hover');
                    });

                    indicator.addEventListener('mouseleave', () => {
                        externalLabel.classList.remove('hover');
                    });
                }
            });
        });
    }

    animateInstrument(element) {
        element.style.boxShadow = '0 0 30px rgba(0, 212, 255, 1)';

        setTimeout(() => {
            element.style.boxShadow = '';
        }, 150);
    }

    startInterface() {
        console.log('Starting interface...');
        document.getElementById('startMessage').style.display = 'none';
        document.getElementById('playerInterface').style.display = 'block';

        // Initialize scale UI and chord progression display
        if (this.notes) {
            this.notes.updateScaleUI();
        }

        // Notify Reddit that webview is ready
        try {
            window.parent?.postMessage({
                type: 'webViewReady'
            }, '*');
        } catch (error) {
            console.log('Could not notify parent of readiness:', error);
        }
    }

    // [Rest of the methods remain the same - togglePlayback, recording, etc.]
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
        this.clearActivePieSlices();
    }

    onNotePlayback(frame) {
        const instrumentId = frame.side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const instrument = document.getElementById(instrumentId);

        if (instrument) {
            this.animateInstrument(instrument);
            this.highlightPieSlice(frame.side, frame.noteIndex);

            if (frame.side === 'left') {
                const noteName = this.notes.getNoteNameByIndex(frame.noteIndex);
                console.log(`Playback note: ${noteName}`);
            } else {
                const chordName = this.notes.getChordNameByIndex(frame.noteIndex);
                const progressionInfo = this.notes.getScaleProgressionInfo();
                const romanNumeral = progressionInfo.chordNames[frame.noteIndex];
                this.updateChordDisplay(`${chordName} (${romanNumeral})`);
            }

            const innerId = frame.side === 'left' ? 'leftInner' : 'rightInner';
            const inner = document.getElementById(innerId);

            if (inner) {
                let degrees = frame.noteIndex * 45;
                const angle = degrees * Math.PI / 180;

                const radius = 60;
                const x = Math.cos(angle - Math.PI / 2) * radius;
                const y = Math.sin(angle - Math.PI / 2) * radius;

                inner.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
                inner.style.background = frame.side === 'left'
                    ? 'linear-gradient(135deg, #00d4ff, #3498db)'
                    : 'linear-gradient(135deg, #8e44ad, #9b59b6)';

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
        this.clearActivePieSlices();

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
                if (recordBtn) recordBtn.disabled = true;
            } else {
                playBtn.textContent = '▶ Play';
                playBtn.className = 'btn btn-play';
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
                if (playBtn) playBtn.disabled = true;
            } else {
                recordBtn.textContent = '● Record';
                recordBtn.className = 'btn btn-record';
                document.getElementById('mainContainer').classList.remove('recording');
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
        this.keyboard.disableKeyboardControl();
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
            let compositionData;
            try {
                const decodedData = atob(importData);
                compositionData = JSON.parse(decodedData);
            } catch (e) {
                compositionData = JSON.parse(importData);
            }

            const success = this.recorder.importRecording(compositionData);

            if (success) {
                this.showToast('Composition imported successfully!', 'success');
                this.closeImportModal();

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
        this.keyboard.disableKeyboardControl();
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
            const encodedData = btoa(JSON.stringify(composition));
            const currentScale = this.notes.getCurrentScale();
            const currentOctave = this.notes.getCurrentOctave();
            const scaleDisplayName = this.getScaleDisplayName(currentScale);

            window.parent?.postMessage({
                type: 'shareComposition',
                data: {
                    encodedComposition: encodedData,
                    message: message || 'Check out my musical creation! 🎵',
                    duration: composition.duration,
                    noteCount: composition.frameCount,
                    scale: currentScale,
                    scaleDisplayName: scaleDisplayName,
                    octave: currentOctave
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