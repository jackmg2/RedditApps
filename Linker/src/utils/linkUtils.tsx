/**
 * Checks if enough time has passed to prevent accidental navigation
 */
export const shouldPreventNavigation = (timestamp: number, delay: number = 1000): boolean => {
  if (timestamp === 0) return false;
  
  const currentTime = Date.now();
  const elapsed = currentTime - timestamp;
  
  return elapsed < delay;
};

/**
 * Validates if a URL is properly formatted
 */
export const validateLinkUrl = (url: string): boolean => {
  if (!url || url.trim() === '') return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    // Try with https:// prefix if it's missing
    try {
      new URL(`https://${url}`);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Normalizes a URL by adding https:// if no protocol is present
 */
export const normalizeUrl = (url: string): string => {
  if (!url || url.trim() === '') return '';
  
  const trimmedUrl = url.trim();
  
  // If it already has a protocol, return as is
  if (trimmedUrl.match(/^https?:\/\//)) {
    return trimmedUrl;
  }
  
  // Add https:// prefix
  return `https://${trimmedUrl}`;
};

/**
 * Checks if a URL is safe for navigation (basic security check)
 */
export const isSafeUrl = (url: string): boolean => {
  if (!url) return false;
  
  const normalizedUrl = normalizeUrl(url);
  
  try {
    const parsedUrl = new URL(normalizedUrl);
    
    // Block javascript: and data: protocols for security
    if (parsedUrl.protocol === 'javascript:' || parsedUrl.protocol === 'data:') {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Truncates text to a specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Generates a preview text for a link based on its properties
 */
export const getLinkPreviewText = (title: string, description: string, url: string): string => {
  if (title && title.trim() !== '') return title;
  if (description && description.trim() !== '') return truncateText(description, 50);
  if (url && url.trim() !== '') {
    try {
      const parsedUrl = new URL(normalizeUrl(url));
      return parsedUrl.hostname;
    } catch {
      return truncateText(url, 30);
    }
  }
  return 'Untitled Link';
};