// simpleRecorder.js - Simple recording system without external dependencies

class SimpleRecorder {
    constructor() {
        this.isRecording = false;
        this.isPlaying = false;
        this.recording = [];
        this.startTime = null;
        this.playbackIndex = 0;
        this.playbackStartTime = null;
        this.playbackTimer = null;
        this.recordingTimer = null;
        this.maxDuration = 300000; // 5 minutes max
        this.events = new EventTarget();
    }

    // Start recording
    startRecording() {
        if (this.isRecording) return false;

        this.isRecording = true;
        this.recording = [];
        this.startTime = Date.now();
        
        this.updateRecordingTime();
        this.dispatchEvent('recordingStarted');
        
        // Auto-stop after max duration
        setTimeout(() => {
            if (this.isRecording) {
                this.stopRecording();
                this.dispatchEvent('recordingLimitReached');
            }
        }, this.maxDuration);

        return true;
    }

    // Stop recording
    stopRecording() {
        if (!this.isRecording) return false;

        this.isRecording = false;
        clearInterval(this.recordingTimer);
        
        this.dispatchEvent('recordingStopped', {
            duration: this.getDuration(),
            frameCount: this.recording.length
        });

        return true;
    }

    // Record a frame of data
    recordFrame(data) {
        if (!this.isRecording) return false;

        const timestamp = Date.now() - this.startTime;
        const frame = {
            timestamp,
            ...data
        };

        // Simple compression - only record if different from last frame
        const lastFrame = this.recording[this.recording.length - 1];
        if (!lastFrame || this.isFrameDifferent(frame, lastFrame)) {
            this.recording.push(frame);
        }

        return true;
    }

    // Check if frames are different enough to record
    isFrameDifferent(frame1, frame2) {
        const threshold = 50; // 50ms threshold for timing
        
        return Math.abs(frame1.timestamp - frame2.timestamp) > threshold ||
               frame1.noteIndex !== frame2.noteIndex ||
               frame1.side !== frame2.side ||
               frame1.octave !== frame2.octave ||
               frame1.chord !== frame2.chord ||
               frame1.leftTone !== frame2.leftTone ||
               frame1.rightTone !== frame2.rightTone;
    }

    // Play back recording
    playRecording() {
        if (!this.hasRecording() || this.isPlaying) return false;

        this.isPlaying = true;
        this.playbackIndex = 0;
        this.playbackStartTime = Date.now();
        
        this.dispatchEvent('playbackStarted');
        this.processPlayback();

        return true;
    }

    // Stop playback
    stopPlayback() {
        if (!this.isPlaying) return false;

        this.isPlaying = false;
        this.playbackIndex = 0;
        clearTimeout(this.playbackTimer);
        
        this.dispatchEvent('playbackStopped');
        return true;
    }

    // Process playback frames
    processPlayback() {
        if (!this.isPlaying || this.playbackIndex >= this.recording.length) {
            this.stopPlayback();
            return;
        }

        const currentTime = Date.now() - this.playbackStartTime;
        const frame = this.recording[this.playbackIndex];

        if (currentTime >= frame.timestamp) {
            // Dispatch frame for playback
            this.dispatchEvent('playbackFrame', frame);
            this.playbackIndex++;
            
            // Update progress
            const progress = (this.playbackIndex / this.recording.length) * 100;
            this.dispatchEvent('playbackProgress', { 
                progress, 
                currentFrame: this.playbackIndex, 
                totalFrames: this.recording.length 
            });
        }

        // Schedule next frame check
        this.playbackTimer = setTimeout(() => {
            this.processPlayback();
        }, 16); // ~60fps
    }

    // Update recording time display
    updateRecordingTime() {
        this.recordingTimer = setInterval(() => {
            if (!this.isRecording) return;

            const elapsed = Date.now() - this.startTime;
            const timeData = this.formatTime(elapsed);
            
            this.dispatchEvent('recordingTimeUpdate', {
                elapsed,
                formatted: timeData.formatted,
                remaining: this.maxDuration - elapsed
            });
        }, 1000);
    }

