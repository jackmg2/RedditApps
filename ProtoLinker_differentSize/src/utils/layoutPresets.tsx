// src/utils/layoutPresets.tsx
import { LinkCell } from '../types/linkCell.js';
import { Link } from '../types/link.js';
import { Page } from '../types/page.js';
import { randomId } from '../utils.js';

export type LayoutPreset = 'hero' | 'dashboard' | 'magazine' | 'mosaic' | 'minimal';

/**
 * Create preset layouts for quick setup
 */
export class LayoutPresets {
  
  /**
   * Hero Layout: Large featured section with supporting cells
   * ┌───────────────┬─────┬─────┐
   * │  2×2 Feature  │ 1×1 │ 1×1 │
   * │               ├─────┼─────┤
   * ├───────────────┤ 1×1 │ 1×1 │
   * │  1×2 Secondary├─────┼─────┤
   * │               │ 1×1 │ 1×1 │
   * └───────────────┴─────┴─────┘
   */
  static createHeroLayout(): LinkCell[] {
    const cells: LinkCell[] = [];
    
    // Main hero cell (2×2)
    const heroCell = new LinkCell();
    heroCell.row = 0;
    heroCell.col = 0;
    heroCell.rowSpan = 2;
    heroCell.colSpan = 2;
    heroCell.displayName = 'Featured Content';
    const heroLink = new Link();
    heroLink.title = '🌟 Join Our Discord';
    heroLink.description = 'Connect with 5000+ community members';
    heroLink.backgroundColor = '#5865F2';
    heroLink.textColor = '#FFFFFF';
    heroCell.links = [heroLink];
    cells.push(heroCell);
    
    // Secondary feature (1×2)
    const secondaryCell = new LinkCell();
    secondaryCell.row = 2;
    secondaryCell.col = 0;
    secondaryCell.rowSpan = 2;
    secondaryCell.colSpan = 2;
    secondaryCell.displayName = 'Secondary Feature';
    const secondaryLink = new Link();
    secondaryLink.title = '📚 Community Wiki';
    secondaryLink.description = 'Guides and resources';
    secondaryCell.links = [secondaryLink];
    cells.push(secondaryCell);
    
    // Supporting cells (1×1)
    const positions = [
      {row: 0, col: 2}, {row: 0, col: 3},
      {row: 1, col: 2}, {row: 1, col: 3},
      {row: 2, col: 2}, {row: 2, col: 3},
      {row: 3, col: 2}, {row: 3, col: 3}
    ];
    
    const titles = ['📋 Rules', '📅 Events', '🎮 Games', '💬 Chat', 
                    '🎯 Goals', '📊 Stats', '🔗 Links', '❓ FAQ'];
    
    positions.forEach((pos, index) => {
      const cell = new LinkCell();
      cell.row = pos.row;
      cell.col = pos.col;
      cell.rowSpan = 1;
      cell.colSpan = 1;
      const link = new Link();
      link.title = titles[index];
      cell.links = [link];
      cells.push(cell);
    });
    
    return cells;
  }
  
  /**
   * Dashboard Layout: Header banner with organized sections
   * ┌───────────────────────────┐
   * │    1×4 Announcement       │
   * ├───────────────┬───────────┤
   * │  2×2 Main     │  2×2 Info │
   * │               │           │
   * ├───────────────┴───────────┤
   * │    1×4 Footer Resources   │
   * └───────────────────────────┘
   */
  static createDashboardLayout(): LinkCell[] {
    const cells: LinkCell[] = [];
    
    // Header banner (1×4)
    const headerCell = new LinkCell();
    headerCell.row = 0;
    headerCell.col = 0;
    headerCell.rowSpan = 1;
    headerCell.colSpan = 4;
    headerCell.displayName = 'Announcement Banner';
    const headerLink = new Link();
    headerLink.title = '📢 Important Announcement';
    headerLink.backgroundColor = '#FF6B6B';
    headerLink.textColor = '#FFFFFF';
    headerCell.links = [headerLink];
    cells.push(headerCell);
    
    // Main content (2×2)
    const mainCell = new LinkCell();
    mainCell.row = 1;
    mainCell.col = 0;
    mainCell.rowSpan = 2;
    mainCell.colSpan = 2;
    mainCell.displayName = 'Main Content';
    const mainLink = new Link();
    mainLink.title = '🏠 Community Hub';
    mainLink.description = 'Start here';
    mainCell.links = [mainLink];
    cells.push(mainCell);
    
    // Info section (2×2)
    const infoCell = new LinkCell();
    infoCell.row = 1;
    infoCell.col = 2;
    infoCell.rowSpan = 2;
    infoCell.colSpan = 2;
    infoCell.displayName = 'Information';
    const infoLink = new Link();
    infoLink.title = 'ℹ️ Information Center';
    infoLink.description = 'Everything you need to know';
    infoCell.links = [infoLink];
    cells.push(infoCell);
    
    // Footer (1×4)
    const footerCell = new LinkCell();
    footerCell.row = 3;
    footerCell.col = 0;
    footerCell.rowSpan = 1;
    footerCell.colSpan = 4;
    footerCell.displayName = 'Resources';
    const footerLink = new Link();
    footerLink.title = '🔗 Quick Links & Resources';
    footerCell.links = [footerLink];
    cells.push(footerCell);
    
    return cells;
  }
  
