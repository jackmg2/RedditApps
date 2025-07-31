// src/utils/analyticsUtils.tsx
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { Page } from '../types/page.js';

export interface DetailedAnalyticsSummary {
  totalClicks: number;
  topLink: {
    title: string;
    clicks: number;
    linkId: string;
  } | null;
  currentPageClicks: number;
  clicksPerRow: number[];
  clicksPerColumn: number[];
  avgClicksPerLink: number;
  mostActiveRow: number | null;
  mostActiveColumn: number | null;
  recentActivityTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
}

export interface PageAnalytics {
  pageIndex: number;
  pageTitle: string;
  totalClicks: number;
  linkCount: number;
  avgClicksPerLink: number;
  topLink: {
    title: string;
    clicks: number;
    linkId: string;
  } | null;
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
 * Ensures we have a proper Page class instance with all methods
 */
const ensurePageInstance = (page: Page | null): Page | null => {
  if (!page) return null;
  
  // If it already has the methods, return as is
  if (typeof page.getTotalClicks === 'function') {
    return page;
  }
  
  // Otherwise, create a proper instance from the data
  return Page.fromData(page);
};

/**
 * Get comprehensive analytics summary for the current page
 */
export const getDetailedAnalyticsSummary = (
  inputLinker: Linker | null, 
  currentPageIndex: number = 0
): DetailedAnalyticsSummary | null => {
  const linker = ensureLinkerInstance(inputLinker);
  
  if (!linker || !linker.pages || linker.pages.length === 0) {
    return null;
  }

  if (currentPageIndex < 0 || currentPageIndex >= linker.pages.length) {
    return null;
  }

  const inputPage = linker.pages[currentPageIndex];
  const currentPage = ensurePageInstance(inputPage);
  
  if (!currentPage) {
    return null;
  }

  // Calculate total clicks across all pages
  const totalClicks = linker.getTotalClicks();
  if (totalClicks === 0) {
    return null;
  }

  // Find the most clicked link across all pages
  let topLink: { title: string; clicks: number; linkId: string; } | null = null;
  let maxClicks = 0;

  for (const inputPageData of linker.pages) {
    const page = ensurePageInstance(inputPageData);
    if (!page) continue;
    
    for (const link of page.links) {
      const clicks = link.clickCount || 0;
      if (clicks > maxClicks && !Link.isEmpty(link)) {
        maxClicks = clicks;
        topLink = {
          title: link.title || 'Untitled Link',
          clicks: clicks,
          linkId: link.id
        };
      }
    }
  }

  // Calculate current page specific statistics
  const currentPageClicks = currentPage.getTotalClicks();
  const clicksPerRow = currentPage.getClicksPerRow();
  const clicksPerColumn = currentPage.getClicksPerColumn();

  // Calculate averages
  const nonEmptyLinks = currentPage.links.filter(link => !Link.isEmpty(link));
  const avgClicksPerLink = nonEmptyLinks.length > 0 ? currentPageClicks / nonEmptyLinks.length : 0;

  // Find most active row and column
  const mostActiveRow = clicksPerRow.length > 0 
    ? clicksPerRow.indexOf(Math.max(...clicksPerRow)) 
    : null;
  
  const mostActiveColumn = clicksPerColumn.length > 0 
    ? clicksPerColumn.indexOf(Math.max(...clicksPerColumn)) 
    : null;

  return {
    totalClicks,
    topLink,
    currentPageClicks,
    clicksPerRow,
    clicksPerColumn,
    avgClicksPerLink: Math.round(avgClicksPerLink * 10) / 10,
    mostActiveRow,
    mostActiveColumn,
    recentActivityTrend: 'unknown' // Could be enhanced with timestamp analysis
  };
};

/**
 * Get analytics for all pages
 */
export const getAllPagesAnalytics = (inputLinker: Linker | null): PageAnalytics[] => {
  const linker = ensureLinkerInstance(inputLinker);
  
  if (!linker || !linker.pages) {
    return [];
  }

  return linker.pages.map((inputPageData, index) => {
    const page = ensurePageInstance(inputPageData);
    
    if (!page) {
      return {
        pageIndex: index,
        pageTitle: `Page ${index + 1}`,
        totalClicks: 0,
        linkCount: 0,
        avgClicksPerLink: 0,
        topLink: null
      };
    }

    const totalClicks = page.getTotalClicks();
    const nonEmptyLinks = page.links.filter(link => !Link.isEmpty(link) && link.uri);
    const linkCount = nonEmptyLinks.length;
    const avgClicksPerLink = linkCount > 0 ? totalClicks / linkCount : 0;

    // Find top link for this page
    let topLink: { title: string; clicks: number; linkId: string; } | null = null;
    let maxClicks = 0;

    for (const link of page.links) {
      const clicks = link.clickCount || 0;
      if (clicks > maxClicks && !Link.isEmpty(link)) {
        maxClicks = clicks;
        topLink = {
          title: link.title || 'Untitled Link',
          clicks: clicks,
          linkId: link.id
        };
      }
    }

    return {
      pageIndex: index,
      pageTitle: page.title || `Page ${index + 1}`,
      totalClicks,
      linkCount,
      avgClicksPerLink: Math.round(avgClicksPerLink * 10) / 10,
      topLink
    };
  });
};

/**
 * Get grid heatmap data for visualization
 */
export const getGridHeatmapData = (
  inputPage: Page | null
): { row: number; col: number; clicks: number; linkTitle: string; }[] => {
  const page = ensurePageInstance(inputPage);
  
  if (!page) {
    return [];
  }

  const heatmapData: { row: number; col: number; clicks: number; linkTitle: string; }[] = [];
  const columns = page.columns || 4;

  page.links.forEach((link, index) => {
    if (!Link.isEmpty(link)) {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const clicks = link.clickCount || 0;
      
      heatmapData.push({
        row,
        col,
        clicks,
        linkTitle: link.title || 'Untitled'
      });
    }
  });

  return heatmapData;
};

/**
 * Calculate engagement metrics
 */
export const getEngagementMetrics = (inputLinker: Linker | null): {
  clickThroughRate: number;
  popularityDistribution: 'even' | 'concentrated' | 'sparse';
} | null => {
  const linker = ensureLinkerInstance(inputLinker);
  
  if (!linker) {
    return null;
  }

  const totalLinks = linker.pages.reduce((sum, inputPageData) => {
    const page = ensurePageInstance(inputPageData);
    if (!page) return sum;
    return sum + page.links.filter(link => !Link.isEmpty(link)).length;
  }, 0);
  
  if (totalLinks === 0) {
    return null;
  }

  const totalClicks = linker.getTotalClicks();
  const clickThroughRate = (totalClicks / totalLinks) * 100;

  // Determine popularity distribution
  const clickCounts = linker.pages.flatMap(inputPageData => {
    const page = ensurePageInstance(inputPageData);
    if (!page) return [];
    
    return page.links
      .filter(link => !Link.isEmpty(link))
      .map(link => link.clickCount || 0);
  });

  const nonZeroClicks = clickCounts.filter(count => count > 0);
  const avgClicks = nonZeroClicks.length > 0 
    ? nonZeroClicks.reduce((sum, count) => sum + count, 0) / nonZeroClicks.length 
    : 0;

  const variance = nonZeroClicks.length > 0
    ? nonZeroClicks.reduce((sum, count) => sum + Math.pow(count - avgClicks, 2), 0) / nonZeroClicks.length
    : 0;

  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = avgClicks > 0 ? standardDeviation / avgClicks : 0;

  let popularityDistribution: 'even' | 'concentrated' | 'sparse';
  if (coefficientOfVariation < 0.5) {
    popularityDistribution = 'even';
  } else if (coefficientOfVariation > 1.5) {
    popularityDistribution = 'concentrated';
  } else {
    popularityDistribution = 'sparse';
  }

  return {
    clickThroughRate: Math.round(clickThroughRate * 10) / 10,
    popularityDistribution
  };
};

/**
 * Format analytics data for display
 */
export const formatAnalyticsForDisplay = (summary: DetailedAnalyticsSummary): {
  title: string;
  value: string;
  description?: string;
}[] => {
  const items = [
    {
      title: 'Total Clicks',
      value: summary.totalClicks.toLocaleString(),
      description: 'Across all links'
    },
    {
      title: 'Current Page Clicks',
      value: summary.currentPageClicks.toLocaleString(),
      description: 'On this page'
    },
    {
      title: 'Average per Link',
      value: summary.avgClicksPerLink.toString(),
      description: 'On current page'
    }
  ];

  if (summary.topLink) {
    items.push({
      title: 'Most Popular',
      value: `"${summary.topLink.title}"`,
      description: `${summary.topLink.clicks} clicks`
    });
  }

  if (summary.mostActiveRow !== null) {
    items.push({
      title: 'Most Active Row',
      value: (summary.mostActiveRow + 1).toString(),
      description: `${summary.clicksPerRow[summary.mostActiveRow]} clicks`
    });
  }

  if (summary.mostActiveColumn !== null) {
    items.push({
      title: 'Most Active Column',
      value: (summary.mostActiveColumn + 1).toString(),
      description: `${summary.clicksPerColumn[summary.mostActiveColumn]} clicks`
    });
  }

  return items;
};