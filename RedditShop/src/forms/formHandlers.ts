import { ShopPin } from '../types/shopPin.js';

export interface AddPinFormData {
  title: string;
  link: string;
  x: string;
  y: string;
  color: string | string[]; // Handle both string and array
  customColor?: string;
}

export interface EditPinFormData {
  pinId: string;
  title: string;
  link: string;
  x: string;
  y: string;
  color: string | string[]; // Handle both string and array
  customColor?: string;
}

export interface AddImageFormData {
  image: string;
  width?: string;
  height?: string;
}

const processColor = (colorSelection: string | string[], customColor?: string): string => {
  // Handle array input from form (select fields return arrays)
  const colorValue = Array.isArray(colorSelection) ? colorSelection[0] : colorSelection;
  
  if (colorValue === 'custom' && typeof customColor === 'string' && customColor.trim()) {
    const cleanCustomColor = customColor.trim();
    // Ensure custom color starts with #
    return cleanCustomColor.startsWith('#') ? cleanCustomColor : `#${cleanCustomColor}`;
  }
  
  // Return the selected color, ensuring it's a string
  return (typeof colorValue === 'string' && colorValue) ? colorValue : '#2b2321EE';
};

export const validateAndCreatePin = (formData: AddPinFormData, context: any): ShopPin | null => {
  // Validate required fields
  if (!formData.title?.trim()) {
    context.ui.showToast('Pin title is required');
    return null;
  }

  if (!formData.link?.trim()) {
    context.ui.showToast('Pin link is required');
    return null;
  }

  if (!formData.link.startsWith('https://')) {
    context.ui.showToast('Link must start with https://');
    return null;
  }

  const xPos = parseFloat(formData.x);
  const yPos = parseFloat(formData.y);

  if (isNaN(xPos) || xPos < 0 || xPos > 100) {
    context.ui.showToast('X position must be a valid number between 0 and 100');
    return null;
  }

  if (isNaN(yPos) || yPos < 0 || yPos > 100) {
    context.ui.showToast('Y position must be a valid number between 0 and 100');
    return null;
  }

  // Process color selection
  const color = processColor(formData.color, formData.customColor);

  // Validate color format
  if (!isValidHexColor(color)) {
    context.ui.showToast('Color must be a valid hex color (e.g., #FF0000 or #FF0000FF)');
    return null;
  }

  try {
    return new ShopPin(formData.title.trim(), formData.link.trim(), xPos, yPos, color);
  } catch (error) {
    console.error('Error creating pin:', error);
    context.ui.showToast('Failed to create pin');
    return null;
  }
};

export const validateAndUpdatePin = (
  formData: EditPinFormData, 
  originalPin: ShopPin, 
  context: any
): ShopPin | null => {
  // Validate required fields
  if (!formData.title?.trim()) {
    context.ui.showToast('Pin title is required');
    return null;
  }

  if (!formData.link?.trim()) {
    context.ui.showToast('Pin link is required');
    return null;
  }

  if (!formData.link.startsWith('https://')) {
    context.ui.showToast('Link must start with https://');
    return null;
  }

  const xPos = parseFloat(formData.x);
  const yPos = parseFloat(formData.y);

  if (isNaN(xPos) || xPos < 0 || xPos > 100) {
    context.ui.showToast('X position must be a valid number between 0 and 100');
    return null;
  }

  if (isNaN(yPos) || yPos < 0 || yPos > 100) {
    context.ui.showToast('Y position must be a valid number between 0 and 100');
    return null;
  }

  // Process color selection
  const color = processColor(formData.color, formData.customColor);

  // Validate color format
  if (!isValidHexColor(color)) {
    context.ui.showToast('Color must be a valid hex color (e.g., #FF0000 or #FF0000FF)');
    return null;
  }

  try {
    return ShopPin.fromData({
      id: formData.pinId,
      title: formData.title.trim(),
      link: formData.link.trim(),
      x: xPos,
      y: yPos,
      color: color,
      createdAt: originalPin.createdAt
    });
  } catch (error) {
    console.error('Error updating pin:', error);
    context.ui.showToast('Failed to update pin');
    return null;
  }
};

const isValidHexColor = (color: string): boolean => {
  // Check for hex color format: #RGB, #RRGGBB, #RRGGBBAA
  const hexPattern = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
  return hexPattern.test(color);
};

export const validateImageData = (formData: AddImageFormData): {
  imageUrl: string;
  width: number;
  height: number;
} => {
  const width = formData.width ? parseInt(formData.width) : 800;
  const height = formData.height ? parseInt(formData.height) : 600;

  return {
    imageUrl: formData.image,
    width,
    height
  };
};