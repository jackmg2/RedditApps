import { useState, useAsync } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { Page } from '../types/page.js';

interface UseLinkerDataReturn {
  linker: Linker | null;
  loading: boolean;
  error: Error | null;
  refreshData: () => void;
  saveLinker: (linker: Linker) => Promise<void>;
  updateLinkerOptimistically: (linker: Linker) => void;
}

/**
 * Migrates old Link[] structure to new LinkCell[] structure
 */
const migrateLegacyLinker = (data: any): any => {
  // Check if migration is needed
  if (data.pages && data.pages.length > 0) {
    const firstPage = data.pages[0];
    
    // If page has 'links' property but no 'cells' property, migrate
    if (firstPage.links && !firstPage.cells) {
      console.log('Migrating legacy linker data to LinkCell structure');
      
      const migratedPages = data.pages.map((page: any) => ({
        ...page,
        cells: page.links.map((link: any) => ({
          id: `cell_${link.id}`, // Create new cell ID based on link ID
          links: [link], // Wrap single link in array
          weights: [1], // Default weight
          displayName: link.title || '', // Use link title as cell name
          rotationEnabled: false, // Disable rotation for migrated single-variant cells
          impressionCount: 0, // Start with zero impressions
          variantImpressions: {}, // Empty variant impressions
          currentEditingIndex: 0 // Initialize editing index
        })),
        // Remove old links property
        links: undefined
      }));

      return {
        ...data,
        pages: migratedPages
      };
    }
  }
  
  // No migration needed
  return data;
};

/**
 * Fixed linker data hook with reliable persistence
 */
export const useLinkerData = (context: any): UseLinkerDataReturn => {
  // Use postId as part of the dependency to ensure each post has its own data
  const [refreshKey, setRefreshKey] = useState(`${context.postId}_${Date.now()}`);
  const [optimisticLinker, setOptimisticLinker] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const { data, loading, error } = useAsync(async () => {
    // Use unique Redis key per post
    const redisKey = `linker_${context.postId}`;
    console.log(`Fetching data for post: ${context.postId}`);
    
    const linkerJson = await context.redis.get(redisKey) as string;
    let linker: Linker;

    if (linkerJson) {
      const parsedData = JSON.parse(linkerJson);
      
      // Apply migration if needed
      const migratedData = migrateLegacyLinker(parsedData);
      
      linker = Linker.fromData(migratedData);

      // Ensure all links have click count initialized (backward compatibility)
      linker.pages.forEach(page => {
        page.cells.forEach(cell => {
          cell.links.forEach(link => {
            if (link.clickCount === undefined || link.clickCount === null) {
              link.clickCount = 0;
            }
          });
          
          // Ensure cell-level analytics are initialized
          if (cell.impressionCount === undefined || cell.impressionCount === null) {
            cell.impressionCount = 0;
          }
          if (!cell.variantImpressions) {
            cell.variantImpressions = {};
          }
          
          // Ensure editing index is initialized
          if (cell.currentEditingIndex === undefined || cell.currentEditingIndex === null) {
            cell.currentEditingIndex = 0;
          }
          
          // Ensure weights array matches links array
          while (cell.weights.length < cell.links.length) {
            cell.weights.push(1);
          }
          cell.weights = cell.weights.slice(0, cell.links.length);

          // Auto-enable rotation for cells with multiple active variants
          const activeVariants = cell.links.filter(link => !Link.isEmpty(link));
          if (activeVariants.length > 1) {
            cell.rotationEnabled = true;
          }
        });
      });

      // If migration occurred, save the migrated data immediately
      if (migratedData !== parsedData) {
        console.log('Saving migrated linker data');
        // Don't await this to avoid blocking the UI
        context.redis.set(redisKey, JSON.stringify({
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
              weights: cell.weights,
              displayName: cell.displayName || '',
              rotationEnabled: cell.rotationEnabled || false,
              impressionCount: cell.impressionCount || 0,
              variantImpressions: cell.variantImpressions || {},
              currentEditingIndex: cell.currentEditingIndex || 0
            }))
          }))
        }));
      }
    } else {
      // Create new linker with enhanced LinkCell structure
      linker = new Linker();
      // Save the initial structure
      const redisKey = `linker_${context.postId}`;
      await context.redis.set(redisKey, JSON.stringify({
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
      }));
    }

    setIsInitialized(true);
    
    // Return as JSON string to satisfy JSONValue type requirement
    return JSON.stringify(linker);
  }, { depends: [refreshKey] }); // Use refreshKey instead of count

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
      // Use unique Redis key per post
      const redisKey = `linker_${context.postId}`;
      
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

      await context.redis.set(redisKey, JSON.stringify(serializableData));
      
      // DO NOT refresh after save - keep the optimistic state
      // The optimistic state will be used until the next explicit refresh
      console.log(`Data saved successfully for post: ${context.postId}`);
      
    } catch (error) {
      console.error(`Failed to save data for post ${context.postId}:`, error);
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