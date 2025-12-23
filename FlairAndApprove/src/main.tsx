import { Devvit } from '@devvit/public-api';
import { settings } from './config/settings.js';
import { verifyAndApprovePostMenuItem, verifyAndApproveCommentMenuItem } from './menuItems/verifyAndApprove.js';
import { bulkApproveMenuItem } from './menuItems/bulkApprove.js';
import { exportApprovedUsersMenuItem } from './menuItems/exportApprovedUsers.js';

// Configure Devvit with Redis enabled
Devvit.configure({ 
  redditAPI: true, 
  redis: true,
  http: false 
});

// Add settings
Devvit.addSettings(settings);

// Add menu items
Devvit.addMenuItem(verifyAndApprovePostMenuItem);
Devvit.addMenuItem(verifyAndApproveCommentMenuItem);
Devvit.addMenuItem(bulkApproveMenuItem);
Devvit.addMenuItem(exportApprovedUsersMenuItem);

export default Devvit;