import { useState, useAsync } from '@devvit/public-api';
import { Linker } from '../types/linker.js';

interface UseLinkerDataReturn {
  linker: Linker | null;
  loading: boolean;
  error: Error | null;
  refreshData: () => void;
  saveLinker: (linker: Linker) => Promise<void>;
}

/**
 * Custom hook for managing linker data fetching and persistence
 */
export const useLinkerData = (context: any): UseLinkerDataReturn => {
  const [count, setCount] = useState(1);

  const { data, loading, error } = useAsync(async () => {
    const linkerJson = await context.redis.get(`linker_${context.postId}`) as string;
    let linker: Linker;
    
    if (linkerJson) {
      const parsedData = JSON.parse(linkerJson);
      linker = Linker.fromData(parsedData);
      
      // Ensure all links have click count initialized (backward compatibility)
      linker.pages.forEach(page => {
        page.links.forEach(link => {
          if (link.clickCount === undefined || link.clickCount === null) {
            link.clickCount = 0;
          }
        });
      });
    } else {
      linker = new Linker();
    }
    
    return JSON.stringify(linker);
  }, { depends: [count] });

  const refreshData = () => {
    setCount(prev => prev + 1);
  };

  const saveLinker = async (linker: Linker): Promise<void> => {
    try {
      await context.redis.set(`linker_${context.postId}`, JSON.stringify(linker));
      refreshData();
    } catch (error) {
      console.error('Failed to save linker data:', error);
      throw error;
    }
  };

  return {
    linker: data ? JSON.parse(data) : null,
    loading,
    error: error
      ? (error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error)))
      : null,
    refreshData,
    saveLinker
  };
};