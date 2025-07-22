export interface GridPosition {
  x: number;
  y: number;
}

export const generateGridPositions = (rows: number, cols: number): GridPosition[] => {
  const positions: GridPosition[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = ((col + 0.5) / cols) * 100;
      const y = ((row + 0.5) / rows) * 100;
      positions.push({ x, y });
    }
  }
  
  return positions;
};

export const validatePosition = (x: number, y: number): boolean => {
  return !isNaN(x) && !isNaN(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100;
};