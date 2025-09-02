// Updated LinkGrid.tsx - Optimized for better space utilization
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
 * Enhanced grid layout component optimized for space utilization
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

  // Calculate optimal sizing based on mode
  const gapSize = isEditMode ? "small" : "small"; // Keep small gap for visual separation
  const columnHeaderHeight = isEditMode && isModerator && columns > 1 ? "16px" : "0px";
  const rowButtonWidth = isEditMode && isModerator ? "16px" : "0px";

  return (
    <vstack gap={gapSize} grow height="100%" width="100%">
      {/* Column headers with remove buttons - only in edit mode */}
      {isEditMode && isModerator && columns > 1 && (
        <hstack gap="none" width="100%">
          {rows > 1 && <vstack width={rowButtonWidth} />} {/* Spacer for row remove buttons only when needed */}
          {Array.from({ length: columns }).map((_, colIndex) => (
            <vstack 
              key={`col-header-${colIndex}`}
              width={`${(100 - (rows > 1 ? 3 : 0)) / columns}%`}
              alignment="center middle"
              gap='none'
            >
              <button
                appearance="destructive"
                size="small"
                width="100%"
                onPress={() => onRemoveColumn(colIndex)}
              >
                Remove Col {colIndex + 1}
              </button>
            </vstack>
          ))}
        </hstack>
      )}

      {/* Grid container - Takes remaining space and distributes to rows */}
      <vstack grow gap={gapSize} width="100%">
        {/* Grid rows - Each row takes equal share of available space */}
        {cellGrid.map((row, rowIndex) => (
          <hstack 
            key={`row-${rowIndex}`} 
            gap={gapSize} 
            grow
            width="100%"
            alignment="center middle"
          >
            {/* Row remove button - only in edit mode */}
            {isEditMode && isModerator && (
              <vstack width={rowButtonWidth} alignment="middle center" height="100%">
                <button
                  appearance="destructive"
                  size="small"
                  height="100%"
                  onPress={() => onRemoveRow(rowIndex)}
                >
                  -
                </button>
              </vstack>
            )}
            
            {/* Cell components in this row - Each cell takes equal horizontal space */}
            {row.map((cell, colIndex) => {
              const currentVariantIndex = editingVariantMap[cell.id] || cell.currentEditingIndex || 0;
              
              // Calculate cell width accounting for row button space
              const cellWidth : number = isEditMode && isModerator
                ? (100 - 3) / columns // 3% for row button
                : 100 / columns;
              
              return (
                <vstack 
                  key={cell.id} 
                  width={cellWidth}
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
    </vstack>
  );
};