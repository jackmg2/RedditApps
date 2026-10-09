import { BeatApp } from './beatApp';

document.addEventListener('DOMContentLoaded', () => {
  try {
    new BeatApp();
  } catch (error) {
    console.error('Error initializing app:', error);
  }
});
