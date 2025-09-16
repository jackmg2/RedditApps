// src/hooks/useLinkerData.tsx
import { useState, useAsync } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { RedisDataService } from '../services/RedisDataService.js';

interface UseLinkerDataReturn {
  linker: Linker | null;
  loading: boolean;
  error: Error | null;
  refreshData: () => void;
  saveLinker: (linker: Linker) => Promise<void>;
  updateLinkerOptimistically: (linker: Linker) => void;
}

/**
 * Linker data hook using only the new Redis hash-based storage
 */
export const useLinkerData = (context: any): UseLinkerDataReturn => {
  const [refreshKey, setRefreshKey] = useState(`${context.postId}_${Date.now()}`);
  const [optimisticLinker, setOptimisticLinker] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Initialize Redis service
  const redisService = new RedisDataService(context, context.postId);

  const { data, loading, error } = useAsync(async () => {
    console.log(`[useLinkerData] Loading data for post: ${context.postId}`);
    
    try {
      // Use Redis service for initialization (handles migration automatically)
      const linker = await redisService.initializeBoard();
      
      setIsInitialized(true);
      
      // Return as JSON string to satisfy JSONValue type requirement
      return JSON.stringify(linker);
    } catch (error) {
      console.error(`[useLinkerData] Failed to load data:`, error);
      throw error;
    }
  }, { depends: [refreshKey] });

  const refreshData = () => {
    // Clear optimistic state when explicitly refreshing
    setOptimisticLinker('');
    // Update refresh key to trigger refetch
    setRefreshKey(`${context.postId}_${Date.now()}`);
  };

  const updateLinkerOptimistically = (linker: Linker) => {
    // Always ensure we have a proper Linker class instance with all methods
    const properLinkerInstance = Linker.fromData(linker);
    setOptimisticLinker(JSON.stringify(properLinkerInstance));
  };

  const saveLinker = async (linker: Linker): Promise<void> => {
    // Immediately update the UI optimistically
    updateLinkerOptimistically(linker);

    try {
      // Save using only the new Redis structure
      await redisService.saveFullLinker(linker);
      
      console.log(`[useLinkerData] Data saved successfully for post: ${context.postId}`);
      
    } catch (error) {
      console.error(`[useLinkerData] Failed to save data for post ${context.postId}:`, error);
      // On error, refresh to get the last known good state
      refreshData();
      throw error;
    }
  };

  // Determine which data to return
  let currentLinker: Linker | null = null;
  
  // Always prefer optimistic data if available
  if (optimisticLinker) {
    currentLinker = JSON.parse(optimisticLinker);
  } else if (data && isInitialized) {
    // Only use fetched data if we've initialized (to avoid flashing old data)
    currentLinker = Linker.fromData(JSON.parse(data as string));
  } else if (data) {
    // During initialization, use the fetched data
    currentLinker = Linker.fromData(JSON.parse(data as string));
  }

  return {
    linker: currentLinker,
    loading: loading && !optimisticLinker, // Don't show loading if we have optimistic data
    error: error
      ? (error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : JSON.stringify(error)))
      : null,
    refreshData,
    saveLinker,
    updateLinkerOptimistically
  };
};