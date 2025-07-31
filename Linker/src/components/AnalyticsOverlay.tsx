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
          maxWidth="550px"
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
                {analytics.totalClicks.toLocaleString()}
              </text>
              <text color="#888" size="xsmall">Total</text>
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
                {analytics.currentPageClicks}
              </text>
              <text color="#888" size="xsmall">This Page</text>
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
                {analytics.avgClicksPerLink}
              </text>
              <text color="#888" size="xsmall">Avg/Link</text>
            </vstack>
          </hstack>

          {/* Top Performer - Compact */}
          {analytics.topLink && (
            <hstack
              backgroundColor="rgba(255, 215, 0, 0.1)"
              cornerRadius="small"
              padding="small"
              gap="small"
              alignment="start middle"
              border="thin"
              borderColor="#ffd700"
            >
              <text color="#ffd700" size="large">🏆</text>
              <vstack gap="small">
                <text color="white" size="medium" weight="bold">
                  "{analytics.topLink.title}"
                </text>
                <text color="#ffd700" size="small">
                  {analytics.topLink.clicks} clicks • Top performer
                </text>
              </vstack>
            </hstack>
          )}

          {/* Multi-page Overview - Compact */}
          {allPagesAnalytics.length > 1 && (
            <vstack gap="small">
              <text color="#888" size="small" weight="bold">📚 ALL PAGES</text>
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