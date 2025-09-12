// src/hooks/useLinkerData.tsx
import { useState, useAsync } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { RedisDataService, REDIS_FEATURE_FLAGS } from '../services/RedisDataService.js';

interface UseLinkerDataReturn {
  linker: Linker | null;
  loading: boolean;
  error: Error | null;
  refreshData: () => void;
  saveLinker: (linker: Linker) => Promise<void>;
  updateLinkerOptimistically: (linker: Linker) => void;
}

/**
 * Enhanced linker data hook with new Redis service integration
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
      // Use new Redis service for initialization
      const linker = await redisService.initializeBoard();
      
      setIsInitialized(true);
      
      // Log performance metrics if enabled
      if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
        const metrics = redisService.getPerformanceMetrics();
        console.log('[Performance Metrics]', metrics);
      }
      
      // Return as JSON string to satisfy JSONValue type requirement
      return JSON.stringify(linker);
    } catch (error) {
      console.error(`[useLinkerData] Failed to load data:`, error);
      
      // Fallback to legacy if new system fails
      if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS) {
        console.log('[useLinkerData] Falling back to legacy data...');
        const legacyKey = `linker_${context.postId}`;
        const legacyData = await context.redis.get(legacyKey);
        
        if (legacyData) {
          const linker = Linker.fromData(JSON.parse(legacyData));
          return JSON.stringify(linker);
        }
      }
      
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
      const startTime = Date.now();
      
      // DUAL WRITE: Write to both old and new structures
      if (REDIS_FEATURE_FLAGS.DUAL_WRITE) {
        // Write to legacy structure (existing code)
        const legacyKey = `linker_${context.postId}`;
        const serializableData = {
          id: linker.id,
          pages: linker.pages.map(page => ({
            id: page.id,
            title: page.title,
            backgroundColor: page.backgroundColor,
            foregroundColor: page.foregroundColor,
            backgroundImage: page.backgroundImage,
            columns: page.columns,
            cells: page.cells.map(cell => ({
              id: cell.id,
              links: cell.links.map(link => ({
                id: link.id,
                uri: link.uri || '',
                title: link.title || '',
                image: link.image || '',
                textColor: link.textColor || '#FFFFFF',
                description: link.description || '',
                backgroundColor: link.backgroundColor || '#000000',
                backgroundOpacity: typeof link.backgroundOpacity === 'number' ? link.backgroundOpacity : 0.5,
                clickCount: typeof link.clickCount === 'number' ? link.clickCount : 0
              })),
              weights: cell.weights || [1],
              displayName: cell.displayName || '',
              rotationEnabled: cell.rotationEnabled || false,
              impressionCount: cell.impressionCount || 0,
              variantImpressions: cell.variantImpressions || {},
              currentEditingIndex: cell.currentEditingIndex || 0
            }))
          }))
        };
        
        await context.redis.set(legacyKey, JSON.stringify(serializableData));
        
        // Also write to new structure
        try {
          await redisService.saveFullLinker(linker);
          
          if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
            const duration = Date.now() - startTime;
            console.log(`[useLinkerData] Dual write completed in ${duration}ms`);
          }
        } catch (error) {
          console.error('[useLinkerData] New Redis write failed:', error);
          // Don't fail the operation if new write fails
        }
      } else if (REDIS_FEATURE_FLAGS.USE_NEW_REDIS) {
        // Use only new structure
        await redisService.saveFullLinker(linker);
        
        if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
          const duration = Date.now() - startTime;
          console.log(`[useLinkerData] New Redis write completed in ${duration}ms`);
        }
      } else {
        // Use only legacy structure
        const legacyKey = `linker_${context.postId}`;
        const serializableData = {
          id: linker.id,
          pages: linker.pages.map(page => ({
            id: page.id,
            title: page.title,
            backgroundColor: page.backgroundColor,
            foregroundColor: page.foregroundColor,
            backgroundImage: page.backgroundImage,
            columns: page.columns,
            cells: page.cells.map(cell => ({
              id: cell.id,
              links: cell.links.map(link => ({
                id: link.id,
                uri: link.uri || '',
                title: link.title || '',
                image: link.image || '',
                textColor: link.textColor || '#FFFFFF',
                description: link.description || '',
                backgroundColor: link.backgroundColor || '#000000',
                backgroundOpacity: typeof link.backgroundOpacity === 'number' ? link.backgroundOpacity : 0.5,
                clickCount: typeof link.clickCount === 'number' ? link.clickCount : 0
              })),
              weights: cell.weights || [1],
              displayName: cell.displayName || '',
              rotationEnabled: cell.rotationEnabled || false,
              impressionCount: cell.impressionCount || 0,
              variantImpressions: cell.variantImpressions || {},
              currentEditingIndex: cell.currentEditingIndex || 0
            }))
          }))
        };
        
        await context.redis.set(legacyKey, JSON.stringify(serializableData));
        
        if (REDIS_FEATURE_FLAGS.LOG_PERFORMANCE) {
          const duration = Date.now() - startTime;
          console.log(`[useLinkerData] Legacy write completed in ${duration}ms`);
        }
      }
      
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