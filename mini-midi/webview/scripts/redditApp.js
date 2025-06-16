// webview/scripts/redditApp.js - Main app with Reddit integration
import { RedditAudio } from './redditAudio.js';
import { RedditUI } from './redditUI.js';
import { Notes } from './notes.js';
import { Controllers } from './controllers/controllers.js';
import { Recorder } from './recorder.js';
import { CollaborativeSync } from './collaborativeSync.js';

class RedditMusicalApp {
    constructor(audio) {
        this.audio = audio;
        this.notes = new Notes(audio);
        this.controllers = new Controllers(this.updateStatus.bind(this));
        this.ui = new RedditUI(this.notes.leftNotes, this.notes.rightNotes);
        this.recorder = new Recorder();
        this.collaborativeSync = null;
        this.previousKeysPressed = this.controllers.keysPressed;
        
        this.initializeRedditIntegration();
        this.setupRecordingControls();
        this.setupEventListeners();
        this.ui.draw(0, 0, this.notes.octave, this.notes.chord, [0, 0, 0, 0]);
        this.updateStatus();
    }

    initializeRedditIntegration() {
        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveComposition();
        });

        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('shareModal'));
            modal.show();
        });

        // Confirm share
        document.getElementById('confirmShare').addEventListener('click', () => {
            this.shareComposition();
        });

        // Collaborate button
        document.getElementById('collaborateBtn').addEventListener('click', () => {
            this.startCollaboration();
        });
    }

    setupRecordingControls() {
        document.getElementById('recordBtn').addEventListener('click', () => {
            if (this.recorder.isRecording) {
                this.recorder.stopRecording();
                document.getElementById('recordBtn').textContent = '● Record';
                document.getElementById('recordBtn').className = 'btn btn-danger btn-sm';
            } else {
                this.recorder.startRecording();
                document.getElementById('recordBtn').textContent = '⏹ Stop';
                document.getElementById('recordBtn').className = 'btn btn-warning btn-sm';
            }
        });

        document.getElementById('playBtn').addEventListener('click', () => {
            this.recorder.playRecording();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.recorder.stopPlayback();
        });
    }

    setupEventListeners() {
        // Listen for playback events
        window.addEventListener('playbackFrame', (event) => {
            this.handlePlaybackFrame(event.detail);
        });

        // Listen for collaborative events
        window.addEventListener('collaboratorJoined', (event) => {
            this.ui.addCollaborator(event.detail.userId, event.detail.data);
        });

        window.addEventListener('collaboratorLeft', (event) => {
            this.ui.removeCollaborator(event.detail.userId);
        });

        window.addEventListener('collaboratorUpdated', (event) => {
            this.ui.updateCollaborator(event.detail.userId, event.detail.data);
        });
    }

    handlePlaybackFrame(frameData) {
        // Apply the recorded frame data to the current state
        this.notes.octave = frameData.octave;
        this.notes.chord = frameData.chord;
        
        // Simulate the recorded input
        this.notes.findAndPlayCorrespondingNotes(
            frameData.leftTone, 
            frameData.rightTone, 
            frameData.axes
        );
        
        this.ui.draw(
            frameData.leftTone, 
            frameData.rightTone, 
            frameData.octave, 
            frameData.chord, 
            frameData.axes
        );
    }

    async saveComposition() {
        if (!this.recorder.hasRecording()) {
            alert('Please record a composition first!');
            return;
        }

        const composition = {
            sequence: this.recorder.getRecording(),
            duration: this.recorder.getDuration(),
            title: `Musical Creation ${new Date().toLocaleString()}`,
        };

        try {
            const response = await this.sendMessageToReddit('saveComposition', composition);
            if (response.success) {
                this.showToast('Composition saved successfully!', 'success');
            } else {
                this.showToast('Failed to save composition', 'error');
            }
        } catch (error) {
            this.showToast('Error saving composition', 'error');
        }
    }

    async shareComposition() {
        if (!this.recorder.hasRecording()) {
            alert('Please record a composition first!');
            return;
        }

        const message = document.getElementById('shareMessage').value;
        const composition = {
            sequence: this.recorder.getRecording(),
            duration: this.recorder.getDuration(),
            title: `Musical Creation ${new Date().toLocaleString()}`,
        };

        try {
            // First save the composition
            const saveResponse = await this.sendMessageToReddit('saveComposition', composition);
            if (saveResponse.success) {
                // Then share it
                const shareResponse = await this.sendMessageToReddit('shareComposition', {
                    compositionId: saveResponse.id,
                    message: message || 'Check out my musical creation!'
                });
                
                if (shareResponse.success) {
                    this.showToast('Composition shared to comments!', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('shareModal'));
                    modal.hide();
                }
            }
        } catch (error) {
            this.showToast('Error sharing composition', 'error');
        }
    }

    async startCollaboration() {
        const sessionId = `collab_${Date.now()}`;
        try {
            const response = await this.sendMessageToReddit('joinCollaboration', { sessionId });
            if (response.success) {
                this.showToast('Collaboration session started!', 'success');
                this.initializeCollaboration(sessionId);
            }
        } catch (error) {
            this.showToast('Error starting collaboration', 'error');
        }
    }

    initializeCollaboration(sessionId) {
        // Add visual indicators for collaborative mode
        document.body.classList.add('collaborative-mode');
        
        // Initialize collaborative sync
        this.collaborativeSync = new CollaborativeSync(sessionId, 'current_user');
        this.collaborativeSync.activate();
        
        // Start broadcasting state
        this.startCollaborativeBroadcast();
    }

    startCollaborativeBroadcast() {
        if (!this.collaborativeSync) return;
        
        setInterval(() => {
            if (this.collaborativeSync && this.collaborativeSync.isActive) {
                const gameState = {
                    leftAxes: [this.controllers.axes[0], this.controllers.axes[1]],
                    rightAxes: [this.controllers.axes[2], this.controllers.axes[3]],
                    octave: this.notes.octave,
                    chord: this.notes.chord,
                    timestamp: Date.now()
                };
                
                this.collaborativeSync.broadcastState(gameState);
            }
        }, 100); // 10fps broadcast rate
    }

    async sendMessageToReddit(type, data) {
        try {
            // Send message to parent Reddit frame
            window.parent?.postMessage({ type, data }, '*');
            
            // For now, we'll assume success since Devvit onMessage doesn't return responses
            // In a production app, you might implement a different response mechanism
            this.lastSyncTime = Date.now();
            
            if (this.connectionState !== 'connected') {
                this.connectionState = 'connected';
                this.notifyConnectionStateChange();
            }
            
            // Return a success response after a short delay to simulate processing
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ success: true });
                }, 100);
            });
        } catch (error) {
            console.error('Failed to send collaborative data:', error);
            this.connectionState = 'error';
            this.notifyConnectionStateChange();
            return { success: false, error: error.message };
        }
    }

    showToast(message, type) {
        // Create Bootstrap toast
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    updateStatus() {
        this.controllers.updateStatus();

        let leftCurrentTone = 0;
        if (this.controllers.keysPressed[12]) {
            leftCurrentTone = 1;
        } else if (this.controllers.keysPressed[6]) {
            leftCurrentTone = 2;
        } else if (this.controllers.keysPressed[4]) {
            leftCurrentTone = 3;
        }

        // Handle octave changes
        if (this.controllers.keysPressed[1] && this.previousKeysPressed[1] === false) {
            this.controllers.keysPressed[1] = true;
            this.notes.incrementOctave();
        }
        if (this.controllers.keysPressed[2] && this.previousKeysPressed[2] === false) {
            this.controllers.keysPressed[2] = true;
            this.notes.decrementOctave();
        }
        if (this.controllers.keysPressed[0]) {
            this.notes.reinitializeOctave();
        }

        // Handle chord changes
        if (this.controllers.keysPressed[15] && this.previousKeysPressed[15] === false) {
            this.controllers.keysPressed[15] = true;
            this.notes.incrementChord();
        }
        if (this.controllers.keysPressed[14] && this.previousKeysPressed[14] === false) {
            this.controllers.keysPressed[14] = true;
            this.notes.decrementChord();
        }
        if (this.controllers.keysPressed[13]) {
            this.notes.reinitializeChord();
        }

        let rightCurrentTone = (this.controllers.keysPressed[7]) ? 1 : 0;

        this.previousKeysPressed = [...this.controllers.keysPressed];

        this.notes.findAndPlayCorrespondingNotes(leftCurrentTone, rightCurrentTone, this.controllers.axes);

        // Record the current state if recording
        if (this.recorder.isRecording) {
            this.recorder.recordFrame({
                timestamp: Date.now(),
                leftTone: leftCurrentTone,
                rightTone: rightCurrentTone,
                octave: this.notes.octave,
                chord: this.notes.chord,
                axes: [...this.controllers.axes]
            });
        }

        this.ui.draw(leftCurrentTone, rightCurrentTone, this.notes.octave, this.notes.chord, this.controllers.axes);

        requestAnimationFrame(this.updateStatus.bind(this));
    }
}

// Initialize app when start button is clicked
document.getElementById('startAudioContext').addEventListener('click', function () {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audio = new RedditAudio(audioContext);
    const app = new RedditMusicalApp(audio);
    
    document.getElementById('startMessage').style.display = 'none';
    document.getElementById('player-div').style.display = 'flex';

    // Auto-detect language
    let languagePicker = document.getElementById("languages");
    const browserLang = navigator.language;
    if (browserLang.includes("en")) {
        languagePicker.value = "en";
    } else if (browserLang.includes("fr")) {
        languagePicker.value = "fr";
    } else if (browserLang.includes("es")) {
        languagePicker.value = "es";
    }
});

export { RedditMusicalApp };