// SimpleRecorder.js - Recording System for FF7 Musical Interface
export class SimpleRecorder {
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