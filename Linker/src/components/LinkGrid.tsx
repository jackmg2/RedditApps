// Updated LinkGrid.tsx
import { Devvit } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { LinkCellComponent } from './LinkCell.js';
import { calculateGrid } from '../utils/gridUtils.js';

interface LinkGridProps {
  cells: LinkCell[];
  columns: number;
  foregroundColor: string;
  isEditMode: boolean;
  isModerator: boolean;
  showDescriptionMap: { [key: string]: boolean };
  editingVariantMap: { [key: string]: number };
  onEditCell: (cell: LinkCell, variantIndex?: number) => void;
  onClickCell: (cell: LinkCell, selectedVariant: Link) => void;
  onToggleDescription: (cellId: string) => void;
  onRemoveRow: (rowIndex: number) => void;
  onRemoveColumn: (colIndex: number) => void;
  onTrackImpression: (cellId: string, variantId: string) => void;
  onNextVariant: (cellId: string) => void;
  onAddVariant: (cellId: string) => void;
  onRemoveVariant: (cellId: string) => void;
  // New prop for button click prevention
  onButtonClick: (cellId: string) => void;
}

/**
 * Enhanced grid layout component with button click prevention
 */
export const LinkGrid: Devvit.BlockComponent<LinkGridProps> = ({
  cells,
  columns,
  foregroundColor,
  isEditMode,
  isModerator,
  showDescriptionMap,
  editingVariantMap,
  onEditCell,
  onClickCell,
  onToggleDescription,
  onRemoveRow,
  onRemoveColumn,
  onTrackImpression,
  onNextVariant,
  onAddVariant,
  onRemoveVariant,
  onButtonClick
}) => {
  const cellGrid = calculateGrid(cells, columns);
  const rows = cellGrid.length;

  return (
    <vstack gap="small" grow>
      {/* Column headers with remove buttons - only in edit mode */}
      {isEditMode && isModerator && columns > 1 && (
        <hstack gap="none" height="12px">
          <vstack width="24px" /> {/* Spacer for row remove buttons */}
          {Array.from({ length: columns }).map((_, colIndex) => (
            <vstack 
              key={`col-header-${colIndex}`}
              width={`${97 / columns}%`}
              alignment="bottom center"
              gap='none'
            >
              <button
                height="12px"
                appearance="destructive"
                size="small"
                width={`${97 / columns}%`}
                onPress={() => onRemoveColumn(colIndex)}
              >
                -
              </button>
            </vstack>
          ))}
        </hstack>
      )}

      {/* Grid rows */}
      {cellGrid.map((row, rowIndex) => (
        <hstack key={`row-${rowIndex}`} gap="small" height={`${100 / rows}%`}>
          {/* Row remove button - only in edit mode */}
          {isEditMode && isModerator && (
            <vstack width="12px" alignment="middle center">
              <button
                appearance="destructive"
                size="small"
                onPress={() => onRemoveRow(rowIndex)}
              >
                -
              </button>
            </vstack>
          )}
          
          {/* Cell components in this row */}
          {row.map((cell) => {
            const currentVariantIndex = editingVariantMap[cell.id] || cell.currentEditingIndex || 0;
            
            return (
              <vstack 
                key={cell.id} 
                width={`${(isEditMode && isModerator ? 97 : 100) / columns}%`} 
                height="100%"
              >
                <LinkCellComponent
                  cell={cell}
                  foregroundColor={foregroundColor}
                  isEditMode={isEditMode}
                  isModerator={isModerator}
                  showDescription={showDescriptionMap[cell.id] || false}
                  currentVariantIndex={currentVariantIndex}
                  onEdit={onEditCell}
                  onClick={onClickCell}
                  onToggleDescription={onToggleDescription}
                  onTrackImpression={onTrackImpression}
                  onNextVariant={onNextVariant}
                  onAddVariant={onAddVariant}
                  onRemoveVariant={onRemoveVariant}
                  onButtonClick={onButtonClick}
                />
              </vstack>
            );
          })}
        </hstack>
      ))}
    </vstack>
  );
};