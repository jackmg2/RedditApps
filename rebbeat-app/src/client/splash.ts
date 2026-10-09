import { context, requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button');
if (startButton instanceof HTMLButtonElement) {
  startButton.addEventListener('click', (e) => {
    // Native iOS/Android app → fullscreen expanded game.
    // Desktop/web → load the game inline in the same window.
    if (context.client !== undefined) {
      requestExpandedMode(e, 'game');
    } else {
      window.location.assign('game.html');
    }
  });
}
