import { ShopPin } from '../types/shopPin.js';

export interface AddPinFormData {
  title: string;
  link: string;
  x: string;
  y: string;
}

export interface EditPinFormData {
  pinId: string;
  title: string;
  link: string;
  x: string;
  y: string;
}

export interface AddImageFormData {
  image: string;
  width?: string;
  height?: string;
}

export const validateAndCreatePin = (formData: AddPinFormData, context: any): ShopPin | null => {
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

  return new ShopPin(formData.title, formData.link, xPos, yPos);
};

export const validateAndUpdatePin = (
  formData: EditPinFormData, 
  originalPin: ShopPin, 
  context: any
): ShopPin | null => {
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

  return ShopPin.fromData({
    id: formData.pinId,
    title: formData.title,
    link: formData.link,
    x: xPos,
    y: yPos,
    createdAt: originalPin.createdAt
  });
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