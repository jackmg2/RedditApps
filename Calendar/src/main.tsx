import { Devvit } from '@devvit/public-api';
import { settings } from './config/settings.js';
import { createCalendarPostMenuItem } from './menuItems/createCalendarPost.js';
import { CalendarPost } from './components/CalendarPost.js';

// Add settings
Devvit.addSettings(settings);

// Add menu items
Devvit.addMenuItem(createCalendarPostMenuItem);

// Add custom post type
Devvit.addCustomPostType({
  name: 'Community Calendar',
  height: 'tall',
  render: CalendarPost
});

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;