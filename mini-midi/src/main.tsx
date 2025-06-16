import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

import type { DevvitMessage, WebViewMessage } from './message.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Silly MIDI Grid',
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
            🎵 Silly MIDI Grid 🎵
          </text>
          <spacer size="small" />
          <text size="medium" color="secondary">
            The most gloriously useless music maker on Reddit!
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
            <hstack>
              <text size="medium">Favorite Notes:&nbsp;</text>
              <text size="medium" weight="bold" color="green">
                {' '}
                {favoriteNotes?.length ?? 0} saved
              </text>
            </hstack>
          </vstack>
          <spacer />
          <text size="small" color="secondary" alignment="center">
            Click colorful squares to make music!
          </text>
          <spacer />
          <button onPress={() => webView.mount()} size="large" appearance="primary">
            🎹 Launch Silly MIDI Grid 🎹
          </button>
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;