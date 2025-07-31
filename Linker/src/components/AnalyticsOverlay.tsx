// src/components/AnalyticsOverlay.tsx
import { Devvit } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
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
 * Full-screen analytics overlay with comprehensive statistics
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

  if (!analytics || analytics.totalClicks === 0) {
    return (
      <zstack height="100%" width="100%">
        {/* Dark overlay background */}
        <vstack
          backgroundColor="rgba(0, 0, 0, 0.9)"
          height="100%"
          width="100%"
          alignment="center middle"
          gap="large"
        >
          <vstack
            backgroundColor="#1a1a1a"
            cornerRadius="large"
            padding="large"
            gap="medium"
            maxWidth="400px"
            alignment="center middle"
          >
            <text color="white" size="xlarge" weight="bold">
              📊 Analytics Dashboard
            </text>

            <text color="#888" size="medium" alignment="center">
              No analytics data available yet
            </text>

            <text color="#666" size="small" alignment="center">
              Start tracking clicks to see detailed insights here
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

  const displayItems = formatAnalyticsForDisplay(analytics);

  return (
    <zstack height="100%" width="100%">
      {/* Dark overlay background */}
      <vstack
        backgroundColor="rgba(0, 0, 0, 0.95)"
        height="100%"
        width="100%"
        alignment="center middle"
        padding="medium"
      >
        {/* Main analytics panel */}
        <vstack
          backgroundColor="#1a1a1a"
          cornerRadius="large"
          padding="large"
          gap="large"
          maxWidth="600px"
          width="90%"
          maxHeight="90%"
        >
          {/* Header with close button */}
          <hstack width="100%">
            <hstack gap="small" alignment="start middle">
              <text color="white" size="xxlarge" weight="bold">
                📊 Analytics Dashboard
              </text>
            </hstack>

            <hstack alignment='end top' grow>
              <button
                icon="close"
                appearance="secondary"
                size="medium"
                onPress={onClose}
              />
            </hstack>
          </hstack>

          {/* Scrollable content area */}
          <vstack gap="large" grow>

            {/* Overview Cards */}
            <hstack gap="medium" width="100%">
              {/* Total Clicks Card */}
              <vstack
                backgroundColor="#2a2a2a"
                cornerRadius="medium"
                padding="medium"
                gap="small"
                grow
                alignment="center middle"
              >
                <text color="#ffd700" size="large">🎯</text>
                <text color="white" size="xlarge" weight="bold">
                  {analytics.totalClicks.toLocaleString()}
                </text>
                <text color="#888" size="small">Total Clicks</text>
              </vstack>

              {/* Current Page Card */}
              <vstack
                backgroundColor="#2a2a2a"
                cornerRadius="medium"
                padding="medium"
                gap="small"
                grow
                alignment="center middle"
              >
                <text color="#4dabf7" size="large">📄</text>
                <text color="white" size="xlarge" weight="bold">
                  {analytics.currentPageClicks}
                </text>
                <text color="#888" size="small">Current Page</text>
              </vstack>

              {/* Average Card */}
              <vstack
                backgroundColor="#2a2a2a"
                cornerRadius="medium"
                padding="medium"
                gap="small"
                grow
                alignment="center middle"
              >
                <text color="#51cf66" size="large">📊</text>
                <text color="white" size="xlarge" weight="bold">
                  {analytics.avgClicksPerLink}
                </text>
                <text color="#888" size="small">Avg per Link</text>
              </vstack>
            </hstack>

            {/* Top Performer Section */}
            {analytics.topLink && (
              <vstack gap="small">
                <text color="white" size="large" weight="bold">
                  🏆 Top Performer
                </text>
                <hstack
                  backgroundColor="rgba(255, 215, 0, 0.1)"
                  cornerRadius="medium"
                  padding="medium"
                  gap="medium"
                  alignment="start middle"
                  border="thin"
                  borderColor="#ffd700"
                >
                  <text color="#ffd700" size="xxlarge">🌟</text>
                  <vstack gap="small">
                    <text color="white" size="large" weight="bold">
                      "{analytics.topLink.title}"
                    </text>
                    <text color="#ffd700" size="medium">
                      {analytics.topLink.clicks} clicks • Top performer across all links
                    </text>
                  </vstack>
                </hstack>
              </vstack>
            )}

            {/* Engagement Metrics */}
            {engagement && (
              <vstack gap="small">
                <text color="white" size="large" weight="bold">
                  🎯 Engagement Analysis
                </text>
                <vstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="medium"
                  padding="medium"
                  gap="medium"
                >
                  <hstack gap="large" alignment="start top">
                    <vstack gap="small" grow>
                      <text color="#888" size="small" weight="bold">CLICK RATE</text>
                      <text color="white" size="large" weight="bold">
                        {engagement.clickThroughRate}%
                      </text>
                    </vstack>

                    <vstack gap="small" grow>
                      <text color="#888" size="small" weight="bold">DISTRIBUTION</text>
                      <text color="white" size="medium">
                        {engagement.popularityDistribution === 'even' && '📊 Even spread'}
                        {engagement.popularityDistribution === 'concentrated' && '🎯 Concentrated'}
                        {engagement.popularityDistribution === 'sparse' && '📈 Mixed activity'}
                      </text>
                    </vstack>
                  </hstack>
                </vstack>
              </vstack>
            )}

            {/* Grid Analysis */}
            {analytics.currentPageClicks > 0 && (
              <vstack gap="small">
                <text color="white" size="large" weight="bold">
                  📄 Grid Performance
                </text>
                <hstack gap="medium">
                  {/* Rows */}
                  <vstack
                    backgroundColor="#2a2a2a"
                    cornerRadius="medium"
                    padding="medium"
                    gap="small"
                    grow
                  >
                    <text color="#888" size="small" weight="bold">ROWS</text>
                    {analytics.clicksPerRow.map((rowClicks, index) => (
                      <hstack key={index.toString()} gap="small" width="100%">
                        <text color="white" size="small">
                          Row {index + 1}
                        </text>
                        <hstack gap="small" alignment="center middle">
                          <text color="#4dabf7" size="small">
                            {rowClicks} clicks
                          </text>
                          {index === analytics.mostActiveRow && (
                            <text color="#ffd700" size="small">🏆</text>
                          )}
                        </hstack>
                      </hstack>
                    ))}
                  </vstack>

                  {/* Columns */}
                  <vstack
                    backgroundColor="#2a2a2a"
                    cornerRadius="medium"
                    padding="medium"
                    gap="small"
                    grow
                  >
                    <text color="#888" size="small" weight="bold">COLUMNS</text>
                    {analytics.clicksPerColumn.map((colClicks, index) => (
                      <hstack key={index.toString()} gap="small" width="100%">
                        <text color="white" size="small">
                          Col {index + 1}
                        </text>
                        <hstack gap="small" alignment="center middle">
                          <text color="#51cf66" size="small">
                            {colClicks} clicks
                          </text>
                          {index === analytics.mostActiveColumn && (
                            <text color="#ffd700" size="small">🏆</text>
                          )}
                        </hstack>
                      </hstack>
                    ))}
                  </vstack>
                </hstack>
              </vstack>
            )}

            {/* Multi-page Analytics */}
            {allPagesAnalytics.length > 1 && (
              <vstack gap="small">
                <text color="white" size="large" weight="bold">
                  📚 All Pages Overview
                </text>
                <vstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="medium"
                  padding="medium"
                  gap="small"
                >
                  {allPagesAnalytics.map((pageAnalytics, index) => (
                    <hstack
                      key={index.toString()}
                      gap="medium"
                      width="100%"
                      padding="small"
                      backgroundColor={index === currentPageIndex ? "rgba(77, 171, 247, 0.1)" : "transparent"}
                      cornerRadius="small"
                    >
                      <hstack gap="small" alignment="center middle">
                        {index === currentPageIndex && (
                          <text color="#4dabf7" size="small">👁️</text>
                        )}
                        <text
                          color={index === currentPageIndex ? "#4dabf7" : "white"}
                          size="medium"
                          weight={index === currentPageIndex ? "bold" : "regular"}
                        >
                          {pageAnalytics.pageTitle}
                        </text>
                      </hstack>

                      <hstack gap="large">
                        <text color="#888" size="small">
                          {pageAnalytics.totalClicks} clicks
                        </text>
                        <text color="#666" size="small">
                          {pageAnalytics.linkCount} links
                        </text>
                        <text color="#555" size="small">
                          {pageAnalytics.avgClicksPerLink} avg
                        </text>
                      </hstack>
                    </hstack>
                  ))}
                </vstack>
              </vstack>
            )}

            {/* Performance Insights */}
            {engagement && (
              <vstack gap="small">
                <text color="white" size="large" weight="bold">
                  💡 Performance Insights
                </text>
                <vstack
                  backgroundColor="#2a2a2a"
                  cornerRadius="medium"
                  padding="medium"
                  gap="small"
                >

                  {engagement.popularityDistribution === 'concentrated' && (
                    <hstack gap="small" alignment="start middle">
                      <text color="#ffd700" size="medium">🎯</text>
                      <text color="white" size="small">
                        Few links are getting most clicks - consider promoting others
                      </text>
                    </hstack>
                  )}

                  {analytics.mostActiveRow !== null && analytics.clicksPerRow[analytics.mostActiveRow] > analytics.avgClicksPerLink * 2 && (
                    <hstack gap="small" alignment="start middle">
                      <text color="#51cf66" size="medium">🏆</text>
                      <text color="white" size="small">
                        Row {(analytics.mostActiveRow + 1)} is performing well - consider similar positioning
                      </text>
                    </hstack>
                  )}

                  {analytics.avgClicksPerLink > 5 && (
                    <hstack gap="small" alignment="start middle">
                      <text color="#51cf66" size="medium">🎉</text>
                      <text color="white" size="small">
                        Great engagement! Your links are performing well
                      </text>
                    </hstack>
                  )}

                </vstack>
              </vstack>
            )}

          </vstack>

          {/* Footer */}
          <hstack alignment="center" width="100%">
            <button
              appearance="primary"
              size="large"
              onPress={onClose}
            >
              Close Analytics
            </button>
          </hstack>

        </vstack>
      </vstack>
    </zstack>
  );
};