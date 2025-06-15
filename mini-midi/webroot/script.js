/** @typedef {import('../src/message.ts').DevvitSystemMessage} DevvitSystemMessage */
/** @typedef {import('../src/message.ts').WebViewMessage} WebViewMessage */

class SillyMIDIGrid {
  constructor() {
    // Note names for the chromatic scale
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    this.startOctave = 3;
    this.audioContext = null;
    this.audioStarted = false;
    this.favoriteNotes = [];
    this.username = 'Redditor';
    this.activeOscillators = new Map(); // Track active notes for polyphony
    
    // Drag functionality
    this.isDragging = false;
    this.lastPlayedCell = null;

    // Color palettes for each octave (8 different color schemes)
    this.colorPalettes = [
      ['#ff6b6b', '#ff8e8e', '#ffb3b3'], // Red tones
      ['#ffa500', '#ffb732', '#ffc966'], // Orange tones  
      ['#ffd700', '#ffe135', '#ffeb69'], // Yellow tones
      ['#32cd32', '#5dd55d', '#7ddd7d'], // Green tones
      ['#1e90ff', '#4da6ff', '#7dbcff'], // Blue tones
      ['#9370db', '#a68ae5', '#b9a4ee'], // Purple tones
      ['#ff69b4', '#ff85c1', '#ffa1ce'], // Pink tones
      ['#00ced1', '#33d6db', '#66dee5']  // Cyan tones
    ];

    // Get references to HTML elements
    this.usernameLabel = document.querySelector('#username');
    this.favoriteCountLabel = document.querySelector('#favoriteCount');
    this.startButton = document.querySelector('#startButton');
    this.gridContainer = document.querySelector('#gridContainer');
    this.clearFavoritesButton = document.querySelector('#clearFavorites');

    // Set up event listeners
    this.setupEventListeners();

    // When the Devvit app sends a message with `postMessage()`, this will be triggered
    addEventListener('message', this.onMessage.bind(this));

    // This event gets called when the web view is loaded
    addEventListener('load', () => {
      postWebViewMessage({ type: 'webViewReady' });
    });
  }

