// src/components/AnalyticsOverlay.tsx (Enhanced with variant analytics)
import { Devvit, useState } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import {
  getDetailedAnalyticsSummary,
  getAllPagesAnalytics,
  getEngagementMetrics,
  getVariantAnalytics,
  formatAnalyticsForDisplay,
  DetailedAnalyticsSummary,
  VariantAnalytics
} from '../utils/analyticsUtils.js';

interface AnalyticsOverlayProps {
  linker: Linker | null;
  currentPageIndex: number;
  isVisible: boolean;
  onClose: () => void;
}

type AnalyticsView = 'overview' | 'variants';

/**
 * Get all active cells with their stats, sorted by clicks
 */
const getAllActiveCellsWithStats = (linker: Linker | null): Array<{
  displayName: string;
  clicks: number;
  impressions: number;
  clickRate: number;
  pageTitle: string;
  pageIndex: number;
  hasRotation: boolean;
  variantCount: number;
}> => {
  if (!linker || !linker.pages) return [];

  const activeCells: Array<{
    displayName: string;
    clicks: number;
    impressions: number;
    clickRate: number;
    pageTitle: string;
    pageIndex: number;
    hasRotation: boolean;
    variantCount: number;
  }> = [];

  linker.pages.forEach((page, pageIndex) => {
    page.cells.forEach((cell) => {
      const hasClicks = cell.links.some(link => (link.clickCount || 0) > 0);
      const hasContent = !LinkCell.isEmpty(cell);

      // Include cells that either have clicks OR have content
      if (hasClicks || hasContent) {
        const totalClicks = cell.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
        const totalImpressions = cell.impressionCount || 0;
        const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const activeVariants = cell.links.filter(link => !Link.isEmpty(link));

        let displayName = cell.displayName || '';
        if (!displayName && activeVariants.length > 0) {
          // Use first variant's title as fallback
          displayName = activeVariants[0].title || 'Untitled Cell';
        }
        if (!displayName) {
          displayName = 'Untitled Cell';
        }

        activeCells.push({
          displayName,
          clicks: totalClicks,
          impressions: totalImpressions,
          clickRate: Math.round(clickRate * 100) / 100,
          pageTitle: page.title || `Page ${pageIndex + 1}`,
          pageIndex,
          hasRotation: cell.rotationEnabled && cell.links.length > 1,
          variantCount: activeVariants.length
        });
      }
    });
  });

  // Sort by clicks (descending), then by click rate (descending)
  return activeCells.sort((a, b) => {
    if (b.clicks !== a.clicks) {
      return b.clicks - a.clicks;
    }
    return b.clickRate - a.clickRate;
  });
};

/**
 * Enhanced analytics overlay with variant analytics support
 */
