// src/forms/GridDimensionsForm.tsx
import { Devvit, useForm } from '@devvit/public-api';

interface GridDimensionsFormProps {
  onUpdateGridDimensions: (rows: number, columns: number) => Promise<void>;
}

/**
 * Form component for editing grid dimensions
 */
export const useGridDimensionsForm = ({ onUpdateGridDimensions }: GridDimensionsFormProps) => {
  return useForm((dataArgs) => {
    const tempData = JSON.parse(dataArgs.e) as { 
      currentRows: number; 
      currentColumns: number;
      cellCount: number;
    };
    
    return {
      fields: [
        {
          name: 'currentInfo',
          label: 'Current Grid',
          type: 'string',
          disabled: true,
          defaultValue: `${tempData.currentRows}×${tempData.currentColumns} grid with ${tempData.cellCount} active cells`,
        },
        {
          name: 'rows',
          label: 'Number of Rows',
          type: 'select',
          defaultValue: [tempData.currentRows.toString()],
          options: [
            { label: '2 rows', value: '2' },
            { label: '3 rows', value: '3' },
            { label: '4 rows', value: '4' },
            { label: '5 rows', value: '5' },
            { label: '6 rows', value: '6' },
          ],
          helpText: 'Number of rows in the grid'
        },
        {
          name: 'columns',
          label: 'Number of Columns',
          type: 'select',
          defaultValue: [tempData.currentColumns.toString()],
          options: [
            { label: '2 columns', value: '2' },
            { label: '3 columns', value: '3' },
            { label: '4 columns', value: '4' },
            { label: '5 columns', value: '5' },
            { label: '6 columns', value: '6' },
          ],
          helpText: 'Number of columns in the grid'
        },
        {
          name: 'warning',
          label: 'Warning',
          type: 'string',
          disabled: true,
          defaultValue: 'Reducing grid size may affect cells that span beyond the new boundaries',
          helpText: 'Cells will be automatically adjusted to fit'
        }
      ],
      title: 'Adjust Grid Dimensions',
      acceptLabel: 'Update Grid',
    } as const;
  },
  async (formData) => {
    const rows = parseInt(Array.isArray(formData.rows) ? formData.rows[0] : formData.rows) || 4;
    const columns = parseInt(Array.isArray(formData.columns) ? formData.columns[0] : formData.columns) || 4;
    
    await onUpdateGridDimensions(rows, columns);
  });
};