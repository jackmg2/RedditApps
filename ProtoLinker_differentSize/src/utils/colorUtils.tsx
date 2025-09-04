/**
 * Converts a hex color to RGBA string
 */
export const hexToRgba = (hex: string, opacity: number): string => {
  // Remove the hash if present
  const cleanHex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Validates if a string is a valid hex color
 */
export const validateHexColor = (color: string): boolean => {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
};

/**
 * Ensures a color string is a valid hex color, returns default if invalid
 */
export const ensureValidHexColor = (color: string, defaultColor: string = '#000000'): string => {
  return validateHexColor(color) ? color : defaultColor;
};

/**
 * Ensures opacity is within valid range (0-1)
 */
export const ensureValidOpacity = (opacity: number, defaultOpacity: number = 0.5): number => {
  if (isNaN(opacity) || opacity < 0 || opacity > 1) {
    return defaultOpacity;
  }
  return opacity;
};

/**
 * Gets contrasting text color (black or white) based on background color
 */
export const getContrastingTextColor = (backgroundColor: string): string => {
  const cleanHex = backgroundColor.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};