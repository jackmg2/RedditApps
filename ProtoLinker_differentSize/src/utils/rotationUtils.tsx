/**
 * Enhanced rotationUtils.tsx with flicker-free variant selection
 */

// Cache to store selected variants per cell during a user session
const sessionVariantCache = new Map<string, string>();

/**
 * Creates a deterministic hash from a string
 */
const createStableHash = (input: string): number => {
  let hash = 0;
  if (input.length === 0) return hash;
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
};

/**
 * Deterministic seeded random function
 */
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

/**
 * Deterministic weighted selection based on seed
 */
const deterministicWeightedSelect = (items: any[], weights: number[], seed: number): any => {
  if (!items || items.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  
  if (items.length === 1) {
    return items[0];
  }
  
  // Ensure weights array matches items length and has valid values
  const normalizedWeights = weights ? weights.slice(0, items.length) : [];
  while (normalizedWeights.length < items.length) {
    normalizedWeights.push(1);
  }
  
  // Calculate total weight, ensuring all weights are positive numbers
  const totalWeight = normalizedWeights.reduce((sum, weight) => {
    const validWeight = (typeof weight === 'number' && !isNaN(weight) && weight >= 0) ? weight : 1;
    return sum + validWeight;
  }, 0);
  
  if (totalWeight === 0) {
    // If all weights are 0, select deterministically with equal probability
    const index = Math.floor(seededRandom(seed) * items.length);
    return items[index];
  }
  
  // Generate deterministic random number between 0 and totalWeight
  const random = seededRandom(seed) * totalWeight;
  
  // Find the selected item
  let currentWeight = 0;
  for (let i = 0; i < items.length; i++) {
    const validWeight = (typeof normalizedWeights[i] === 'number' && !isNaN(normalizedWeights[i]) && normalizedWeights[i] >= 0) 
      ? normalizedWeights[i] 
      : 1;
    currentWeight += validWeight;
    if (random <= currentWeight) {
      return items[i];
    }
  }
  
  // Fallback (should not happen)
  return items[items.length - 1];
};

/**
 * Checks if a link is empty (helper function to avoid circular imports)
 */
const isLinkEmpty = (link: any): boolean => {
  if (!link) return true;
  
  const hasUri = link.uri && link.uri.trim() !== '';
  const hasTitle = link.title && link.title.trim() !== '';
  const hasImage = link.image && link.image.trim() !== '';
  
  return !hasUri && !hasTitle && !hasImage;
};

/**
 * Main variant selection function - now completely deterministic and flicker-free
 */
export const selectVariant = (cell: any): any => {
  if (!cell || !cell.links || cell.links.length === 0) {
    return null;
  }
  
  if (!cell.rotationEnabled || cell.links.length === 1) {
    return cell.links[0];
  }
  
  // Filter out empty links
  const activeLinks = cell.links.filter((link: any) => !isLinkEmpty(link));
  if (activeLinks.length === 0) {
    return cell.links[0]; // Return first even if empty
  }
  
  if (activeLinks.length === 1) {
    return activeLinks[0];
  }

  // Check if we've already selected a variant for this cell in this session
  const cachedVariantId = sessionVariantCache.get(cell.id);
  if (cachedVariantId) {
    const cachedVariant = activeLinks.find((link: { id: string; }) => link.id === cachedVariantId);
    if (cachedVariant) {
      return cachedVariant;
    }
    // If cached variant is no longer available, clear cache and continue
    sessionVariantCache.delete(cell.id);
  }

  // Create a deterministic seed based on cell ID and user session
  // This ensures the same variant is selected every time for this cell in this session
  const sessionSeed = getOrCreateSessionSeed();
  const cellHash = createStableHash(cell.id);
  const combinedSeed = cellHash + sessionSeed;
  
  // Get weights for active links only
  const activeWeights: number[] = [];
  cell.links.forEach((link: any, index: number) => {
    if (!isLinkEmpty(link)) {
      const weight = cell.weights && cell.weights[index] ? cell.weights[index] : 1;
      activeWeights.push(weight);
    }
  });
  
  try {
    // Use deterministic selection
    const selectedVariant = deterministicWeightedSelect(activeLinks, activeWeights, combinedSeed);
    
    // Cache the selection for this session
    sessionVariantCache.set(cell.id, selectedVariant.id);
    
    return selectedVariant;
  } catch (error) {
    console.error('Error in selectVariant:', error);
    const fallbackVariant = activeLinks[0];
    sessionVariantCache.set(cell.id, fallbackVariant.id);
    return fallbackVariant;
  }
};

/**
 * Session seed management for consistent selections across the session
 */
let sessionSeed: number | null = null;

const getOrCreateSessionSeed = (): number => {
  if (sessionSeed === null) {
    // Create a session seed based on current time, but stable for the session
    sessionSeed = createStableHash(Date.now().toString() + Math.random().toString());
  }
  return sessionSeed;
};

/**
 * Pre-select variants for all cells to eliminate any flickering
 * Call this when linker data is loaded to ensure variants are selected upfront
 */
export const preSelectVariants = (linker: any): void => {
  if (!linker || !linker.pages) return;
  
  for (const page of linker.pages) {
    for (const cell of page.cells) {
      if (cell.rotationEnabled && cell.links && cell.links.length > 1) {
        // This will select and cache the variant
        selectVariant(cell);
      }
    }
  }
};

/**
 * Legacy functions for compatibility
 */
export const weightedRandomSelect = (items: any[], weights: number[]): any => {
  // Use deterministic selection with a random seed for backward compatibility
  const seed = Math.floor(Math.random() * 1000000);
  return deterministicWeightedSelect(items, weights, seed);
};

export const selectVariantDeterministic = (cell: any, timeWindowMs: number = 60000): any => {
  // Create a time-based seed that changes every timeWindowMs milliseconds
  const timeWindow = Math.floor(Date.now() / timeWindowMs);
  const cellHash = createStableHash(cell.id);
  const seed = cellHash + timeWindow;
  
  if (!cell || !cell.links || cell.links.length === 0) {
    return null;
  }
  
  if (!cell.rotationEnabled || cell.links.length === 1) {
    return cell.links[0];
  }
  
  const activeLinks = cell.links.filter((link: any) => !isLinkEmpty(link));
  if (activeLinks.length === 0) {
    return cell.links[0];
  }
  
  if (activeLinks.length === 1) {
    return activeLinks[0];
  }

  const activeWeights: number[] = [];
  cell.links.forEach((link: any, index: number) => {
    if (!isLinkEmpty(link)) {
      const weight = cell.weights && cell.weights[index] ? cell.weights[index] : 1;
      activeWeights.push(weight);
    }
  });
  
  return deterministicWeightedSelect(activeLinks, activeWeights, seed);
};

/**
 * Clears the session cache for a specific cell (useful when cell is updated)
 */
export const clearCellVariantCache = (cellId: string): void => {
  sessionVariantCache.delete(cellId);
};

/**
 * Clears the entire session cache (useful when starting a new session)
 */
export const clearAllVariantCache = (): void => {
  sessionVariantCache.clear();
  sessionSeed = null; // Reset session seed too
};

/**
 * Gets the currently cached variant ID for a cell
 */
export const getCachedVariantId = (cellId: string): string | undefined => {
  return sessionVariantCache.get(cellId);
};

/**
 * Calculates the probability of each variant being selected
 */
export const calculateVariantProbabilities = (cell: any): { variantId: string; probability: number }[] => {
  if (!cell || !cell.links || cell.links.length === 0) {
    return [];
  }
  
  if (!cell.rotationEnabled || cell.links.length <= 1) {
    return cell.links.map((link: any) => ({
      variantId: link.id || 'unknown',
      probability: 100
    }));
  }
  
  const activeLinks = cell.links.filter((link: any) => !isLinkEmpty(link));
  if (activeLinks.length === 0) {
    return [];
  }
  
  const activeWeights: number[] = [];
  const activeLinkIds: string[] = [];
  
  cell.links.forEach((link: any, index: number) => {
    if (!isLinkEmpty(link)) {
      const weight = cell.weights && cell.weights[index] ? cell.weights[index] : 1;
      activeWeights.push(weight);
      activeLinkIds.push(link.id || `variant_${index}`);
    }
  });
  
  const totalWeight = activeWeights.reduce((sum, weight) => {
    const validWeight = (typeof weight === 'number' && !isNaN(weight) && weight >= 0) ? weight : 1;
    return sum + validWeight;
  }, 0);
  
  if (totalWeight === 0) {
    const equalProbability = 100 / activeLinks.length;
    return activeLinkIds.map(id => ({
      variantId: id,
      probability: Math.round(equalProbability * 100) / 100
    }));
  }
  
  return activeLinkIds.map((id, index) => {
    const weight = (typeof activeWeights[index] === 'number' && !isNaN(activeWeights[index]) && activeWeights[index] >= 0) 
      ? activeWeights[index] 
      : 1;
    const probability = (weight / totalWeight) * 100;
    return {
      variantId: id,
      probability: Math.round(probability * 100) / 100
    };
  });
};

/**
 * Validates weights array for a LinkCell
 */
export const validateWeights = (weights: any[]): boolean => {
  if (!Array.isArray(weights)) return false;
  return weights.every(weight => typeof weight === 'number' && !isNaN(weight) && weight >= 0);
};

/**
 * Normalizes weights to ensure they're valid numbers >= 0
 */
export const normalizeWeights = (weights: any[]): number[] => {
  if (!Array.isArray(weights)) return [1];
  
  return weights.map(weight => {
    if (typeof weight !== 'number' || isNaN(weight) || weight < 0) {
      return 1; // Default weight
    }
    return weight;
  });
};