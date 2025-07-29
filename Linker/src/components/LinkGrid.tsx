import { Devvit } from '@devvit/public-api';
import { Link } from '../types/link.js';
import { LinkCell } from './LinkCell.js';
import { calculateGrid } from '../utils/gridUtils.js';

interface LinkGridProps {
  links: Link[];
  columns: number;
  foregroundColor: string;
  isEditMode: boolean;
  isModerator: boolean;
  showDescriptionMap: { [key: string]: boolean };
  onEditLink: (link: Link) => void;
  onClickLink: (link: Link) => void;
  onToggleDescription: (linkId: string) => void;
  onRemoveRow: (rowIndex: number) => void;
  onRemoveColumn: (colIndex: number) => void;
}

/**
 * Grid layout component for displaying links
 */
export const LinkGrid: Devvit.BlockComponent<LinkGridProps> = ({
  links,
  columns,
  foregroundColor,
  isEditMode,
  isModerator,
  showDescriptionMap,
  onEditLink,
  onClickLink,
  onToggleDescription,
  onRemoveRow,
  onRemoveColumn
}) => {
  const linkGrid = calculateGrid(links, columns);
  const rows = linkGrid.length;

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
      {linkGrid.map((row, rowIndex) => (
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
          
          {/* Link cells in this row */}
          {row.map((link) => (
            <vstack 
              key={link.id} 
              width={`${(isEditMode && isModerator ? 97 : 100) / columns}%`} 
              height="100%"
            >
              <LinkCell
                link={link}
                foregroundColor={foregroundColor}
                isEditMode={isEditMode}
                isModerator={isModerator}
                showDescription={showDescriptionMap[link.id] || false}
                onEdit={onEditLink}
                onClick={onClickLink}
                onToggleDescription={onToggleDescription}
              />
            </vstack>
          ))}
        </hstack>
      ))}
    </vstack>
  );
};