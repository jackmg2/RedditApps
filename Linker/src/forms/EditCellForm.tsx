import { Devvit, useForm } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { validateLinkUrl, normalizeUrl } from '../utils/linkUtils.js';

interface EditCellFormProps {
  onUpdateCell: (cell: LinkCell) => Promise<void>;
}

/**
 * Simplified form component for editing a single variant of a cell
 */
export const useEditCellForm = ({ onUpdateCell }: EditCellFormProps) => {
  return useForm((dataArgs) => {
    // Handle potential undefined or malformed data
    if (!dataArgs || !dataArgs.e) {
      throw new Error('Form data is missing');
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(dataArgs.e);
    } catch (error) {
      console.error('Failed to parse form data:', dataArgs.e);
      throw new Error('Invalid form data format');
    }
    
    if (!parsedData.cell || parsedData.variantIndex === undefined) {
      throw new Error('Missing required cell data or variant index');
    }
    
    const { cell: tempCell, variantIndex } = parsedData as { 
      cell: LinkCell; 
      variantIndex: number; 
    };

    const currentVariant = tempCell.links[variantIndex] || new Link();
    const variantCount = tempCell.links.filter(link => !Link.isEmpty(link)).length;
    const isNewVariant = Link.isEmpty(currentVariant);

    return {
      fields: [
        // Hidden fields to preserve original data
        {
          name: 'originalCellData',
          label: 'Original Cell Data',
          type: 'string',
          defaultValue: JSON.stringify(tempCell),
          disabled: true
        },
        {
          name: 'variantIndex',
          label: 'Variant Index',
          type: 'string',
          defaultValue: variantIndex.toString(),
          disabled: true
        },
        {
          name: 'cellId',
          label: 'Cell ID',
          type: 'string',
          disabled: true,
          defaultValue: tempCell.id,
          onValidate: (e: any) => e.value === '' ? 'ID required' : undefined
        },
        {
          name: 'displayName',
          label: 'Cell Name (for management)',
          type: 'string',
          defaultValue: tempCell.displayName,
          helpText: 'Internal name to help you identify this cell'
        },
        {
          name: 'title',
          label: `Variant Title ${variantIndex + 1}${isNewVariant ? ' (New)' : ''}`,
          type: 'string',
          defaultValue: currentVariant.title,
          helpText: variantCount > 1 ? `This is variant ${variantIndex + 1} of ${variantCount}` : 'Main title for this cell'
        },
        {
          name: 'uri',
          label: 'URL',
          type: 'string',
          defaultValue: currentVariant.uri,
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
          name: 'weight',
          label: 'Rotation Weight',
          type: 'string',
          defaultValue: (tempCell.weights[variantIndex] || 1).toString(),
          helpText: variantCount > 1 
            ? 'Higher weight = more likely to be shown (1 = normal, 2 = twice as likely, etc.)'
            : 'Weight for random selection (default: 1)',
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
          name: 'image',
          label: 'Background Image',
          type: 'image',
          defaultValue: currentVariant.image,
          helpText: 'Optional background image for this variant'
        },
        {
          name: 'textColor',
          label: 'Text Color',
          type: 'string',
          defaultValue: currentVariant.textColor || '#FFFFFF',
          helpText: 'Hex color code (e.g., #FFFFFF for white)',
          onValidate: (e: any) => {
            if (!e.value) return undefined;
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(e.value) ? undefined : 'Please enter a valid hex color (e.g., #FFFFFF)';
          }
        },
        {
          name: 'backgroundColor',
          label: 'Title Background',
          type: 'string',
          defaultValue: currentVariant.backgroundColor || '#000000',
          helpText: 'Hex color code for title background',
          onValidate: (e: any) => {
            if (!e.value) return undefined;
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return hexRegex.test(e.value) ? undefined : 'Please enter a valid hex color (e.g., #000000)';
          }
        },
        {
          name: 'backgroundOpacity',
          label: 'Background Opacity',
          type: 'string',
          defaultValue: (currentVariant.backgroundOpacity !== undefined ? currentVariant.backgroundOpacity : 0.5).toString(),
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
          defaultValue: currentVariant.description || '',
          helpText: 'Optional description shown when info button is clicked'
        }
      ],
      title: `Edit ${tempCell.displayName || 'Cell'} - Variant ${variantIndex + 1}${variantCount > 1 ? ` of ${variantCount}` : ''}`,
      acceptLabel: 'Save Variant',
    } as const;
  },
  async (formData) => {
    // Now we can access the original data from hidden fields
    const originalCellData = JSON.parse(formData.originalCellData);
    const variantIndex = parseInt(formData.variantIndex);
    
    // Create updated cell from original data
    const updatedCell = LinkCell.fromData(originalCellData);
    
    // Update cell-level properties
    updatedCell.displayName = formData.displayName || '';
    
    // Ensure we have enough slots in the arrays
    while (updatedCell.links.length <= variantIndex) {
      updatedCell.links.push(new Link());
      updatedCell.weights.push(1);
    }
    
    // Update the specific variant
    const updatedLink = Link.fromData({
      id: updatedCell.links[variantIndex].id, // Preserve existing ID
      title: formData.title || '',
      uri: formData.uri ? normalizeUrl(formData.uri) : '',
      image: formData.image || '',
      textColor: formData.textColor || '#FFFFFF',
      backgroundColor: formData.backgroundColor || '#000000',
      backgroundOpacity: parseFloat(formData.backgroundOpacity) || 0.5,
      description: formData.description || '',
      clickCount: updatedCell.links[variantIndex].clickCount || 0 // Preserve click count
    });
    
    updatedCell.links[variantIndex] = updatedLink;
    updatedCell.weights[variantIndex] = parseFloat(formData.weight) || 1;
    
    // Update current editing index
    updatedCell.currentEditingIndex = variantIndex;
    
    // Clean up and auto-adjust rotation settings
    updatedCell.cleanupEmptyVariants();
    
    await onUpdateCell(updatedCell);
  });
};