    // Format time for display
    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return {
            minutes,
            seconds,
            formatted: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };
    }

    // Check if has recording
    hasRecording() {
        return this.recording.length > 0;
    }

    // Get recording duration
    getDuration() {
        if (!this.hasRecording()) return 0;
        return this.recording[this.recording.length - 1].timestamp;
    }

    // Get recording data
    getRecording() {
        return this.recording;
    }

    // Clear recording
    clearRecording() {
        this.stopRecording();
        this.stopPlayback();
        this.recording = [];
        this.playbackIndex = 0;
        
        this.dispatchEvent('recordingCleared');
    }

    // Get recording statistics
    getStats() {
        const duration = this.getDuration();
        const frameCount = this.recording.length;
        const avgFrameRate = frameCount > 0 ? frameCount / (duration / 1000) : 0;
        
        return {
            duration,
            frameCount,
            avgFrameRate: Math.round(avgFrameRate * 100) / 100,
            sizeEstimate: JSON.stringify(this.recording).length,
            isEmpty: !this.hasRecording()
        };
    }

    // Export recording for sharing
    exportRecording() {
        if (!this.hasRecording()) return null;

        return {
            version: '1.0',
            created: Date.now(),
            duration: this.getDuration(),
            frameCount: this.recording.length,
            data: this.compressRecording(),
            metadata: this.getStats()
        };
    }

    // Simple compression
    compressRecording() {
        // Remove consecutive duplicate frames
        const compressed = [];
        let lastFrame = null;

        for (const frame of this.recording) {
            if (!lastFrame || this.isFrameDifferent(frame, lastFrame)) {
                compressed.push({
                    t: frame.timestamp,
                    n: frame.noteIndex,
                    s: frame.side,
                    o: frame.octave,
                    c: frame.chord,
                    lt: frame.leftTone,
                    rt: frame.rightTone
                });
                lastFrame = frame;
            }
        }

        return compressed;
    }

    // Import recording from exported data
    importRecording(exportedData) {
        try {
            if (!exportedData || exportedData.version !== '1.0') {
                throw new Error('Invalid or unsupported recording format');
            }

            // Decompress data
            this.recording = exportedData.data.map(frame => ({
                timestamp: frame.t,
                noteIndex: frame.n,
                side: frame.s,
                octave: frame.o,
                chord: frame.c,
                leftTone: frame.lt,
                rightTone: frame.rt
            }));

            this.playbackIndex = 0;
            this.dispatchEvent('recordingImported', exportedData.metadata);
            
            return true;
        } catch (error) {
            console.error('Failed to import recording:', error);
            return false;
        }
    }

    // Load recording from encoded string (for Reddit sharing)
    loadFromEncodedString(encodedString) {
        try {
            const decoded = atob(encodedString);
            const data = JSON.parse(decoded);
            return this.importRecording(data);
        } catch (error) {
            console.error('Failed to load from encoded string:', error);
            return false;
        }
    }

    // Encode recording to string for sharing
    encodeToString() {
        const exported = this.exportRecording();
        if (!exported) return null;
        
        try {
            return btoa(JSON.stringify(exported));
        } catch (error) {
            console.error('Failed to encode recording:', error);
            return null;
        }
    }

    // Event handling
    addEventListener(type, listener) {
        this.events.addEventListener(type, listener);
    }

    removeEventListener(type, listener) {
        this.events.removeEventListener(type, listener);
    }

    dispatchEvent(type, detail = null) {
        const event = new CustomEvent(type, { detail });
        this.events.dispatchEvent(event);
    }

    // Get current state
    getState() {
        return {
            isRecording: this.isRecording,
            isPlaying: this.isPlaying,
            hasRecording: this.hasRecording(),
            duration: this.getDuration(),
            frameCount: this.recording.length,
            playbackProgress: this.playbackIndex / Math.max(1, this.recording.length)
        };
    }
}

export { SimpleRecorder };