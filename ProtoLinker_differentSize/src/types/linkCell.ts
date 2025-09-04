// src/types/linkCell.ts - Enhanced with spanning support
import { randomId } from "../utils.js";
import { Link } from "./link.js";

export class LinkCell {
  public id: string;
  public links: Link[];
  public weights: number[];
  public displayName: string;
  public rotationEnabled: boolean;
  public impressionCount: number;
  public variantImpressions: { [variantId: string]: number };
  public currentEditingIndex: number;
  
  // NEW: Grid positioning and spanning properties
  public row: number;           // Starting row position (0-based)
  public col: number;           // Starting column position (0-based)
  public rowSpan: number;       // Number of rows this cell spans
  public colSpan: number;       // Number of columns this cell spans
  public isPlaceholder: boolean; // True if this is a placeholder for a spanned cell

  constructor() {
    this.id = randomId();
    this.links = [new Link()];
    this.weights = [1];
    this.displayName = '';
    this.rotationEnabled = false;
    this.impressionCount = 0;
    this.variantImpressions = {};
    this.currentEditingIndex = 0;
    
    // Initialize grid properties
    this.row = 0;
    this.col = 0;
    this.rowSpan = 1;
    this.colSpan = 1;
    this.isPlaceholder = false;
  }

  public static isEmpty(cell: LinkCell): boolean {
    // Placeholders are considered empty
    if (cell.isPlaceholder) return true;
    
    return cell == null || cell == undefined || 
           cell.links.length === 0 || 
           cell.links.every(link => Link.isEmpty(link));
  }

  public static fromData(data: {
    id: string;
    links: Link[];
    weights?: number[];
    displayName?: string;
    rotationEnabled?: boolean;
    impressionCount?: number;
    variantImpressions?: { [variantId: string]: number };
    currentEditingIndex?: number;
    row?: number;
    col?: number;
    rowSpan?: number;
    colSpan?: number;
    isPlaceholder?: boolean;
  }): LinkCell {
    const cell = new LinkCell();
    cell.id = data.id;
    cell.links = data.links.map(l => Link.fromData(l));
    cell.weights = data.weights || [1];
    cell.displayName = data.displayName || '';
    cell.rotationEnabled = data.rotationEnabled || false;
    cell.impressionCount = data.impressionCount || 0;
    cell.variantImpressions = data.variantImpressions || {};
    cell.currentEditingIndex = data.currentEditingIndex || 0;
    
    // Grid properties
    cell.row = data.row !== undefined ? data.row : 0;
    cell.col = data.col !== undefined ? data.col : 0;
    cell.rowSpan = data.rowSpan !== undefined ? data.rowSpan : 1;
    cell.colSpan = data.colSpan !== undefined ? data.colSpan : 1;
    cell.isPlaceholder = data.isPlaceholder || false;

    // Ensure weights array matches links array length
    while (cell.weights.length < cell.links.length) {
      cell.weights.push(1);
    }
    cell.weights = cell.weights.slice(0, cell.links.length);

    // Auto-enable rotation if multiple variants exist
    if (cell.links.filter(link => !Link.isEmpty(link)).length > 1) {
      cell.rotationEnabled = true;
    }

    return cell;
  }

  // Create a placeholder cell for spanning
  public static createPlaceholder(mainCellId: string, row: number, col: number): LinkCell {
    const placeholder = new LinkCell();
    placeholder.id = `${mainCellId}_placeholder_${row}_${col}`;
    placeholder.isPlaceholder = true;
    placeholder.row = row;
    placeholder.col = col;
    placeholder.rowSpan = 1;
    placeholder.colSpan = 1;
    placeholder.links = [];
    return placeholder;
  }

  // Check if this cell occupies a specific grid position
  public occupiesPosition(row: number, col: number): boolean {
    if (this.isPlaceholder) return false;
    
    return row >= this.row && 
           row < this.row + this.rowSpan &&
           col >= this.col && 
           col < this.col + this.colSpan;
  }

  // Get all grid positions occupied by this cell
  public getOccupiedPositions(): { row: number; col: number }[] {
    const positions: { row: number; col: number }[] = [];
    
    if (this.isPlaceholder) return positions;
    
    for (let r = this.row; r < this.row + this.rowSpan; r++) {
      for (let c = this.col; c < this.col + this.colSpan; c++) {
        positions.push({ row: r, col: c });
      }
    }
    
    return positions;
  }

  // Update cell spanning
  public updateSpanning(rowSpan: number, colSpan: number): void {
    this.rowSpan = Math.max(1, rowSpan);
    this.colSpan = Math.max(1, colSpan);
  }

  // Navigate to next variant in edit mode
  public nextVariant(): void {
    const activeVariants = this.links.filter(link => !Link.isEmpty(link));
    if (activeVariants.length <= 1) return;
    
    this.currentEditingIndex = (this.currentEditingIndex + 1) % this.links.length;
    
    // Skip empty variants
    let attempts = 0;
    while (Link.isEmpty(this.links[this.currentEditingIndex]) && attempts < this.links.length) {
      this.currentEditingIndex = (this.currentEditingIndex + 1) % this.links.length;
      attempts++;
    }
  }

