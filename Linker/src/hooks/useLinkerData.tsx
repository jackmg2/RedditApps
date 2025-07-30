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
    
    // Return as JSON string to satisfy JSONValue type requirement
    return JSON.stringify(linker);
  }, { depends: [count] });

  const refreshData = () => {
    setCount(prev => prev + 1);
  };

  const saveLinker = async (linker: Linker): Promise<void> => {
    try {
      // Convert to plain object for serialization
      const serializableData = {
        id: linker.id,
        pages: linker.pages.map(page => ({
          id: page.id,
          title: page.title,
          backgroundColor: page.backgroundColor,
          foregroundColor: page.foregroundColor,
          backgroundImage: page.backgroundImage,
          columns: page.columns,
          links: page.links.map(link => ({
            id: link.id,
            uri: link.uri || '',
            title: link.title || '',
            image: link.image || '',
            textColor: link.textColor || '#FFFFFF',
            description: link.description || '',
            backgroundColor: link.backgroundColor || '#000000',
            backgroundOpacity: typeof link.backgroundOpacity === 'number' ? link.backgroundOpacity : 0.5,
            clickCount: typeof link.clickCount === 'number' ? link.clickCount : 0
          }))
        }))
      };
      
      await context.redis.set(`linker_${context.postId}`, JSON.stringify(serializableData));
      
      // Force immediate refresh
      refreshData();
      
    } catch (error) {
      console.error('Failed to save linker data:', error);
      throw error;
    }
  };

  return {
    linker: data ? Linker.fromData(JSON.parse(data as string)) : null,
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