  setupEventListeners() {
    this.startButton.addEventListener('click', () => this.initializeAudio());
    this.clearFavoritesButton.addEventListener('click', () => this.clearFavorites());

    // Global drag tracking
    document.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('note-cell')) {
        this.isDragging = true;
        this.lastPlayedCell = null;
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.lastPlayedCell = null;
    });

    document.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.lastPlayedCell = null;
    });

    // Fun Easter egg - play random notes on spacebar
    document.addEventListener('keydown', (e) => {
      if (!this.audioStarted || !this.audioContext) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        
        // Check if audio context is still valid
        if (this.audioContext.state !== 'running') {
          console.warn('Audio context not running');
          return;
        }
        
        const cells = document.querySelectorAll('.note-cell');
        if (cells.length === 0) {
          console.warn('No cells available');
          return;
        }
        
        const randomCell = cells[Math.floor(Math.random() * cells.length)];
        if (randomCell && randomCell.dataset.note) {
          this.playNote(randomCell);
        }
      }
      
      // Numpad shortcuts for favorite notes
      if (e.code.startsWith('Numpad') || (e.code.startsWith('Digit') && e.location === 0)) {
        e.preventDefault();
        
        let numpadNumber;
        if (e.code.startsWith('Numpad')) {
          numpadNumber = parseInt(e.code.replace('Numpad', ''));
        } else if (e.code.startsWith('Digit')) {
          numpadNumber = parseInt(e.code.replace('Digit', ''));
        }
        
        // Support numbers 0-9 (array indices 0-9)
        if (numpadNumber >= 0 && numpadNumber <= 9) {
          const favoriteIndex = numpadNumber;
          if (this.favoriteNotes[favoriteIndex]) {
            this.playFavoriteNote(this.favoriteNotes[favoriteIndex], favoriteIndex);
          }
        }
      }
    });
  }

  /**
   * @param {MessageEvent<DevvitSystemMessage>} ev
   */
  onMessage(ev) {
    // Reserved type for messages sent via `context.ui.webView.postMessage`
    if (ev.data.type !== 'devvit-message') return;
    const { message } = ev.data.data;

    switch (message.type) {
      case 'initialData': {
        const { username, favoriteNotes } = message.data;
        this.username = username;
        this.favoriteNotes = favoriteNotes || [];
        this.updateDisplay();
        break;
      }
      case 'updateFavorites': {
        const { favoriteNotes } = message.data;
        this.favoriteNotes = favoriteNotes || [];
        this.updateDisplay();
        break;
      }
      default:
        break;
    }
  }

  updateDisplay() {
    this.usernameLabel.textContent = this.username;
    this.favoriteCountLabel.textContent = this.favoriteNotes.length.toString();
    
    // Update favorite number indicators on all cells
    this.updateFavoriteNumbers();
  }

  updateFavoriteNumbers() {
    // Clear all existing favorite numbers
    document.querySelectorAll('.note-cell').forEach(cell => {
      cell.removeAttribute('data-favorite-number');
    });
    
    // Add favorite numbers to favorite cells
    this.favoriteNotes.forEach((note, index) => {
      const cell = document.querySelector(`[data-note="${note}"]`);
      if (cell) {
        const favoriteNumber = index;
        cell.setAttribute('data-favorite-number', favoriteNumber);
      }
    });
  }

  async initializeAudio() {
    if (this.audioStarted) return;
    
    try {
      // Create Web Audio Context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume context if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.audioStarted = true;
      
      // Hide/minimize UI elements to maximize grid space
      this.startButton.style.display = 'none';
      document.querySelector('.controls').classList.add('hidden');
      document.querySelector('.header').classList.add('minimized');
      document.querySelector('.instructions').classList.add('minimized');
      document.querySelector('.reddit-branding').classList.add('minimized');
      
      // Show and maximize grid
      this.gridContainer.style.display = 'grid';
      this.gridContainer.classList.add('maximized');
      
      this.createGrid();
    } catch (error) {
      console.error('Audio initialization failed:', error);
      alert('Audio failed to start. Please try again!');
    }
  }

  // Convert note name to frequency
  noteToFrequency(note) {
    try {
      const noteMap = {
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
        'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
      };
      
      const noteName = note.slice(0, -1);
      const octave = parseInt(note.slice(-1));
      
      // Validate inputs
      if (!noteMap.hasOwnProperty(noteName) || !isFinite(octave) || octave < 0 || octave > 10) {
        console.warn('Invalid note:', note);
        return 440; // Default to A4
      }
      
      const semitone = noteMap[noteName];
      
      // A4 = 440Hz, calculate frequency using equal temperament
      const A4 = 440;
      const semitonesFromA4 = (octave - 4) * 12 + (semitone - 9);
      const frequency = A4 * Math.pow(2, semitonesFromA4 / 12);
      
      // Validate result
      if (!isFinite(frequency) || frequency <= 0 || frequency > 20000) {
        console.warn('Invalid frequency calculated:', frequency, 'for note:', note);
        return 440; // Default to A4
      }
      
      return frequency;
    } catch (error) {
      console.warn('Error calculating frequency for note:', note, error);
      return 440; // Default to A4
    }
  }

  // Create and play a note with Web Audio API
  playTone(frequency, duration = 0.5) {
    if (!this.audioContext || this.audioContext.state !== 'running') return;
    
    // Validate inputs
    if (!isFinite(frequency) || frequency <= 0 || !isFinite(duration) || duration <= 0) {
      console.warn('Invalid audio parameters:', { frequency, duration });
      return;
    }

    try {
      // Create oscillator
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      // Set up oscillator with validation
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

      // Set up filter for a warmer sound
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
      filter.Q.setValueAtTime(1, this.audioContext.currentTime);

      // Set up envelope (ADSR) with validated values
      const now = this.audioContext.currentTime;
      const attackTime = 0.02;
      const decayTime = 0.3;
      const sustainLevel = 0.1;
      const releaseTime = 0.8;

      // Validate all time values
      if (!isFinite(now) || now < 0) {
        console.warn('Invalid audio context time');
        return;
      }

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + attackTime); // Attack
      gainNode.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + attackTime + decayTime); // Decay
      gainNode.gain.setValueAtTime(Math.max(sustainLevel, 0.001), now + duration - releaseTime); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release

      // Connect nodes
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Start and stop with error handling
      oscillator.start(now);
      oscillator.stop(now + duration);

      // Clean up on end
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          gainNode.disconnect();
          filter.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      };

      return oscillator;
    } catch (error) {
      console.warn('Audio playback error:', error);
      return null;
    }
  }

  createGrid() {
    this.gridContainer.innerHTML = '';

    // Create 12 rows (notes) × 8 columns (octaves)
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement('div');
        cell.className = 'note-cell';
        
        const noteName = this.noteNames[row];
        const octave = this.startOctave + col;
        const noteWithOctave = `${noteName}${octave}`;
        
        // Store note data but don't display text for magic
        cell.dataset.note = noteWithOctave;
        cell.dataset.row = row;
        cell.dataset.col = col;
        
        // Set initial subtle color based on position
        const baseColor = this.colorPalettes[col][0];
        cell.style.background = `linear-gradient(135deg, ${baseColor}33, ${baseColor}11)`;
        
        // Check if this note is a favorite
        if (this.favoriteNotes.includes(noteWithOctave)) {
          cell.classList.add('favorite');
        }
        
        // Add event listeners for click and drag
        cell.addEventListener('mousedown', (e) => this.handleCellMouseDown(cell, e));
        cell.addEventListener('mouseenter', (e) => this.handleCellMouseEnter(cell, e));
        
        // Prevent context menu on right click
        cell.addEventListener('contextmenu', (e) => e.preventDefault());
        
        this.gridContainer.appendChild(cell);
      }
    }
    
    // Update favorite numbers after creating grid
    this.updateFavoriteNumbers();
  }

  handleCellMouseDown(cell, event) {
    event.preventDefault();
    const note = cell.dataset.note;
    
    // If shift is held, toggle favorite
    if (event.shiftKey) {
      this.toggleFavorite(cell, note);
    } else {
      this.playNote(cell);
      this.lastPlayedCell = cell;
    }
  }

  handleCellMouseEnter(cell, event) {
    // Only play if we're dragging and this isn't the last played cell
    if (this.isDragging && cell !== this.lastPlayedCell) {
      if (event.shiftKey) {
        this.toggleFavorite(cell, cell.dataset.note);
      } else {
        this.playNote(cell);
      }
      this.lastPlayedCell = cell;
    }
  }

  handleCellClick(cell, event) {
    // This method is now replaced by the more sophisticated mouse handlers above
    // but keeping for backward compatibility if needed
    const note = cell.dataset.note;
    
    // If shift is held, toggle favorite
    if (event.shiftKey) {
      this.toggleFavorite(cell, note);
    } else {
      this.playNote(cell);
    }
  }

  handleCellClick(cell, event) {
    const note = cell.dataset.note;
    
    // If shift is held, toggle favorite
    if (event.shiftKey) {
      this.toggleFavorite(cell, note);
    } else {
      this.playNote(cell);
    }
  }

  toggleFavorite(cell, note) {
    if (this.favoriteNotes.includes(note)) {
      // Remove from favorites
      this.favoriteNotes = this.favoriteNotes.filter(n => n !== note);
      cell.classList.remove('favorite');
      
      // Send update to Devvit
      postWebViewMessage({ type: 'saveFavoriteNote', data: { note: note, action: 'remove' } });
    } else {
      // Add to favorites with rolling system (max 10)
      if (this.favoriteNotes.length >= 10) {
        // Remove the first favorite (index 0) and its visual indicator
        const removedNote = this.favoriteNotes.shift();
        const removedCell = document.querySelector(`[data-note="${removedNote}"]`);
        if (removedCell) {
          removedCell.classList.remove('favorite');
        }
      }
      
      // Add new favorite
      this.favoriteNotes.push(note);
      cell.classList.add('favorite');
      
      // Send the entire updated favorites array to Devvit for persistence
      postWebViewMessage({ type: 'updateFavoritesList', data: { favoriteNotes: this.favoriteNotes } });
    }
    
    // Update display and numbers
    this.updateDisplay();
  }

  playNote(cell) {
    if (!this.audioStarted || !this.audioContext) return;
    
    const note = cell.dataset.note;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    // Calculate frequency and play the note
    const frequency = this.noteToFrequency(note);
    this.playTone(frequency);
    
    // Animate the cell with crazy colors
    this.animateCell(cell, row, col);
  }

  animateCell(cell, row, col) {
    const colors = this.colorPalettes[col];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Add active class for scaling effect
    cell.classList.add('active');
    
    // Create rainbow gradient effect
    const gradient = `radial-gradient(circle, ${randomColor}, ${randomColor}88, ${randomColor}33)`;
    cell.style.background = gradient;
    cell.style.color = 'white';
    
    // Add some sparkle effects
    cell.style.boxShadow = `0 0 20px ${randomColor}, 0 0 40px ${randomColor}66`;
    
    // Reset after animation
    setTimeout(() => {
      cell.classList.remove('active');
      const baseColor = this.colorPalettes[col][0];
      cell.style.background = `linear-gradient(135deg, ${baseColor}33, ${baseColor}11)`;
      cell.style.color = 'rgba(255, 255, 255, 0.8)';
      cell.style.boxShadow = '';
    }, 300);
  }

  playFavoriteNote(note, favoriteNumber) {
    // Find the cell with this note
    const cell = document.querySelector(`[data-note="${note}"]`);
    if (!cell) {
      console.warn('Favorite note cell not found:', note);
      return;
    }
    
    // Play the note with visual feedback
    this.playNote(cell);
    
    // Add special favorite flash effect
    this.flashFavoriteIndicator(cell, favoriteNumber);
  }

  flashFavoriteIndicator(cell, favoriteNumber) {
    // Create a temporary favorite number indicator
    const indicator = document.createElement('div');
    indicator.textContent = favoriteNumber;
    indicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ff69b4;
      font-size: 24px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 100;
      animation: favoriteFlash 0.6s ease-out;
    `;
    
    // Add flash animation CSS if not already added
    if (!document.querySelector('#favoriteFlashStyle')) {
      const style = document.createElement('style');
      style.id = 'favoriteFlashStyle';
      style.textContent = `
        @keyframes favoriteFlash {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(2); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
      `;
      document.head.appendChild(style);
    }
    
    cell.appendChild(indicator);
    
    // Remove indicator after animation
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 600);
  }
  clearFavorites() {
    postWebViewMessage({ type: 'clearFavorites' });
    // Remove favorite class from all cells
    document.querySelectorAll('.note-cell.favorite').forEach(cell => {
      cell.classList.remove('favorite');
    });
  }
}

/**
 * Sends a message to the Devvit app.
 * @param {import('../src/message.ts').WebViewMessage} msg
 */
function postWebViewMessage(msg) {
  parent.postMessage(msg, '*');
}

// Initialize the app
new SillyMIDIGrid();