import { Link } from '../types/link.js';

/**
 * Calculates a 2D grid matrix from a flat array of links
 */
export const calculateGrid = (links: Link[], columns: number): Link[][] => {
  const rows = Math.ceil(links.length / columns);
  const linkGrid: Link[][] = [];
  
  for (let i = 0; i < rows; i++) {
    linkGrid.push(links.slice(i * columns, (i + 1) * columns));
    
    // Pad the last row with empty links if needed
    if (i === rows - 1 && linkGrid[i].length < columns) {
      const padding = columns - linkGrid[i].length;
      for (let j = 0; j < padding; j++) {
        linkGrid[i].push(new Link());
      }
    }
  }
  
  return linkGrid;
};

/**
 * Adds a new row of links to the grid
 */
export const addRowToGrid = (links: Link[], columns: number): Link[] => {
  const newLinks = [...links];
  
  // Add a new row of links (empty links for each column)
  for (let i = 0; i < columns; i++) {
    newLinks.push(new Link());
  }
  
  return newLinks;
};

/**
 * Adds a new column to the grid by restructuring the links array
 */
export const addColumnToGrid = (links: Link[], currentColumns: number): { links: Link[], columns: number } => {
  const newColumns = currentColumns + 1;
  const currentLinks = [...links];
  const newLinks = [];
  
  // Calculate how many rows we currently have
  const rows = Math.ceil(currentLinks.length / currentColumns);
  
  // Create a new array with links inserted at the right positions
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < newColumns; col++) {
      if (col === newColumns - 1) {
        // This is our new column, add a new link
        newLinks.push(new Link());
      } else {
        // Get the existing link from the old array if it exists
        const index = row * currentColumns + col;
        if (index < currentLinks.length) {
          newLinks.push(currentLinks[index]);
        }
      }
    }
  }
  
  return { links: newLinks, columns: newColumns };
};

/**
 * Removes a row from the grid
 */
export const removeRowFromGrid = (links: Link[], rowIndex: number, columns: number): Link[] => {
  // Calculate the start and end index of the links in this row
  const startIndex = rowIndex * columns;
  const endIndex = startIndex + columns;
  
  // Remove the links in this row
  return [
    ...links.slice(0, startIndex),
    ...links.slice(endIndex)
  ];
};

/**
 * Removes a column from the grid by restructuring the links array
 */
export const removeColumnFromGrid = (links: Link[], colIndex: number, currentColumns: number): { links: Link[], columns: number } => {
  if (currentColumns <= 1) {
    throw new Error('Cannot remove the last column');
  }
  
  const newColumns = currentColumns - 1;
  const currentLinks = [...links];
  const newLinks = [];
  
  // Calculate how many rows we currently have
  const rows = Math.ceil(currentLinks.length / currentColumns);
  
  // Remove the specified column by excluding it from the new array
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < currentColumns; col++) {
      if (col !== colIndex) {
        const index = row * currentColumns + col;
        if (index < currentLinks.length) {
          newLinks.push(currentLinks[index]);
        }
      }
    }
  }
  
  return { links: newLinks, columns: newColumns };
};

/**
 * Gets the number of rows needed for the current links and columns
 */
export const calculateRowCount = (linkCount: number, columns: number): number => {
  return Math.ceil(linkCount / columns);
};