  /**
   * Magazine Layout: Editorial style with varied sizes
   * ┌───────────────┬───────────┐
   * │               │  2×1 Side │
   * │  2×3 Feature  ├───────────┤
   * │               │  2×1 Side │
   * ├───────────────┴───────────┤
   * │      1×4 Bottom Bar       │
   * └───────────────────────────┘
   */
  static createMagazineLayout(): LinkCell[] {
    const cells: LinkCell[] = [];
    
    // Main feature article (2×3)
    const featureCell = new LinkCell();
    featureCell.row = 0;
    featureCell.col = 0;
    featureCell.rowSpan = 3;
    featureCell.colSpan = 2;
    featureCell.displayName = 'Feature Article';
    const featureLink = new Link();
    featureLink.title = '📰 Featured Story';
    featureLink.description = 'This week\'s highlight';
    featureCell.links = [featureLink];
    cells.push(featureCell);
    
    // Side articles
    const sideCell1 = new LinkCell();
    sideCell1.row = 0;
    sideCell1.col = 2;
    sideCell1.rowSpan = 1;
    sideCell1.colSpan = 2;
    sideCell1.displayName = 'Article 1';
    const sideLink1 = new Link();
    sideLink1.title = '📝 Latest News';
    sideCell1.links = [sideLink1];
    cells.push(sideCell1);
    
    const sideCell2 = new LinkCell();
    sideCell2.row = 1;
    sideCell2.col = 2;
    sideCell2.rowSpan = 2;
    sideCell2.colSpan = 2;
    sideCell2.displayName = 'Article 2';
    const sideLink2 = new Link();
    sideLink2.title = '💡 Tips & Tricks';
    sideCell2.links = [sideLink2];
    cells.push(sideCell2);
    
    // Bottom bar (1×4)
    const bottomCell = new LinkCell();
    bottomCell.row = 3;
    bottomCell.col = 0;
    bottomCell.rowSpan = 1;
    bottomCell.colSpan = 4;
    bottomCell.displayName = 'More Stories';
    const bottomLink = new Link();
    bottomLink.title = '📚 More Articles & Archives';
    bottomCell.links = [bottomLink];
    cells.push(bottomCell);
    
    return cells;
  }
  
  /**
   * Apply a preset to a page
   */
  static applyPreset(page: Page, preset: LayoutPreset): void {
    let newCells: LinkCell[] = [];
    
    switch (preset) {
      case 'hero':
        newCells = this.createHeroLayout();
        break;
      case 'dashboard':
        newCells = this.createDashboardLayout();
        break;
      case 'magazine':
        newCells = this.createMagazineLayout();
        break;
      case 'mosaic':
        newCells = this.createMosaicLayout();
        break;
      case 'minimal':
        newCells = this.createMinimalLayout();
        break;
    }
    
    // Preserve existing cell content where possible
    newCells.forEach(newCell => {
      // Try to find an existing cell with content at the same position
      const existingCell = page.cells.find(c => 
        c.row === newCell.row && 
        c.col === newCell.col && 
        !LinkCell.isEmpty(c)
      );
      
      if (existingCell) {
        // Preserve existing content
        newCell.links = existingCell.links;
        newCell.weights = existingCell.weights;
        newCell.displayName = existingCell.displayName;
        newCell.rotationEnabled = existingCell.rotationEnabled;
        newCell.impressionCount = existingCell.impressionCount;
        newCell.variantImpressions = existingCell.variantImpressions;
      }
    });
    
    // Update page cells
    page.cells = newCells;
    
    // Ensure grid dimensions are appropriate
    const maxRow = Math.max(...newCells.map(c => c.row + c.rowSpan));
    const maxCol = Math.max(...newCells.map(c => c.col + c.colSpan));
    page.rows = Math.max(page.rows, maxRow);
    page.columns = Math.max(page.columns, maxCol);
  }
  
  /**
   * Mosaic Layout: Artistic arrangement
   */
  static createMosaicLayout(): LinkCell[] {
    const cells: LinkCell[] = [];
    
    // Create an artistic pattern
    const pattern = [
      {row: 0, col: 0, rowSpan: 1, colSpan: 2, title: '🎨 Gallery'},
      {row: 0, col: 2, rowSpan: 2, colSpan: 1, title: '🖼️ Featured'},
      {row: 0, col: 3, rowSpan: 1, colSpan: 1, title: '✨ New'},
      {row: 1, col: 0, rowSpan: 2, colSpan: 1, title: '📸 Photos'},
      {row: 1, col: 1, rowSpan: 1, colSpan: 1, title: '🎭 Art'},
      {row: 1, col: 3, rowSpan: 2, colSpan: 1, title: '🏛️ Museum'},
      {row: 2, col: 1, rowSpan: 1, colSpan: 2, title: '🌟 Showcase'},
      {row: 3, col: 0, rowSpan: 1, colSpan: 4, title: '📅 Upcoming Exhibitions'}
    ];
    
    pattern.forEach(config => {
      const cell = new LinkCell();
      cell.row = config.row;
      cell.col = config.col;
      cell.rowSpan = config.rowSpan;
      cell.colSpan = config.colSpan;
      const link = new Link();
      link.title = config.title;
      cell.links = [link];
      cells.push(cell);
    });
    
    return cells;
  }
  
  /**
   * Minimal Layout: Clean and simple
   */
  static createMinimalLayout(): LinkCell[] {
    const cells: LinkCell[] = [];
    
    // Simple 2×2 grid with equal cells
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const cell = new LinkCell();
        cell.row = row * 2;
        cell.col = col * 2;
        cell.rowSpan = 2;
        cell.colSpan = 2;
        const link = new Link();
        link.title = ['🏠 Home', '📚 Docs', '💬 Community', '⚙️ Settings'][row * 2 + col];
        cell.links = [link];
        cells.push(cell);
      }
    }
    
    return cells;
  }
}