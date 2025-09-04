import { useAsync } from '@devvit/public-api';

interface UseModeratorReturn {
  isModerator: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook for checking moderator status
 */
export const useModerator = (context: any): UseModeratorReturn => {
  const { data, loading, error } = useAsync(async () => {
    try {
      const currentUser = await context.reddit.getCurrentUser();
      if (!currentUser) {
        return false;
      }

      const moderators = await context.reddit.getModerators({ 
        subredditName: context.subredditName as string 
      });
      
      const allModerators = await moderators.all();
      const isModerator = allModerators.some(m => m.username === currentUser.username);
      
      return isModerator;
    } catch (error) {
      console.error('Failed to check moderator status:', error);
      return false;
    }
  }, { depends: [context.subredditName] });

  return {
    isModerator: data || false,
    loading,
    error: error
      ? (error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error)))
      : null
  };
};