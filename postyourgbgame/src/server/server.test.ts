import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import type {AddressInfo, Server} from 'node:net'
import {after, before, beforeEach, test} from 'node:test'
import {
  type Context,
  reddit,
  runWithContext,
  scheduler,
  settings,
} from '@devvit/web/server'
import type {
  ErrorRsp,
  GetRomRsp,
  RomMetaRsp,
  UploadReq,
  UploadRsp,
} from '../shared/api.ts'
import {FakeRedis} from '../test/fakeRedis.ts'
import {makeRom, type RomSpec} from '../test/fixtures.ts'
import {onReq} from './server.ts'
import {draftMaxAgeMs, expireDraft, sweepStaleDrafts} from './service.ts'
import {key} from './store/keys.ts'

type Ctx = {userId?: string; username?: string; postId?: string}
type Ui = {
  showToast?: {text: string}
  showForm?: {name: string; form: {fields: {name: string}[]}}
  navigateTo?: string
}

const fake = new FakeRedis()
let server: Server
let serverURL: string
let ctx: Ctx = {}
let mods = new Set<string>()
let appSettings: {[name: string]: unknown} = {}
let submitted: {[opt: string]: unknown}[] = []
let failSubmit = false
let removedPosts = new Set<string>()
let wiki = new Map<string, string>()
let wikiSettings: {[opt: string]: unknown}[] = []
let jobs: {name: string; data?: {postId?: string}; runAt: Date}[] = []
type AppPost = {id: string; subredditName: string; removed: boolean}
let appPosts: AppPost[] = []
let deletedPosts: string[] = []

const patches: [object, string, PropertyDescriptor | undefined][] = []
function patch(target: object, name: string, value: unknown): void {
  patches.push([target, name, Object.getOwnPropertyDescriptor(target, name)])
  Object.defineProperty(target, name, {
    value,
    configurable: true,
    writable: true,
  })
}

