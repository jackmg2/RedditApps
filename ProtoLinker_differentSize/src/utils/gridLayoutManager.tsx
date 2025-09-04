// src/utils/gridLayoutManager.tsx
import { LinkCell } from '../types/linkCell.js';

export interface GridPosition {
  row: number;
  col: number;
}

export interface GridDimensions {
  rows: number;
  cols: number;
}

export interface GridCellLayout {
  cell: LinkCell;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  isMainCell: boolean; // True for the main cell, false for placeholders
}

export class GridLayoutManager {
  private rows: number;
  private cols: number;
  private grid: (LinkCell | null)[][];
  private cells: LinkCell[];

  constructor(rows: number, cols: number, cells: LinkCell[] = []) {
    this.rows = rows;
    this.cols = cols;
    this.cells = cells;
    this.grid = this.createEmptyGrid();
    this.layoutCells();
  }

  // Create an empty grid
  private createEmptyGrid(): (LinkCell | null)[][] {
    const grid: (LinkCell | null)[][] = [];
    for (let r = 0; r < this.rows; r++) {
      grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        grid[r][c] = null;
      }
    }
    return grid;
  }

  // Layout cells in the grid
  private layoutCells(): void {
    // Clear the grid
    this.grid = this.createEmptyGrid();

    // Place cells that have fixed positions
    const positionedCells = this.cells.filter(cell => !cell.isPlaceholder);
    
    for (const cell of positionedCells) {
      this.placeCell(cell);
    }

    // Auto-place cells without positions
    const unpositionedCells = positionedCells.filter(cell => 
      cell.row === 0 && cell.col === 0 && !this.isCellPlaced(cell)
    );

    for (const cell of unpositionedCells) {
      const position = this.findNextAvailablePosition(cell.rowSpan, cell.colSpan);
      if (position) {
        cell.row = position.row;
        cell.col = position.col;
        this.placeCell(cell);
      }
    }
  }

  // Check if a cell is already placed in the grid
  private isCellPlaced(cell: LinkCell): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]?.id === cell.id) {
          return true;
        }
      }
    }
    return false;
  }

  // Place a cell in the grid
  private placeCell(cell: LinkCell): boolean {
    if (cell.isPlaceholder) return false;

    // Check if the cell fits in the grid
    if (!this.canPlaceCell(cell.row, cell.col, cell.rowSpan, cell.colSpan)) {
      return false;
    }

    // Place the main cell and placeholders
    for (let r = cell.row; r < cell.row + cell.rowSpan && r < this.rows; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan && c < this.cols; c++) {
        if (r === cell.row && c === cell.col) {
          // Place the main cell
          this.grid[r][c] = cell;
        } else {
          // Create and place placeholder
          const placeholder = LinkCell.createPlaceholder(cell.id, r, c);
          this.grid[r][c] = placeholder;
        }
      }
    }

    return true;
  }

  // Check if a cell can be placed at a specific position
  public canPlaceCell(row: number, col: number, rowSpan: number, colSpan: number, excludeCellId?: string): boolean {
    // Check boundaries
    if (row < 0 || col < 0 || row + rowSpan > this.rows || col + colSpan > this.cols) {
      return false;
    }

    // Check for overlaps
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        const existingCell = this.grid[r][c];
        if (existingCell && !existingCell.isPlaceholder) {
          // Allow if it's the same cell we're trying to move
          if (excludeCellId && existingCell.id === excludeCellId) {
            continue;
          }
          return false;
        }
        // Check if it's a placeholder for a different cell
        if (existingCell?.isPlaceholder && !existingCell.id.startsWith(excludeCellId + '_')) {
          return false;
        }
      }
    }

    return true;
  }

  // Find the next available position for a cell with given dimensions
  public findNextAvailablePosition(rowSpan: number, colSpan: number): GridPosition | null {
    for (let r = 0; r <= this.rows - rowSpan; r++) {
      for (let c = 0; c <= this.cols - colSpan; c++) {
        if (this.canPlaceCell(r, c, rowSpan, colSpan)) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  // Get the grid layout for rendering
  public getGridLayout(): GridCellLayout[][] {
    const layout: GridCellLayout[][] = [];

    for (let r = 0; r < this.rows; r++) {
      layout[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell) {
          layout[r][c] = {
            cell: cell,
            row: r,
            col: c,
            rowSpan: cell.isPlaceholder ? 1 : cell.rowSpan,
            colSpan: cell.isPlaceholder ? 1 : cell.colSpan,
            isMainCell: !cell.isPlaceholder && cell.row === r && cell.col === c
          };
        } else {
          // Empty cell
          const emptyCell = new LinkCell();
          emptyCell.row = r;
          emptyCell.col = c;
          layout[r][c] = {
            cell: emptyCell,
            row: r,
            col: c,
            rowSpan: 1,
            colSpan: 1,
            isMainCell: true
          };
        }
      }
    }

    return layout;
  }

  // Get a flat list of cells for rendering (no duplicates/placeholders)
  public getFlatCellList(): GridCellLayout[] {
    const cellMap = new Map<string, GridCellLayout>();

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell && !cell.isPlaceholder && !cellMap.has(cell.id)) {
          cellMap.set(cell.id, {
            cell: cell,
            row: cell.row,
            col: cell.col,
            rowSpan: cell.rowSpan,
            colSpan: cell.colSpan,
            isMainCell: true
          });
        } else if (!cell) {
          // Include empty cells
          const emptyCell = new LinkCell();
          emptyCell.row = r;
          emptyCell.col = c;
          const emptyCellId = `empty_${r}_${c}`;
          if (!cellMap.has(emptyCellId)) {
            cellMap.set(emptyCellId, {
              cell: emptyCell,
              row: r,
              col: c,
              rowSpan: 1,
              colSpan: 1,
              isMainCell: true
            });
          }
        }
      }
    }

    return Array.from(cellMap.values());
  }

  // Move a cell to a new position
  public moveCell(cellId: string, newRow: number, newCol: number): boolean {
    const cell = this.cells.find(c => c.id === cellId);
    if (!cell || cell.isPlaceholder) return false;

    // Clear current position
    this.clearCellFromGrid(cell);

    // Check if new position is valid
    if (!this.canPlaceCell(newRow, newCol, cell.rowSpan, cell.colSpan, cellId)) {
      // Restore original position
      this.placeCell(cell);
      return false;
    }

    // Update cell position
    cell.row = newRow;
    cell.col = newCol;

    // Place at new position
    return this.placeCell(cell);
  }

  // Clear a cell from the grid
  private clearCellFromGrid(cell: LinkCell): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const gridCell = this.grid[r][c];
        if (gridCell && (gridCell.id === cell.id || gridCell.id.startsWith(cell.id + '_placeholder'))) {
          this.grid[r][c] = null;
        }
      }
    }
  }

  // Resize a cell (change its span)
  public resizeCell(cellId: string, newRowSpan: number, newColSpan: number): boolean {
    const cell = this.cells.find(c => c.id === cellId);
    if (!cell || cell.isPlaceholder) return false;

    // Clear current position
    this.clearCellFromGrid(cell);

    // Check if new size fits at current position
    if (!this.canPlaceCell(cell.row, cell.col, newRowSpan, newColSpan, cellId)) {
      // Try to find a new position that fits
      const newPosition = this.findNextAvailablePosition(newRowSpan, newColSpan);
      if (!newPosition) {
        // Restore original size and position
        this.placeCell(cell);
        return false;
      }
      cell.row = newPosition.row;
      cell.col = newPosition.col;
    }

    // Update cell dimensions
    cell.rowSpan = newRowSpan;
    cell.colSpan = newColSpan;

    // Place with new dimensions
    return this.placeCell(cell);
  }

  // Add a new cell to the grid
  public addCell(cell: LinkCell): boolean {
    // Find position if not specified
    if (cell.row === 0 && cell.col === 0) {
      const position = this.findNextAvailablePosition(cell.rowSpan, cell.colSpan);
      if (!position) return false;
      cell.row = position.row;
      cell.col = position.col;
    }

    // Add to cells array
    this.cells.push(cell);

    // Place in grid
    return this.placeCell(cell);
  }

  // Remove a cell from the grid
  public removeCell(cellId: string): boolean {
    const cellIndex = this.cells.findIndex(c => c.id === cellId);
    if (cellIndex === -1) return false;

    const cell = this.cells[cellIndex];
    
    // Clear from grid
    this.clearCellFromGrid(cell);

    // Remove from cells array
    this.cells.splice(cellIndex, 1);

    return true;
  }

  // Get grid dimensions
  public getDimensions(): GridDimensions {
    return { rows: this.rows, cols: this.cols };
  }

  // Update grid dimensions
  public updateDimensions(rows: number, cols: number): void {
    this.rows = rows;
    this.cols = cols;
    this.layoutCells();
  }

  // Get all cells
  public getCells(): LinkCell[] {
    return this.cells.filter(cell => !cell.isPlaceholder);
  }

  // Validate and fix grid layout
  public validateAndFix(): void {
    // Remove overlapping cells
    const validCells: LinkCell[] = [];

    for (const cell of this.cells) {
      if (cell.isPlaceholder) continue;

      // Adjust cell dimensions if they exceed grid boundaries
      if (cell.row + cell.rowSpan > this.rows) {
        cell.rowSpan = this.rows - cell.row;
      }
      if (cell.col + cell.colSpan > this.cols) {
        cell.colSpan = this.cols - cell.col;
      }

      // Check for valid dimensions
      if (cell.rowSpan > 0 && cell.colSpan > 0) {
        validCells.push(cell);
      }
    }

    this.cells = validCells;
    this.layoutCells();
  }
}