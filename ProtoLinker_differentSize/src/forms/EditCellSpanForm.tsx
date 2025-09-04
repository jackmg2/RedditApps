// src/forms/EditCellSpanForm.tsx
import { Devvit, useForm } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';

interface EditCellSpanFormProps {
  onUpdateCellSpan: (cellId: string, rowSpan: number, colSpan: number) => Promise<void>;
}

/**
 * Form component for editing cell spanning properties
 */
export const useEditCellSpanForm = ({ onUpdateCellSpan }: EditCellSpanFormProps) => {
  return useForm((dataArgs) => {
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
    
    const { cell, maxRows, maxCols } = parsedData as { 
      cell: LinkCell; 
      maxRows: number; 
      maxCols: number;
    };

    // Calculate maximum possible spans from current position
    const maxRowSpanFromPosition = maxRows - cell.row;
    const maxColSpanFromPosition = maxCols - cell.col;

    return {
      fields: [
        {
          name: 'cellId',
          label: 'Cell ID',
          type: 'string',
          disabled: true,
          defaultValue: cell.id,
        },
        {
          name: 'displayName',
          label: 'Cell Name',
          type: 'string',
          disabled: true,
          defaultValue: cell.displayName || cell.links[0]?.title || 'Untitled Cell',
          helpText: 'Cell identifier for reference'
        },
        {
          name: 'currentPosition',
          label: 'Current Position',
          type: 'string',
          disabled: true,
          defaultValue: `Row ${cell.row + 1}, Column ${cell.col + 1}`,
          helpText: 'Current grid position'
        },
        {
          name: 'currentSize',
          label: 'Current Size',
          type: 'string',
          disabled: true,
          defaultValue: `${cell.rowSpan} row(s) × ${cell.colSpan} column(s)`,
          helpText: 'Current cell dimensions'
        },
        {
          name: 'rowSpan',
          label: 'Row Span',
          type: 'string',
          defaultValue: cell.rowSpan.toString(),
          helpText: `Number of rows (1-${maxRowSpanFromPosition})`,
          onValidate: (e: any) => {
            const value = parseInt(e.value);
            if (isNaN(value) || value < 1 || value > maxRowSpanFromPosition) {
              return `Please enter a number between 1 and ${maxRowSpanFromPosition}`;
            }
            return undefined;
          }
        },
        {
          name: 'colSpan',
          label: 'Column Span',
          type: 'string',
          defaultValue: cell.colSpan.toString(),
          helpText: `Number of columns (1-${maxColSpanFromPosition})`,
          onValidate: (e: any) => {
            const value = parseInt(e.value);
            if (isNaN(value) || value < 1 || value > maxColSpanFromPosition) {
              return `Please enter a number between 1 and ${maxColSpanFromPosition}`;
            }
            return undefined;
          }
        },
        {
          name: 'presetSizes',
          label: 'Quick Presets',
          type: 'select',
          defaultValue: ['custom'],
          options: [
            { label: 'Custom Size', value: 'custom' },
            { label: '1×1 (Standard)', value: '1x1' },
            { label: '1×2 (Wide)', value: '1x2' },
            { label: '2×1 (Tall)', value: '2x1' },
            { label: '2×2 (Large)', value: '2x2' },
            { label: '1×3 (Banner)', value: '1x3' },
            { label: '3×1 (Tower)', value: '3x1' },
          ],
          helpText: 'Select a preset size or use custom values above',
          onValueChange: (e: any) => {
            const value = Array.isArray(e.value) ? e.value[0] : e.value;
            if (value !== 'custom') {
              const [rows, cols] = value.split('x').map(Number);
              // This would need to update the form fields, but Devvit forms don't support dynamic field updates
              // Users will need to manually enter values
            }
          }
        }
      ],
      title: `Adjust Cell Size`,
      acceptLabel: 'Update Size',
    } as const;
  },
  async (formData) => {
    const rowSpan = parseInt(formData.rowSpan) || 1;
    const colSpan = parseInt(formData.colSpan) || 1;
    
    await onUpdateCellSpan(formData.cellId, rowSpan, colSpan);
  });
};