import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { 
  getDetailedAnalyticsSummary, 
  getAllPagesAnalytics, 
  getEngagementMetrics,
  getGridHeatmapData,
  DetailedAnalyticsSummary,
  PageAnalytics
} from '../utils/analyticsUtils.js';

interface AnalyticsData {
  // Basic analytics (for backward compatibility)
  totalClicks: number;
  mostClicked: Link | null;
  hasAnyClicks: boolean;
  
  // Enhanced analytics
  detailedSummary: DetailedAnalyticsSummary | null;
  allPagesAnalytics: PageAnalytics[];
  engagementMetrics: {
    clickThroughRate: number;
    popularityDistribution: 'even' | 'concentrated' | 'sparse';
  } | null;
  heatmapData: { row: number; col: number; clicks: number; linkTitle: string; }[];
  
  // Convenience flags
  hasMultiplePages: boolean;
}

/**
 * Analytics hook that provides comprehensive statistics
 */
export const useAnalytics = (
  linker: Linker | null, 
  currentPageIndex: number = 0, 
  isEditMode: boolean, 
  isModerator: boolean
): AnalyticsData => {
  // Return empty state if conditions not met
  if (!linker || !isEditMode || !isModerator) {
    return {
      totalClicks: 0,
      mostClicked: null,
      hasAnyClicks: false,
      detailedSummary: null,
      allPagesAnalytics: [],
      engagementMetrics: null,
      heatmapData: [],
      hasMultiplePages: false
    };
  }
  
  // Get current page safely
  const currentPage = linker.pages && linker.pages.length > currentPageIndex 
    ? linker.pages[currentPageIndex] 
    : null;
  
  if (!currentPage) {
    return {
      totalClicks: 0,
      mostClicked: null,
      hasAnyClicks: false,
      detailedSummary: null,
      allPagesAnalytics: [],
      engagementMetrics: null,
      heatmapData: [],
      hasMultiplePages: linker.pages ? linker.pages.length > 1 : false
    };
  }
  
  // Get analytics
  const detailedSummary = getDetailedAnalyticsSummary(linker, currentPageIndex);
  const allPagesAnalytics = getAllPagesAnalytics(linker);
  const engagementMetrics = getEngagementMetrics(linker);
  const heatmapData = getGridHeatmapData(currentPage);
  
  // Calculate basic analytics for backward compatibility
  const totalClicks = linker.getTotalClicks();
  const hasAnyClicks = totalClicks > 0;
  
  // Find most clicked link (for backward compatibility)
  let mostClicked: Link | null = null;
  if (detailedSummary?.topLink) {
    // Find the actual Link object
    for (const page of linker.pages) {
      const foundLink = page.links.find(link => link.id === detailedSummary.topLink?.linkId);
      if (foundLink) {
        mostClicked = foundLink;
        break;
      }
    }
  }
  
  // Calculate convenience flags
  const hasMultiplePages = linker.pages ? linker.pages.length > 1 : false;
  
  return {
    // Basic analytics (backward compatibility)
    totalClicks,
    mostClicked,
    hasAnyClicks,
    
    // Enhanced analytics
    detailedSummary,
    allPagesAnalytics,
    engagementMetrics,
    heatmapData,
    
    // Convenience flags
    hasMultiplePages
  };
};