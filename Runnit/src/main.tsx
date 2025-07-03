import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

import type { DevvitMessage, WebViewMessage } from './message.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Reddit Runner',
  height: 'tall',
  render: (context) => {
    // Load username with `useAsync` hook
    const [username] = useState(async () => {
      return (await context.reddit.getCurrentUsername()) ?? 'anon';
    });

    // Load user's best time from redis
    const [bestTime, setBestTime] = useState(async () => {
      const savedTime = await context.redis.get(`best_time_${context.postId}_${username}`);
      return savedTime ? parseFloat(savedTime) : null;
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
                bestTime: bestTime,
              },
            });
            break;
          
          case 'raceStart':
            console.log(`${username} started a race`);
            break;
          
          case 'raceComplete':
            try {
              const { time } = message.data;
              const timeKey = `best_time_${context.postId}_${username}`;
              const leaderboardKey = `leaderboard_${context.postId}`;
              
              let isPersonalBest = false;
              if (!bestTime || time < bestTime) {
                await context.redis.set(timeKey, time.toString());
                setBestTime(time);
                isPersonalBest = true;
              }

              // Update global leaderboard
              const leaderboardData = await context.redis.get(leaderboardKey);
              let leaderboard = leaderboardData ? JSON.parse(leaderboardData) : [];
              
              // Remove any existing entry for this user
              leaderboard = leaderboard.filter(entry => entry.username !== username);
              
              // Add new entry
              leaderboard.push({
                username: username,
                time: time,
                date: new Date().toISOString()
              });
              
              // Sort by time (ascending - fastest first) and keep top 10
              leaderboard.sort((a, b) => a.time - b.time);
              leaderboard = leaderboard.slice(0, 10);
              
              // Save updated leaderboard
              await context.redis.set(leaderboardKey, JSON.stringify(leaderboard));

              // Find user's position in leaderboard
              const userPosition = leaderboard.findIndex(entry => entry.username === username) + 1;

              if (isPersonalBest) {
                context.ui.showToast(`🏆 New personal best: ${time.toFixed(2)}s!`);
              } else {
                context.ui.showToast(`✅ Race completed: ${time.toFixed(2)}s`);
              }

              webView.postMessage({
                type: 'newBestTime',
                data: {
                  time,
                  isPersonalBest,
                  leaderboard,
                  userPosition
                },
              });
            } catch (error) {
              console.error('Error saving race time:', error);
              context.ui.showToast('Error saving race time');
            }
            break;
          
          case 'raceFailed':
            console.log(`${username} fell at ${message.data.distance}m`);
            break;
          
          case 'requestLeaderboard':
            try {
              const leaderboardKey = `leaderboard_${context.postId}`;
              const leaderboardData = await context.redis.get(leaderboardKey);
              const leaderboard = leaderboardData ? JSON.parse(leaderboardData) : [];
              
              webView.postMessage({
                type: 'leaderboardData',
                data: {
                  leaderboard
                },
              });
            } catch (error) {
              console.error('Error fetching leaderboard:', error);
            }
            break;
          
          default:
            throw new Error(`Unknown message type: ${message satisfies never}`);
        }
      },
      onUnmount() {
        context.ui.showToast('Thanks for playing Reddit Runner! 🏃‍♂️');
      },
    });

    // Render the custom post type
    return (
      <vstack grow padding="small">
        <hstack gap="small" alignment="end top">
          <image 
            imageHeight={90} 
            imageWidth={90} 
            url="white_circle_360x360.png" 
            description="Bolt.new logo"
            onPress={() => {
              context.ui.navigateTo('https://bolt.new');
            }}
          />
        </hstack>
        <vstack grow alignment="middle center">
          <text size="xlarge" weight="bold" color="orange">
            🏃‍♂️ Reddit Runner 🏃‍♂️
          </text>
          <spacer size="small" />
          <text size="medium" color="secondary">
            100m Sprint Challenge - Beat Your Best Time!
          </text>
          <spacer />
          <vstack alignment="start middle" gap="small">
            {bestTime && (
              <hstack>
                <text size="medium">Best Time:&nbsp;</text>
                <text size="medium" weight="bold" color="green">
                  {bestTime.toFixed(2)}s
                </text>
              </hstack>
            )}
          </vstack>
          <spacer />
          <text size="small" color="secondary" alignment="center">
            Alternate left and right steps - don't step twice with the same leg!
          </text>
          <text size="small" color="secondary" alignment="center">
            Desktop: Left/Right click • Mobile: Touch left/right side
          </text>
          <spacer size="medium" />
          <button onPress={() => webView.mount()} size="large" appearance="primary">
            🏃‍♂️ Start Running! 🏃‍♂️
          </button>
          <spacer size="medium" />          
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;