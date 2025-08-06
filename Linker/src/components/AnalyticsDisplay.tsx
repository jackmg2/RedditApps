import { Devvit } from '@devvit/public-api';
import { Linker } from '../types/linker.js';
import { 
  getDetailedAnalyticsSummary, 
  getAllPagesAnalytics, 
  getEngagementMetrics,
  formatAnalyticsForDisplay,
  DetailedAnalyticsSummary 
} from '../utils/analyticsUtils.js';

interface AnalyticsDisplayProps {
  linker: Linker | null;
  currentPageIndex: number;
  foregroundColor: string;
  showDetailed?: boolean;
}

export const AnalyticsDisplay: Devvit.BlockComponent<AnalyticsDisplayProps> = ({
  linker,
  currentPageIndex,
  foregroundColor,
  showDetailed = false
}) => {
  if (!linker) {
    return null;
  }

  const analytics = getDetailedAnalyticsSummary(linker, currentPageIndex);
  const engagement = getEngagementMetrics(linker);
  const allPagesAnalytics = getAllPagesAnalytics(linker);

  if (!analytics || analytics.totalClicks === 0) {
    return (
      <vstack gap="small" padding="small">
        <text color={foregroundColor} size="medium" weight="bold">
          📊 Analytics
        </text>
        <text color={foregroundColor} size="small">
          No clicks recorded yet
        </text>
      </vstack>
    );
  }

  const displayItems = formatAnalyticsForDisplay(analytics);

  return (
    <vstack gap="small" padding="small">
      {/* Header */}
      <hstack gap="small" alignment="start middle">
        <text color={foregroundColor} size="medium" weight="bold">
          📊 Analytics Dashboard
        </text>
      </hstack>

      {/* Quick Stats Grid */}
      <vstack gap="small">
        <text color={foregroundColor} size="small" weight="bold">
          📈 Quick Stats
        </text>
        <vstack gap="small">
          {displayItems.slice(0, 4).map((item, index) => (
            <hstack key={index.toString()} gap="medium" alignment="start middle">
              <text color={foregroundColor} size="small" weight="bold" minWidth="120px">
                {item.title}:
              </text>
              <text color={foregroundColor} size="small">
                {item.value}
              </text>
              {item.description ? (
                <text color={foregroundColor} size="small" style="body">
                  ({item.description})
                </text>
              ) : null}
            </hstack>
          ))}
        </vstack>
      </vstack>

      {/* Engagement Metrics */}
      {engagement && (
        <vstack gap="small">
          <text color={foregroundColor} size="small" weight="bold">
            🎯 Engagement
          </text>
          <vstack gap="small">
            <hstack gap="medium" alignment="start middle">
              <text color={foregroundColor} size="small" weight="bold" minWidth="120px">
                Click Rate:
              </text>
              <text color={foregroundColor} size="small">
                {engagement.clickThroughRate}%
              </text>
            </hstack>
            <hstack gap="medium" alignment="start middle">
              <text color={foregroundColor} size="small" weight="bold" minWidth="120px">
                Distribution:
              </text>
              <text color={foregroundColor} size="small">
                {engagement.popularityDistribution === 'even' && '📊 Even spread'}
                {engagement.popularityDistribution === 'concentrated' && '🎯 Concentrated'}
                {engagement.popularityDistribution === 'sparse' && '📈 Mixed activity'}
              </text>
            </hstack>
          </vstack>
        </vstack>
      )}

      {/* Top Link Highlight */}
      {analytics.topLink && (
        <vstack gap="small">
          <text color={foregroundColor} size="small" weight="bold">
            🏆 Top Performer
          </text>
          <hstack
            backgroundColor="rgba(255, 215, 0, 0.1)"
            cornerRadius="medium"
            padding="small"
            gap="small"
            alignment="start middle"
          >
            <text color="#FFD700" size="large">🌟</text>
            <vstack gap="small">
              <text color={foregroundColor} size="small" weight="bold">
                "{analytics.topLink.title}"
              </text>
              <text color={foregroundColor} size="xsmall">
                {analytics.topLink.clicks} clicks
              </text>
            </vstack>
          </hstack>
        </vstack>
      )}

      {/* Current Page Breakdown */}
      {analytics.currentPageClicks > 0 && (
        <vstack gap="small">
          <text color={foregroundColor} size="small" weight="bold">
            📄 Current Page Breakdown
          </text>
          <vstack gap="small">
            {analytics.clicksPerRow.map((rowClicks, index) => {
              if (rowClicks === 0) return null;
              return (
                <hstack key={index.toString()} gap="small" alignment="start middle">
                  <text color={foregroundColor} size="xsmall" minWidth="60px">
                    Row {index + 1}:
                  </text>
                  <text color={foregroundColor} size="xsmall">
                    {rowClicks} clicks
                  </text>
                  {index === analytics.mostActiveRow && (
                    <text color="#FFD700" size="xsmall">🏆</text>
                  )}
                </hstack>
              );
            })}
          </vstack>
        </vstack>
      )}

      {/* Multi-page Analytics (if applicable) */}
      {showDetailed && allPagesAnalytics.length > 1 && (
        <vstack gap="small">
          <text color={foregroundColor} size="small" weight="bold">
            📚 All Pages Overview
          </text>
          <vstack gap="small">
            {allPagesAnalytics.map((pageAnalytics, index) => (
              <hstack key={index.toString()} gap="small" alignment="start middle">
                <text 
                  color={index === currentPageIndex ? "#FFD700" : foregroundColor} 
                  size="xsmall" 
                  weight={index === currentPageIndex ? "bold" : "regular"}
                  minWidth="80px"
                >
                  {pageAnalytics.pageTitle}:
                </text>
                <text color={foregroundColor} size="xsmall">
                  {pageAnalytics.totalClicks} clicks
                </text>
                <text color={foregroundColor} size="xsmall">
                  ({pageAnalytics.linkCount} links)
                </text>
                {index === currentPageIndex && (
                  <text color="#FFD700" size="xsmall">👁️</text>
                )}
              </hstack>
            ))}
          </vstack>
        </vstack>
      )}

      {/* Performance Tips */}
      {engagement && (
        <vstack gap="small">
          <text color={foregroundColor} size="small" weight="bold">
            💡 Insights
          </text>
          <vstack gap="small">
            {engagement.popularityDistribution === 'concentrated' && (
              <text color={foregroundColor} size="xsmall">
                • Few links are getting most clicks - consider promoting others
              </text>
            )}
            {analytics.mostActiveRow !== null && analytics.clicksPerRow[analytics.mostActiveRow] > analytics.avgClicksPerLink * 2 && (
              <text color={foregroundColor} size="xsmall">
                • Row {(analytics.mostActiveRow + 1)} is performing well - consider similar positioning
              </text>
            )}
            {analytics.avgClicksPerLink > 5 && (
              <text color={foregroundColor} size="xsmall">
                • Great engagement! Your links are performing well
              </text>
            )}
          </vstack>
        </vstack>
      )}
    </vstack>
  );
};