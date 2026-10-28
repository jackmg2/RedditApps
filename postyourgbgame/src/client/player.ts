import {context} from '@devvit/web/client'
import {mountPlayer} from './player/app.ts'

// Expanded-mode entrypoint: the emulator only ever loads here, never in the
// feed splash.
mountPlayer(document.getElementById('app') as HTMLElement, {
  postId: context.postId,
  loggedIn: !!context.userId,
})
