import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { 
  getDetailedAnalyticsSummary, 
  getAllPagesAnalytics, 
  getEngagementMetrics,
  getVariantAnalytics,
  getGridHeatmapData,
  DetailedAnalyticsSummary,
  PageAnalytics,
  VariantAnalytics
} from '../utils/analyticsUtils.js';

interface AnalyticsData {
  // Basic analytics (for backward compatibility)
  totalClicks: number;
  totalImpressions: number;
  mostClicked: Link | null;
  mostClickedCell: LinkCell | null;
  hasAnyClicks: boolean;
  
  // Enhanced analytics
  detailedSummary: DetailedAnalyticsSummary | null;
  allPagesAnalytics: PageAnalytics[];
  variantAnalytics: VariantAnalytics[];
  engagementMetrics: {
    clickThroughRate: number;
    popularityDistribution: 'even' | 'concentrated' | 'sparse';
    abTestingActive: boolean;
    abTestCount: number;
  } | null;
  heatmapData: { row: number; col: number; clicks: number; cellTitle: string; }[];
  
  // Convenience flags
  hasMultiplePages: boolean;
  hasABTests: boolean;
}

/**
 * Ensures we have a proper Linker class instance with all methods
 */
const ensureLinkerInstance = (linker: Linker | null): Linker | null => {
  if (!linker) return null;
  
  // If it already has the methods, return as is
  if (typeof linker.getTotalClicks === 'function') {
    return linker;
  }
  
  // Otherwise, create a proper instance from the data
  return Linker.fromData(linker);
};

/**
 * Analytics hook that provides comprehensive statistics for LinkCell-based structure
 */
export const useAnalytics = (
  inputLinker: Linker | null, 
  currentPageIndex: number = 0, 
  isEditMode: boolean, 
  isModerator: boolean
): AnalyticsData => {
  // Ensure we have a proper linker instance
  const linker = ensureLinkerInstance(inputLinker);
  
  // Return empty state if conditions not met
  if (!linker || !isEditMode || !isModerator) {
    return {
      totalClicks: 0,
      totalImpressions: 0,
      mostClicked: null,
      mostClickedCell: null,
      hasAnyClicks: false,
      detailedSummary: null,
      allPagesAnalytics: [],
      variantAnalytics: [],
      engagementMetrics: null,
      heatmapData: [],
      hasMultiplePages: false,
      hasABTests: false
    };
  }
  
  // Get current page safely
  const currentPage = linker.pages && linker.pages.length > currentPageIndex 
    ? linker.pages[currentPageIndex] 
    : null;
  
  if (!currentPage) {
    return {
      totalClicks: 0,
      totalImpressions: 0,
      mostClicked: null,
      mostClickedCell: null,
      hasAnyClicks: false,
      detailedSummary: null,
      allPagesAnalytics: [],
      variantAnalytics: [],
      engagementMetrics: null,
      heatmapData: [],
      hasMultiplePages: linker.pages ? linker.pages.length > 1 : false,
      hasABTests: false
    };
  }
  
  // Get analytics
  const detailedSummary = getDetailedAnalyticsSummary(linker, currentPageIndex);
  const allPagesAnalytics = getAllPagesAnalytics(linker);
  const variantAnalytics = getVariantAnalytics(linker);
  const engagementMetrics = getEngagementMetrics(linker);
  const heatmapData = getGridHeatmapData(currentPage);
  
  // Calculate basic analytics for backward compatibility
  const totalClicks = linker.getTotalClicks();
  const totalImpressions = linker.pages.reduce((sum, page) => {
    if (typeof page.getTotalImpressions === 'function') {
      return sum + page.getTotalImpressions();
    }
    // Fallback calculation if method is not available
    return sum + page.cells.reduce((pageSum, cell) => pageSum + (cell.impressionCount || 0), 0);
  }, 0);
  const hasAnyClicks = totalClicks > 0;
  
  // Find most clicked link (for backward compatibility)
  let mostClicked: Link | null = null;
  let maxLinkClicks = 0;
  
  // Find most clicked cell
  let mostClickedCell: LinkCell | null = null;
  let maxCellClicks = 0;
  
  for (const page of linker.pages) {
    for (const cell of page.cells) {
      const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      
      // Check for most clicked cell
      if (cellClicks > maxCellClicks && !LinkCell.isEmpty(cell)) {
        maxCellClicks = cellClicks;
        mostClickedCell = cell;
      }
      
      // Check each link for most clicked link
      for (const link of cell.links) {
        const clicks = link.clickCount || 0;
        if (clicks > maxLinkClicks && !Link.isEmpty(link)) {
          maxLinkClicks = clicks;
          mostClicked = link;
        }
      }
    }
  }
  
  // Calculate convenience flags
  const hasMultiplePages = linker.pages ? linker.pages.length > 1 : false;
  const hasABTests = variantAnalytics.length > 0;
  
  return {
    // Basic analytics (backward compatibility)
    totalClicks,
    totalImpressions,
    mostClicked,
    mostClickedCell,
    hasAnyClicks,
    
    // Enhanced analytics
    detailedSummary,
    allPagesAnalytics,
    variantAnalytics,
    engagementMetrics,
    heatmapData,
    
    // Convenience flags
    hasMultiplePages,
    hasABTests
  };
};