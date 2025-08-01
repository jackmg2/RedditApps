import { Devvit } from '@devvit/public-api';
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { LinkCellComponent } from './LinkCell.js';
import { calculateGrid } from '../utils/gridUtils.js';

interface LinkGridProps {
  cells: LinkCell[]; // Changed from links to cells
  columns: number;
  foregroundColor: string;
  isEditMode: boolean;
  isModerator: boolean;
  showDescriptionMap: { [key: string]: boolean };
  onEditCell: (cell: LinkCell) => void; // Changed from onEditLink
  onClickCell: (cell: LinkCell, selectedVariant: Link) => void; // Changed from onClickLink
  onToggleDescription: (cellId: string) => void;
  onRemoveRow: (rowIndex: number) => void;
  onRemoveColumn: (colIndex: number) => void;
  onTrackImpression: (cellId: string, variantId: string) => void;
}

/**
 * Grid layout component for displaying LinkCells
 */
export const LinkGrid: Devvit.BlockComponent<LinkGridProps> = ({
  cells,
  columns,
  foregroundColor,
  isEditMode,
  isModerator,
  showDescriptionMap,
  onEditCell,
  onClickCell,
  onToggleDescription,
  onRemoveRow,
  onRemoveColumn,
  onTrackImpression
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
          {row.map((cell) => (
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
                onEdit={onEditCell}
                onClick={onClickCell}
                onToggleDescription={onToggleDescription}
                onTrackImpression={onTrackImpression}
              />
            </vstack>
          ))}
        </hstack>
      ))}
    </vstack>
  );
};