export const AnalyticsOverlay: Devvit.BlockComponent<AnalyticsOverlayProps> = ({
  linker,
  currentPageIndex,
  isVisible,
  onClose
}) => {
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('overview');
  const [variantsPage, setVariantsPage] = useState(0);

  if (!isVisible || !linker) {
    return null;
  }

  const analytics = getDetailedAnalyticsSummary(linker, currentPageIndex);
  const engagement = getEngagementMetrics(linker);
  const allPagesAnalytics = getAllPagesAnalytics(linker);
  const variantAnalytics = getVariantAnalytics(linker);
  const allActiveCells = getAllActiveCellsWithStats(linker);

  if (!analytics || analytics.totalClicks === 0) {
    return (
      <zstack height="100%" width="100%">
        <vstack
          backgroundColor="rgba(0, 0, 0, 0.9)"
          height="100%"
          width="100%"
          alignment="center middle"
          gap="small"
        >
          <vstack
            backgroundColor="#1a1a1a"
            height="100%"
            width="100%"
            cornerRadius="large"
            padding="small"
            gap="small"
            alignment="center middle"
          >
            <text color="white" size="large" weight="bold">
              📊 Analytics Dashboard
            </text>
            <text color="#888" size="small" alignment="center">
              No analytics data available yet
            </text>
            <text color="#666" size="xsmall" alignment="center">
              Start tracking clicks and impressions to see insights here
            </text>
            <button
              appearance="primary"
              size="medium"
              onPress={onClose}
            >
              Close
            </button>
          </vstack>
        </vstack>
      </zstack>
    );
  }

  // Split cells into two columns (max 4 per column)
  const maxCellsPerColumn = 4;
  const maxTotalCells = maxCellsPerColumn * 3;
  const displayCells = allActiveCells.slice(0, maxTotalCells);
  const column1 = displayCells.slice(0, maxCellsPerColumn);
  const column2 = displayCells.slice(maxCellsPerColumn, maxCellsPerColumn);
  const column3 = displayCells.slice(maxCellsPerColumn * 2, maxTotalCells);

  const VARIANTS_PER_PAGE = 3;
  const totalVariantPages = Math.ceil(variantAnalytics.length / VARIANTS_PER_PAGE);
  const startIndex = variantsPage * VARIANTS_PER_PAGE;
  const endIndex = Math.min(startIndex + VARIANTS_PER_PAGE, variantAnalytics.length);
  const currentVariants = variantAnalytics.slice(startIndex, endIndex);

  const handlePreviousVariants = () => {
    setVariantsPage(Math.max(0, variantsPage - 1));
  };

  const handleNextVariants = () => {
    setVariantsPage(Math.min(totalVariantPages - 1, variantsPage + 1));
  };

  // Reset variants page when switching views
  const handleViewChange = (view: AnalyticsView) => {
    if (view !== analyticsView) {
      setAnalyticsView(view);
      if (view === 'variants') {
        setVariantsPage(0); // Reset to first page
      }
    }
  };

  return (
    <zstack height="100%" width="100%">
      <vstack
        backgroundColor="rgba(0, 0, 0, 0.95)"
        height="100%"
        width="100%"
        alignment="center middle"
        padding="small"
      >
        <vstack
          backgroundColor="#1a1a1a"
          cornerRadius="large"
          padding="small"
          gap="small"
          height="100%"
          width="100%"
        >
          {/* Header with view toggle */}
          <hstack width="100%" alignment="center middle" gap="medium">
            <text color="white" size="large" weight="bold">
              📊 Analytics Dashboard
            </text>

            <hstack gap="small" grow alignment="center middle">
              <button
                appearance={analyticsView === 'overview' ? 'primary' : 'secondary'}
                size="small"
                onPress={() => setAnalyticsView('overview')}
              >
                Overview
              </button>
              <button
                appearance={analyticsView === 'variants' ? 'primary' : 'secondary'}
                size="small"
                onPress={() => setAnalyticsView('variants')}
                disabled={variantAnalytics.length === 0}
              >
                A/B Tests {variantAnalytics.length > 0 ? `(${variantAnalytics.length})` : ''}
              </button>
            </hstack>

            <hstack alignment='end top'>
              <button
                icon="close"
                appearance="secondary"
                size="small"
                onPress={onClose}
              />
            </hstack>
          </hstack>

          {analyticsView === 'overview' && (
            <>
              {/* Overview Stats */}
              <hstack gap="small" width="100%">
                <hstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="small"
                  padding="small"
                  gap="small"
                  grow
                  alignment="center middle"
                >
                  <text color="#ffd700" size="medium">🎯</text>
                  <text color="white" size="large" weight="bold">
                    {analytics.totalClicks.toLocaleString()}
                  </text>
                  <text color="#888" size="small">Total Clicks</text>
                </hstack>

                <hstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="small"
                  padding="small"
                  gap="small"
                  grow
                  alignment="center middle"
                >
                  <text color="#4dabf7" size="medium">👁️</text>
                  <text color="white" size="large" weight="bold">
                    {analytics.totalImpressions.toLocaleString()}
                  </text>
                  <text color="#888" size="small">Impressions</text>
                </hstack>

                <hstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="small"
                  padding="small"
                  gap="small"
                  grow
                  alignment="center middle"
                >
                  <text color="#51cf66" size="medium">📈</text>
                  <text color="white" size="large" weight="bold">
                    {analytics.overallClickRate}%
                  </text>
                  <text color="#888" size="small">Click Rate</text>
                </hstack>

                {engagement?.abTestingActive ? (
                  <hstack
                    backgroundColor="#2a2a2a"
                    cornerRadius="small"
                    padding="small"
                    gap="small"
                    grow
                    alignment="center middle"
                  >
                    <text color="#9775fa" size="medium">🧪</text>
                    <text color="white" size="large" weight="bold">
                      {engagement.abTestCount}
                    </text>
                    <text color="#888" size="small">A/B Tests</text>
                  </hstack>
                ) : null}
              </hstack>

              {/* All Cells Performance - Three Columns */}
              {displayCells.length > 0 && (
                <vstack gap="small" width="100%" grow>
                  <text color="#888" size="small" weight="bold">📋 ALL CELLS PERFORMANCE</text>

                  <hstack gap="small" width="100%" grow alignment="start top">
                    {/* Column 1 */}
                    <vstack
                      backgroundColor="#2a2a2a"
                      cornerRadius="small"
                      padding="small"
                      gap="small"
                      width={column2.length > 0 ? (column3.length > 0 ? "33%" : "50%") : "100%"}
                      height="100%"
                      alignment="start top"
                    >
                      {column1.map((cell, index) => (
                        <hstack
                          key={`col1-${index}`}
                          gap="small"
                          alignment="start middle"
                          width="100%"
                          padding="xsmall"
                          backgroundColor={index === 0 ? "rgba(255, 215, 0, 0.1)" : "transparent"}
                          cornerRadius="small"
                        >
                          <text
                            color={index === 0 ? "#ffd700" : "#4dabf7"}
                            size="small"
                            minWidth="24px"
                            weight="bold"
                          >
                            {index === 0 ? "🏆" : `${index + 1}.`}
                          </text>
                          <vstack gap="none" grow>
                            <hstack gap="small" alignment="start middle">
                              <text
                                color="white"
                                size="small"
                                weight={index === 0 ? "bold" : "regular"}
                              >
                                {cell.displayName.length > 15 ? `${cell.displayName.substring(0, 15)}...` : cell.displayName}
                              </text>
                              {cell.hasRotation && (
                                <text color="#9775fa" size="small">🔄</text>
                              )}
                            </hstack>
                            <text color="#888" size="xsmall">
                              {cell.clicks} clicks • {cell.clickRate}% rate
                              {cell.impressions > 0 && ` • ${cell.impressions} views`}
                            </text>
                          </vstack>
                        </hstack>
                      ))}
                    </vstack>

                    {/* Column 2 */}
                    {column2.length > 0 && (
                      <vstack
                        backgroundColor="#2a2a2a"
                        cornerRadius="small"
                        padding="small"
                        gap="small"
                        width={column3.length > 0 ? "33%" : "50%"}
                        height="100%"
                        alignment="start top"
                      >
                        {column2.map((cell, index) => (
                          <hstack
                            key={`col2-${index}`}
                            gap="small"
                            alignment="start middle"
                            width="100%"
                            padding="xsmall"
                            cornerRadius="small"
                          >
                            <text
                              color="#4dabf7"
                              size="small"
                              minWidth="24px"
                              weight="bold"
                            >
                              {maxCellsPerColumn + index + 1}.
                            </text>
                            <vstack gap="none" grow>
                              <hstack gap="small" alignment="start middle">
                                <text color="white" size="small">
                                  {cell.displayName.length > 15 ? `${cell.displayName.substring(0, 15)}...` : cell.displayName}
                                </text>
                                {cell.hasRotation && (
                                  <text color="#9775fa" size="small">🔄</text>
                                )}
                              </hstack>
                              <text color="#888" size="xsmall">
                                {cell.clicks} clicks • {cell.clickRate}% rate
                                {allPagesAnalytics.length > 1 && (
                                  <text color="#666"> • {cell.pageTitle}</text>
                                )}
                              </text>
                            </vstack>
                          </hstack>
                        ))}
                      </vstack>
                    )}

                    {/* Column 3 */}
                    {column3.length > 0 && (
                      <vstack
                        backgroundColor="#2a2a2a"
                        cornerRadius="small"
                        padding="small"
                        gap="small"
                        width="33%"
                        height="100%"
                        alignment="start top"
                      >
                        {column3.map((cell, index) => (
                          <hstack
                            key={`col2-${index}`}
                            gap="small"
                            alignment="start middle"
                            width="100%"
                            padding="xsmall"
                            cornerRadius="small"
                          >
                            <text
                              color="#4dabf7"
                              size="small"
                              minWidth="24px"
                              weight="bold"
                            >
                              {maxCellsPerColumn + index + 1}.
                            </text>
                            <vstack gap="none" grow>
                              <hstack gap="small" alignment="start middle">
                                <text color="white" size="small">
                                  {cell.displayName.length > 15 ? `${cell.displayName.substring(0, 15)}...` : cell.displayName}
                                </text>
                                {cell.hasRotation && (
                                  <text color="#9775fa" size="small">🔄</text>
                                )}
                              </hstack>
                              <text color="#888" size="xsmall">
                                {cell.clicks} clicks • {cell.clickRate}% rate
                                {allPagesAnalytics.length > 1 && (
                                  <text color="#666"> • {cell.pageTitle}</text>
                                )}
                              </text>
                            </vstack>
                          </hstack>
                        ))}
                      </vstack>
                    )}
                  </hstack>

                  {/* Show total if there are more cells */}
                  {allActiveCells.length > maxTotalCells && (
                    <text color="#666" size="xsmall" alignment="center">
                      Showing top {maxTotalCells} of {allActiveCells.length} active cells
                    </text>
                  )}
                </vstack>
              )}
            </>
          )}


          {analyticsView === 'variants' && (
            <vstack gap="small" width="100%" grow>
              {/* NEW: A/B Test Header with Pagination Controls */}
              <hstack width="100%" alignment="start middle" gap="medium">
                <text color="#888" size="small" weight="bold">🧪 A/B TEST RESULTS</text>

                {totalVariantPages > 1 && (
                  <hstack gap="small" alignment="end middle" grow>
                    <button
                      icon="left"
                      appearance="secondary"
                      size="small"
                      disabled={variantsPage === 0}
                      onPress={handlePreviousVariants}
                    />

                    <text color="#888" size="small">
                      Page {variantsPage + 1} of {totalVariantPages}
                    </text>

                    <button
                      icon="right"
                      appearance="secondary"
                      size="small"
                      disabled={variantsPage === totalVariantPages - 1}
                      onPress={handleNextVariants}
                    />
                  </hstack>
                )}
              </hstack>

              {variantAnalytics.length === 0 ? (
                <vstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="small"
                  padding="large"
                  gap="small"
                  alignment="center middle"
                >
                  <text color="#888" size="medium">🧪</text>
                  <text color="white" size="medium" weight="bold">No A/B Tests Running</text>
                  <text color="#666" size="small" alignment="center">
                    Enable rotation on cells with multiple variants to start A/B testing
                  </text>
                </vstack>
              ) : (
                <vstack gap="small" width="100%" grow>
                  {/* NEW: Show current page of variants */}
                  {currentVariants.map((cellAnalytics, cellIndex) => (
                    <vstack
                      key={cellAnalytics.cellId}
                      backgroundColor="#2a2a2a"
                      cornerRadius="small"
                      padding="small"
                      gap="small"
                      width="100%"
                    >
                      {/* Cell header */}
                      <hstack gap="small" alignment="start middle" width="100%">
                        <text color="white" size="medium" weight="bold">
                          {cellAnalytics.cellDisplayName}
                        </text>
                        {cellAnalytics.hasSignificantDifference && (
                          <text color="#51cf66" size="small">✅ Significant</text>
                        )}
                        <hstack grow alignment="end middle">
                          <text color="#888" size="small">
                            {cellAnalytics.overallClickRate}% overall
                          </text>
                        </hstack>
                      </hstack>

                      {/* Variants */}
                      <vstack gap="small" width="100%">
                        {cellAnalytics.variants.map((variant, variantIndex) => (
                          <hstack
                            key={variant.variantId}
                            gap="small"
                            alignment="start middle"
                            width="100%"
                            padding="xsmall"
                            backgroundColor={
                              cellAnalytics.bestPerforming?.variantId === variant.variantId
                                ? "rgba(81, 207, 102, 0.1)"
                                : "transparent"
                            }
                            cornerRadius="small"
                          >
                            <text color="#4dabf7" size="small" minWidth="60px">
                              Variant {variantIndex + 1}:
                            </text>
                            <vstack gap="none" grow>
                              <text color="white" size="small">
                                {variant.title.length > 20 ? `${variant.title.substring(0, 20)}...` : variant.title}
                              </text>
                              <text color="#888" size="xsmall">
                                {variant.clicks}/{variant.impressions} ({variant.clickRate}%) •
                                Weight: {variant.weight} •
                                {variant.actualShare}% share
                              </text>
                            </vstack>
                            {cellAnalytics.bestPerforming?.variantId === variant.variantId && (
                              <text color="#51cf66" size="small">🏆</text>
                            )}
                          </hstack>
                        ))}
                      </vstack>
                    </vstack>
                  ))}

                  {/* NEW: Pagination summary */}
                  {totalVariantPages > 1 && (
                    <hstack width="100%" alignment="center middle" gap="small">
                      <text color="#666" size="xsmall">
                        Showing {startIndex + 1}-{endIndex} of {variantAnalytics.length} A/B tests
                      </text>
                    </hstack>
                  )}
                </vstack>
              )}
            </vstack>
          )}

          {/* Multi-page Overview - Compact (only show if multiple pages) */}
          {allPagesAnalytics.length > 1 && analyticsView === 'overview' && (
            <vstack gap="small">
              <text color="#888" size="small" weight="bold">📚 PAGES OVERVIEW</text>
              <hstack gap="small" width="100%">
                {allPagesAnalytics.slice(0, 3).map((pageAnalytics, index) => (
                  <vstack
                    key={index.toString()}
                    backgroundColor={index === currentPageIndex ? "rgba(77, 171, 247, 0.2)" : "#2a2a2a"}
                    cornerRadius="small"
                    padding="small"
                    gap="small"
                    grow
                    alignment="center middle"
                  >
                    {index === currentPageIndex && (
                      <text color="#4dabf7" size="small">👁️</text>
                    )}
                    <text
                      color={index === currentPageIndex ? "#4dabf7" : "white"}
                      size="small"
                      weight={index === currentPageIndex ? "bold" : "regular"}
                    >
                      {pageAnalytics.pageTitle}
                    </text>
                    <text color="#888" size="xsmall">
                      {pageAnalytics.totalClicks} clicks • {pageAnalytics.clickRate}%
                    </text>
                    {pageAnalytics.abTestCount > 0 && (
                      <text color="#9775fa" size="xsmall">
                        🧪 {pageAnalytics.abTestCount} tests
                      </text>
                    )}
                  </vstack>
                ))}
                {allPagesAnalytics.length > 3 && (
                  <vstack
                    backgroundColor="#2a2a2a"
                    cornerRadius="small"
                    padding="small"
                    alignment="center middle"
                    grow
                  >
                    <text color="#888" size="small">
                      +{allPagesAnalytics.length - 3} more
                    </text>
                  </vstack>
                )}
              </hstack>
            </vstack>
          )}
        </vstack>
      </vstack>
    </zstack>
  );
};