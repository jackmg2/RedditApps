// src/utils/analyticsUtils.tsx
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import { LinkCell } from '../types/linkCell.js';
import { Page } from '../types/page.js';

export interface DetailedAnalyticsSummary {
  totalClicks: number;
  totalImpressions: number;
  topLink: {
    title: string;
    clicks: number;
    linkId: string;
  } | null;
  topCell: {
    displayName: string;
    clicks: number;
    cellId: string;
  } | null;
  currentPageClicks: number;
  currentPageImpressions: number;
  clicksPerRow: number[];
  clicksPerColumn: number[];
  avgClicksPerCell: number;
  avgClicksPerLink: number;
  mostActiveRow: number | null;
  mostActiveColumn: number | null;
  overallClickRate: number;
  recentActivityTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
}

export interface PageAnalytics {
  pageIndex: number;
  pageTitle: string;
  totalClicks: number;
  totalImpressions: number;
  cellCount: number;
  linkCount: number;
  avgClicksPerCell: number;
  avgClicksPerLink: number;
  clickRate: number;
  topCell: {
    displayName: string;
    clicks: number;
    cellId: string;
  } | null;
  abTestCount: number; // Number of cells with A/B testing enabled
}

export interface VariantAnalytics {
  cellId: string;
  cellDisplayName: string;
  variants: {
    variantId: string;
    title: string;
    impressions: number;
    clicks: number;
    clickRate: number;
    weight: number;
    expectedShare: number; // Expected percentage based on weight
    actualShare: number; // Actual percentage of impressions
  }[];
  totalImpressions: number;
  totalClicks: number;
  overallClickRate: number;
  bestPerforming: {
    variantId: string;
    title: string;
    clickRate: number;
  } | null;
  hasSignificantDifference: boolean;
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

  // Calculate total clicks and impressions across all pages
  const totalClicks = linker.getTotalClicks();
  const totalImpressions = linker.pages.reduce((sum, pageData) => {
    const page = ensurePageInstance(pageData);
    return sum + (page ? page.getTotalImpressions() : 0);
  }, 0);

  // Find the most clicked link across all pages
  let topLink: { title: string; clicks: number; linkId: string; } | null = null;
  let maxLinkClicks = 0;

  // Find the most clicked cell across all pages
  let topCell: { displayName: string; clicks: number; cellId: string; } | null = null;
  let maxCellClicks = 0;

  for (const inputPageData of linker.pages) {
    const page = ensurePageInstance(inputPageData);
    if (!page) continue;
    
    for (const cell of page.cells) {
      const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      
      // Check for top cell
      if (cellClicks > maxCellClicks && !LinkCell.isEmpty(cell)) {
        maxCellClicks = cellClicks;
        topCell = {
          displayName: cell.displayName || 'Untitled Cell',
          clicks: cellClicks,
          cellId: cell.id
        };
      }
      
      // Check each link for top link
      for (const link of cell.links) {
        const clicks = link.clickCount || 0;
        if (clicks > maxLinkClicks && !Link.isEmpty(link)) {
          maxLinkClicks = clicks;
          topLink = {
            title: link.title || 'Untitled Link',
            clicks: clicks,
            linkId: link.id
          };
        }
      }
    }
  }

  // Calculate current page specific statistics
  const currentPageClicks = currentPage.getTotalClicks();
  const currentPageImpressions = currentPage.getTotalImpressions();
  const clicksPerRow = currentPage.getClicksPerRow();
  const clicksPerColumn = currentPage.getClicksPerColumn();

  // Calculate averages
  const nonEmptyCells = currentPage.cells.filter(cell => !LinkCell.isEmpty(cell));
  const totalLinks = nonEmptyCells.reduce((sum, cell) => sum + cell.links.filter(link => !Link.isEmpty(link)).length, 0);
  
  const avgClicksPerCell = nonEmptyCells.length > 0 ? currentPageClicks / nonEmptyCells.length : 0;
  const avgClicksPerLink = totalLinks > 0 ? currentPageClicks / totalLinks : 0;

  // Find most active row and column
  const mostActiveRow = clicksPerRow.length > 0 
    ? clicksPerRow.indexOf(Math.max(...clicksPerRow)) 
    : null;
  
