import { randomId } from "../utils.js";
import { Link } from "./link.js";

export class LinkCell {
  public id: string;
  public links: Link[];
  public weights: number[];
  public displayName: string;
  public rotationEnabled: boolean;
  public impressionCount: number; // Track total impressions for this cell
  public variantImpressions: { [variantId: string]: number }; // Track impressions per variant
  public currentEditingIndex: number; // Track current variant being viewed in edit mode

  constructor() {
    this.id = randomId();
    this.links = [new Link()];
    this.weights = [1];
    this.displayName = '';
    this.rotationEnabled = false;
    this.impressionCount = 0;
    this.variantImpressions = {};
    this.currentEditingIndex = 0;
  }

  public static isEmpty(cell: LinkCell): boolean {
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
    if (activeVariants.length <= 1) {
      return false; // Cannot remove the last variant
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

  // Get the current active link (for display/clicking)
  public getActiveLink(): Link {
    if (!this.rotationEnabled || this.links.length === 1) {
      return this.links[0];
    }
    
    // This will be called by the rotation service
    return this.links[0]; // Fallback
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