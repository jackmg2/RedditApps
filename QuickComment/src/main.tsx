import { Devvit } from '@devvit/public-api';
import { registerMenuItems } from './menu/index.js';
import { autoCommentTrigger } from './triggers/autoComment.js';

// Configure Devvit
Devvit.configure({ redditAPI: true, http: false });

// Add settings
Devvit.addSettings([
  {
    name: 'autoCommentEnabled',
    label: 'Enable Auto-commenting on Flaired Posts',
    type: 'boolean',
    helpText: 'Automatically post predefined comments when posts are created with matching flairs.',
  },
  {
    name: 'defaultValuePinComment',
    label: 'Check Sticky Comment by default',
    type: 'boolean',
  },
]);

// Register all menu items
registerMenuItems();

// Register triggers
Devvit.addTrigger(autoCommentTrigger);

export default Devvit;