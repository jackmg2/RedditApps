// KeyboardManager.js - Keyboard Input Manager with Fixed Simultaneous Key Detection
export class KeyboardManager {
    constructor(app) {
        this.app = app;
        this.isKeyboardActive = false;
        
        // Track key states instead of just pressed keys
        this.keyStates = {
            'KeyW': false,
            'KeyA': false,
            'KeyS': false,
            'KeyD': false,
            'ArrowUp': false,
            'ArrowDown': false,
            'ArrowLeft': false,
            'ArrowRight': false
        };
        
        // Track what combinations have already been triggered
        this.triggeredCombos = new Set();
        
        // Add timeout for combination detection
        this.combinationTimeout = null;
        this.combinationDelay = 50; // ms to wait for combination keys
        
        // Key mappings for 8-direction control
        this.keyMappings = {
            // WASD for notes (left instrument)
            notes: {
                'KeyW': { angle: -Math.PI/2, name: 'W (Up)', noteIndex: 2 },      // Top (C)
                'KeyA': { angle: Math.PI, name: 'A (Left)', noteIndex: 0 },       // Left (B)  
                'KeyS': { angle: Math.PI/2, name: 'S (Down)', noteIndex: 6 },     // Bottom (G)
                'KeyD': { angle: 0, name: 'D (Right)', noteIndex: 4 },           // Right (E)
                
                // Diagonals (combinations)
                'KeyD+KeyW': { angle: -Math.PI/4, name: 'W+D (Up-Right)', noteIndex: 3 },    // Top-Right (D)
                'KeyD+KeyS': { angle: Math.PI/4, name: 'S+D (Down-Right)', noteIndex: 5 },   // Bottom-Right (F)
                'KeyA+KeyS': { angle: 3*Math.PI/4, name: 'S+A (Down-Left)', noteIndex: 7 },  // Bottom-Left (A)
                'KeyA+KeyW': { angle: -3*Math.PI/4, name: 'W+A (Up-Left)', noteIndex: 1 }    // Top-Left (C')
            },
            
            // Arrow keys for chords (right instrument)
            chords: {
                'ArrowUp': { angle: -Math.PI/2, name: '↑ (Up)', noteIndex: 2 },
                'ArrowLeft': { angle: Math.PI, name: '← (Left)', noteIndex: 0 },
                'ArrowDown': { angle: Math.PI/2, name: '↓ (Down)', noteIndex: 6 },
                'ArrowRight': { angle: 0, name: '→ (Right)', noteIndex: 4 },
                
                // Diagonals (combinations)
                'ArrowRight+ArrowUp': { angle: -Math.PI/4, name: '↑→ (Up-Right)', noteIndex: 3 },
                'ArrowDown+ArrowRight': { angle: Math.PI/4, name: '↓→ (Down-Right)', noteIndex: 5 },
                'ArrowDown+ArrowLeft': { angle: 3*Math.PI/4, name: '↓← (Down-Left)', noteIndex: 7 },
                'ArrowLeft+ArrowUp': { angle: -3*Math.PI/4, name: '↑← (Up-Left)', noteIndex: 1 }
            }
        };
        
        this.lastKeyTime = { notes: 0, chords: 0 };
        this.keyDelay = 100; // Minimum ms between key triggers
        
        this.setupKeyboardEvents();
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Prevent default behavior for our control keys
            if (this.isControlKey(e.code)) {
                e.preventDefault();
                this.handleKeyDown(e.code);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.isControlKey(e.code)) {
                e.preventDefault();
                this.handleKeyUp(e.code);
            }
        });

        // Show keyboard indicator on first key press
        document.addEventListener('keydown', (e) => {
            if (this.isControlKey(e.code) && !this.isKeyboardActive) {
                this.isKeyboardActive = true;
                this.showKeyboardIndicator(true);
                this.app.showToast('⌨️ Keyboard controls active! WASD: Notes, Arrows: Chords', 'success');
            }
        }, { once: true });

        console.log('Fixed keyboard manager initialized');
    }

    isControlKey(code) {
        return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
    }

    handleKeyDown(code) {
        if (!this.app.isInitialized || !this.app.notes) return;

        // Update key state
        if (this.keyStates.hasOwnProperty(code)) {
            this.keyStates[code] = true;
        }
        
        // Clear any existing timeout
        if (this.combinationTimeout) {
            clearTimeout(this.combinationTimeout);
        }
        
        // Wait a bit for potential combination keys
        this.combinationTimeout = setTimeout(() => {
            this.checkKeyStates();
        }, this.combinationDelay);
    }

    handleKeyUp(code) {
        // Update key state
        if (this.keyStates.hasOwnProperty(code)) {
            this.keyStates[code] = false;
        }
        
        // Clear combination timeout
        if (this.combinationTimeout) {
            clearTimeout(this.combinationTimeout);
            this.combinationTimeout = null;
        }
        
        // Clear triggered combinations when keys are released
        this.triggeredCombos.clear();
        
        // Clear visual feedback when all keys released
        if (Object.values(this.keyStates).every(state => !state)) {
            this.clearKeyboardVisuals();
        }
    }

    checkKeyStates() {
        // Get currently pressed keys
        const pressedKeys = Object.keys(this.keyStates).filter(key => this.keyStates[key]);
        
        console.log('Currently pressed keys:', pressedKeys);
        
        // Check for combinations first (priority over single keys)
        const combination = this.detectCombinationFromStates(pressedKeys);
        if (combination) {
            const comboKey = combination.keys.join('+');
            if (!this.triggeredCombos.has(comboKey)) {
                console.log('New combination detected:', comboKey);
                this.triggeredCombos.add(comboKey);
                this.triggerNote(combination.mapping, combination.side);
                return;
            }
        }
        
        // Handle single key presses only if no combinations and not already triggered
        if (pressedKeys.length === 1) {
            const mapping = this.getSingleKeyMapping(pressedKeys[0]);
            if (mapping && !this.triggeredCombos.has(pressedKeys[0])) {
                console.log('Single key detected:', pressedKeys[0]);
                this.triggeredCombos.add(pressedKeys[0]);
                this.triggerNote(mapping.mapping, mapping.side);
            }
        }
    }

    detectCombinationFromStates(pressedKeys) {
        if (pressedKeys.length < 2) return null;
        
        // Check WASD combinations
        const wasdKeys = pressedKeys.filter(key => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key));
        if (wasdKeys.length >= 2) {
            // Check all possible 2-key combinations from WASD
            for (let i = 0; i < wasdKeys.length; i++) {
                for (let j = i + 1; j < wasdKeys.length; j++) {
                    const combo1 = [wasdKeys[i], wasdKeys[j]].sort().join('+');
                    const combo2 = [wasdKeys[j], wasdKeys[i]].sort().join('+');
                    
                    if (this.keyMappings.notes[combo1]) {
                        return {
                            mapping: this.keyMappings.notes[combo1],
                            side: 'left',
                            keys: [wasdKeys[i], wasdKeys[j]]
                        };
                    }
                    if (this.keyMappings.notes[combo2]) {
                        return {
                            mapping: this.keyMappings.notes[combo2],
                            side: 'left',
                            keys: [wasdKeys[j], wasdKeys[i]]
                        };
                    }
                }
            }
        }
        
        // Check Arrow combinations
        const arrowKeys = pressedKeys.filter(key => key.startsWith('Arrow'));
        if (arrowKeys.length >= 2) {
            // Check all possible 2-key combinations from arrows
            for (let i = 0; i < arrowKeys.length; i++) {
                for (let j = i + 1; j < arrowKeys.length; j++) {
                    const combo1 = [arrowKeys[i], arrowKeys[j]].sort().join('+');
                    const combo2 = [arrowKeys[j], arrowKeys[i]].sort().join('+');
                    
                    if (this.keyMappings.chords[combo1]) {
                        return {
                            mapping: this.keyMappings.chords[combo1],
                            side: 'right',
                            keys: [arrowKeys[i], arrowKeys[j]]
                        };
                    }
                    if (this.keyMappings.chords[combo2]) {
                        return {
                            mapping: this.keyMappings.chords[combo2],
                            side: 'right',
                            keys: [arrowKeys[j], arrowKeys[i]]
                        };
                    }
                }
            }
        }
        
        return null;
    }

    getSingleKeyMapping(code) {
        // Check notes (WASD)
        if (this.keyMappings.notes[code]) {
            return {
                mapping: this.keyMappings.notes[code],
                side: 'left'
            };
        }
        
        // Check chords (Arrows)
        if (this.keyMappings.chords[code]) {
            return {
                mapping: this.keyMappings.chords[code],
                side: 'right'
            };
        }
        
        return null;
    }

    triggerNote(mapping, side) {
        const now = Date.now();
        const lastTime = side === 'left' ? this.lastKeyTime.notes : this.lastKeyTime.chords;
        
        // Debounce rapid key presses
        if (now - lastTime < this.keyDelay) {
            console.log('Debounced key press');
            return;
        }
        
        // Check if this position is active in current scale
        const activePositions = this.app.notes.scaleActivePositions[this.app.notes.currentScale];
        if (!activePositions[mapping.noteIndex]) {
            console.log(`Note position ${mapping.noteIndex} is disabled in current scale`);
            return;
        }

        console.log(`Triggering ${side} instrument at position ${mapping.noteIndex} (${mapping.name})`);

        // Play the note/chord
        const result = side === 'left' 
            ? this.app.notes.playNote(mapping.noteIndex)
            : this.app.notes.playChord(mapping.noteIndex);

        if (result) {
            console.log('Note/chord played successfully');
            
            // Visual feedback
            this.app.highlightPieSlice(side, mapping.noteIndex);
            this.animateKeyboardFeedback(side, mapping.noteIndex);
            
            // Update displays
            if (side === 'left') {
                const noteName = this.app.notes.getNoteNameByIndex(mapping.noteIndex);
                console.log(`Keyboard note: ${mapping.name} -> ${noteName}`);
            } else {
                const chordName = this.app.notes.getChordNameByIndex(mapping.noteIndex);
                this.app.updateChordDisplay(chordName);
                console.log(`Keyboard chord: ${mapping.name} -> ${chordName}`);
            }

            // Record if recording
            if (this.app.recorder.isRecording) {
                this.app.recorder.recordFrame({
                    noteIndex: mapping.noteIndex,
                    side,
                    octave: this.app.notes.currentOctave
                });
            }

            // Update last time
            if (side === 'left') {
                this.lastKeyTime.notes = now;
            } else {
                this.lastKeyTime.chords = now;
            }
        } else {
            console.log('Failed to play note/chord');
        }
    }

    animateKeyboardFeedback(side, noteIndex) {
        const instrumentId = side === 'left' ? 'leftInstrument' : 'rightInstrument';
        const instrument = document.getElementById(instrumentId);
        
        if (instrument) {
            // Add keyboard glow effect
            instrument.style.boxShadow = '0 0 25px rgba(255, 255, 0, 0.8)';
            instrument.style.borderColor = '#ffff00';
            
            setTimeout(() => {
                instrument.style.boxShadow = '';
                instrument.style.borderColor = '#3498db';
            }, 200);

            // Animate inner circle
            const innerId = side === 'left' ? 'leftInner' : 'rightInner';
            const inner = document.getElementById(innerId);
            
            if (inner) {
                // Calculate position based on note index
                let degrees = noteIndex * 45;
                degrees = (degrees - 180 + 360) % 360;
                const angle = degrees * Math.PI / 180;

                const radius = 60;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                inner.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
                inner.style.background = 'linear-gradient(135deg, #ffff00, #ffd700)';

                // Reset after animation
                setTimeout(() => {
                    inner.style.transform = 'translate(-50%, -50%)';
                    inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
                }, 200);
            }
        }
    }

    clearKeyboardVisuals() {
        // Reset any keyboard-specific visual effects
        const instruments = document.querySelectorAll('.instrument');
        instruments.forEach(instrument => {
            instrument.style.boxShadow = '';
            instrument.style.borderColor = '#3498db';
        });
        
        const inners = document.querySelectorAll('.instrument-inner');
        inners.forEach(inner => {
            inner.style.transform = 'translate(-50%, -50%)';
            inner.style.background = 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)';
        });
    }

    showKeyboardIndicator(show) {
        let indicator = document.getElementById('keyboardIndicator');

        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.id = 'keyboardIndicator';
            indicator.innerHTML = `
                ⌨️ Keyboard Active<br>
                <small style="line-height: 1.4;">
                    <strong>WASD:</strong> Notes<br>
                    <strong>Arrows:</strong> Chords
                </small>
            `;
            indicator.style.cssText = `
                position: fixed;
                top: 120px;
                right: 20px;
                background: linear-gradient(135deg, #6f42c1, #563d7c);
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                border: 1px solid rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                animation: fadeIn 0.3s ease;
                text-align: center;
                line-height: 1.2;
                box-shadow: 0 4px 15px rgba(111, 66, 193, 0.3);
            `;
            document.body.appendChild(indicator);
        } else if (!show && indicator) {
            indicator.remove();
        }
    }

    // Method to get current key mappings for help display
    getKeyMappings() {
        return {
            notes: this.keyMappings.notes,
            chords: this.keyMappings.chords
        };
    }
}