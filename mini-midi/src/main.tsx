import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

import type { DevvitMessage, WebViewMessage } from './message.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'MIDI Silly Fantasy',
  height: 'tall',
  render: (context) => {
    // Load username with `useAsync` hook
    const [username] = useState(async () => {
      return (await context.reddit.getCurrentUsername()) ?? 'anon';
    });

    // Load user's favorite notes from redis
    const [favoriteNotes, setFavoriteNotes] = useState(async () => {
      const savedNotes = await context.redis.get(`favorite_notes_${context.postId}`);
      return savedNotes ? JSON.parse(savedNotes) : [];
    });

    const webView = useWebView<WebViewMessage, DevvitMessage>({
      // URL of your web view content
      url: 'page.html',

      // Handle messages sent from the web view
      async onMessage(message, webView) {
        switch (message.type) {
          case 'webViewReady':
            webView.postMessage({
              type: 'initialData',
              data: {
                username: username,
                favoriteNotes: favoriteNotes,
              },
            });
            break;
          case 'saveFavoriteNote':
            // Legacy support for individual note additions
            if (message.data.action === 'remove') {
              const updatedNotes = favoriteNotes.filter(note => note !== message.data.note);
              await context.redis.set(
                `favorite_notes_${context.postId}`,
                JSON.stringify(updatedNotes)
              );
              setFavoriteNotes(updatedNotes);

              webView.postMessage({
                type: 'updateFavorites',
                data: {
                  favoriteNotes: updatedNotes,
                },
              });
            } else {
              // Add note with rolling limit of 10
              let updatedNotes = [...favoriteNotes];

              // Remove if already exists
              updatedNotes = updatedNotes.filter(note => note !== message.data.note);

              // Add to end
              updatedNotes.push(message.data.note);

              // Enforce limit of 10 (remove from beginning if needed)
              if (updatedNotes.length > 10) {
                updatedNotes = updatedNotes.slice(-10);
              }

              await context.redis.set(
                `favorite_notes_${context.postId}`,
                JSON.stringify(updatedNotes)
              );
              setFavoriteNotes(updatedNotes);

              webView.postMessage({
                type: 'updateFavorites',
                data: {
                  favoriteNotes: updatedNotes,
                },
              });
            }
            break;
          case 'updateFavoritesList':
            // Direct update of the entire favorites list
            const newFavorites = message.data.favoriteNotes.slice(0, 10); // Ensure max 10
            await context.redis.set(
              `favorite_notes_${context.postId}`,
              JSON.stringify(newFavorites)
            );
            setFavoriteNotes(newFavorites);

            webView.postMessage({
              type: 'updateFavorites',
              data: {
                favoriteNotes: newFavorites,
              },
            });
            break;
          case 'clearFavorites':
            await context.redis.set(
              `favorite_notes_${context.postId}`,
              JSON.stringify([])
            );
            setFavoriteNotes([]);

            webView.postMessage({
              type: 'updateFavorites',
              data: {
                favoriteNotes: [],
              },
            });
            break;
          case 'saveComposition':
            try {
              // Save composition to Redis with user-specific key
              const compositionKey = `composition_${context.postId}_${username}_${Date.now()}`;
              await context.redis.set(compositionKey, JSON.stringify(message.data));

              // Also save to user's composition list
              const userCompositionsKey = `user_compositions_${username}`;
              const existingCompositions = await context.redis.get(userCompositionsKey);
              const compositions = existingCompositions ? JSON.parse(existingCompositions) : [];

              compositions.push({
                key: compositionKey,
                created: message.data.created,
                duration: message.data.duration,
                frameCount: message.data.frameCount,
                postId: context.postId
              });

              // Keep only last 50 compositions per user
              if (compositions.length > 50) {
                compositions.splice(0, compositions.length - 50);
              }

              await context.redis.set(userCompositionsKey, JSON.stringify(compositions));

              context.ui.showToast('Composition saved successfully! 🎵');
            } catch (error) {
              console.error('Error saving composition:', error);
              context.ui.showToast('Failed to save composition');
            }
            break;
          case 'shareComposition':
            try {
              // Create a comment with the composition
              const durationSeconds = Math.floor(message.data.duration / 1000);
              const minutes = Math.floor(durationSeconds / 60);
              const seconds = durationSeconds % 60;
              const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

              // Get scale and octave info with fallbacks
              const scaleInfo = message.data.scaleDisplayName || message.data.scale || 'Major ✨';
              const octaveInfo = message.data.octave || 4;

              const commentText = `${message.data.message}

🎵 **MIDI Silly Fantasy** 🎵
- Duration: ${durationStr}
- Notes: ${message.data.noteCount}
- Scale: ${scaleInfo}
- Octave: ${octaveInfo}
- Created by: u/${username}

**Composition Code:**
\`\`\`
${message.data.encodedComposition}
\`\`\`

*Copy the code above and use "Import" to play this composition!*`;

              const comment = await context.reddit.submitComment({
                id: context.postId as string,
                text: commentText,
              });

              context.ui.showToast('Composition shared as comment! 🎵');
            } catch (error) {
              console.error('Error sharing composition:', error);
              context.ui.showToast('Failed to share composition');
            }
            break;
          default:
            throw new Error(`Unknown message type: ${message satisfies never}`);
        }
      },
      onUnmount() {
        context.ui.showToast('Thanks for making silly music! 🎵');
      },
    });

    // Render the custom post type
    return (
      <vstack grow padding="small">
        <vstack grow alignment="middle center">
          <text size="xlarge" weight="bold" color="orange">
            🎵 MIDI Silly Fantasy 🎵
          </text>
          <spacer size="small" />
          <text size="medium" color="secondary">
            Let's bring some music to Reddit! 🎹
          </text>
          <spacer />
          <vstack alignment="start middle" gap="small">
            <hstack>
              <text size="medium">Redditor:&nbsp;</text>
              <text size="medium" weight="bold" color="blue">
                {' u/'}
                {username ?? ''}
              </text>
            </hstack>
          </vstack>
          <spacer />
          <text size="small" color="secondary" alignment="center">
            Left for notes! Right for chords!
          </text>
          <text size="small" color="secondary" alignment="center">
            Play with keyboard, mouse, touch or even gamepad!
          </text>
          <text size="small" color="secondary" alignment="center">
            Record and share your compositions!
          </text>
          <spacer size="medium" />
          <button onPress={() => webView.mount()} size="large" appearance="primary">
            🎹 Let's play! 🎹
          </button>
          <spacer size="medium" />
          <hstack gap="small" alignment="center middle">
            <text size="small" color="secondary">Built with</text>
            <text size="small" weight="bold" color="#ff6600">Bolt.new</text>
            <text size="small">⚡</text>
          </hstack>
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;