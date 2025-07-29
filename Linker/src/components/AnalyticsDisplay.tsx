import { Devvit } from '@devvit/public-api';
import { Link } from '../types/link.js';

interface AnalyticsDisplayProps {
  totalClicks: number;
  mostClicked: Link | null;
  foregroundColor: string;
}

/**
 * Analytics display component for showing click statistics
 */
export const AnalyticsDisplay: Devvit.BlockComponent<AnalyticsDisplayProps> = ({
  totalClicks,
  mostClicked,
  foregroundColor
}) => {
  if (totalClicks === 0) {
    return null;
  }

  return (
    <vstack gap="small" padding="small">
      <text color={foregroundColor} size="medium" weight="bold">
        📊 Analytics
      </text>
      
      <hstack gap="medium" alignment="start middle">
        <text color={foregroundColor} size="small">
          Total Clicks: {totalClicks}
        </text>
        
        {mostClicked && (
          <text color={foregroundColor} size="small">
            Most Clicked: "{mostClicked.title || 'Untitled'}" ({mostClicked.clickCount || 0} clicks)
          </text>
        )}
      </hstack>
    </vstack>
  );
};