// src/utils/pageUtils.tsx
import { Page } from '../types/page.js';

/**
 * Validates if a page index is within valid bounds
 */
export const isValidPageIndex = (pageIndex: number, totalPages: number): boolean => {
  return pageIndex >= 0 && pageIndex < totalPages;
};

/**
 * Normalizes a page index to be within valid bounds using looping
 */
export const normalizePageIndex = (pageIndex: number, totalPages: number): number => {
  if (totalPages === 0) return 0;
  
  let normalized = pageIndex;
  
  // Handle negative indices (loop to end)
  while (normalized < 0) {
    normalized += totalPages;
  }
  
  // Handle indices beyond bounds (loop to beginning)
  while (normalized >= totalPages) {
    normalized -= totalPages;
  }
  
  return normalized;
};

/**
 * Gets safe page indices for previous and next pages with looping
 */
export const getNavigationIndices = (currentIndex: number, totalPages: number): {
  previousIndex: number;
  nextIndex: number;
} => {
  if (totalPages <= 1) {
    return { previousIndex: currentIndex, nextIndex: currentIndex };
  }
  
  const previousIndex = currentIndex === 0 ? totalPages - 1 : currentIndex - 1;
  const nextIndex = currentIndex === totalPages - 1 ? 0 : currentIndex + 1;
  
  return { previousIndex, nextIndex };
};

/**
 * Creates a default page title based on index
 */
export const createDefaultPageTitle = (pageIndex: number): string => {
  return `Page ${pageIndex + 1}`;
};

/**
 * Checks if a page has any content (non-empty cells)
 */
export const pageHasContent = (page: Page): boolean => {
  if (!page || !page.cells) return false;
  
  return page.cells.some(cell => {
    if (!cell || !cell.links) return false;
    return cell.links.some(link => 
      (link.title && link.title.trim() !== '') ||
      (link.uri && link.uri.trim() !== '') ||
      (link.image && link.image.trim() !== '')
    );
  });
};

/**
 * Gets a display-friendly page summary for debugging
 */
export const getPageSummary = (page: Page, pageIndex: number): string => {
  const title = page.title || createDefaultPageTitle(pageIndex);
  const cellCount = page.cells ? page.cells.length : 0;
  const hasContent = pageHasContent(page);
  
  return `${title} (${cellCount} cells, ${hasContent ? 'has content' : 'empty'})`;
};

/**
 * Validates page navigation state
 */
export const validateNavigationState = (
  currentPageIndex: number,
  totalPages: number,
  pages: Page[]
): {
  isValid: boolean;
  correctedIndex: number;
  errors: string[];
} => {
  const errors: string[] = [];
  let correctedIndex = currentPageIndex;
  
  if (totalPages === 0) {
    errors.push('No pages available');
    correctedIndex = 0;
  } else if (!isValidPageIndex(currentPageIndex, totalPages)) {
    errors.push(`Invalid page index: ${currentPageIndex} (should be 0-${totalPages - 1})`);
    correctedIndex = Math.max(0, Math.min(currentPageIndex, totalPages - 1));
  }
  
  if (pages.length !== totalPages) {
    errors.push(`Page count mismatch: expected ${totalPages}, got ${pages.length}`);
  }
  
  if (correctedIndex >= 0 && correctedIndex < pages.length && !pages[correctedIndex]) {
    errors.push(`Page at index ${correctedIndex} is null or undefined`);
  }
  
  return {
    isValid: errors.length === 0,
    correctedIndex,
    errors
  };
};