  const mostActiveColumn = clicksPerColumn.length > 0 
    ? clicksPerColumn.indexOf(Math.max(...clicksPerColumn)) 
    : null;

  // Calculate overall click rate
  const overallClickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return {
    totalClicks,
    totalImpressions,
    topLink,
    topCell,
    currentPageClicks,
    currentPageImpressions,
    clicksPerRow,
    clicksPerColumn,
    avgClicksPerCell: Math.round(avgClicksPerCell * 10) / 10,
    avgClicksPerLink: Math.round(avgClicksPerLink * 10) / 10,
    mostActiveRow,
    mostActiveColumn,
    overallClickRate: Math.round(overallClickRate * 100) / 100,
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
        totalImpressions: 0,
        cellCount: 0,
        linkCount: 0,
        avgClicksPerCell: 0,
        avgClicksPerLink: 0,
        clickRate: 0,
        topCell: null,
        abTestCount: 0
      };
    }

    const totalClicks = page.getTotalClicks();
    const totalImpressions = page.getTotalImpressions();
    const nonEmptyCells = page.cells.filter(cell => !LinkCell.isEmpty(cell));
    const totalLinks = nonEmptyCells.reduce((sum, cell) => sum + cell.links.filter(link => !Link.isEmpty(link)).length, 0);
    const abTestCells = page.getCellsWithABData();
    
    const avgClicksPerCell = nonEmptyCells.length > 0 ? totalClicks / nonEmptyCells.length : 0;
    const avgClicksPerLink = totalLinks > 0 ? totalClicks / totalLinks : 0;
    const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // Find top cell for this page
    let topCell: { displayName: string; clicks: number; cellId: string; } | null = null;
    let maxClicks = 0;

    for (const cell of page.cells) {
      const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      if (cellClicks > maxClicks && !LinkCell.isEmpty(cell)) {
        maxClicks = cellClicks;
        topCell = {
          displayName: cell.displayName || 'Untitled Cell',
          clicks: cellClicks,
          cellId: cell.id
        };
      }
    }

    return {
      pageIndex: index,
      pageTitle: page.title || `Page ${index + 1}`,
      totalClicks,
      totalImpressions,
      cellCount: nonEmptyCells.length,
      linkCount: totalLinks,
      avgClicksPerCell: Math.round(avgClicksPerCell * 10) / 10,
      avgClicksPerLink: Math.round(avgClicksPerLink * 10) / 10,
      clickRate: Math.round(clickRate * 100) / 100,
      topCell,
      abTestCount: abTestCells.length
    };
  });
};

/**
 * Get A/B testing analytics for cells with multiple variants
 */
export const getVariantAnalytics = (inputLinker: Linker | null): VariantAnalytics[] => {
  const linker = ensureLinkerInstance(inputLinker);
  
  if (!linker || !linker.pages) {
    return [];
  }

  const variantAnalytics: VariantAnalytics[] = [];

  for (const inputPageData of linker.pages) {
    const page = ensurePageInstance(inputPageData);
    if (!page) continue;

    for (const cell of page.cells) {
      // Only include cells with rotation enabled and multiple variants
      if (!cell.rotationEnabled || cell.links.length <= 1) continue;

      const cellImpressions = cell.impressionCount || 0;
      const cellClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      
      if (cellImpressions === 0) continue; // Skip cells with no impressions

      // Calculate total weight for expected share calculation
      const totalWeight = cell.weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
      
      const variants = cell.links.map((link, index) => {
        const impressions = cell.variantImpressions[link.id] || 0;
        const clicks = link.clickCount || 0;
        const clickRate = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const weight = cell.weights[index] || 1;
        const expectedShare = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
        const actualShare = cellImpressions > 0 ? (impressions / cellImpressions) * 100 : 0;

        return {
          variantId: link.id,
          title: link.title || 'Untitled Variant',
          impressions,
          clicks,
          clickRate: Math.round(clickRate * 100) / 100,
          weight,
          expectedShare: Math.round(expectedShare * 100) / 100,
          actualShare: Math.round(actualShare * 100) / 100
        };
      });

      // Find best performing variant
      const bestPerforming = variants.reduce((best, current) => {
        return current.clickRate > best.clickRate ? current : best;
      }, variants[0]);

      // Simple significance test: check if best performer has at least 20% better rate and minimum impressions
      const hasSignificantDifference = variants.length > 1 && 
        bestPerforming.impressions >= 20 &&
        variants.some(v => v.variantId !== bestPerforming.variantId && 
                          bestPerforming.clickRate > v.clickRate * 1.2);

      variantAnalytics.push({
        cellId: cell.id,
        cellDisplayName: cell.displayName || 'Untitled Cell',
        variants,
        totalImpressions: cellImpressions,
        totalClicks: cellClicks,
        overallClickRate: cellImpressions > 0 ? Math.round((cellClicks / cellImpressions) * 10000) / 100 : 0,
        bestPerforming: bestPerforming ? {
          variantId: bestPerforming.variantId,
          title: bestPerforming.title,
          clickRate: bestPerforming.clickRate
        } : null,
        hasSignificantDifference
      });
    }
  }

  return variantAnalytics.sort((a, b) => b.totalClicks - a.totalClicks);
};

