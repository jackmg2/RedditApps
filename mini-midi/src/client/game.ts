import { SimpleMusicalApp } from './simpleMusicalApp';

document.addEventListener('DOMContentLoaded', () => {
  try {
    new SimpleMusicalApp();
  } catch (error) {
    console.error('Error initializing app:', error);
  }
});
