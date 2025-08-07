import { TriggerContext, Devvit } from '@devvit/public-api';
import { PostRecord } from '../types/PostRecord.js';
import { redisService } from './redisService.js';

export class WikiService {
  static async recordPost(context: TriggerContext | Devvit.Context, postRecord: PostRecord): Promise<void> {
    try {
      await redisService.addPostRecord(postRecord, context);
      const posts = await redisService.getPostRecords(context);
      await this.updateWikiPage(context, posts);
    } catch (error) {
      console.error('Error recording post:', error);
    }
  }

  static async updateWikiPage(context: TriggerContext | Devvit.Context, posts: PostRecord[]): Promise<void> {
    try {
      const subredditName = (await context.reddit.getCurrentSubreddit()).name;
      const wikiPageName = 'redditratio';

      // Group posts by author
      const postsByAuthor: Record<string, PostRecord[]> = {};
      posts.forEach(post => {
        if (!postsByAuthor[post.authorName]) {
          postsByAuthor[post.authorName] = [];
        }
        postsByAuthor[post.authorName].push(post);
      });

      // Create wiki content
      let wikiContent = '# Post History by User\n\n';
      wikiContent += 'This page is automatically generated and tracks all posts with their ratio changes.\n\n';

      // Sort authors alphabetically
      const sortedAuthors = Object.keys(postsByAuthor).sort();

      sortedAuthors.forEach(author => {
        wikiContent += `## ${author}\n\n`;

        // Sort posts by date descending (newest first)
        const sortedPosts = postsByAuthor[author].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        sortedPosts.forEach(post => {
          wikiContent += `* ${post.date}: [${post.postTitle}](${post.postLink}) - Ratio: ${post.ratio}\n`;
        });

        wikiContent += '\n';
      });

      // Update the wiki page
      try {
        let pageExists = false;
        try {
          await context.reddit.getWikiPage(subredditName, wikiPageName);
          pageExists = true;
        } catch (error) {
          pageExists = false;
        }

        if (pageExists) {
          await context.reddit.updateWikiPage({
            subredditName: subredditName,
            page: wikiPageName,
            content: wikiContent,
            reason: 'Automatic update by RedditRatio'
          });
        } else {
          await context.reddit.createWikiPage({
            subredditName: subredditName,
            page: wikiPageName,
            content: wikiContent,
            reason: 'Automatic creation by RedditRatio'
          });
        }
      } catch (error) {
        console.error('Error updating wiki page:', error);
      }
    } catch (error) {
      console.error('Error in updateWikiPage:', error);
    }
  }
}