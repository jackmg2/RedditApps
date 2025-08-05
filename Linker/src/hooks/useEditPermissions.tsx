import { useAsync } from '@devvit/public-api';

interface UseEditPermissionsReturn {
  canEdit: boolean;
  isModerator: boolean;
  isWhitelisted: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook for checking edit permissions (moderators + whitelisted users)
 */
export const useEditPermissions = (context: any): UseEditPermissionsReturn => {
  const { data, loading, error } = useAsync(async () => {
    try {
      const currentUser = await context.reddit.getCurrentUser();
      if (!currentUser) {
        return {
          canEdit: false,
          isModerator: false,
          isWhitelisted: false
        };
      }

      // Check if user is a moderator
      const moderators = await context.reddit.getModerators({ 
        subredditName: context.subredditName as string 
      });
      
      const allModerators = await moderators.all();
      const isModerator = allModerators.some((m: { username: string }) => m.username === currentUser.username);

      // Check if user is in the whitelist
      let isWhitelisted = false;
      try {
        const whitelist = await context.settings.get('editWhitelist') as string || '';
        if (whitelist.trim()) {
          const whitelistedUsers = whitelist
            .split(';')
            .map(username => username.trim().toLowerCase())
            .filter(username => username.length > 0);
          
          isWhitelisted = whitelistedUsers.includes(currentUser.username.toLowerCase());
        }
      } catch (settingsError) {
        console.error('Failed to get whitelist settings:', settingsError);
        // Continue without whitelist checking if settings fail
      }

      return {
        canEdit: isModerator || isWhitelisted,
        isModerator,
        isWhitelisted
      };
    } catch (error) {
      console.error('Failed to check edit permissions:', error);
      return {
        canEdit: false,
        isModerator: false,
        isWhitelisted: false
      };
    }
  }, { depends: [context.subredditName] });

  return {
    canEdit: data?.canEdit || false,
    isModerator: data?.isModerator || false,
    isWhitelisted: data?.isWhitelisted || false,
    loading,
    error: error
      ? (error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error)))
      : null
  };
};