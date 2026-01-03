import { Devvit } from '@devvit/public-api';
import { settings } from './config/settings.js';
import { banUserMenuItem } from './menuItems/banUser.js';
import { bulkBanUsersMenuItem } from './menuItems/bulkBanUsers.js';
import { exportBannedUsersMenuItem } from './menuItems/exportBannedUsers.js';

// Configuration
Devvit.configure({
  redditAPI: true,
  http: false
});

// Add settings
Devvit.addSettings(settings);

// Add menu items
Devvit.addMenuItem(banUserMenuItem);
Devvit.addMenuItem(bulkBanUsersMenuItem);
Devvit.addMenuItem(exportBannedUsersMenuItem);

export default Devvit;