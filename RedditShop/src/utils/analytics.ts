import { ShopPost } from '../types/shopPost.js';

export interface AnalyticsSummary {
  totalClicks: number;
  topProduct: {
    title: string;
    clicks: number;
  } | null;
  currentImageClicks: number;
}

export const getAnalyticsSummary = (shopPost: ShopPost, currentImageIndex: number): AnalyticsSummary | null => {
  if (!shopPost || !shopPost.clickTracking || Object.keys(shopPost.clickTracking).length === 0) {
    return null;
  }

  const totalClicks = shopPost.getTotalClicks();
  if (totalClicks === 0) return null;

  const mostClicked = shopPost.getMostClickedPin();
  if (!mostClicked) return null;

  // Find the pin title
  let pinTitle = "Unknown Pin";
  for (const image of shopPost.images) {
    const pin = image.pins.find(p => p.id === mostClicked.pinId);
    if (pin) {
      pinTitle = pin.title;
      break;
    }
  }

  // Calculate current image clicks
  const currentImage = shopPost.images[currentImageIndex];
  const currentImageClicks = currentImage?.pins.reduce(
    (sum, pin) => sum + (shopPost.getClickCount(pin.id) || 0), 
    0
  ) || 0;

  return {
    totalClicks,
    topProduct: {
      title: pinTitle,
      clicks: mostClicked.clicks
    },
    currentImageClicks
  };
};