/**
 * Enhanced linkUtils.tsx with button click prevention utilities
 */

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
 * Checks if a button was recently clicked to prevent parent element activation
 */
export const shouldPreventButtonPropagation = (
  timestamps: { [key: string]: number }, 
  elementId: string, 
  delay: number = 500
): boolean => {
  const timestamp = timestamps[elementId];
  if (!timestamp) return false;
  
  const currentTime = Date.now();
  const elapsed = currentTime - timestamp;
  
  return elapsed < delay;
};

/**
 * Creates a timestamp for button click prevention
 */
export const createButtonClickTimestamp = (elementId: string): { [key: string]: number } => {
  return { [elementId]: Date.now() };
};

/**
 * Cleans up old timestamps to prevent memory leaks
 */
export const cleanupOldTimestamps = (
  timestamps: { [key: string]: number }, 
  maxAge: number = 2000
): { [key: string]: number } => {
  const currentTime = Date.now();
  const cleaned: { [key: string]: number } = {};
  
  Object.entries(timestamps).forEach(([id, timestamp]) => {
    if (currentTime - timestamp < maxAge) {
      cleaned[id] = timestamp;
    }
  });
  
  return cleaned;
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
  if (trimmedUrl.match(/^https?:\/\//i)) {
    return trimmedUrl;
  }
  
  // Handle common cases
  if (trimmedUrl.startsWith('www.')) {
    return `https://${trimmedUrl}`;
  }
  
  // Handle reddit links
  if (trimmedUrl.startsWith('/r/') || trimmedUrl.startsWith('r/')) {
    const cleanPath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    return `https://reddit.com${cleanPath}`;
  }
  
  // Add https:// prefix for other URLs
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
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:'];
    if (dangerousProtocols.includes(parsedUrl.protocol.toLowerCase())) {
      return false;
    }
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol.toLowerCase())) {
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

/**
 * Gets a user-friendly display version of a URL
 */
export const getDisplayUrl = (url: string): string => {
  if (!url) return '';
  
  try {
    const normalizedUrl = normalizeUrl(url);
    const parsedUrl = new URL(normalizedUrl);
    
    // For reddit links, show a cleaner format
    if (parsedUrl.hostname.includes('reddit.com')) {
      return parsedUrl.pathname;
    }
    
    // For other URLs, show hostname + path if short enough
    const display = parsedUrl.hostname + parsedUrl.pathname;
    return display.length > 40 ? parsedUrl.hostname : display;
  } catch {
    return truncateText(url, 40);
  }
};