// src/main.tsx - Main Devvit app entry point
import { Devvit, Context, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
});

// Types for musical data
interface MusicalComposition {
  id: string;
  authorId: string;
  sequence: Array<{
    timestamp: number;
    leftTone: number;
    rightTone: number;
    octave: number;
    chord: number;
    axes: number[];
  }>;
  duration: number;
  title: string;
  created: number;
}

interface WebviewMessage {
  type: 'saveComposition' | 'loadComposition' | 'shareComposition' | 'joinCollaboration';
  data: any;
}

// Form data interface
interface CreatePostFormData {
  title: string;
  description?: string;
  [key: string]: string | undefined; // Index signature to satisfy JSONObject constraint
}

// Handle messages from webview
async function handleWebviewMessage(context: Context, message: unknown): Promise<void> {
  try {
    // Validate and parse the message
    const parsedMessage = message as WebviewMessage;
    if (!parsedMessage || typeof parsedMessage.type !== 'string') {
      console.error('Invalid message format:', message);
      return;
    }

    const { type, data } = parsedMessage;
    let response;

    switch (type) {
      case 'saveComposition':
        response = await saveComposition(context, data);
        break;
      case 'loadComposition':
        response = await loadComposition(context, data.id);
        break;
      case 'shareComposition':
        response = await shareComposition(context, data);
        break;
      case 'joinCollaboration':
        response = await joinCollaboration(context, data);
        break;
      default:
        console.error('Unknown message type:', type);
        return;
    }

    // Log the response for debugging (in a real app, you might want to send this back to the webview)
    console.log('Message processed:', type, response);
  } catch (error) {
    console.error('Error handling webview message:', error);
  }
}

// Save composition to Redis
async function saveComposition(context: Context, composition: MusicalComposition): Promise<{ success: boolean; id?: string }> {
  try {
    const compositionId = `composition:${context.postId}:${Date.now()}`;
    composition.id = compositionId;
    composition.authorId = context.userId || 'anonymous';
    composition.created = Date.now();

    await context.redis.set(compositionId, JSON.stringify(composition));
    
    // Add to user's compositions list
    const userCompositions = await context.redis.get(`user:${composition.authorId}:compositions`) || '[]';
    const compositions = JSON.parse(userCompositions);
    compositions.push(compositionId);
    await context.redis.set(`user:${composition.authorId}:compositions`, JSON.stringify(compositions));

    return { success: true, id: compositionId };
  } catch (error) {
    console.error('Error saving composition:', error);
    return { success: false };
  }
}

// Load composition from Redis
async function loadComposition(context: Context, compositionId: string): Promise<MusicalComposition | null> {
  try {
    const data = await context.redis.get(compositionId);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading composition:', error);
    return null;
  }
}

// Share composition as comment
async function shareComposition(context: Context, data: { compositionId: string; message: string }) {
  try {
    const composition = await loadComposition(context, data.compositionId);
    if (!composition) return { success: false };

    const encodedComposition = btoa(JSON.stringify(composition.sequence));
    const commentText = `${data.message}\n\n🎵 **Musical Composition** 🎵\n\`${encodedComposition}\`\n\n*Use the Musical Interface to play this composition!*`;

    await context.reddit.submitComment({
      id: context.postId!,
      text: commentText,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sharing composition:', error);
    return { success: false };
  }
}

// Join collaborative session
async function joinCollaboration(context: Context, data: { sessionId: string }) {
  try {
    const sessionKey = `collaboration:${data.sessionId}`;
    const session = await context.redis.get(sessionKey) || '{"users": [], "composition": null}';
    const sessionData = JSON.parse(session);
    
    if (!sessionData.users.includes(context.userId)) {
      sessionData.users.push(context.userId);
      await context.redis.set(sessionKey, JSON.stringify(sessionData));
    }

    return { success: true, session: sessionData };
  } catch (error) {
    console.error('Error joining collaboration:', error);
    return { success: false };
  }
}

// Add custom post type for musical interface
Devvit.addCustomPostType({
  name: 'FF7 Musical Interface',
  height: 'tall',
  render: (context) => {
    return (
      <webview
        id="ff7-musical-interface"
        url="index.html"
        onMessage={async (msg) => {
          // Handle the message but don't return anything
          // The webview will use postMessage for communication
          await handleWebviewMessage(context, msg);
        }}
        width="100%"
        height="600px"
      />
    );
  },
});

// Create the form for musical post creation
const createMusicalPostForm = Devvit.createForm(
  {
    title: 'Create FF7 Musical Interface Post',
    fields: [
      {
        name: 'title',
        label: 'Post Title',
        type: 'string',
        required: true,
        defaultValue: '🎵 FF7 Musical Interface - Create and Share Music! 🎵',
      },
      {
        name: 'description',
        label: 'Description (optional)',
        type: 'paragraph',
        helpText: 'Describe what users can do with this musical interface',
      },
    ],
  },
  async (event: FormOnSubmitEvent<CreatePostFormData>, context: Context) => {
    const { reddit, ui } = context;
    
    try {
      const post = await reddit.submitPost({
        title: event.values.title,
        subredditName: context.subredditName  as string,
        preview: (
          <vstack gap="medium" padding="medium">
            <text size="xlarge" weight="bold">🎵 FF7 Musical Interface</text>
            <text>Create and share music inspired by Final Fantasy VII Rebirth!</text>
            <text size="small" color="neutral-content-weak">
              Use gamepad, touch, or mouse controls to play musical notes and chords.
            </text>
            {event.values.description as string && (
              <text size="medium">{event.values.description}</text>
            )}
          </vstack>
        ),
      });

      ui.showToast({
        text: 'Musical interface post created!',
        appearance: 'success',
      });

      ui.navigateTo(post.url);
    } catch (error) {
      console.error('Error creating musical post:', error);
      ui.showToast({
        text: 'Failed to create post. Please try again.',
        appearance: 'neutral',
      });
    }
  }
);

// Add menu action to create musical post
Devvit.addMenuItem({
  label: 'Create Musical Post',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (event, context: Context) => {
    const { ui } = context;
    ui.showForm(createMusicalPostForm);
  },
});

export default Devvit;