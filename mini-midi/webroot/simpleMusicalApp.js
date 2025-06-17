// Enhanced SimpleMusicalApp.js - Main Application with Pie Slice Support
import { SimpleAudio } from './simpleAudio.js';
import { SimpleNotes } from './simpleNotes.js';
import { SimpleRecorder } from './simpleRecorder.js';
import { GamepadManager } from './gamepadManager.js';

export class SimpleMusicalApp {
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

        // Clear all active pie slices
        this.clearActivePieSlices();
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

        if (result) {
            const angle = Math.atan2(y, x);
            const noteIndex = this.notes.angleToNoteIndex(angle);
            
            // Highlight the corresponding pie slice
            this.highlightPieSlice(side, noteIndex);

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
        }
    }

    clearActivePieSlices() {
        const allInnerElements = document.querySelectorAll('.segment .inner.active');
        allInnerElements.forEach(inner => inner.classList.remove('active'));
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
        this.clearActivePieSlices();
    }

    onNotePlayback(frame) {
        // Visual feedback during playback
        const instrumentId = frame.side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const instrument = document.getElementById(instrumentId);

        if (instrument) {
            this.animateInstrument(instrument);
            
            // Highlight the pie slice for this note
            this.highlightPieSlice(frame.side, frame.noteIndex);

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
        this.clearActivePieSlices();

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