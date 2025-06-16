// webview/scripts/redditUI.js - Extended UI with Reddit features
import { Ui } from './ui.js';

class RedditUI extends Ui {
    constructor(leftNotes, rightNotes) {
        super(leftNotes, rightNotes);
        this.collaborators = new Map();
        this.showCollaboratorIndicators = false;
        this.isRecording = false;
        this.isPlaying = false;
        this.setupRedditEventListeners();
    }

    setupRedditEventListeners() {
        // Listen for recording events
        window.addEventListener('recordingStopped', (event) => {
            this.showRecordingComplete(event.detail);
        });

        window.addEventListener('playbackStarted', (event) => {
            this.isPlaying = true;
            this.updatePlaybackIndicator();
        });

        window.addEventListener('playbackStopped', (event) => {
            this.isPlaying = false;
            this.updatePlaybackIndicator();
        });

        window.addEventListener('playbackProgress', (event) => {
            this.updatePlaybackProgress(event.detail);
        });

        window.addEventListener('recordingLimitReached', (event) => {
            this.showRecordingLimitWarning(event.detail);
        });
    }

    draw(leftTone, rightTone, octave, chord, sticksAxes) {
        // Call parent draw method
        super.draw(leftTone, rightTone, octave, chord, sticksAxes);
        
        // Add Reddit-specific UI updates
        this.updateRecordingIndicator();
        this.updateCollaboratorIndicators();
        this.updatePlaybackIndicator();
    }

    updateRecordingIndicator() {
        const recordBtn = document.getElementById('recordBtn');
        const app = document.getElementById('app');
        
        if (recordBtn && recordBtn.textContent.includes('Stop')) {
            // Add pulsing red border to indicate recording
            app.style.border = '3px solid #dc3545';
            app.style.animation = 'pulse 1s infinite';
            this.isRecording = true;
        } else {
            app.style.border = 'none';
            app.style.animation = 'none';
            this.isRecording = false;
        }
    }

    updatePlaybackIndicator() {
        const app = document.getElementById('app');
        
        if (this.isPlaying) {
            app.style.border = '3px solid #28a745';
            app.style.animation = 'glow 1.5s ease-in-out infinite alternate';
        } else if (!this.isRecording) {
            app.style.border = 'none';
            app.style.animation = 'none';
        }
    }

    updatePlaybackProgress(progressData) {
        // Create or update progress bar
        let progressBar = document.getElementById('playback-progress');
        if (!progressBar) {
            progressBar = this.createPlaybackProgressBar();
        }
        
        const progressFill = progressBar.querySelector('.progress-bar');
        if (progressFill) {
            progressFill.style.width = `${progressData.progress}%`;
            progressFill.setAttribute('aria-valuenow', progressData.progress);
        }
        
        // Show frame info
        const frameInfo = progressBar.querySelector('.frame-info');
        if (frameInfo) {
            frameInfo.textContent = `${progressData.currentFrame}/${progressData.totalFrames}`;
        }
    }

