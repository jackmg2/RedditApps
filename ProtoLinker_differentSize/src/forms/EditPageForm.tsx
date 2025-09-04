import { Devvit, useForm } from '@devvit/public-api';
import { Page } from '../types/page.js';

interface EditPageFormProps {
  onUpdatePage: (data: { id: string, title: string, foregroundColor?: string, backgroundColor?: string, backgroundImage?: string }) => Promise<void>;
}

/**
 * Form component for editing page/board properties
 */
export const useEditPageForm = ({ onUpdatePage }: EditPageFormProps) => {
  return useForm((dataArgs) => {
    const tempData = JSON.parse(dataArgs.e) as Page;
    
    return {
      fields: [
        {
          name: 'id',
          label: 'Id',
          type: 'string',
          disabled: true,
          defaultValue: tempData.id,
          onValidate: (e: any) => e.value === '' ? 'Id required' : undefined
        },
        {
          name: 'title',
          label: 'Title',
          type: 'string',
          defaultValue: tempData.title,
          onValidate: (e: any) => e.value === '' ? 'Title required' : undefined,
          helpText: 'The main title displayed at the top of the board'
        },
        {
          name: 'backgroundColor',
          label: 'Background Color',
          type: 'string',
          defaultValue: tempData.backgroundColor || '#000000',
          helpText: 'Hex color code for the board background (e.g., #000000 for black)'
        },
        {
          name: 'foregroundColor',
          label: 'Foreground Color',
          type: 'string',
          defaultValue: tempData.foregroundColor || '#FFFFFF',
          helpText: 'Hex color code for text and borders (e.g., #FFFFFF for white)'
        }
      ],
      title: 'Edit Board',
      acceptLabel: 'Save',
    } as const;
  },
  async (formData) => {
    await onUpdatePage({
      id: formData.id,
      title: formData.title,
      backgroundColor: formData.backgroundColor,
      foregroundColor: formData.foregroundColor
    });
  });
};