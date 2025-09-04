// src/components/LinkGrid.tsx - Updated with spanning support
import { Devvit } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { LinkCellComponent } from './LinkCell.js';

interface LinkGridProps {
  cells: LinkCell[];
  columns: number;
  rows: number; // NEW: rows parameter
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
  onEditCellSpan?: (cell: LinkCell) => void; // NEW: span editing
}

/**
 * Enhanced grid layout component with spanning support
 */
export const LinkGrid: Devvit.BlockComponent<LinkGridProps> = ({
  cells,
  columns,
  rows,
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
  onButtonClick,
  onEditCellSpan
}) => {
  // Create a 2D grid to track which positions are occupied
  const gridMap: (LinkCell | null)[][] = Array(rows).fill(null).map(() => Array(columns).fill(null));
  
  // Sort cells by position to ensure proper placement
  const sortedCells = [...cells].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  // Place cells in the grid
  sortedCells.forEach(cell => {
    if (!LinkCell.isEmpty(cell)) {
      // Place the cell in its starting position
      if (cell.row < rows && cell.col < columns) {
        gridMap[cell.row][cell.col] = cell;
        
        // Mark other positions occupied by this cell
        for (let r = cell.row; r < Math.min(cell.row + cell.rowSpan, rows); r++) {
          for (let c = cell.col; c < Math.min(cell.col + cell.colSpan, columns); c++) {
            if (r !== cell.row || c !== cell.col) {
              gridMap[r][c] = null; // Mark as occupied but not the main cell
            }
          }
        }
      }
    }
  });

  // Helper function to check if a position is the start of a cell
  const isCellStart = (row: number, col: number): boolean => {
    const cell = cells.find(c => c.row === row && c.col === col && !LinkCell.isEmpty(c));
    return cell !== undefined;
  };

  // Helper function to check if a position is occupied by a spanning cell
  const isOccupied = (row: number, col: number): boolean => {
    return sortedCells.some(cell => 
      !LinkCell.isEmpty(cell) &&
      row >= cell.row && row < cell.row + cell.rowSpan &&
      col >= cell.col && col < cell.col + cell.colSpan
    );
  };

  const gapSize = "small";
  const columnHeaderHeight = isEditMode && isModerator && columns > 1 ? "24px" : "0px";
  const rowButtonWidth = isEditMode && isModerator && rows > 1 ? "24px" : "0px";

  return (
    <vstack gap={gapSize} grow height="100%" width="100%">
      {/* Column headers with remove buttons - only in edit mode */}
      {isEditMode && isModerator && columns > 1 && (
        <hstack gap="none" width="100%">
          {rows > 1 && <vstack width={rowButtonWidth} />}
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
                -C{colIndex + 1}
              </button>
            </vstack>
          ))}
        </hstack>
      )}

      {/* Grid container */}
      <vstack grow gap={gapSize} width="100%">
        {/* Grid rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <hstack 
            key={`row-${rowIndex}`} 
            gap={gapSize} 
            grow
            width="100%"
            alignment="center middle"
          >
            {/* Row remove button */}
            {isEditMode && isModerator && rows > 1 && (
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
            
            {/* Cells in this row */}
            {Array.from({ length: columns }).map((_, colIndex) => {
              const cell = gridMap[rowIndex][colIndex];
              
              // Skip if this position is occupied by a spanning cell (but not the start)
              if (isOccupied(rowIndex, colIndex) && !isCellStart(rowIndex, colIndex)) {
                return null;
              }
              
              // Find the actual cell at this position
              const actualCell = cells.find(c => 
                c.row === rowIndex && c.col === colIndex
              ) || new LinkCell();
              
              // Set position if it's a new empty cell
              if (LinkCell.isEmpty(actualCell)) {
                actualCell.row = rowIndex;
                actualCell.col = colIndex;
                actualCell.rowSpan = 1;
                actualCell.colSpan = 1;
              }
              
              const currentVariantIndex = editingVariantMap[actualCell.id] || actualCell.currentEditingIndex || 0;
              
              // Calculate cell width accounting for spanning
              const cellWidth = isEditMode && isModerator
                ? ((100 - 3) / columns) * actualCell.colSpan
                : (100 / columns) * actualCell.colSpan;
              
              // Calculate height multiplier for row spanning
              const heightMultiplier = actualCell.rowSpan;
              
              return (
                <vstack 
                  key={`${actualCell.id}_${rowIndex}_${colIndex}`} 
                  width={`${cellWidth}%`}
                  height={`${100 * heightMultiplier}%`}
                  alignment="center middle"
                >
                  {/* Spanning indicator and controls in edit mode */}
                  {(isEditMode && isModerator && !LinkCell.isEmpty(actualCell) && 
                   (actualCell.rowSpan > 1 || actualCell.colSpan > 1)) ? (
                    <hstack width="100%" padding="xsmall" alignment="end top">
                      <hstack
                        backgroundColor="rgba(147, 51, 234, 0.9)"
                        cornerRadius="small"
                        padding="xsmall"
                      >
                        <text size="xsmall" color="white" weight="bold">
                          {actualCell.rowSpan}×{actualCell.colSpan}
                        </text>
                      </hstack>
                    </hstack>
                  ) : null}
                  
                  {/* Span edit button in edit mode */}
                  {(isEditMode && isModerator && !LinkCell.isEmpty(actualCell) && onEditCellSpan) ? (
                    <hstack width="100%" padding="xsmall" alignment="start top">
                      <button
                        icon="expand-right"
                        size="small"
                        appearance="secondary"
                        onPress={() => {
                          onButtonClick(actualCell.id);
                          onEditCellSpan(actualCell);
                        }}
                      />
                    </hstack>
                  ): null}
                  
                  <LinkCellComponent
                    cell={actualCell}
                    foregroundColor={foregroundColor}
                    isEditMode={isEditMode}
                    isModerator={isModerator}
                    showDescription={showDescriptionMap[actualCell.id] || false}
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
            }).filter(Boolean)}
          </hstack>
        ))}
      </vstack>
      
      {/* Grid info in edit mode */}
      {isEditMode && isModerator && (
        <hstack width="100%" padding="small" gap="medium" alignment="center middle">
          <text color={foregroundColor} size="small">
            Grid: {rows}×{columns}
          </text>
          <text color={foregroundColor} size="small">
            Active cells: {cells.filter(c => !LinkCell.isEmpty(c)).length}
          </text>
        </hstack>
      )}
    </vstack>
  );
};