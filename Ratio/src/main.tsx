import { Devvit, PostDelete, PostSubmit } from '@devvit/public-api';
import { settings } from './config/settings.js';
import { postSubmitTrigger } from './triggers/postSubmit.js';
import { postDeleteTrigger } from './triggers/postDelete.js';
import { manualRatioMenuItem } from './menuItems/manualRatio.js';
import { changeFlairAndRatioMenuItem } from './menuItems/changeFlairAndRatio.js';
import { removeFlairMenuItem } from './menuItems/removeFlair.js';
import { refreshWikiMenuItem } from './menuItems/refreshWiki.js';
import { setRatioByUsernameMenuItem } from './menuItems/setRatioByUsername.js';

// Add settings
Devvit.addSettings(settings);

// Add triggers
Devvit.addTrigger<PostSubmit>(postSubmitTrigger);
Devvit.addTrigger<PostDelete>(postDeleteTrigger);

// Add menu items
Devvit.addMenuItem(manualRatioMenuItem);
Devvit.addMenuItem(changeFlairAndRatioMenuItem);
Devvit.addMenuItem(removeFlairMenuItem);
Devvit.addMenuItem(refreshWikiMenuItem);
Devvit.addMenuItem(setRatioByUsernameMenuItem);

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;