  // Navigate to previous variant in edit mode
  public previousVariant(): void {
    const activeVariants = this.links.filter(link => !Link.isEmpty(link));
    if (activeVariants.length <= 1) return;
    
    this.currentEditingIndex = this.currentEditingIndex - 1;
    if (this.currentEditingIndex < 0) {
      this.currentEditingIndex = this.links.length - 1;
    }
    
    // Skip empty variants
    let attempts = 0;
    while (Link.isEmpty(this.links[this.currentEditingIndex]) && attempts < this.links.length) {
      this.currentEditingIndex = this.currentEditingIndex - 1;
      if (this.currentEditingIndex < 0) {
        this.currentEditingIndex = this.links.length - 1;
      }
      attempts++;
    }
  }

  // Add a new variant to this cell
  public addVariant(link?: Link, weight: number = 1): void {
    const newLink = link || new Link();
    this.links.push(newLink);
    this.weights.push(weight);
    
    // Set current editing index to the new variant
    this.currentEditingIndex = this.links.length - 1;
    
    // Auto-enable rotation when adding second variant
    if (this.links.filter(l => !Link.isEmpty(l)).length >= 2) {
      this.rotationEnabled = true;
    }
  }

  // Remove current variant and navigate to next available
  public removeCurrentVariant(): boolean {
    const activeVariants = this.links.filter(link => !Link.isEmpty(link));
    
    // If this is the last active variant, clear it instead of removing it
    if (activeVariants.length <= 1) {
      const currentIndex = this.currentEditingIndex;
      if (currentIndex >= 0 && currentIndex < this.links.length) {
        // Clear the current variant by replacing it with an empty link
        this.links[currentIndex] = new Link();
        this.weights[currentIndex] = 1;
        
        // Reset cell properties when clearing the last variant
        this.displayName = '';
        this.rotationEnabled = false;
        this.impressionCount = 0;
        this.variantImpressions = {};
        this.currentEditingIndex = 0;
        
        return true;
      }
      return false;
    }

    const currentIndex = this.currentEditingIndex;
    
    // Remove the current variant
    this.links.splice(currentIndex, 1);
    this.weights.splice(currentIndex, 1);
    
    // Adjust current editing index
    if (this.currentEditingIndex >= this.links.length) {
      this.currentEditingIndex = this.links.length - 1;
    }
    
    // Skip to next non-empty variant if current is empty
    if (this.links.length > 0 && Link.isEmpty(this.links[this.currentEditingIndex])) {
      this.nextVariant();
    }
    
    // Auto-disable rotation if only one variant left
    const remainingActive = this.links.filter(l => !Link.isEmpty(l));
    if (remainingActive.length <= 1) {
      this.rotationEnabled = false;
    }
    
    return true;
  }

  // Get the current variant being edited
  public getCurrentEditingVariant(): Link {
    if (this.currentEditingIndex >= 0 && this.currentEditingIndex < this.links.length) {
      return this.links[this.currentEditingIndex];
    }
    return this.links[0] || new Link();
  }

  // Set the current editing variant
  public setCurrentEditingVariant(index: number): void {
    if (index >= 0 && index < this.links.length) {
      this.currentEditingIndex = index;
    }
  }

  // Track an impression for a specific variant
  public trackImpression(variantId: string): void {
    this.impressionCount++;
    this.variantImpressions[variantId] = (this.variantImpressions[variantId] || 0) + 1;
  }

  // Get analytics data for this cell
  public getVariantAnalytics(): {
    variantId: string;
    title: string;
    impressions: number;
    clicks: number;
    clickRate: number;
  }[] {
    return this.links.map(link => {
      const impressions = this.variantImpressions[link.id] || 0;
      const clicks = link.clickCount || 0;
      const clickRate = impressions > 0 ? (clicks / impressions) * 100 : 0;
      
      return {
        variantId: link.id,
        title: link.title || 'Untitled Variant',
        impressions,
        clicks,
        clickRate: Math.round(clickRate * 100) / 100
      };
    });
  }

  // Get the best performing variant
  public getBestPerformingVariant(): { variantId: string; clickRate: number } | null {
    const analytics = this.getVariantAnalytics();
    if (analytics.length === 0) return null;
    
    let best = analytics[0];
    for (const variant of analytics) {
      if (variant.clickRate > best.clickRate) {
        best = variant;
      }
    }
    
    return best.impressions > 0 ? { variantId: best.variantId, clickRate: best.clickRate } : null;
  }

  // Get active (non-empty) variants count
  public getActiveVariantCount(): number {
    return this.links.filter(link => !Link.isEmpty(link)).length;
  }

  // Clean up empty variants
  public cleanupEmptyVariants(): void {
    const activeIndices: number[] = [];
    const activeLinks: Link[] = [];
    const activeWeights: number[] = [];
    
    this.links.forEach((link, index) => {
      if (!Link.isEmpty(link)) {
        activeIndices.push(index);
        activeLinks.push(link);
        activeWeights.push(this.weights[index] || 1);
      }
    });
    
    // Keep at least one variant (even if empty)
    if (activeLinks.length === 0) {
      activeLinks.push(new Link());
      activeWeights.push(1);
      activeIndices.push(0);
    }
    
    this.links = activeLinks;
    this.weights = activeWeights;
    
    // Adjust current editing index
    if (this.currentEditingIndex >= this.links.length) {
      this.currentEditingIndex = this.links.length - 1;
    }
    
    // Update rotation setting
    this.rotationEnabled = activeLinks.filter(l => !Link.isEmpty(l)).length > 1;
  }
}