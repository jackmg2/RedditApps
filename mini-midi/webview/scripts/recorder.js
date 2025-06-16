// webview/scripts/recorder.js - Recording functionality for Reddit sharing
class Recorder {
    constructor() {
        this.isRecording = false;
        this.recording = [];
        this.startTime = null;
        this.playbackIndex = 0;
        this.playbackStartTime = null;
        this.isPlaying = false;
        this.playbackInterval = null;
        this.recordingTimeInterval = null;
        this.maxRecordingTime = 300000; // 5 minutes in milliseconds
    }

    startRecording() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.recording = [];
        this.startTime = Date.now();
        this.updateRecordingTime();
        
        // Auto-stop recording after max time
        setTimeout(() => {
            if (this.isRecording) {
                this.stopRecording();
                this.showRecordingLimitReached();
            }
        }, this.maxRecordingTime);
    }

    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        clearInterval(this.recordingTimeInterval);
        
        // Trigger recording stopped event
        window.dispatchEvent(new CustomEvent('recordingStopped', {
            detail: {
                duration: this.getDuration(),
                frameCount: this.recording.length
            }
        }));
    }

    recordFrame(frameData) {
        if (!this.isRecording) return;
        
        const relativeTime = Date.now() - this.startTime;
        
        // Optimize recording by skipping duplicate frames
        const lastFrame = this.recording[this.recording.length - 1];
        if (lastFrame && this.areFramesSimilar(lastFrame, frameData)) {
            return; // Skip recording identical frames
        }
        
        this.recording.push({
            ...frameData,
            timestamp: relativeTime
        });
    }

    areFramesSimilar(frame1, frame2) {
        const threshold = 0.01; // Small threshold for axes comparison
        
        return frame1.leftTone === frame2.leftTone &&
               frame1.rightTone === frame2.rightTone &&
               frame1.octave === frame2.octave &&
               frame1.chord === frame2.chord &&
               Math.abs(frame1.axes[0] - frame2.axes[0]) < threshold &&
               Math.abs(frame1.axes[1] - frame2.axes[1]) < threshold &&
               Math.abs(frame1.axes[2] - frame2.axes[2]) < threshold &&
               Math.abs(frame1.axes[3] - frame2.axes[3]) < threshold;
    }

    hasRecording() {
        return this.recording.length > 0;
    }

    getRecording() {
        return this.recording;
    }

    getDuration() {
        if (this.recording.length === 0) return 0;
        return this.recording[this.recording.length - 1].timestamp;
    }

    getRecordingStats() {
        return {
            duration: this.getDuration(),
            frameCount: this.recording.length,
            averageFrameRate: this.recording.length / (this.getDuration() / 1000) || 0,
            sizeEstimate: JSON.stringify(this.recording).length
        };
    }

    playRecording() {
        if (!this.hasRecording() || this.isPlaying) return;
        
        this.isPlaying = true;
        this.playbackIndex = 0;
        this.playbackStartTime = Date.now();
        
        // Update play button UI
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '⏸ Pause';
            playBtn.className = 'btn btn-warning btn-sm';
        }
        
        // Trigger playback events
        this.playbackInterval = setInterval(() => {
            this.processPlayback();
        }, 16); // ~60fps
        
        // Trigger playback started event
        window.dispatchEvent(new CustomEvent('playbackStarted', {
            detail: { duration: this.getDuration() }
        }));
    }

    stopPlayback() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        clearInterval(this.playbackInterval);
        this.playbackIndex = 0;
        
        // Update play button UI
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '▶ Play';
            playBtn.className = 'btn btn-success btn-sm';
        }
        
        // Trigger playback stopped event
        window.dispatchEvent(new CustomEvent('playbackStopped'));
    }

    pausePlayback() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        clearInterval(this.playbackInterval);
        
        // Update play button UI
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '▶ Resume';
            playBtn.className = 'btn btn-success btn-sm';
        }
    }

    resumePlayback() {
        if (this.isPlaying || !this.hasRecording()) return;
        
        this.isPlaying = true;
        this.playbackStartTime = Date.now() - this.getCurrentPlaybackTime();
        
        // Update play button UI
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '⏸ Pause';
            playBtn.className = 'btn btn-warning btn-sm';
        }
        
        this.playbackInterval = setInterval(() => {
            this.processPlayback();
        }, 16);
    }

    getCurrentPlaybackTime() {
        if (this.playbackIndex < this.recording.length) {
            return this.recording[this.playbackIndex].timestamp;
        }
        return this.getDuration();
    }

    processPlayback() {
        if (!this.isPlaying || this.playbackIndex >= this.recording.length) {
            this.stopPlayback();
            return;
        }

        const currentTime = Date.now() - this.playbackStartTime;
        const frame = this.recording[this.playbackIndex];

        if (currentTime >= frame.timestamp) {
            // Dispatch custom event for playback
            window.dispatchEvent(new CustomEvent('playbackFrame', {
                detail: frame
            }));
            this.playbackIndex++;
            
            // Update progress
            this.updatePlaybackProgress();
        }
    }

    updatePlaybackProgress() {
        const progress = (this.playbackIndex / this.recording.length) * 100;
        window.dispatchEvent(new CustomEvent('playbackProgress', {
            detail: { progress, currentFrame: this.playbackIndex, totalFrames: this.recording.length }
        }));
    }

    updateRecordingTime() {
        if (!this.isRecording) return;
        
        this.recordingTimeInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const timeElement = document.getElementById('recordingTime');
            
            if (timeElement) {
                timeElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                // Change color when approaching limit
                const remainingTime = this.maxRecordingTime - elapsed;
                if (remainingTime < 30000) { // Last 30 seconds
                    timeElement.className = 'badge bg-danger';
                } else if (remainingTime < 60000) { // Last minute
                    timeElement.className = 'badge bg-warning';
                } else {
                    timeElement.className = 'badge bg-secondary';
                }
            }
        }, 1000);
    }

    showRecordingLimitReached() {
        // Show notification that recording limit was reached
        window.dispatchEvent(new CustomEvent('recordingLimitReached', {
            detail: { maxTime: this.maxRecordingTime / 1000 }
        }));
    }

    clearRecording() {
        this.stopRecording();
        this.stopPlayback();
        this.recording = [];
        this.playbackIndex = 0;
        
        // Reset UI
        const timeElement = document.getElementById('recordingTime');
        if (timeElement) {
            timeElement.textContent = '00:00';
            timeElement.className = 'badge bg-secondary';
        }
        
        window.dispatchEvent(new CustomEvent('recordingCleared'));
    }

    // Export recording as compressed data for sharing
    exportForSharing() {
        if (!this.hasRecording()) return null;
        
        return {
            version: '1.0',
            duration: this.getDuration(),
            frameCount: this.recording.length,
            data: this.compressRecording(this.recording),
            metadata: {
                created: Date.now(),
                stats: this.getRecordingStats()
            }
        };
    }

    // Simple compression by removing redundant data
    compressRecording(recording) {
        // Remove frames that are too similar to previous ones
        const compressed = [];
        let lastFrame = null;
        
        for (let frame of recording) {
            if (!lastFrame || !this.areFramesSimilar(lastFrame, frame)) {
                compressed.push(frame);
                lastFrame = frame;
            }
        }
        
        return compressed;
    }

    // Import recording from shared data
    importFromSharing(sharedData) {
        try {
            if (sharedData.version === '1.0') {
                this.recording = sharedData.data;
                this.playbackIndex = 0;
                
                window.dispatchEvent(new CustomEvent('recordingImported', {
                    detail: sharedData.metadata
                }));
                
                return true;
            }
        } catch (error) {
            console.error('Failed to import recording:', error);
        }
        return false;
    }
}

export { Recorder };