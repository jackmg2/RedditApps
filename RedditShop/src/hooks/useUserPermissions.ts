import { useAsync } from '@devvit/public-api';

export interface UserData {
  userId: string | null;
  username: string | null;
}

export interface UserPermissions {
  userData: UserData | null;
  isModerator: boolean;
  isCreator: boolean;
  canEdit: boolean;
  loading: boolean;
}

export function useUserPermissions(context: any, shopPostAuthorId?: string): UserPermissions {
  // Load current user data
  const userDataAsync = useAsync(async () => {
    try {
      const currentUser = await context.reddit.getCurrentUser();
      return {
        userId: currentUser?.id || null,
        username: currentUser?.username || null
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return { userId: null, username: null };
    }
  });

  // Load moderator status - only run after userDataAsync has data
  const isModeratorAsync = useAsync(async () => {
    try {
      const userData = userDataAsync.data;
      if (!userData?.username) {
        console.log('No username available for moderator check');
        return false;
      }

      const moderators = await context.reddit.getModerators({
        subredditName: context.subredditName as string
      });
      const allMods = await moderators.all();
      const isMod = allMods.some((m: { username: any; }) => m.username === userData.username);
      console.log('Is moderator:', isMod);
      return isMod;
    } catch (error) {
      console.error('Error checking moderator status:', error);
      return false;
    }
  }, {
    depends: [userDataAsync.data]
  });

  // Load creator status - only run after userDataAsync has data
  const isCreatorAsync = useAsync(async () => {
    try {
      if (!context.postId) {
        console.log('No postId available');
        return false;
      }

      const userData = userDataAsync.data;
      if (!userData?.userId) {
        console.log('No user data available, userData:', userData);
        return false;
      }

      // Check real author ID from Redis first
      const realAuthorId = await context.redis.get(`shop_post_author_${context.postId}`);
      console.log('Real author ID from Redis:', realAuthorId);
      console.log('Current user ID:', userData.userId);

      if (realAuthorId) {
        const isCreatorByRedis = userData.userId === realAuthorId;
        console.log('Is creator by Redis author ID:', isCreatorByRedis);
        return isCreatorByRedis;
      }

      // Fallback to shop post data
      if (shopPostAuthorId) {
        console.log('Shop post authorId:', shopPostAuthorId);
        const isCreatorByShopPost = userData.userId === shopPostAuthorId;
        console.log('Is creator by shop post:', isCreatorByShopPost);
        return isCreatorByShopPost;
      }

      // Final fallback to Reddit post author
      const post = await context.reddit.getPostById(context.postId);
      console.log('Reddit post authorId (likely bot):', post.authorId);
      const isCreatorByPost = userData.userId === post.authorId;
      console.log('Is creator by Reddit post:', isCreatorByPost);

      return isCreatorByPost;
    } catch (error) {
      console.error('Error checking creator status:', error);
      return false;
    }
  }, {
    depends: [userDataAsync.data, shopPostAuthorId ?? null]
  });

  const loading = userDataAsync.loading || isModeratorAsync.loading || isCreatorAsync.loading;
  const userData = userDataAsync.data || null;
  const isModerator = isModeratorAsync.data || false;
  const isCreator = isCreatorAsync.data || false;
  const canEdit = isModerator || isCreator;

  return {
    userData,
    isModerator,
    isCreator,
    canEdit,
    loading
  };
}