/**
 * Get grid heatmap data for visualization
 */
export const getGridHeatmapData = (
  inputPage: Page | null
): { row: number; col: number; clicks: number; cellTitle: string; }[] => {
  const page = ensurePageInstance(inputPage);
  
  if (!page) {
    return [];
  }

  const heatmapData: { row: number; col: number; clicks: number; cellTitle: string; }[] = [];
  const columns = page.columns || 4;

  page.cells.forEach((cell, index) => {
    if (!LinkCell.isEmpty(cell)) {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const clicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      
      heatmapData.push({
        row,
        col,
        clicks,
        cellTitle: cell.displayName || 'Untitled Cell'
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
  abTestingActive: boolean;
  abTestCount: number;
} | null => {
  const linker = ensureLinkerInstance(inputLinker);
  
  if (!linker) {
    return null;
  }

  const totalCells = linker.pages.reduce((sum, inputPageData) => {
    const page = ensurePageInstance(inputPageData);
    if (!page) return sum;
    return sum + page.cells.filter(cell => !LinkCell.isEmpty(cell)).length;
  }, 0);
  
  if (totalCells === 0) {
    return null;
  }

  const totalClicks = linker.getTotalClicks();
  const totalImpressions = linker.pages.reduce((sum, inputPageData) => {
    const page = ensurePageInstance(inputPageData);
    return sum + (page ? page.getTotalImpressions() : 0);
  }, 0);

  const clickThroughRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Count A/B tests
  let abTestCount = 0;
  for (const inputPageData of linker.pages) {
    const page = ensurePageInstance(inputPageData);
    if (!page) continue;
    abTestCount += page.getCellsWithABData().length;
  }

  // Determine popularity distribution
  const cellClickCounts = linker.pages.flatMap(inputPageData => {
    const page = ensurePageInstance(inputPageData);
    if (!page) return [];
    
    return page.cells
      .filter(cell => !LinkCell.isEmpty(cell))
      .map(cell => cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0));
  });

  const nonZeroClicks = cellClickCounts.filter(count => count > 0);
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
    popularityDistribution,
    abTestingActive: abTestCount > 0,
    abTestCount
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
      title: 'Total Impressions',
      value: summary.totalImpressions.toLocaleString(),
      description: 'Page loads tracked'
    },
    {
      title: 'Click Rate',
      value: `${summary.overallClickRate}%`,
      description: 'Overall conversion rate'
    },
    {
      title: 'Current Page Clicks',
      value: summary.currentPageClicks.toLocaleString(),
      description: 'On this page'
    }
  ];

  if (summary.topCell) {
    items.push({
      title: 'Top Cell',
      value: `"${summary.topCell.displayName}"`,
      description: `${summary.topCell.clicks} clicks`
    });
  }

  if (summary.mostActiveRow !== null) {
    items.push({
      title: 'Most Active Row',
      value: (summary.mostActiveRow + 1).toString(),
      description: `${summary.clicksPerRow[summary.mostActiveRow]} clicks`
    });
  }

  return items;
};