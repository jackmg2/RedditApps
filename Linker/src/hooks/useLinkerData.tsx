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
          variantImpressions: {} // Empty variant impressions
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
 * Custom hook for managing linker data fetching and persistence with migration support
 */
export const useLinkerData = (context: any): UseLinkerDataReturn => {
  const [count, setCount] = useState(1);
  const [optimisticLinker, setOptimisticLinker] = useState<Linker | null>(null);

  const { data, loading, error } = useAsync(async () => {
    const linkerJson = await context.redis.get(`linker_${context.postId}`) as string;
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
          
          // Ensure weights array matches links array
          while (cell.weights.length < cell.links.length) {
            cell.weights.push(1);
          }
          cell.weights = cell.weights.slice(0, cell.links.length);
        });
      });

      // If migration occurred, save the migrated data immediately
      if (migratedData !== parsedData) {
        console.log('Saving migrated linker data');
        // Schedule save after this async operation completes
        setTimeout(async () => {
          try {
            await context.redis.set(`linker_${context.postId}`, JSON.stringify({
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
                  variantImpressions: cell.variantImpressions || {}
                }))
              }))
            }));
            console.log('Migration save completed');
          } catch (error) {
            console.error('Failed to save migrated data:', error);
          }
        }, 100);
      }
    } else {
      // Create new linker with LinkCell structure
      linker = new Linker();
      // The constructor already creates a Page with LinkCells
    }

    // Clear optimistic state when fresh data arrives
    setOptimisticLinker(null);

    // Return as JSON string to satisfy JSONValue type requirement
    return JSON.stringify(linker);
  }, { depends: [count] });

  const refreshData = () => {
    setCount(prev => prev + 1);
  };

  const updateLinkerOptimistically = (linker: Linker) => {
    // Always ensure we have a proper Linker class instance with all methods
    const properLinkerInstance = Linker.fromData(linker);
    setOptimisticLinker(properLinkerInstance);
  };

  const saveLinker = async (linker: Linker): Promise<void> => {
    // Immediately update the UI optimistically
    updateLinkerOptimistically(linker);

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
            variantImpressions: cell.variantImpressions || {}
          }))
        }))
      };

      await context.redis.set(`linker_${context.postId}`, JSON.stringify(serializableData));

      // Force refresh after a short delay to ensure Redis operation is complete
      setTimeout(() => {
        refreshData();
      }, 100);
    } catch (error) {
      // If save fails, revert the optimistic update by refreshing
      refreshData();
      throw error;
    }
  };

  // Return optimistic data if available, otherwise use fetched data
  // Always ensure we return a proper Linker class instance
  let currentLinker: Linker | null = null;
  
  if (optimisticLinker) {
    currentLinker = optimisticLinker;
  } else if (data) {
    currentLinker = Linker.fromData(JSON.parse(data as string));
  }

  return {
    linker: currentLinker,
    loading,
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