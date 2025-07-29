import { Linker } from '../types/linker.js';
import { Link } from '../types/link.js';

interface AnalyticsData {
  totalClicks: number;
  mostClicked: Link | null;
  hasAnyClicks: boolean;
}

/**
 * Calculates analytics data for the current linker state
 */
const calculateAnalytics = (linker: Linker | null, isEditMode: boolean, isModerator: boolean): AnalyticsData => {
  if (!linker || !isEditMode || !isModerator) {
    return {
      totalClicks: 0,
      mostClicked: null,
      hasAnyClicks: false
    };
  }
  
  const currentPage = linker.pages[0];
  if (!currentPage) {
    return {
      totalClicks: 0,
      mostClicked: null,
      hasAnyClicks: false
    };
  }
  
  // Ensure links have clickCount property
  const links = currentPage.links.map((link: any) => ({
    ...link,
    clickCount: link.clickCount || 0
  }));
  
  const totalClicks = links.reduce((sum: number, link: any) => sum + link.clickCount, 0);
  
  if (totalClicks === 0) {
    return {
      totalClicks: 0,
      mostClicked: null,
      hasAnyClicks: false
    };
  }
  
  const mostClicked = links.reduce((max: any, current: any) => 
    current.clickCount > max.clickCount ? current : max
  );
  
  return {
    totalClicks,
    mostClicked: mostClicked.clickCount > 0 ? mostClicked : null,
    hasAnyClicks: totalClicks > 0
  };
};

export const useAnalytics = (linker: Linker | null, isEditMode: boolean, isModerator: boolean): AnalyticsData => {
  return calculateAnalytics(linker, isEditMode, isModerator);
};