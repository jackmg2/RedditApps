import {
  context,
  reddit,
  type WikiPagePermissionLevel,
} from '@devvit/web/server';
import type { PostRecord } from '../types/PostRecord';
import { redisService } from './redisService';

// Parent index page; each month gets a child page `redditratio/YYYY-MM`.
const INDEX_PAGE = 'redditratio';
const monthPage = (month: string): string => `${INDEX_PAGE}/${month}`;

// WikiPagePermissionLevel.MODS_ONLY — the enum is only type-exported through
// @devvit/web/server, so the value is spelled out here.
const MODS_ONLY = 2 as WikiPagePermissionLevel;

export class WikiService {
  static async recordPost(postRecord: PostRecord): Promise<void> {
    try {
      const { month, monthCreated } = await redisService.addEvent(postRecord);
      // Only the affected month's page changes per event; the index changes
      // only when a brand-new month first appears.
      await this.renderMonthPage(month);
      if (monthCreated) {
        await this.updateIndexPage();
      }
    } catch (error) {
      console.error('Error recording post:', error);
    }
  }

  /**
   * Regenerates the index page and every month page from scratch and re-applies
   * their mod-only permissions. Returns the total event count across all months.
   */
  static async refreshWiki(): Promise<number> {
    const months = await redisService.getEventMonths();
    let total = 0;
    for (const month of months) {
      total += await this.renderMonthPage(month);
    }
    await this.updateIndexPage();
    await this.applyModOnlySettings(INDEX_PAGE);
    return total;
  }

  /**
   * Renders a single month's child page from its Redis bucket, grouped by author
   * with posts newest-first. Returns the number of events rendered.
   */
  private static async renderMonthPage(month: string): Promise<number> {
    const posts = await redisService.getEventsForMonth(month);

    // Group posts by author
    const postsByAuthor: Record<string, PostRecord[]> = {};
    posts.forEach((post) => {
      if (!postsByAuthor[post.authorName]) {
        postsByAuthor[post.authorName] = [];
      }
      postsByAuthor[post.authorName]!.push(post);
    });

    // Build month page content
    let wikiContent = `# Post History by User — ${month}\n\n`;
    wikiContent +=
      'This page is automatically generated and tracks posts with their ratio ' +
      `changes for ${month}. ${posts.length} events.\n\n`;

    // Sort authors alphabetically
    const sortedAuthors = Object.keys(postsByAuthor).sort();
    sortedAuthors.forEach((author) => {
      wikiContent += `## ${author}\n\n`;

      // Sort posts newest first (timestamp when available, date otherwise)
      const sortedPosts = postsByAuthor[author]!.sort(
        (a, b) =>
          (b.timestamp ?? new Date(b.date).getTime()) -
          (a.timestamp ?? new Date(a.date).getTime())
      );

      sortedPosts.forEach((post) => {
        wikiContent += `* ${post.date}: [${post.postTitle}](${post.postLink}) - Ratio: ${post.ratio}\n`;
      });

      wikiContent += '\n';
    });

    await this.upsertPage(monthPage(month), wikiContent, 'month history');
    return posts.length;
  }

  /**
   * Rebuilds the parent index page: intro text plus a newest-first list of links
   * to each month's child page.
   */
  private static async updateIndexPage(): Promise<void> {
    const subredditName = context.subredditName;
    const months = await redisService.getEventMonths();

    let wikiContent = '# Post History by User\n\n';
    wikiContent +=
      'This page is automatically generated and tracks posts with their ratio ' +
      'changes. History is split into one page per month, newest first.\n\n';

    // Newest month first
    [...months].reverse().forEach((month) => {
      wikiContent += `* [${month}](/r/${subredditName}/wiki/${monthPage(month)})\n`;
    });

    await this.upsertPage(INDEX_PAGE, wikiContent, 'index');
  }

  /**
   * Creates or updates a wiki page, applying mod-only settings on first create.
   */
  private static async upsertPage(
    page: string,
    content: string,
    label: string
  ): Promise<void> {
    const subredditName = context.subredditName;
    try {
      let pageExists = false;
      try {
        await reddit.getWikiPage(subredditName, page);
        pageExists = true;
      } catch {
        pageExists = false;
      }

      if (pageExists) {
        await reddit.updateWikiPage({
          subredditName,
          page,
          content,
          reason: 'Automatic update by RedditRatio',
        });
      } else {
        await reddit.createWikiPage({
          subredditName,
          page,
          content,
          reason: 'Automatic creation by RedditRatio',
        });
        // The pages hold per-user posting history; keep them out of public view
        await this.applyModOnlySettings(page);
      }
    } catch (error) {
      console.error(`Error updating wiki ${label} page (${page}):`, error);
    }
  }

  private static async applyModOnlySettings(page: string): Promise<void> {
    try {
      await reddit.updateWikiPageSettings({
        subredditName: context.subredditName,
        page,
        listed: false,
        permLevel: MODS_ONLY,
      });
      console.log(`Wiki page ${page} set to mods-only`);
    } catch (error) {
      console.error(`Error setting wiki page permissions (${page}):`, error);
    }
  }
}
