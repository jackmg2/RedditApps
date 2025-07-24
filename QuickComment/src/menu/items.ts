import { Devvit, Context, MenuItem, MenuItemOnPressEvent } from '@devvit/public-api';
import { CommentStorage } from '../storage/index.js';
import { getSubredditFlairs } from '../utils/reddit.js';
import { formatAllComments } from '../utils/formatters.js';
import {
  postCommentModal,
  createCommentModal,
  createUserCommentModal,
  editCommentModal,
  editUserCommentModal,
  deleteCommentModal,
  deleteUserCommentModal,
  viewAllCommentsModal
} from '../forms/index.js';

export const postCommentMenuItem: MenuItem = {
  location: 'post',
  forUserType: 'moderator',
  label: 'El Commentator: Post Predefined Comment',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const comments = await CommentStorage.getComments(context);
      const userComments = await CommentStorage.getUserComments(context);
      const settings = await context.settings.getAll();

      const allComments = [
        ...comments.map(c => ({ label: `[Flair] ${c.title}`, value: c.comment })),
        ...userComments.map(c => ({ label: `[User] ${c.title} (u/${c.username})`, value: c.comment }))
      ];

      if (allComments.length === 0) {
        context.ui.showToast('No comment templates found. Create one first using "Create Comment Template"');
        return;
      }

      context.ui.showForm(postCommentModal, {
        postId: context.postId as string,
        predefinedComments: allComments,
        defaultValuePinComment: settings.defaultValuePinComment as boolean
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const createCommentMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Create Comment Template',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const flairs = await getSubredditFlairs(context);

      context.ui.showForm(createCommentModal, {
        flairs: flairs.map(f => ({ label: f.text, value: f.id }))
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const createUserCommentMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Create User Comment Template',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      context.ui.showForm(createUserCommentModal);
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const editCommentMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Edit Comment Template',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const comments = await CommentStorage.getComments(context);
      const flairs = await getSubredditFlairs(context);

      if (comments.length === 0) {
        context.ui.showToast('No comment templates found. Create one first using "Create Comment Template"');
        return;
      }
      context.ui.showForm(editCommentModal, {
        comments: comments,
        flairs: flairs.map(f => ({ label: f.text, value: f.id }))
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const editUserCommentMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Edit User Comment Template',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const userComments = await CommentStorage.getUserComments(context);

      if (userComments.length === 0) {
        context.ui.showToast('No user comment templates found. Create one first using "Create User Comment Template"');
        return;
      }

      context.ui.showForm(editUserCommentModal, {
        userComments: userComments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const deleteCommentMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Delete Comment Template',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const comments = await CommentStorage.getComments(context);

      if (comments.length === 0) {
        context.ui.showToast('No comment templates found. Nothing to delete.');
        return;
      }

      context.ui.showForm(deleteCommentModal, {
        comments: comments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const deleteUserCommentMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Delete User Comment Template',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const userComments = await CommentStorage.getUserComments(context);

      if (userComments.length === 0) {
        context.ui.showToast('No user comment templates found. Nothing to delete.');
        return;
      }

      context.ui.showForm(deleteUserCommentModal, {
        userComments: userComments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

export const viewAllCommentsMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: View All Templates',
  onPress: async (event: MenuItemOnPressEvent, context: Context) => {
    try {
      const formattedComments = await formatAllComments(context);

      context.ui.showForm(viewAllCommentsModal, {
        formattedComments: formattedComments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};