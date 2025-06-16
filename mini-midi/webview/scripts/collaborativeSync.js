// webview/scripts/collaborativeSync.js - Real-time collaboration features
class CollaborativeSync {
    constructor(sessionId, userId) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.collaborators = new Map();
        this.syncQueue = [];
        this.lastSyncTime = 0;
        this.isActive = false;
        this.syncInterval = null;
        this.heartbeatInterval = null;
        this.lastHeartbeat = Date.now();
        this.connectionState = 'disconnected';
    }

    activate() {
        this.isActive = true;
        this.connectionState = 'connecting';
        this.startSyncLoop();
        this.startHeartbeat();
        this.sendJoinMessage();
    }

    deactivate() {
        this.isActive = false;
        this.connectionState = 'disconnected';
        this.clearIntervals();
        this.sendLeaveMessage();
        this.clearCollaborators();
    }

    clearIntervals() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    sendJoinMessage() {
        this.sendToReddit('userJoined', {
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: Date.now(),
            initialState: this.getCurrentState()
        });
    }

    sendLeaveMessage() {
        this.sendToReddit('userLeft', {
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: Date.now()
        });
    }

    getCurrentState() {
        // Get current game state for sharing
        return {
            leftAxes: [0, 0],
            rightAxes: [0, 0],
            octave: 4,
            chord: 4,
            timestamp: Date.now()
        };
    }

    addCollaborator(userId, initialData) {
        if (userId === this.userId) return; // Don't add self
        
        this.collaborators.set(userId, {
            ...initialData,
            lastUpdate: Date.now(),
            connectionState: 'connected'
        });
        
        // Notify UI about new collaborator
        window.dispatchEvent(new CustomEvent('collaboratorJoined', {
            detail: { userId, data: initialData }
        }));
        
        console.log(`Collaborator ${userId} joined session ${this.sessionId}`);
    }

    removeCollaborator(userId) {
        if (!this.collaborators.has(userId)) return;
        
        this.collaborators.delete(userId);
        
        // Notify UI about collaborator leaving
        window.dispatchEvent(new CustomEvent('collaboratorLeft', {
            detail: { userId }
        }));
        
        console.log(`Collaborator ${userId} left session ${this.sessionId}`);
    }

    updateCollaborator(userId, data) {
        if (userId === this.userId) return; // Don't update self
        
        if (this.collaborators.has(userId)) {
            this.collaborators.set(userId, {
                ...data,
                lastUpdate: Date.now(),
                connectionState: 'connected'
            });
            
            // Notify UI about collaborator update
            window.dispatchEvent(new CustomEvent('collaboratorUpdated', {
                detail: { userId, data }
            }));
        } else {
            // New collaborator detected
            this.addCollaborator(userId, data);
        }
    }

    broadcastState(gameState) {
        if (!this.isActive) return;
        
        // Add to sync queue with timestamp
        const syncData = {
            userId: this.userId,
            timestamp: Date.now(),
            state: gameState,
            sessionId: this.sessionId
        };
        
        this.syncQueue.push(syncData);
        
        // Keep queue size manageable
        if (this.syncQueue.length > 100) {
            this.syncQueue = this.syncQueue.slice(-50);
        }
        
        // Send to Reddit backend immediately for real-time feel
        this.sendToReddit('stateUpdate', syncData);
    }

    async sendToReddit(type, data) {
        try {
            // Send message to parent Reddit frame
            window.parent?.postMessage({
                type: 'collaborative',
                subType: type,
                data,
                sessionId: this.sessionId
            }, '*');
            
            this.lastSyncTime = Date.now();
            
            if (this.connectionState !== 'connected') {
                this.connectionState = 'connected';
                this.notifyConnectionStateChange();
            }
        } catch (error) {
            console.error('Failed to send collaborative data:', error);
            this.connectionState = 'error';
            this.notifyConnectionStateChange();
        }
    }

    startSyncLoop() {
        if (!this.isActive) return;
        
        this.syncInterval = setInterval(() => {
            this.processSyncQueue();
            this.cleanupStaleCollaborators();
            this.checkConnectionHealth();
        }, 100); // 10fps sync rate
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isActive) {
                this.sendHeartbeat();
            }
        }, 5000); // 5 second heartbeat
    }

    sendHeartbeat() {
        this.sendToReddit('heartbeat', {
            userId: this.userId,
            timestamp: Date.now(),
            collaboratorCount: this.collaborators.size
        });
        this.lastHeartbeat = Date.now();
    }

    processSyncQueue() {
        const now = Date.now();
        const recentWindow = 1000; // 1 second window
        
        // Process recent updates from other users
        const recentUpdates = this.syncQueue.filter(update => 
            now - update.timestamp < recentWindow && 
            update.userId !== this.userId
        );
        
        for (let update of recentUpdates) {
            if (update.state) {
                this.updateCollaborator(update.userId, update.state);
            }
        }
        
        // Clean old updates
        this.syncQueue = this.syncQueue.filter(update => 
            now - update.timestamp < 10000 // Keep 10 seconds of history
        );
    }

    cleanupStaleCollaborators() {
        const now = Date.now();
        const staleThreshold = 15000; // 15 seconds
        
        const staleCollaborators = [];
        for (let [userId, data] of this.collaborators.entries()) {
            if (now - data.lastUpdate > staleThreshold) {
                staleCollaborators.push(userId);
            }
        }
        
        // Remove stale collaborators
        for (let userId of staleCollaborators) {
            console.log(`Removing stale collaborator: ${userId}`);
            this.removeCollaborator(userId);
        }
    }

    checkConnectionHealth() {
        const now = Date.now();
        const connectionTimeout = 30000; // 30 seconds
        
        if (now - this.lastSyncTime > connectionTimeout) {
            if (this.connectionState !== 'disconnected') {
                this.connectionState = 'disconnected';
                this.notifyConnectionStateChange();
            }
        }
    }

    notifyConnectionStateChange() {
        window.dispatchEvent(new CustomEvent('collaborativeConnectionChange', {
            detail: {
                state: this.connectionState,
                collaboratorCount: this.collaborators.size,
                sessionId: this.sessionId
            }
        }));
    }

    clearCollaborators() {
        const collaboratorIds = Array.from(this.collaborators.keys());
        for (let userId of collaboratorIds) {
            this.removeCollaborator(userId);
        }
        this.collaborators.clear();
    }

    // Handle incoming collaborative data from Reddit
    handleIncomingData(data) {
        if (!this.isActive) return;
        
        switch (data.subType) {
            case 'userJoined':
                if (data.userId !== this.userId) {
                    this.addCollaborator(data.userId, data.initialState);
                }
                break;
                
            case 'userLeft':
                this.removeCollaborator(data.userId);
                break;
                
            case 'stateUpdate':
                if (data.state && data.userId !== this.userId) {
                    this.updateCollaborator(data.userId, data.state);
                }
                break;
                
            case 'heartbeat':
                if (data.userId !== this.userId) {
                    // Update collaborator's last seen time
                    if (this.collaborators.has(data.userId)) {
                        const existing = this.collaborators.get(data.userId);
                        existing.lastUpdate = Date.now();
                        this.collaborators.set(data.userId, existing);
                    }
                }
                break;
                
            case 'sessionInfo':
                this.handleSessionInfo(data);
                break;
                
            default:
                console.log('Unknown collaborative message type:', data.subType);
        }
    }

    handleSessionInfo(data) {
        // Handle session metadata like user list, permissions, etc.
        if (data.users) {
            // Sync user list
            for (let user of data.users) {
                if (user.userId !== this.userId && !this.collaborators.has(user.userId)) {
                    this.addCollaborator(user.userId, user.state || {});
                }
            }
        }
    }

    // Get session statistics
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            collaboratorCount: this.collaborators.size,
            connectionState: this.connectionState,
            isActive: this.isActive,
            syncQueueSize: this.syncQueue.length,
            lastSyncTime: this.lastSyncTime,
            lastHeartbeat: this.lastHeartbeat,
            collaborators: Array.from(this.collaborators.keys())
        };
    }

    // Pause/resume collaboration (useful for when user goes idle)
    pauseCollaboration() {
        this.clearIntervals();
        this.connectionState = 'paused';
        this.notifyConnectionStateChange();
    }

    resumeCollaboration() {
        if (this.isActive) {
            this.startSyncLoop();
            this.startHeartbeat();
            this.connectionState = 'connecting';
            this.notifyConnectionStateChange();
        }
    }

    // Force reconnection
    reconnect() {
        this.deactivate();
        setTimeout(() => {
            this.activate();
        }, 1000);
    }
}

export { CollaborativeSync };