    createPlaybackProgressBar() {
        const container = document.querySelector('.recording-controls');
        const progressContainer = document.createElement('div');
        progressContainer.id = 'playback-progress';
        progressContainer.className = 'mt-2';
        progressContainer.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <small>Playback Progress</small>
                <small class="frame-info">0/0</small>
            </div>
            <div class="progress" style="height: 4px;">
                <div class="progress-bar bg-success" role="progressbar" 
                     style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                </div>
            </div>
        `;
        
        container.appendChild(progressContainer);
        return progressContainer;
    }

    showRecordingComplete(details) {
        const duration = Math.round(details.duration / 1000);
        const message = `Recording complete! Duration: ${duration}s, Frames: ${details.frameCount}`;
        this.showToast(message, 'success');
    }

    showRecordingLimitWarning(details) {
        const maxMinutes = Math.round(details.maxTime / 60);
        const message = `Recording stopped - ${maxMinutes} minute limit reached`;
        this.showToast(message, 'warning');
    }

    updateCollaboratorIndicators() {
        if (!this.showCollaboratorIndicators) return;
        
        // Show other users' controller positions
        for (let [userId, data] of this.collaborators.entries()) {
            this.drawCollaboratorCursor(userId, data);
        }
    }

    drawCollaboratorCursor(userId, data) {
        const { leftAxes, rightAxes } = data;
        
        // Create or update collaborator cursor for left controller
        let leftCursor = document.getElementById(`collaborator-left-${userId}`);
        if (!leftCursor) {
            leftCursor = this.createCollaboratorCursor(`collaborator-left-${userId}`, '#ff6b6b');
            document.getElementById('leftInstrument').appendChild(leftCursor);
        }
        this.moveCollaboratorCursor(leftCursor, leftAxes[0], leftAxes[1]);
        
        // Create or update collaborator cursor for right controller
        let rightCursor = document.getElementById(`collaborator-right-${userId}`);
        if (!rightCursor) {
            rightCursor = this.createCollaboratorCursor(`collaborator-right-${userId}`, '#4ecdc4');
            document.getElementById('rightInstrument').appendChild(rightCursor);
        }
        this.moveCollaboratorCursor(rightCursor, rightAxes[0], rightAxes[1]);
    }

    createCollaboratorCursor(id, color) {
        const cursor = document.createElement('div');
        cursor.id = id;
        cursor.className = 'collaborator-cursor';
        cursor.style.cssText = `
            position: absolute;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: ${color};
            border: 2px solid white;
            pointer-events: none;
            z-index: 1000;
            transition: transform 0.1s ease;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 10px ${color}50;
        `;
        
        // Add username label
        const label = document.createElement('div');
        label.className = 'collaborator-label';
        label.style.cssText = `
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            white-space: nowrap;
            pointer-events: none;
        `;
        label.textContent = id.replace('collaborator-left-', '').replace('collaborator-right-', '');
        cursor.appendChild(label);
        
        return cursor;
    }

    moveCollaboratorCursor(cursor, x, y) {
        const newX = (x * 50) - 50;
        const newY = (y * 50) - 50;
        cursor.style.transform = `translate(calc(-50% + ${newX}%), calc(-50% + ${newY}%))`;
    }

    addCollaborator(userId, data) {
        this.collaborators.set(userId, data);
        this.showCollaboratorIndicators = true;
        
        // Show notification
        this.showToast(`${userId} joined the session`, 'info');
        
        // Update collaborator count
        this.updateCollaboratorCount();
    }

    removeCollaborator(userId) {
        // Remove collaborator cursors
        const leftCursor = document.getElementById(`collaborator-left-${userId}`);
        const rightCursor = document.getElementById(`collaborator-right-${userId}`);
        
        if (leftCursor) leftCursor.remove();
        if (rightCursor) rightCursor.remove();
        
        this.collaborators.delete(userId);
        
        if (this.collaborators.size === 0) {
            this.showCollaboratorIndicators = false;
        }
        
        // Show notification
        this.showToast(`${userId} left the session`, 'info');
        
        // Update collaborator count
        this.updateCollaboratorCount();
    }

    updateCollaborator(userId, data) {
        if (this.collaborators.has(userId)) {
            this.collaborators.set(userId, data);
        }
    }

    updateCollaboratorCount() {
        let countElement = document.getElementById('collaborator-count');
        if (!countElement) {
            countElement = this.createCollaboratorCounter();
        }
        
        const count = this.collaborators.size;
        if (count > 0) {
            countElement.textContent = `👥 ${count} online`;
            countElement.style.display = 'inline-block';
        } else {
            countElement.style.display = 'none';
        }
    }

    createCollaboratorCounter() {
        const header = document.querySelector('.reddit-header .d-flex');
        const counter = document.createElement('span');
        counter.id = 'collaborator-count';
        counter.className = 'badge bg-success me-2';
        counter.style.display = 'none';
        header.insertBefore(counter, header.firstChild);
        return counter;
    }

    showToast(message, type = 'info') {
        // Create Bootstrap toast
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        
        const bgClass = {
            'success': 'bg-success',
            'error': 'bg-danger',
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-info';
        
        toast.className = `toast align-items-center text-white ${bgClass} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
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

    // Enhanced translation method with Reddit-specific terms
    translateInternal(language) {
        // Call parent translation first
        super.translateInternal(language);
        
        // Add Reddit-specific translations
        const redditTranslations = {
            en: {
                save_composition: "Save Composition",
                share_composition: "Share to Comments",
                start_collaboration: "Start Collaboration",
                recording: "Recording",
                playing: "Playing",
                record_button: "Record",
                play_button: "Play",
                stop_button: "Stop",
                collaborators_online: "online"
            },
            fr: {
                save_composition: "Sauvegarder",
                share_composition: "Partager",
                start_collaboration: "Collaborer",
                recording: "Enregistrement",
                playing: "Lecture",
                record_button: "Enregistrer",
                play_button: "Jouer",
                stop_button: "Arrêter",
                collaborators_online: "en ligne"
            },
            es: {
                save_composition: "Guardar",
                share_composition: "Compartir",
                start_collaboration: "Colaborar",
                recording: "Grabando",
                playing: "Reproduciendo",
                record_button: "Grabar",
                play_button: "Reproducir",
                stop_button: "Parar",
                collaborators_online: "en línea"
            }
        };

        const currentLang = this.language.includes("en") ? "en" : 
                           this.language.includes("fr") ? "fr" : "es";
        
        const translations = redditTranslations[currentLang];
        
        // Apply translations to Reddit-specific elements
        for (let [key, value] of Object.entries(translations)) {
            const element = document.getElementById(key);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'BUTTON') {
                    element.value = value;
                } else {
                    element.textContent = value;
                }
            }
        }
        
        // Update button texts
        const saveBtn = document.getElementById('saveBtn');
        const shareBtn = document.getElementById('shareBtn');
        const collaborateBtn = document.getElementById('collaborateBtn');
        
        if (saveBtn) saveBtn.textContent = translations.save_composition;
        if (shareBtn) shareBtn.textContent = translations.share_composition;
        if (collaborateBtn) collaborateBtn.textContent = translations.start_collaboration;
    }

    // Method to highlight active areas during recording/playback
    highlightActiveArea(leftActive, rightActive) {
        const leftInstrument = document.getElementById('leftInstrument');
        const rightInstrument = document.getElementById('rightInstrument');
        
        if (leftActive) {
            leftInstrument.classList.add('instrument-active');
        } else {
            leftInstrument.classList.remove('instrument-active');
        }
        
        if (rightActive) {
            rightInstrument.classList.add('instrument-active');
        } else {
            rightInstrument.classList.remove('instrument-active');
        }
    }

    // Method to show composition metadata
    showCompositionInfo(composition) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Composition Info</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Title:</strong> ${composition.title}</p>
                        <p><strong>Duration:</strong> ${Math.round(composition.duration / 1000)}s</p>
                        <p><strong>Frames:</strong> ${composition.sequence.length}</p>
                        <p><strong>Created:</strong> ${new Date(composition.created).toLocaleString()}</p>
                        <p><strong>Author:</strong> ${composition.authorId}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }
}

export { RedditUI };