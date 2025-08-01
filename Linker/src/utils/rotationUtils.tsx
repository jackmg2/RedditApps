/**
 * Selects a random item from an array based on weights
 */
export const weightedRandomSelect = (items: any[], weights: number[]): any => {
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
    // If all weights are 0, select randomly with equal probability
    return items[Math.floor(Math.random() * items.length)];
  }
  
  // Generate random number between 0 and totalWeight
  const random = Math.random() * totalWeight;
  
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
 * Selects a variant from a LinkCell based on rotation settings
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
  
  // Get weights for active links only
  const activeWeights: number[] = [];
  cell.links.forEach((link: any, index: number) => {
    if (!isLinkEmpty(link)) {
      const weight = cell.weights && cell.weights[index] ? cell.weights[index] : 1;
      activeWeights.push(weight);
    }
  });
  
  try {
    return weightedRandomSelect(activeLinks, activeWeights);
  } catch (error) {
    console.error('Error in selectVariant:', error);
    return activeLinks[0]; // Fallback to first active link
  }
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
    // Equal probability if all weights are 0
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