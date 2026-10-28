import type { Cell, Page } from "../shared/api.ts";

export type Placement = {
  cellId: string;
  index: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
};

export type Layout = {
  rows: number;
  placements: Placement[];
  coveredBy: Map<number, string>; // slot index → anchor cell id
};

// Resolves the effective span of every cell on a grid page. `page.cellIds` is a
// full row-major rows × columns slot array; a spanning cell covers the slots to
// its right/below, which keep their own (empty) cells but are not rendered.
export function computeLayout(page: Page, cells: Record<string, Cell>): Layout {
  const cols = page.columns;
  const rows = Math.ceil(page.cellIds.length / cols);
  const placements: Placement[] = [];
  const coveredBy = new Map<number, string>();
  const taken = new Set<number>();

  for (let index = 0; index < page.cellIds.length; index++) {
    if (taken.has(index)) continue;
    const cellId = page.cellIds[index]!;
    const cell = cells[cellId];
    const row = Math.floor(index / cols);
    const col = index % cols;
    let rowSpan = clampSpan(cell?.rowSpan, rows - row);
    let colSpan = clampSpan(cell?.colSpan, cols - col);

    const rect = slotsIn(page, row, col, rowSpan, colSpan);
    // Overlapping spans only happen with corrupt data; fall back to 1×1.
    if (rect.some((i) => taken.has(i) || i >= page.cellIds.length)) {
      rowSpan = 1;
      colSpan = 1;
    }

    for (const i of slotsIn(page, row, col, rowSpan, colSpan)) {
      taken.add(i);
      if (i !== index) coveredBy.set(i, cellId);
    }
    placements.push({ cellId, index, row, col, rowSpan, colSpan });
  }

  return { rows, placements, coveredBy };
}

export function slotsIn(
  page: Page,
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
): number[] {
  const slots: number[] = [];
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      slots.push(r * page.columns + c);
    }
  }
  return slots;
}

function clampSpan(span: number | undefined, max: number): number {
  return Math.max(1, Math.min(Math.floor(span ?? 1) || 1, max));
}
