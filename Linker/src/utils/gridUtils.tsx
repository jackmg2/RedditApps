import { LinkCell } from '../types/linkCell.js';

/**
 * Calculates a 2D grid matrix from a flat array of LinkCells
 */
export const calculateGrid = (cells: LinkCell[], columns: number): LinkCell[][] => {
  const rows = Math.ceil(cells.length / columns);
  const cellGrid: LinkCell[][] = [];
  
  for (let i = 0; i < rows; i++) {
    cellGrid.push(cells.slice(i * columns, (i + 1) * columns));
    
    // Pad the last row with empty cells if needed
    if (i === rows - 1 && cellGrid[i].length < columns) {
      const padding = columns - cellGrid[i].length;
      for (let j = 0; j < padding; j++) {
        cellGrid[i].push(new LinkCell());
      }
    }
  }
  
  return cellGrid;
};

/**
 * Adds a new row of cells to the grid
 */
export const addRowToGrid = (cells: LinkCell[], columns: number): LinkCell[] => {
  const newCells = [...cells];
  
  // Add a new row of cells (empty cells for each column)
  for (let i = 0; i < columns; i++) {
    newCells.push(new LinkCell());
  }
  
  return newCells;
};

/**
 * Adds a new column to the grid by restructuring the cells array
 */
export const addColumnToGrid = (cells: LinkCell[], currentColumns: number): { cells: LinkCell[], columns: number } => {
  const newColumns = currentColumns + 1;
  const currentCells = [...cells];
  const newCells = [];
  
  // Calculate how many rows we currently have
  const rows = Math.ceil(currentCells.length / currentColumns);
  
  // Create a new array with cells inserted at the right positions
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < newColumns; col++) {
      if (col === newColumns - 1) {
        // This is our new column, add a new cell
        newCells.push(new LinkCell());
      } else {
        // Get the existing cell from the old array if it exists
        const index = row * currentColumns + col;
        if (index < currentCells.length) {
          newCells.push(currentCells[index]);
        }
      }
    }
  }
  
  return { cells: newCells, columns: newColumns };
};

/**
 * Removes a row from the grid
 */
export const removeRowFromGrid = (cells: LinkCell[], rowIndex: number, columns: number): LinkCell[] => {
  // Calculate the start and end index of the cells in this row
  const startIndex = rowIndex * columns;
  const endIndex = startIndex + columns;
  
  // Remove the cells in this row
  return [
    ...cells.slice(0, startIndex),
    ...cells.slice(endIndex)
  ];
};

/**
 * Removes a column from the grid by restructuring the cells array
 */
export const removeColumnFromGrid = (cells: LinkCell[], colIndex: number, currentColumns: number): { cells: LinkCell[], columns: number } => {
  if (currentColumns <= 1) {
    throw new Error('Cannot remove the last column');
  }
  
  const newColumns = currentColumns - 1;
  const currentCells = [...cells];
  const newCells = [];
  
  // Calculate how many rows we currently have
  const rows = Math.ceil(currentCells.length / currentColumns);
  
  // Remove the specified column by excluding it from the new array
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < currentColumns; col++) {
      if (col !== colIndex) {
        const index = row * currentColumns + col;
        if (index < currentCells.length) {
          newCells.push(currentCells[index]);
        }
      }
    }
  }
  
  return { cells: newCells, columns: newColumns };
};

/**
 * Gets the number of rows needed for the current cells and columns
 */
export const calculateRowCount = (cellCount: number, columns: number): number => {
  return Math.ceil(cellCount / columns);
};

/**
 * Finds a cell by ID in the cells array
 */
export const findCellById = (cells: LinkCell[], cellId: string): { cell: LinkCell; index: number } | null => {
  const index = cells.findIndex(cell => cell.id === cellId);
  if (index === -1) return null;
  return { cell: cells[index], index };
};

/**
 * Gets grid position (row, col) for a cell by its index
 */
export const getCellPosition = (cellIndex: number, columns: number): { row: number; col: number } => {
  return {
    row: Math.floor(cellIndex / columns),
    col: cellIndex % columns
  };
};

/**
 * Gets cell index from grid position
 */
export const getCellIndex = (row: number, col: number, columns: number): number => {
  return row * columns + col;
};