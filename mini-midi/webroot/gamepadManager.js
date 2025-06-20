// Enhanced GamepadManager.js - Gamepad Input Manager with Pie Slice Support and Octave Controls - C on Top
export class GamepadManager {
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
        
        // Button state tracking for controls
        this.buttonStates = {
            X: false,      // Xbox X button (button 2) - octave down
            B: false,      // Xbox B button (button 1) - octave up
            LB: false,     // Left bumper (button 4) - scale prev
            RB: false      // Right bumper (button 5) - scale next
        };
        this.lastButtonTime = { X: 0, B: 0, LB: 0, RB: 0 };
        this.buttonDelay = 200; // Minimum ms between button presses

        this.setupGamepadEvents();
    }

    setupGamepadEvents() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            this.gamepadIndex = e.gamepad.index;
            this.isGamepadActive = true;
            this.startPolling();
            this.app.showToast('🎮 Gamepad connected! Use sticks to play, X/B for octaves, LB/RB for scales.', 'success');
            this.showGamepadIndicator(true);
            this.updateOctaveButtonIcons(true);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected:', e.gamepad.id);
            if (e.gamepad.index === this.gamepadIndex) {
                this.isGamepadActive = false;
                this.stopPolling();
                this.app.showToast('🎮 Gamepad disconnected', 'info');
                this.showGamepadIndicator(false);
                this.updateOctaveButtonIcons(false);
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

            // Handle button inputs for octave controls
            this.handleButtonInputs(gamepad);
        }

        // Continue polling
        requestAnimationFrame(() => this.pollGamepad());
    }

    handleButtonInputs(gamepad) {
        const now = Date.now();
        
        // Xbox controller button mapping:
        // button[0] = A, button[1] = B, button[2] = X, button[3] = Y
        // button[4] = LB, button[5] = RB
        
        // X button (button 2) - decrease octave
        const xPressed = gamepad.buttons[2] && gamepad.buttons[2].pressed;
        if (xPressed && !this.buttonStates.X && (now - this.lastButtonTime.X) > this.buttonDelay) {
            if (this.app.notes) {
                const newOctave = this.app.notes.changeOctave(-1);
                this.app.updateOctaveDisplay(newOctave);
                this.app.showToast(`🔽 Octave: ${newOctave}`, 'info');
                this.lastButtonTime.X = now;
                console.log('Gamepad X pressed - octave decreased to:', newOctave);
            }
        }
        this.buttonStates.X = xPressed;

        // B button (button 1) - increase octave
        const bPressed = gamepad.buttons[1] && gamepad.buttons[1].pressed;
        if (bPressed && !this.buttonStates.B && (now - this.lastButtonTime.B) > this.buttonDelay) {
            if (this.app.notes) {
                const newOctave = this.app.notes.changeOctave(1);
                this.app.updateOctaveDisplay(newOctave);
                this.app.showToast(`🔼 Octave: ${newOctave}`, 'info');
                this.lastButtonTime.B = now;
                console.log('Gamepad B pressed - octave increased to:', newOctave);
            }
        }
        this.buttonStates.B = bPressed;

        // LB button (button 4) - previous scale
        const lbPressed = gamepad.buttons[4] && gamepad.buttons[4].pressed;
        if (lbPressed && !this.buttonStates.LB && (now - this.lastButtonTime.LB) > this.buttonDelay) {
            if (this.app.notes) {
                const newScale = this.app.notes.changeScale(-1);
                this.app.updateScaleDisplay(newScale);
                this.app.showToast(`◀ Scale: ${this.app.getScaleDisplayName(newScale)}`, 'success');
                this.lastButtonTime.LB = now;
                console.log('Gamepad LB pressed - scale changed to:', newScale);
            }
        }
        this.buttonStates.LB = lbPressed;

        // RB button (button 5) - next scale
        const rbPressed = gamepad.buttons[5] && gamepad.buttons[5].pressed;
        if (rbPressed && !this.buttonStates.RB && (now - this.lastButtonTime.RB) > this.buttonDelay) {
            if (this.app.notes) {
                const newScale = this.app.notes.changeScale(1);
                this.app.updateScaleDisplay(newScale);
                this.app.showToast(`▶ Scale: ${this.app.getScaleDisplayName(newScale)}`, 'success');
                this.lastButtonTime.RB = now;
                console.log('Gamepad RB pressed - scale changed to:', newScale);
            }
        }
        this.buttonStates.RB = rbPressed;
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

                if (result) {
                    const angle = Math.atan2(normalizedY, normalizedX);
                    const noteIndex = this.app.notes.angleToNoteIndex(angle);
                    const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'"];

                    // Highlight the pie slice for visual feedback
                    this.app.highlightPieSlice(side, noteIndex);

                    // Debug logging
                    console.log(`Gamepad ${side}: angle=${(angle * 180 / Math.PI).toFixed(1)}°, noteIndex=${noteIndex} (${noteNames[noteIndex]}), pos=(${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)})`);

                    if (this.app.recorder.isRecording) {
                        this.app.recorder.recordFrame({
                            noteIndex,
                            side,
                            octave: this.app.notes.currentOctave
                        });
                    }
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

    updateOctaveButtonIcons(showGamepadIcons) {
        // Toggle between arrow emojis and Xbox button icons
        const defaultIcons = document.querySelectorAll('.octave-icon-default, .scale-icon-default');
        const gamepadIcons = document.querySelectorAll('.octave-icon-gamepad, .scale-icon-gamepad');

        defaultIcons.forEach(icon => {
            icon.style.display = showGamepadIcons ? 'none' : 'inline';
        });

        gamepadIcons.forEach(icon => {
            icon.style.display = showGamepadIcons ? 'inline' : 'none';
        });
    }

    showGamepadIndicator(show) {
        let indicator = document.getElementById('gamepadIndicator');

        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.id = 'gamepadIndicator';
            indicator.innerHTML = '🎮 Gamepad Active<br><small>X/B: Octave ± • LB/RB: Scale ±</small>';
            indicator.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                border: 1px solid rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                animation: fadeIn 0.3s ease;
                text-align: center;
                line-height: 1.2;
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
                this.updateOctaveButtonIcons(true);
                console.log('Detected existing gamepad:', gamepads[i].id);
                return true;
            }
        }
        return false;
    }
}