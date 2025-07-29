import { Devvit, useForm } from '@devvit/public-api';
import { Link } from '../types/link.js';

interface EditLinkFormProps {
  onUpdateLink: (link: Link) => Promise<void>;
}

/**
 * Form component for editing link properties
 */
export const useEditLinkForm = ({ onUpdateLink }: EditLinkFormProps) => {
  return useForm((dataArgs) => {
    const tempData = JSON.parse(dataArgs.e) as Link;

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
          onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
        },
        {
          name: 'uri',
          label: 'Link',
          type: 'string',
          defaultValue: tempData.uri,
          helpText: 'URL to navigate to when clicked'
        },
        {
          name: 'image',
          label: 'Background Image',
          type: 'image',
          defaultValue: tempData.image,
          helpText: 'Optional background image for the link cell'
        },
        {
          name: 'textColor',
          label: 'Text Color',
          type: 'string',
          defaultValue: tempData.textColor || '#FFFFFF',
          helpText: 'Hex color code (e.g., #FFFFFF for white)'
        },
        {
          name: 'backgroundColor',
          label: 'Title Background Color',
          type: 'string',
          defaultValue: tempData.backgroundColor || '#000000',
          helpText: 'Hex color code for title background (e.g., #000000 for black)'
        },
        {
          name: 'backgroundOpacity',
          label: 'Title Background Opacity',
          type: 'string',
          defaultValue: (tempData.backgroundOpacity !== undefined ? tempData.backgroundOpacity : 0.5).toString(),
          helpText: 'Opacity value between 0 and 1 (e.g., 0.5 for 50%)'
        },
        {
          name: 'description',
          label: 'Description',
          type: 'paragraph',
          defaultValue: tempData.description || '',
          helpText: 'Optional description shown when info button is clicked'
        },
        {
          name: 'clickCount',
          label: 'Click Count',
          type: 'string',
          defaultValue: (tempData.clickCount || 0).toString(),
          helpText: 'Number of times this link has been clicked (you can edit this value)'
        }
      ],
      title: 'Edit Link',
      acceptLabel: 'Save',
    } as const;
  },
  async (formData) => {
    const link = new Link();
    link.id = formData.id;
    link.title = formData.title;
    link.uri = formData.uri;
    link.image = formData.image;
    link.textColor = formData.textColor;
    link.description = formData.description;
    link.backgroundColor = formData.backgroundColor;
    link.backgroundOpacity = parseFloat(formData.backgroundOpacity);
    link.clickCount = parseInt(formData.clickCount) || 0;
    
    await onUpdateLink(link);
  });
};