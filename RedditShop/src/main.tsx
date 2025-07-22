import { Devvit } from '@devvit/public-api';
import './createPost.js';
import { ShopPostRenderer } from './components/ShopPostRenderer.js';

Devvit.addSettings([
  {
    name: 'allowAllUsers',
    label: 'Allow all users to create shop posts',
    type: 'boolean',
    helpText: 'If enabled, all users can create shop posts. If disabled, only moderators can create them.',
    defaultValue: false
  }
]);

Devvit.addCustomPostType({
  name: 'Shop Post',
  height: 'tall',
  render: (context) => <ShopPostRenderer context={context} />
});

Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;