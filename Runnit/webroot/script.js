import { GameEngine } from './gameEngine.js';
import { InputManager } from './inputManager.js';
import { PixelRenderer } from './renderer.js';
import { ParallaxManager } from './parallaxManager.js';

class RedditRunner {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameEngine = new GameEngine();
        this.renderer = new PixelRenderer(this.canvas);
        this.parallax = new ParallaxManager(this.canvas);
        this.inputManager = new InputManager(this.gameEngine, this.canvas);
        
        this.username = 'anon';
        this.bestTime = null;
        this.animationId = null;
        
        this.setupCanvas();
        this.setupEventListeners();
        this.setupMessageHandling();
        
        // Start the game loop
        this.gameLoop();
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            this.canvas.width = rect.width;
            this.canvas.height = rect.height - 80; // Account for HUD
            
            // Update renderer and parallax with new dimensions
            this.renderer.updateDimensions(this.canvas.width, this.canvas.height);
            this.parallax.updateDimensions(this.canvas.width, this.canvas.height);
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => {
            this.startRace();
        });
        
        document.getElementById('retryButton').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('retryButton2').addEventListener('click', () => {
            this.resetGame();
        });
    }
    
    setupMessageHandling() {
        // Notify Reddit that webview is ready
        window.parent?.postMessage({
            type: 'webViewReady'
        }, '*');
        
        // Handle messages from Reddit
        window.addEventListener('message', (event) => {
            if (event.data.type === 'devvit-message' && event.data.data?.message) {
                const message = event.data.data.message;
                
                switch (message.type) {
                    case 'initialData':
                        this.username = message.data.username;
                        this.bestTime = message.data.bestTime;
                        this.updateBestTimeDisplay();
                        break;
                    case 'newBestTime':
                        if (message.data.isPersonalBest) {
                            this.bestTime = message.data.time;
                            this.showPersonalBestMessage();
                        }
                        this.displayLeaderboard(message.data.leaderboard, message.data.userPosition);
                        break;
                    case 'leaderboardData':
                        this.displayLeaderboard(message.data.leaderboard, 0);
                        break;
                }
            }
        });
    }
    
    startRace() {
        // Hide start screen
        document.getElementById('startScreen').classList.add('hidden');
        
        // Initialize game
        this.gameEngine.startRace();
        
        // Notify Reddit
        window.parent?.postMessage({
            type: 'raceStart'
        }, '*');
        
        // Set up game completion callbacks
        this.gameEngine.onRaceComplete = (time) => {
            this.handleRaceComplete(time);
        };
        
        this.gameEngine.onRaceFailed = (distance) => {
            this.handleRaceFailed(distance);
        };
    }
    
    resetGame() {
        // Hide all game screens
        document.querySelectorAll('.game-screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show start screen
        document.getElementById('startScreen').classList.remove('hidden');
        
        // Reset game engine
        this.gameEngine.reset();
        
        // Reset UI
        this.updateHUD();
    }
    
    handleRaceComplete(time) {
        // Show victory screen
        document.getElementById('victoryScreen').classList.remove('hidden');
        document.getElementById('finalTime').textContent = `${time.toFixed(2)}s`;
        
        // Request updated leaderboard
        window.parent?.postMessage({
            type: 'requestLeaderboard'
        }, '*');
        
        // Notify Reddit
        window.parent?.postMessage({
            type: 'raceComplete',
            data: {
                time: time,
                username: this.username
            }
        }, '*');
    }
    
    handleRaceFailed(distance) {
        // Show game over screen
        document.getElementById('gameOverScreen').classList.remove('hidden');
        document.getElementById('distanceReached').textContent = `${distance.toFixed(1)}m`;
        
        // Notify Reddit
        window.parent?.postMessage({
            type: 'raceFailed',
            data: {
                distance: distance,
                username: this.username
            }
        }, '*');
    }
    
    updateBestTimeDisplay() {
        const bestTimeElement = document.getElementById('bestTimeDisplay');
        if (this.bestTime) {
            bestTimeElement.textContent = `Best Time: ${this.bestTime.toFixed(2)}s`;
            bestTimeElement.style.display = 'block';
        } else {
            bestTimeElement.textContent = 'No best time yet - be the first!';
            bestTimeElement.style.display = 'block';
        }
    }
    
    showPersonalBestMessage() {
        const messageElement = document.getElementById('bestTimeMessage');
        messageElement.textContent = '🏆 NEW PERSONAL BEST! 🏆';
        messageElement.className = 'best-time-message personal-best';
    }
    
    displayLeaderboard(leaderboard, userPosition) {
        const listElement = document.getElementById('leaderboardList');
        const positionElement = document.getElementById('leaderboardPosition');
        
        // Show user's position
        if (userPosition > 0) {
            if (userPosition <= 3) {
                const medals = ['🥇', '🥈', '🥉'];
                positionElement.textContent = `${medals[userPosition - 1]} You ranked #${userPosition}!`;
                positionElement.className = 'position-message top-3';
            } else {
                positionElement.textContent = `🏃‍♂️ You ranked #${userPosition}`;
                positionElement.className = 'position-message';
            }
        } else {
            positionElement.textContent = '';
        }
        
        // Clear existing leaderboard
        listElement.innerHTML = '';
        
        if (leaderboard.length === 0) {
            listElement.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">No times recorded yet!</div>';
            return;
        }
        
        // Populate leaderboard
        leaderboard.forEach((entry, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'leaderboard-entry';
            
            // Highlight current user
            if (entry.username === this.username) {
                entryDiv.classList.add('current-user');
            }
            
            // Highlight top 3
            if (index < 3) {
                entryDiv.classList.add('top-3');
            }
            
            const position = index + 1;
            const medals = ['🥇', '🥈', '🥉'];
            const positionText = position <= 3 ? medals[position - 1] : `${position}.`;
            
            entryDiv.innerHTML = `
                <span class="entry-position">${positionText}</span>
                <span class="entry-username">u/${entry.username}</span>
                <span class="entry-time">${entry.time.toFixed(2)}s</span>
            `;
            
            listElement.appendChild(entryDiv);
        });
    }
    
    updateHUD() {
        const progress = this.gameEngine.getProgress();
        const time = this.gameEngine.getElapsedTime();
        
        // Update distance
        document.getElementById('distanceDisplay').textContent = `${progress.toFixed(1)}m`;
        
        // Update progress bar
        const progressPercent = (progress / 100) * 100;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
        
        // Update timer
        document.getElementById('timerDisplay').textContent = `${time.toFixed(2)}s`;
    }
    
    gameLoop() {
        // Update game state
        this.gameEngine.update();
        
        // Update parallax based on player progress
        this.parallax.update(this.gameEngine.getProgress());
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render background
        this.parallax.render(this.ctx);
        
        // Render track and player
        this.renderer.render(this.ctx, this.gameEngine);
        
        // Update HUD
        if (this.gameEngine.isRunning()) {
            this.updateHUD();
        }
        
        // Continue loop
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Reddit Runner...');
    const game = new RedditRunner();
    window.redditRunner = game; // Make globally accessible
});