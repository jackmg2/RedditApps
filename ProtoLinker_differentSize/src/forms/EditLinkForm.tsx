import { Devvit, useForm } from '@devvit/public-api';
import { Link } from '../types/link.js';
import { validateLinkUrl, normalizeUrl, getDisplayUrl } from '../utils/linkUtils.js';

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
          label: 'Link URL',
          type: 'string',
          defaultValue: tempData.uri,
          helpText: 'Enter a URL (e.g., https://example.com, reddit.com, /r/subreddit)',
          onValidate: (e: any) => {
            if (!e.value || e.value.trim() === '') {
              return undefined; // URI is optional
            }
            
            const url = e.value.trim();
            if (!validateLinkUrl(url)) {
              return 'Please enter a valid URL';
            }
            
            return undefined;
          }
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
          helpText: 'Hex color code (e.g., #FFFFFF for white)',
          onValidate: (e: any) => {
            if (!e.value) return undefined;
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(e.value) ? undefined : 'Please enter a valid hex color (e.g., #FFFFFF)';
          }
        },
        {
          name: 'backgroundColor',
          label: 'Title Background Color',
          type: 'string',
          defaultValue: tempData.backgroundColor || '#000000',
          helpText: 'Hex color code for title background (e.g., #000000 for black)',
          onValidate: (e: any) => {
            if (!e.value) return undefined;
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(e.value) ? undefined : 'Please enter a valid hex color (e.g., #000000)';
          }
        },
        {
          name: 'backgroundOpacity',
          label: 'Title Background Opacity',
          type: 'string',
          defaultValue: (tempData.backgroundOpacity !== undefined ? tempData.backgroundOpacity : 0.5).toString(),
          helpText: 'Opacity value between 0 and 1 (e.g., 0.5 for 50%)',
          onValidate: (e: any) => {
            if (!e.value) return undefined;
            const value = parseFloat(e.value);
            if (isNaN(value) || value < 0 || value > 1) {
              return 'Please enter a number between 0 and 1';
            }
            return undefined;
          }
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
          helpText: 'Number of times this link has been clicked (you can edit this value)',
          onValidate: (e: any) => {
            if (!e.value) return undefined;
            const value = parseInt(e.value);
            if (isNaN(value) || value < 0) {
              return 'Please enter a non-negative number';
            }
            return undefined;
          }
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
    
    // Normalize the URL if provided
    link.uri = formData.uri ? normalizeUrl(formData.uri) : '';
    
    link.image = formData.image;
    link.textColor = formData.textColor || '#FFFFFF';
    link.description = formData.description;
    link.backgroundColor = formData.backgroundColor || '#000000';
    link.backgroundOpacity = parseFloat(formData.backgroundOpacity) || 0.5;
    link.clickCount = parseInt(formData.clickCount) || 0;
    
    await onUpdateLink(link);
  });
};