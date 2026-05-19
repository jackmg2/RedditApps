import type { Cell, LinkVariant, Page } from "../shared/api.ts";
import { state } from "./state.ts";

export function newId(): string {
  return crypto.randomUUID();
}

export function isLinkEmpty(link: LinkVariant): boolean {
  return !link.uri && !link.title && !link.image;
}

export function getActiveLinks(cell: Cell): LinkVariant[] {
  return cell.links.filter((l) => !isLinkEmpty(l));
}

export function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function newLink(): LinkVariant {
  return {
    id: newId(),
    uri: "",
    title: "",
    image: "",
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.5,
    description: "",
    clickCount: 0,
  };
}

export function newCell(): Cell {
  return {
    id: newId(),
    displayName: "",
    rotationEnabled: false,
    impressionCount: 0,
    variantImpressions: {},
    currentEditingIndex: 0,
    links: [newLink()],
    weights: [1],
  };
}

export function currentPage(): Page | null {
  if (!state) return null;
  const { board, pages } = state.boardState;
  const pageId = board.pageIds[state.currentPageIndex];
  return pageId ? (pages[pageId] ?? null) : null;
}

export function getVariantIndex(cell: Cell): number {
  if (!state) return 0;
  const activeLinks = getActiveLinks(cell);
  if (activeLinks.length < 2 || !cell.rotationEnabled) return 0;

  if (!state.variantSelections.has(cell.id)) {
    const activeWeights = cell.weights.filter(
      (_, i) => i < cell.links.length && !isLinkEmpty(cell.links[i]!),
    );
    const chosen = weightedRandom(
      activeWeights.length > 0 ? activeWeights : activeLinks.map(() => 1),
    );
    state.variantSelections.set(cell.id, chosen);
  }
  return state.variantSelections.get(cell.id) ?? 0;
}

export function colorWithOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${opacity})`;
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
