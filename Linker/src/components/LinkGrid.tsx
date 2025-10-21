// Improved LinkGrid.tsx - Mobile responsive with proper spacing
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
  onButtonClick: (cellId: string) => void;
}

/**
 * Mobile-responsive grid layout component
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

  // Mobile-optimized gap sizing
  const gapSize = 'small'; // Reduced gap for mobile
  const showColumnHeaders = isEditMode && isModerator && columns > 1;
  const showRowButtons = isEditMode && isModerator && rows > 1;

  return (
    <vstack grow height="100%" width="100%" gap={gapSize}>
      {/* Column headers - more compact for mobile */}
      {showColumnHeaders && (
        <hstack width="100%" gap={gapSize}>
          {showRowButtons && <vstack width="32px" />} {/* Smaller spacer */}
          {Array.from({ length: columns }).map((_, colIndex) => (
            <vstack 
              key={`col-header-${colIndex}`}
              grow
              alignment="center middle"
            >
              <button
                appearance="destructive"
                size="small"
                width="100%"
                onPress={() => onRemoveColumn(colIndex)}
              >
                -
              </button>
            </vstack>
          ))}
        </hstack>
      )}

      {/* Grid rows with proper mobile spacing */}
      {cellGrid.map((row, rowIndex) => (
        <hstack 
          key={`row-${rowIndex}`} 
          grow
          width="100%"
          alignment="center middle"
          gap={gapSize}
        >
          {/* Row remove button - smaller for mobile */}
          {showRowButtons && (
            <vstack width="32px" height="100%" alignment="middle center">
              <button
                appearance="destructive"
                size="small"
                onPress={() => onRemoveRow(rowIndex)}
              >
                -
              </button>
            </vstack>
          )}
          
          {/* Cell components - use grow instead of percentage */}
          {row.map((cell, colIndex) => {
            const currentVariantIndex = editingVariantMap[cell.id] || cell.currentEditingIndex || 0;
            
            return (
              <vstack 
                key={cell.id} 
                grow
                height="100%"
                alignment="center middle"
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