// src/components/EnhancedLinkGrid.tsx
import { Devvit } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { LinkCellComponent } from './LinkCell.js';
import { GridLayoutManager, GridCellLayout } from '../utils/gridLayoutManager.js';

interface EnhancedLinkGridProps {
  cells: LinkCell[];
  rows: number;
  columns: number;
  foregroundColor: string;
  isEditMode: boolean;
  isModerator: boolean;
  showDescriptionMap: { [key: string]: boolean };
  editingVariantMap: { [key: string]: number };
  onEditCell: (cell: LinkCell, variantIndex?: number) => void;
  onClickCell: (cell: LinkCell, selectedVariant: Link) => void;
  onToggleDescription: (cellId: string) => void;
  onTrackImpression: (cellId: string, variantId: string) => void;
  onNextVariant: (cellId: string) => void;
  onAddVariant: (cellId: string) => void;
  onRemoveVariant: (cellId: string) => void;
  onButtonClick: (cellId: string) => void;
  onEditCellSpan: (cell: LinkCell) => void;
  onMoveCell?: (cellId: string, row: number, col: number) => void;
}

/**
 * Enhanced grid component that supports cells spanning multiple rows and columns
 */
export const EnhancedLinkGrid: Devvit.BlockComponent<EnhancedLinkGridProps> = ({
  cells,
  rows,
  columns,
  foregroundColor,
  isEditMode,
  isModerator,
  showDescriptionMap,
  editingVariantMap,
  onEditCell,
  onClickCell,
  onToggleDescription,
  onTrackImpression,
  onNextVariant,
  onAddVariant,
  onRemoveVariant,
  onButtonClick,
  onEditCellSpan,
  onMoveCell
}) => {
  // Create grid layout manager
  const layoutManager = new GridLayoutManager(rows, columns, cells);
  const flatCellList = layoutManager.getFlatCellList();

  // Calculate cell dimensions based on available space
  const calculateCellDimensions = (rowSpan: number, colSpan: number) => {
    // Base dimensions (percentage of container)
    const baseWidth = 100 / columns;
    const baseHeight = 100 / rows;
    
    // Calculate actual dimensions accounting for gaps
    const width = baseWidth * colSpan - 1; // Subtract for gaps
    const height = baseHeight * rowSpan - 1; // Subtract for gaps
    
    return { width: width, height: height };
  };

  // Helper function to render a cell
  const renderCell = (layout: GridCellLayout) => {
    const { cell, row, col, rowSpan, colSpan, isMainCell } = layout;
    
    // Skip placeholders
    if (cell.isPlaceholder || !isMainCell) {
      return null;
    }

    const currentVariantIndex = editingVariantMap[cell.id] || cell.currentEditingIndex || 0;
    const dimensions = calculateCellDimensions(rowSpan, colSpan);
    
    // Calculate position based on grid
    const leftPosition = (col * 100) / columns;
    const topPosition = (row * 100) / rows;

    return (
      <zstack
        key={`${cell.id}_${row}_${col}`}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"
      >
        {/* Cell content */}
        <vstack width="100%" height="100%" gap="none">
          {/* Spanning controls in edit mode */}
          {isEditMode && isModerator && !LinkCell.isEmpty(cell) && (
            <hstack
              width="100%"
              padding="xsmall"
              alignment="end top"
              gap="small"
            >
              {/* Span indicator */}
              {(rowSpan > 1 || colSpan > 1) && (
                <hstack
                  backgroundColor="rgba(147, 51, 234, 0.9)"
                  cornerRadius="small"
                  padding="xsmall"
                >
                  <text size="xsmall" color="white" weight="bold">
                    {rowSpan}×{colSpan}
                  </text>
                </hstack>
              )}
              
              {/* Edit span button */}
              <button
                icon="rules"
                size="small"
                appearance="secondary"
                onPress={() => {
                  onButtonClick(cell.id);
                  onEditCellSpan(cell);
                }}
              />
            </hstack>
          )}

          {/* Main cell component */}
          <vstack grow width="100%" height="100%">
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
        </vstack>

        {/* Grid position indicator in edit mode */}
        {isEditMode && isModerator && !LinkCell.isEmpty(cell) && (
          <vstack
            width="100%"
            height="100%"
            padding="xsmall"
            alignment="start bottom"
          >
            <hstack
              backgroundColor="rgba(0, 0, 0, 0.7)"
              cornerRadius="small"
              padding="xsmall"
            >
              <text size="xsmall" color="white">
                R{row + 1}C{col + 1}
              </text>
            </hstack>
          </vstack>
        )}
      </zstack>
    );
  };

  // Group cells by row for rendering
  const cellsByRow: Map<number, GridCellLayout[]> = new Map();
  for (const layout of flatCellList) {
    const rowCells = cellsByRow.get(layout.row) || [];
    rowCells.push(layout);
    cellsByRow.set(layout.row, rowCells);
  }

  // Render grid with absolute positioning for spanning cells
  return (
    <vstack width="100%" height="100%" grow gap="small">
      {/* Grid container with relative positioning */}
      <zstack width="100%" height="100%" grow>
        {/* Background grid lines in edit mode */}
        {isEditMode && isModerator && (
          <vstack width="100%" height="100%" gap="none">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <hstack key={`grid-row-${rowIndex}`} width="100%" grow gap="none">
                {Array.from({ length: columns }, (_, colIndex) => (
                  <vstack
                    key={`grid-cell-${rowIndex}-${colIndex}`}
                    grow
                    width={`${100 / columns}%`}
                    height="100%"
                    border="thin"
                    borderColor={`${foregroundColor}33`} // 20% opacity
                  />
                ))}
              </hstack>
            ))}
          </vstack>
        )}

        {/* Render all cells with absolute positioning */}
        {flatCellList.map(layout => (
          <vstack
            key={`cell-container-${layout.cell.id}`}
            width="100%"
            height="100%"
            alignment="start top"
          >
            {renderCell(layout)}
          </vstack>
        ))}
      </zstack>

      {/* Grid controls in edit mode */}
      {isEditMode && isModerator && (
        <hstack width="100%" padding="small" gap="medium" alignment="center middle">
          <text color={foregroundColor} size="small">
            Grid: {rows}×{columns}
          </text>
          <text color={foregroundColor} size="small">
            {cells.filter(c => !c.isPlaceholder && !LinkCell.isEmpty(c)).length} cells
          </text>
          <text color={foregroundColor} size="xsmall" style="body">
            (Cells can span multiple rows/columns)
          </text>
        </hstack>
      )}
    </vstack>
  );
};