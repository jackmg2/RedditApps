// script.js - Main entry point for FF7 Musical Interface
import { SimpleMusicalApp } from './simpleMusicalApp.js';

// Simplified FF7 Musical Interface
console.log('FF7 Musical Interface loading...');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    try {
        const app = new SimpleMusicalApp();
        window.musicalApp = app; // Make globally accessible for message handling
        console.log('App created successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Handle messages from Reddit
window.addEventListener('message', (event) => {
    console.log('Received message from Reddit:', event.data);

    // Handle Devvit system messages
    if (event.data.type === 'devvit-message' && event.data.data?.message) {
        const message = event.data.data.message;

        switch (message.type) {
            case 'initialData':
                // Handle initial data if needed
                console.log('Received initial data:', message.data);
                break;
            case 'updateFavorites':
                // Handle favorites update if needed
                console.log('Favorites updated:', message.data);
                break;
        }
    }
});

console.log('Script loaded successfully');