before(async () => {
  fake.install()
  patch(settings, 'getAll', async () => appSettings)
  patch(scheduler, 'runJob', async (job: (typeof jobs)[number]) => {
    jobs.push(job)
    return `job${jobs.length}`
  })
  patch(reddit, 'getCurrentUser', async () =>
    ctx.username
      ? {
          username: ctx.username,
          getModPermissionsForSubreddit: async () =>
            mods.has(ctx.username ?? '') ? ['all'] : [],
        }
      : undefined,
  )
  patch(reddit, 'getAppUser', async () => ({username: 'postyourgbgame'}))
  patch(reddit, 'submitCustomPost', async (opts: {[opt: string]: unknown}) => {
    if (failSubmit) throw new Error('nope')
    submitted.push(opts)
    const id = `t3_new${submitted.length}`
    return {id, url: `https://reddit.com/r/homebrew/comments/${id.slice(3)}/`}
  })
  patch(reddit, 'getPostById', async (id: string) => ({
    id,
    url: `https://reddit.com/r/homebrew/comments/${id.slice(3)}/`,
    authorName: 'alice',
    removed: removedPosts.has(id),
    remove: async () => {
      removedPosts.add(id)
    },
    addRemovalNote: async () => {},
  }))
  patch(reddit, 'getPostsByUser', (opts: {username: string}) =>
    (async function* () {
      if (opts.username !== 'postyourgbgame') return
      for (const p of appPosts)
        yield {
          ...p,
          removedByCategory: p.removed ? 'moderator' : undefined,
          isRemoved: () => p.removed,
          isSpam: () => false,
          delete: async () => {
            deletedPosts.push(p.id)
          },
        }
    })(),
  )
  patch(reddit, 'getWikiPage', async (_sub: string, page: string) => {
    const content = wiki.get(page)
    if (content === undefined) throw new Error('PAGE_NOT_CREATED')
    return {content}
  })
  const writeWiki = async (opts: {page: string; content: string}) => {
    wiki.set(opts.page, opts.content)
    return {}
  }
  patch(reddit, 'createWikiPage', writeWiki)
  patch(reddit, 'updateWikiPage', writeWiki)
  patch(
    reddit,
    'updateWikiPageSettings',
    async (opts: {[opt: string]: unknown}) => {
      wikiSettings.push(opts)
      return {}
    },
  )

  server = createServer((req, rsp) => {
    const context = {
      appName: 'postyourgbgame',
      appSlug: 'postyourgbgame',
      subredditName: 'homebrew',
      subredditId: 't5_sub',
      ...ctx,
    } as unknown as Context
    void runWithContext(context, () => onReq(req, rsp))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  serverURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  fake.restore()
  for (const [target, name, desc] of patches.reverse()) {
    if (desc) Object.defineProperty(target, name, desc)
    else delete (target as {[name: string]: unknown})[name]
  }
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  )
})

beforeEach(() => {
  fake.clear()
  ctx = {userId: 't2_alice', username: 'alice'}
  mods = new Set()
  appSettings = {}
  submitted = []
  failSubmit = false
  removedPosts = new Set()
  wiki = new Map()
  wikiSettings = []
  jobs = []
  appPosts = []
  deletedPosts = []
})

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{status: number; json: T}> {
  const rsp = await fetch(`${serverURL}${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: {'Content-Type': 'application/json'},
        }),
  })
  return {status: rsp.status, json: (await rsp.json()) as T}
}

function uploadBody(
  spec: RomSpec = {},
  over: Partial<UploadReq> = {},
): UploadReq {
  const rom = makeRom(spec)
  return {
    fileName: 'game.gb',
    sizeBytes: rom.length,
    licence: 'MIT',
    sourceUrl: 'https://example.com/src',
    colourMode: 'auto',
    romBase64: Buffer.from(rom).toString('base64'),
    attested: true,
    ...over,
  }
}

/** Menu form → post waiting for its ROM; returns the post id. */
async function createPost(
  title = 'My Game',
  description = 'A tiny demo.',
): Promise<string> {
  const rsp = await call<Ui>('POST', '/internal/form/create-rom-post', {
    title,
    description,
  })
  assert.ok(rsp.json.navigateTo, JSON.stringify(rsp.json))
  return `t3_new${submitted.length}`
}

/** Uploads into the given post as the current user. */
function upload(
  postId: string,
  spec: RomSpec = {},
): Promise<{status: number; json: UploadRsp & ErrorRsp}> {
  ctx = {...ctx, postId}
  return call('POST', `/api/rom/${postId}/upload`, uploadBody(spec))
}

async function uploadAsMod(
  spec: RomSpec = {},
): Promise<UploadRsp & {postId: string}> {
  mods.add('alice')
  const postId = await createPost()
  const rsp = await upload(postId, spec)
  assert.equal(rsp.status, 200, JSON.stringify(rsp.json))
  return {...rsp.json, postId}
}

test('default permissions: non-mods cannot create ROM posts', async () => {
  const menu = await call<Ui>('POST', '/internal/menu/upload', {})
  assert.match(menu.json.showToast?.text ?? '', /moderators/)
  const form = await call<Ui>('POST', '/internal/form/create-rom-post', {
    title: 'x',
  })
  assert.ok(form.json.showToast)
  assert.equal(submitted.length, 0)
  assert.equal(fake.data.size, 0)
})

test('the menu asks for a title and description first', async () => {
  mods.add('alice')
  const menu = await call<Ui>('POST', '/internal/menu/upload', {})
  assert.equal(menu.json.showForm?.name, 'createRomPost')
  assert.deepEqual(
    menu.json.showForm?.form.fields.map(f => f.name),
    ['title', 'description'],
  )
})

test('creating the post submits it as the user and waits for the ROM', async () => {
  mods.add('alice')
  const postId = await createPost()
  const opts = submitted[0]
  assert.equal(opts?.runAs, 'USER')
  assert.equal(opts?.entry, 'default')
  assert.deepEqual(opts?.postData, {kind: 'rom'})
  assert.equal(opts?.title, 'My Game')
  assert.deepEqual(opts?.userGeneratedContent, {
    text: 'My Game\n\nA tiny demo.',
  })

  ctx = {...ctx, postId}
  const mine = await call<RomMetaRsp>('GET', `/api/rom/${postId}/meta`)
  assert.deepEqual(mine.json, {
    state: 'draft',
    title: 'My Game',
    description: 'A tiny demo.',
    authorName: 'alice',
    isAuthor: true,
  })
  ctx = {userId: 't2_bob', username: 'bob', postId}
  const theirs = await call<RomMetaRsp>('GET', `/api/rom/${postId}/meta`)
  assert.equal(theirs.json.state === 'draft' && theirs.json.isAuthor, false)
  assert.equal((await call('GET', `/api/rom/${postId}`)).status, 404)
})

test('allowed usernames and allowEveryone open uploads', async () => {
  appSettings = {allowedUsernames: 'u/Alice'}
  assert.equal((await upload(await createPost(), {seed: 1})).status, 200)
  appSettings = {allowEveryone: true}
  ctx = {userId: 't2_bob', username: 'bob'}
  assert.equal((await upload(await createPost(), {seed: 2})).status, 200)
})

test('upload makes the post playable and lists it on the wiki page', async () => {
  const {postId, romId, postUrl} = await uploadAsMod()
  assert.ok(postUrl.includes(postId.slice(3)))
  assert.equal(await fake.impl.get(key.post(postId)), romId)
  assert.equal(fake.data.has(key.draft(postId)), false)

  ctx = {userId: 't2_bob', username: 'bob', postId}
  const meta = await call<RomMetaRsp>('GET', `/api/rom/${postId}/meta`)
  assert.equal(meta.json.state, 'live')
  const rom = await call<GetRomRsp>('GET', `/api/rom/${postId}`)
  assert.equal(rom.status, 200)
  assert.equal(rom.json.romBase64, uploadBody().romBase64)
  assert.equal(rom.json.meta.title, 'My Game')
  assert.equal(rom.json.meta.uploaderName, 'alice')
  assert.equal('uploaderId' in rom.json.meta, false)

  const page = wiki.get('homebrew-roms') ?? ''
  assert.match(
    page,
    /\[My Game\]\(https:\/\/www\.reddit\.com\/r\/homebrew\/comments\/new1\/\)/,
  )
  assert.match(page, /u\/alice/)
  assert.deepEqual(wikiSettings, [
    {
      subredditName: 'homebrew',
      page: 'homebrew-roms',
      listed: true,
      permLevel: 1,
    },
  ])
})

test('a ROM cannot be replaced once uploaded', async () => {
  const {postId, romId} = await uploadAsMod()
  const again = await upload(postId, {seed: 9})
  assert.equal(again.status, 409)
  assert.equal(again.json.error, 'ROM_LOCKED')
  assert.equal(
    (await call<ErrorRsp>('GET', `/api/rom/${postId}/upload`)).json.error,
    'ROM_LOCKED',
  )
  assert.equal(await fake.impl.get(key.post(postId)), romId)
})

test('only the post author can upload its ROM', async () => {
  appSettings = {allowEveryone: true}
  const postId = await createPost()
  ctx = {userId: 't2_bob', username: 'bob'}
  const rsp = await upload(postId)
  assert.equal(rsp.status, 403)
  assert.match(rsp.json.message, /u\/alice/)
  ctx = {userId: 't2_alice', username: 'alice'}
  assert.equal((await upload(postId)).status, 200)
})

test('uploads are scoped to the post they come from', async () => {
  mods.add('alice')
  const postId = await createPost()
  ctx = {...ctx, postId: 't3_other'}
  assert.equal(
    (await call('POST', `/api/rom/${postId}/upload`, uploadBody())).status,
    403,
  )
})

test('one waiting post per user; a removed one is forgotten', async () => {
  mods.add('alice')
  const postId = await createPost()
  const again = await call<Ui>('POST', '/internal/menu/upload', {})
  assert.ok(again.json.navigateTo?.includes(postId.slice(3)))
  assert.equal(again.json.showForm, undefined)

  removedPosts.add(postId)
  const fresh = await call<Ui>('POST', '/internal/menu/upload', {})
  assert.equal(fresh.json.showForm?.name, 'createRomPost')
  assert.equal(fake.data.has(key.draft(postId)), false)
})

test('ROM bytes are only served to the post they belong to', async () => {
  const {postId} = await uploadAsMod()
  ctx = {userId: 't2_bob', username: 'bob', postId: 't3_other'}
  assert.equal((await call('GET', `/api/rom/${postId}`)).status, 403)
})

test('removed posts are not playable except by mods', async () => {
  const {postId} = await uploadAsMod()
  removedPosts.add(postId)
  ctx = {userId: 't2_bob', username: 'bob', postId}
  assert.equal((await call('GET', `/api/rom/${postId}`)).status, 404)
  mods.add('bob')
  assert.equal((await call('GET', `/api/rom/${postId}`)).status, 200)
})

test('validation failures store nothing and allow a retry', async () => {
  mods.add('alice')
  const postId = await createPost()
  const rsp = await upload(postId, {title: 'TETRIS'})
  assert.equal(rsp.status, 422)
  assert.equal(rsp.json.error, 'REJECT_TITLE')
  assert.equal(fake.data.has(key.post(postId)), false)
  assert.equal(
    [...fake.data.keys()].some(k => k.startsWith('hb:rom:')),
    false,
  )
  assert.equal((await upload(postId)).status, 200)
})

test('declared size must match the decoded bytes', async () => {
  mods.add('alice')
  const postId = await createPost()
  ctx = {...ctx, postId}
  const body = uploadBody()
  const rsp = await call<ErrorRsp>('POST', `/api/rom/${postId}/upload`, {
    ...body,
    sizeBytes: body.sizeBytes + 1,
  })
  assert.equal(rsp.status, 400)
})

test('duplicates point at the existing post', async () => {
  const {postId} = await uploadAsMod()
  const second = await createPost('Copy')
  const rsp = await upload(second)
  assert.equal(rsp.status, 409)
  assert.equal(rsp.json.error, 'REJECT_DUPLICATE')
  assert.ok(rsp.json.existingPostUrl?.includes(postId.slice(3)))
  assert.equal(fake.data.has(key.post(second)), false)
})

test('failed post creation stores nothing', async () => {
  mods.add('alice')
  failSubmit = true
  const rsp = await call<Ui>('POST', '/internal/form/create-rom-post', {
    title: 'My Game',
  })
  assert.match(rsp.json.showToast?.text ?? '', /did not accept/)
  assert.equal(
    [...fake.data.keys()].some(k => k.startsWith('hb:draft')),
    false,
  )
})

test('per-user quota is checked before creating a post', async () => {
  appSettings = {maxRomsPerUser: 1}
  await uploadAsMod({seed: 1})
  const rsp = await call<Ui>('POST', '/internal/menu/upload', {})
  assert.match(rsp.json.showToast?.text ?? '', /limit of 1 ROMs/)
})

test('saves round-trip and are size-checked', async () => {
  const {postId} = await uploadAsMod()
  ctx = {userId: 't2_bob', username: 'bob', postId}
  assert.equal(
    (await call<{sramBase64: null}>('GET', `/api/rom/${postId}/save`)).json
      .sramBase64,
    null,
  )
  const sram = Buffer.alloc(8192, 7).toString('base64')
  assert.equal(
    (await call('PUT', `/api/rom/${postId}/save`, {sramBase64: sram})).status,
    200,
  )
  assert.equal(
    (await call<{sramBase64: string}>('GET', `/api/rom/${postId}/save`)).json
      .sramBase64,
    sram,
  )
  const big = Buffer.alloc(128 * 1024 + 1).toString('base64')
  assert.equal(
    (await call('PUT', `/api/rom/${postId}/save`, {sramBase64: big})).status,
    400,
  )
})

test('the blocklist form needs the posts permission and replaces both lists', async () => {
  const denied = await call<Ui>('POST', '/internal/menu/blocklist', {})
  assert.equal(denied.json.showForm, undefined)
  assert.equal(
    (await call<Ui>('POST', '/internal/form/blocklist', {titles: 'X'})).json
      .showForm,
    undefined,
  )
  assert.equal(fake.data.has(key.blockedTitles), false)

  mods.add('alice')
  const form = await call<Ui>('POST', '/internal/menu/blocklist', {})
  assert.equal(form.json.showForm?.name, 'blocklist')
  const hash = 'AB'.repeat(32)
  const saved = await call<Ui>('POST', '/internal/form/blocklist', {
    titles: 'MYCLONE\nFOO*\nMYCLONE',
    hashes: `${hash}\nnot-a-hash`,
  })
  assert.match(saved.json.showToast?.text ?? '', /2 titles, 1 hash \(1 invalid/)
  assert.deepEqual(await fake.impl.hKeys(key.blockedHashes), [
    hash.toLowerCase(),
  ])

  await call('POST', '/internal/form/blocklist', {titles: '', hashes: ''})
  assert.equal(fake.data.has(key.blockedTitles), false)
})

test('a mod removal through Reddit triggers cleanup (removal sync)', async () => {
  const {postId, romId} = await uploadAsMod()
  const rsp = await call('POST', '/internal/trigger/mod-action', {
    action: 'removelink',
    moderator: {name: 'somemod'},
    targetPost: {id: postId},
  })
  assert.equal(rsp.status, 200)
  assert.equal(await fake.impl.get(key.post(postId)), undefined)
  assert.deepEqual(await fake.impl.hGetAll(key.romMeta(romId)), {})
  assert.match(wiki.get('homebrew-roms') ?? '', /No ROMs have been posted yet/)
})

test('the daily job and app upgrades delete removed app-authored posts', async () => {
  const {postId, romId} = await uploadAsMod()
  appPosts = [
    {id: postId, subredditName: 'homebrew', removed: true},
    {id: 't3_live', subredditName: 'homebrew', removed: false},
    {id: 't3_elsewhere', subredditName: 'othersub', removed: true},
  ]
  const rsp = await call('POST', '/internal/scheduler/removed-posts-sweep')
  assert.equal(rsp.status, 200)
  assert.deepEqual(deletedPosts, [postId])
  assert.equal(await fake.impl.get(key.post(postId)), undefined)
  assert.deepEqual(await fake.impl.hGetAll(key.romMeta(romId)), {})

  deletedPosts = []
  appPosts = [{id: 't3_old', subredditName: 'homebrew', removed: true}]
  assert.equal(
    (await call('POST', '/internal/trigger/app-upgrade')).status,
    200,
  )
  assert.deepEqual(deletedPosts, ['t3_old'])
})

test('post deletion triggers cleanup, for ROM posts and waiting posts', async () => {
  const {postId, romId} = await uploadAsMod()
  await call('POST', '/internal/trigger/post-delete', {postId, source: 1})
  assert.equal(await fake.impl.get(key.romBin(romId)), undefined)

  const waiting = await createPost('Later')
  await call('POST', '/internal/trigger/post-delete', {
    postId: waiting,
    source: 1,
  })
  assert.equal(fake.data.has(key.draft(waiting)), false)
  assert.equal(fake.data.has(key.userDraft('t2_alice')), false)
})

test('posts that never get their ROM are removed after one hour', async () => {
  mods.add('alice')
  const before = Date.now()
  const postId = await createPost()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.name, 'draft-expiry')
  assert.deepEqual(jobs[0]?.data, {postId})
  const delay = (jobs[0]?.runAt.getTime() ?? 0) - before
  assert.ok(delay >= draftMaxAgeMs && delay < draftMaxAgeMs + 5000, `${delay}`)

  // A job that fires early (or a sweep before the hour) leaves it alone.
  await call('POST', '/internal/scheduler/draft-expiry', jobs[0])
  assert.equal(removedPosts.has(postId), false)
  assert.equal(await sweepStaleDrafts(Date.now()), 0)

  const later = Date.now() + draftMaxAgeMs
  assert.equal(await expireDraft(postId, later), true)
  assert.ok(removedPosts.has(postId))
  assert.equal(fake.data.has(key.draft(postId)), false)
  assert.equal(fake.data.has(key.userDraft('t2_alice')), false)
})

test('the expiry job spares posts that got their ROM', async () => {
  const {postId} = await uploadAsMod()
  assert.equal(await expireDraft(postId, Date.now() + draftMaxAgeMs), false)
  assert.equal(removedPosts.has(postId), false)

  // Upload still in progress: the post is claimed but its draft remains.
  const uploading = await createPost('Second')
  await fake.impl.set(key.post(uploading), 'someromid')
  assert.equal(await expireDraft(uploading, Date.now() + draftMaxAgeMs), false)
  assert.equal(removedPosts.has(uploading), false)
})

test('the daily sweep removes overdue posts whose job was missed', async () => {
  mods.add('alice')
  const postId = await createPost()
  assert.equal(await sweepStaleDrafts(Date.now() + draftMaxAgeMs + 1000), 1)
  assert.ok(removedPosts.has(postId))
})

test('settings validators enforce ranges and safe wiki page names', async () => {
  const bad = await call<{success: boolean}>(
    'POST',
    '/internal/settings/validate-max-rom-size',
    {value: 8192},
  )
  assert.equal(bad.json.success, false)
  const ok = await call<{success: boolean}>(
    'POST',
    '/internal/settings/validate-max-roms-per-user',
    {value: 5},
  )
  assert.equal(ok.json.success, true)
  for (const [value, success] of [
    ['games/homebrew', true],
    ['config/automoderator', false],
    ['index', false],
    ['Has Spaces', false],
  ] as const) {
    const rsp = await call<{success: boolean}>(
      'POST',
      '/internal/settings/validate-wiki-page',
      {value},
    )
    assert.equal(rsp.json.success, success, value)
  }
})

test('unknown routes 404', async () => {
  assert.equal((await call('GET', '/nope')).status, 404)
  assert.equal((await call('DELETE', '/api/rom/t3_x/upload')).status, 405)
})
