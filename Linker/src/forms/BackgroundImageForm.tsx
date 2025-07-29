import { Devvit, useForm } from '@devvit/public-api';

interface BackgroundImageFormProps {
  currentBackgroundImage: string;
  onUpdateBackgroundImage: (backgroundImage: string) => Promise<void>;
}

/**
 * Form component for editing board background image
 */
export const useBackgroundImageForm = ({ currentBackgroundImage, onUpdateBackgroundImage }: BackgroundImageFormProps) => {
  return useForm(() => {
    return {
      fields: [
        {
          name: 'backgroundImage',
          label: 'Background Image',
          type: 'image',
          defaultValue: currentBackgroundImage || '',
          helpText: 'Upload an image for the board background (leave empty to remove)'
        }
      ],
      title: 'Change Background Image',
      acceptLabel: 'Save',
    } as const;
  },
  async (formData) => {
    await onUpdateBackgroundImage(formData.backgroundImage || '');
  });
};