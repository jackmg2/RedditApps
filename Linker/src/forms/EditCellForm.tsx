import { Devvit, useForm } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { validateLinkUrl, normalizeUrl } from '../utils/linkUtils.js';

interface EditCellFormProps {
  onUpdateCell: (cell: LinkCell) => Promise<void>;
}

/**
 * Form component for editing cell properties and managing variants
 */
export const useEditCellForm = ({ onUpdateCell }: EditCellFormProps) => {
  return useForm((dataArgs) => {
    const tempData = JSON.parse(dataArgs.e) as LinkCell;

    // Create form fields for each variant
    const variantFields = tempData.links.map((link, index) => [
      {
        name: `variant_${index}_title`,
        label: `Variant ${index + 1} - Title`,
        type: 'string' as const,
        defaultValue: link.title,
        helpText: index === 0 ? 'Primary variant title' : `Alternative variant ${index + 1} title`
      },
      {
        name: `variant_${index}_uri`,
        label: `Variant ${index + 1} - URL`,
        type: 'string' as const,
        defaultValue: link.uri,
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
        name: `variant_${index}_weight`,
        label: `Variant ${index + 1} - Weight`,
        type: 'string' as const,
        defaultValue: (tempData.weights[index] || 1).toString(),
        helpText: 'Weight for random selection (higher = more likely). Default: 1',
        onValidate: (e: any) => {
          if (!e.value) return 'Weight is required';
          const value = parseFloat(e.value);
          if (isNaN(value) || value < 0) {
            return 'Please enter a non-negative number';
          }
          return undefined;
        }
      },
      {
        name: `variant_${index}_image`,
        label: `Variant ${index + 1} - Background Image`,
        type: 'image' as const,
        defaultValue: link.image,
        helpText: 'Optional background image for this variant'
      },
      {
        name: `variant_${index}_textColor`,
        label: `Variant ${index + 1} - Text Color`,
        type: 'string' as const,
        defaultValue: link.textColor || '#FFFFFF',
        helpText: 'Hex color code (e.g., #FFFFFF for white)',
        onValidate: (e: any) => {
          if (!e.value) return undefined;
          const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          return hexRegex.test(e.value) ? undefined : 'Please enter a valid hex color (e.g., #FFFFFF)';
        }
      },
      {
        name: `variant_${index}_backgroundColor`,
        label: `Variant ${index + 1} - Title Background`,
        type: 'string' as const,
        defaultValue: link.backgroundColor || '#000000',
        helpText: 'Hex color code for title background',
        onValidate: (e: any) => {
          if (!e.value) return undefined;
          const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          return hexRegex.test(e.value) ? undefined : 'Please enter a valid hex color (e.g., #000000)';
        }
      },
      {
        name: `variant_${index}_backgroundOpacity`,
        label: `Variant ${index + 1} - Background Opacity`,
        type: 'string' as const,
        defaultValue: (link.backgroundOpacity !== undefined ? link.backgroundOpacity : 0.5).toString(),
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
        name: `variant_${index}_description`,
        label: `Variant ${index + 1} - Description`,
        type: 'paragraph' as const,
        defaultValue: link.description || '',
        helpText: 'Optional description shown when info button is clicked'
      }
    ]).flat();

    return {
      fields: [
        {
          name: 'id',
          label: 'Cell ID',
          type: 'string',
          disabled: true,
          defaultValue: tempData.id,
          onValidate: (e: any) => e.value === '' ? 'ID required' : undefined
        },
        {
          name: 'displayName',
          label: 'Cell Name (for management)',
          type: 'string',
          defaultValue: tempData.displayName,
          helpText: 'Internal name to help you identify this cell'
        },
        {
          name: 'rotationEnabled',
          label: 'Enable A/B Testing',
          type: 'boolean',
          defaultValue: tempData.rotationEnabled,
          helpText: 'When enabled, variants will be randomly shown based on weights'
        },
        {
          name: 'variantCount',
          label: 'Number of Variants',
          type: 'string',
          defaultValue: tempData.links.length.toString(),
          helpText: `Currently ${tempData.links.length} variants. Change this number to add/remove variants.`,
          onValidate: (e: any) => {
            const value = parseInt(e.value);
            if (isNaN(value) || value < 1 || value > 5) {
              return 'Please enter a number between 1 and 5';
            }
            return undefined;
          }
        },
        ...variantFields
      ],
      title: `Edit Cell: ${tempData.displayName || 'Untitled Cell'}`,
      acceptLabel: 'Save',
    } as const;
  },
  async (formData) => {
    const variantCount = parseInt(formData.variantCount);
    const cell = LinkCell.fromData({
      id: formData.id,
      links: [],
      weights: [],
      displayName: formData.displayName,
      rotationEnabled: formData.rotationEnabled
    });

    // Process variants
    for (let i = 0; i < variantCount; i++) {
      const link = new Link();
      link.title = formData[`variant_${i}_title`] || '';
      link.uri = formData[`variant_${i}_uri`] ? normalizeUrl(formData[`variant_${i}_uri`]) : '';
      link.image = formData[`variant_${i}_image`] || '';
      link.textColor = formData[`variant_${i}_textColor`] || '#FFFFFF';
      link.backgroundColor = formData[`variant_${i}_backgroundColor`] || '#000000';
      link.backgroundOpacity = parseFloat(formData[`variant_${i}_backgroundOpacity`]) || 0.5;
      link.description = formData[`variant_${i}_description`] || '';
      
      // Preserve existing click count if this is an existing variant
      const existingVariant = (formData as any).originalCell?.links[i];
      link.clickCount = existingVariant?.clickCount || 0;

      cell.links.push(link);
      cell.weights.push(parseFloat(formData[`variant_${i}_weight`]) || 1);
    }

    // Auto-enable rotation if multiple variants
    if (cell.links.length > 1 && !cell.rotationEnabled) {
      cell.rotationEnabled = true;
    }

    await onUpdateCell(cell);
  });
};