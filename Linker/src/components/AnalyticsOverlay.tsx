// src/components/AnalyticsOverlay.tsx
import { Devvit } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';
import {
  getDetailedAnalyticsSummary,
  getAllPagesAnalytics,
  getEngagementMetrics,
  formatAnalyticsForDisplay,
  DetailedAnalyticsSummary
} from '../utils/analyticsUtils.js';

interface AnalyticsOverlayProps {
  linker: Linker | null;
  currentPageIndex: number;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Get all active links with their stats, sorted by clicks
 */
const getAllActiveLinksWithStats = (linker: Linker | null): Array<{
  title: string;
  clicks: number;
  pageTitle: string;
  pageIndex: number;
}> => {
  if (!linker || !linker.pages) return [];

  const activeLinks: Array<{
    title: string;
    clicks: number;
    pageTitle: string;
    pageIndex: number;
  }> = [];

  linker.pages.forEach((page, pageIndex) => {
    page.links.forEach((link) => {
      const hasClicks = (link.clickCount || 0) > 0;
      const hasContent = !Link.isEmpty(link) && link.uri;
      
      // Include links that either have clicks OR have content
      if (hasClicks || hasContent) {
        // Create a display title - use actual title, URI, or fallback
        let displayTitle = link.title || '';
        if (!displayTitle && link.uri) {
          // Extract domain from URI for display
          try {
            const url = new URL(link.uri.startsWith('http') ? link.uri : `https://${link.uri}`);
            displayTitle = url.hostname;
          } catch {
            displayTitle = link.uri.length > 25 ? `${link.uri.substring(0, 25)}...` : link.uri;
          }
        }
        if (!displayTitle) {
          displayTitle = 'Untitled Link';
        }

        activeLinks.push({
          title: displayTitle,
          clicks: link.clickCount || 0,
          pageTitle: page.title || `Page ${pageIndex + 1}`,
          pageIndex
        });
      }
    });
  });

  // Sort by clicks (descending), then by title (ascending)
  return activeLinks.sort((a, b) => {
    if (b.clicks !== a.clicks) {
      return b.clicks - a.clicks;
    }
    return a.title.localeCompare(b.title);
  });
};

/**
 * Compact full-screen analytics overlay optimized for limited space
 */
export const AnalyticsOverlay: Devvit.BlockComponent<AnalyticsOverlayProps> = ({
  linker,
  currentPageIndex,
  isVisible,
  onClose
}) => {
  if (!isVisible || !linker) {
    return null;
  }

  const analytics = getDetailedAnalyticsSummary(linker, currentPageIndex);
  const engagement = getEngagementMetrics(linker);
  const allPagesAnalytics = getAllPagesAnalytics(linker);
  const allActiveLinks = getAllActiveLinksWithStats(linker);

  if (!analytics || analytics.totalClicks === 0) {
    return (
      <zstack height="100%" width="100%">
        <vstack
          backgroundColor="rgba(0, 0, 0, 0.9)"
          height="100%"
          width="100%"
          alignment="center middle"
          gap="medium"
        >
          <vstack
            backgroundColor="#1a1a1a"
            cornerRadius="large"
            padding="large"
            gap="medium"
            maxWidth="350px"
            alignment="center middle"
          >
            <text color="white" size="large" weight="bold">
              📊 Analytics Dashboard
            </text>
            <text color="#888" size="small" alignment="center">
              No analytics data available yet
            </text>
            <text color="#666" size="xsmall" alignment="center">
              Start tracking clicks to see insights here
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

  // Split links into two columns (max 10 per column)
  const maxLinksPerColumn = 5;
  const maxTotalLinks = maxLinksPerColumn * 2;
  const displayLinks = allActiveLinks.slice(0, maxTotalLinks);
  const column1 = displayLinks.slice(0, maxLinksPerColumn);
  const column2 = displayLinks.slice(maxLinksPerColumn, maxTotalLinks);

  return (
    <zstack height="100%" width="100%">
      <vstack
        backgroundColor="rgba(0, 0, 0, 0.95)"
        height="100%"
        width="100%"
        alignment="center middle"
        padding="medium"
      >
        <vstack
          backgroundColor="#1a1a1a"
          cornerRadius="large"
          padding="medium"
          gap="medium"
          maxWidth="600px"
          width="90%"
          height="85%"
        >
          {/* Compact Header */}
          <hstack width="100%" alignment="center middle">
            <text color="white" size="large" weight="bold">
              📊 Analytics Dashboard
            </text>
            <hstack alignment='end top' grow>
              <button
                icon="close"
                appearance="secondary"
                size="small"
                onPress={onClose}
              />
            </hstack>
          </hstack>

          {/* Compact Overview - Single Row */}
          <hstack gap="small" width="100%">
            <vstack
              backgroundColor="#2a2a2a"
              cornerRadius="small"
              padding="small"
              gap="small"
              grow
              alignment="center middle"
            >
              <text color="#ffd700" size="medium">🎯</text>
              <text color="white" size="large" weight="bold">
                Total: {analytics.totalClicks.toLocaleString()}
              </text>
            </vstack>

            <vstack
              backgroundColor="#2a2a2a"
              cornerRadius="small"
              padding="small"
              gap="small"
              grow
              alignment="center middle"
            >
              <text color="#4dabf7" size="medium">📄</text>
              <text color="white" size="large" weight="bold">
                This Page: {analytics.currentPageClicks}
              </text>
            </vstack>

            <vstack
              backgroundColor="#2a2a2a"
              cornerRadius="small"
              padding="small"
              gap="small"
              grow
              alignment="center middle"
            >
              <text color="#51cf66" size="medium">📊</text>
              <text color="white" size="large" weight="bold">
                Avg/Link: {analytics.avgClicksPerLink}
              </text>
            </vstack>
          </hstack>

          {/* All Links Performance - Two Columns */}
          {displayLinks.length > 0 && (
            <vstack gap="small" width="100%" grow>
              <text color="#888" size="small" weight="bold">📋 ALL LINKS PERFORMANCE</text>
              
              <hstack gap="small" width="100%" grow alignment="start top">
                {/* Column 1 */}
                <vstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="small"
                  padding="small"
                  gap="small"
                  width="50%"
                  height="100%"
                  alignment="start top"
                >
                  {column1.map((link, index) => (
                    <hstack
                      key={`col1-${index}`}
                      gap="none"
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
                        <text 
                          color="white" 
                          size="small" 
                          weight={index === 0 ? "bold" : "regular"}
                        >
                          {link.title.length > 20 ? `${link.title.substring(0, 20)}...` : link.title}
                        </text>
                        <text color="#888" size="xsmall">
                          {link.clicks} clicks
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
                    width="50%"
                    height="100%"
                    alignment="start top"
                  >
                    {column2.map((link, index) => (
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
                          {maxLinksPerColumn + index + 1}.
                        </text>
                        <vstack gap="none" grow>
                          <text color="white" size="small">
                            {link.title.length > 20 ? `${link.title.substring(0, 20)}...` : link.title}
                          </text>
                          <text color="#888" size="xsmall">
                            {link.clicks} clicks
                            {allPagesAnalytics.length > 1 && (
                              <text color="#666"> • {link.pageTitle}</text>
                            )}
                          </text>
                        </vstack>
                      </hstack>
                    ))}
                  </vstack>
                )}
              </hstack>

              {/* Show total if there are more links */}
              {allActiveLinks.length > maxTotalLinks && (
                <text color="#666" size="xsmall" alignment="center">
                  Showing top {maxTotalLinks} of {allActiveLinks.length} active links
                </text>
              )}
            </vstack>
          )}

          {/* Multi-page Overview - Compact (only show if multiple pages) */}
          {allPagesAnalytics.length > 1 && (
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
                      {pageAnalytics.totalClicks} clicks
                    </text>
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