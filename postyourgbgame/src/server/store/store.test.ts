import assert from 'node:assert/strict'
import {after, before, beforeEach, test} from 'node:test'
import {FakeRedis} from '../../test/fakeRedis.ts'
import {key} from './keys.ts'
import {
  attachPost,
  claimPost,
  createDraft,
  deleteDraft,
  deleteRom,
  deleteUserData,
  findDuplicate,
  getDraft,
  getRom,
  getRomIdForPost,
  getStorage,
  getUserDraftPostId,
  listLiveRoms,
  listStaleDrafts,
  maxSavesPerUser,
  putSave,
  type RomRecord,
  releasePost,
  saveTtlMs,
  storeRom,
  sweepExpiredSaves,
} from './store.ts'

const fake = new FakeRedis()
before(() => fake.install())
after(() => fake.restore())
beforeEach(() => fake.clear())

function record(n: number, over: Partial<RomRecord> = {}): RomRecord {
  const sha = n.toString(16).padStart(64, '0')
  return {
    romId: `${sha.slice(-16)}abcd`,
    title: `Game ${n}`,
    description: '',
    licence: 'MIT',
    sourceUrl: '',
    uploaderId: 't2_alice',
    uploaderName: 'alice',
    postId: '',
    status: 'pending',
    sizeBytes: 32768,
    storedBytes: 43692,
    sha256: sha,
    cartType: 0,
    cgbFlag: 0,
    sgbFlag: 0,
    licenseeCode: '0x00',
    headerTitle: `GAME${n}`,
    validation: [],
    attestedAt: n,
    attestedBy: 'alice',
    createdAt: n,
    colourMode: 'auto',
    hasCover: false,
    ...over,
  }
}

async function addLive(
  n: number,
  over: Partial<RomRecord> = {},
): Promise<RomRecord> {
  const rec = record(n, over)
  assert.equal(
    await storeRom(rec, 'A'.repeat(rec.storedBytes), undefined),
    true,
  )
  await attachPost(rec, `t3_p${n}`)
  return {...rec, postId: `t3_p${n}`, status: 'live'}
}

test('store → attach → delete leaves nothing behind', async () => {
  const rec = await addLive(1)
  assert.equal(await getRomIdForPost('t3_p1'), rec.romId)
  assert.equal((await getRom(rec.romId))?.status, 'live')
  assert.equal(await findDuplicate(rec.sha256), 't3_p1')
  assert.equal((await getStorage()).bytes, rec.storedBytes)

  await putSave(rec.romId, 't2_bob', 'BBBB')
  assert.equal((await getStorage()).bytes, rec.storedBytes + 4)

  await deleteRom(rec.romId)
  assert.equal((await getStorage()).bytes, 0)
  const left = [...fake.data.keys()].filter(
    k => k !== key.storageBytes && k !== key.users,
  )
  assert.deepEqual(left, [])
})

test('duplicate hash is claimed once', async () => {
  await addLive(2)
  assert.equal(
    await storeRom(record(2, {romId: 'other00000000000000'}), 'A', undefined),
    false,
  )
})

test('live ROMs are listed newest first for the wiki page', async () => {
  await addLive(10)
  await addLive(11, {uploaderName: 'bob', uploaderId: 't2_bob'})
  const gone = await addLive(12)
  await deleteRom(gone.romId)
  const rows = await listLiveRoms()
  assert.deepEqual(
    rows.map(r => [r.title, r.uploaderName, r.postId]),
    [
      ['Game 11', 'bob', 't3_p11'],
      ['Game 10', 'alice', 't3_p10'],
    ],
  )
})

test('a post is claimed by one ROM only', async () => {
  assert.equal(await claimPost('t3_x', 'rom1'), true)
  assert.equal(await claimPost('t3_x', 'rom2'), false)
  await releasePost('t3_x', 'rom2')
  assert.equal(await getRomIdForPost('t3_x'), 'rom1')
  await releasePost('t3_x', 'rom1')
  assert.equal(await claimPost('t3_x', 'rom2'), true)
})

test('drafts are indexed per user and retired by the upload', async () => {
  const draft = {
    postId: 't3_p20',
    authorId: 't2_alice',
    authorName: 'alice',
    title: 'Game 20',
    description: 'd',
    createdAt: 1000,
  }
  await createDraft(draft)
  assert.deepEqual(await getDraft('t3_p20'), draft)
  assert.equal(await getUserDraftPostId('t2_alice'), 't3_p20')
  assert.deepEqual(await listStaleDrafts(999), [])
  assert.deepEqual(await listStaleDrafts(1000), ['t3_p20'])

  await addLive(20)
  assert.equal(await getDraft('t3_p20'), undefined)
  assert.equal(await getUserDraftPostId('t2_alice'), undefined)
  assert.deepEqual(await listStaleDrafts(Date.now()), [])

  await createDraft({...draft, postId: 't3_p21'})
  await deleteDraft('t3_p21')
  const left = [...fake.data.keys()].filter(k => k.includes('draft'))
  assert.deepEqual(left, [])
})

test('saves are capped per user, oldest evicted', async () => {
  const roms: RomRecord[] = []
  for (let i = 0; i < maxSavesPerUser + 2; i++)
    roms.push(await addLive(100 + i))
  for (const [i, rom] of roms.entries())
    await putSave(rom.romId, 't2_bob', 'SS', 1000 + i)
  const saves = fake.data.get(key.userSaves('t2_bob')) as Map<string, number>
  assert.equal(saves.size, maxSavesPerUser)
  assert.equal(fake.data.has(key.save(roms[0]?.romId ?? '', 't2_bob')), false)
  assert.equal(
    fake.data.has(key.save(roms.at(-1)?.romId ?? '', 't2_bob')),
    true,
  )
})

test('expired saves are swept from the index and storage total', async () => {
  const rom = await addLive(200)
  await putSave(rom.romId, 't2_bob', 'SSSS', 0)
  const before = (await getStorage()).bytes
  fake.data.delete(key.save(rom.romId, 't2_bob')) // TTL lapsed
  assert.equal(await sweepExpiredSaves(saveTtlMs + 1), 1)
  assert.equal((await getStorage()).bytes, before - 4)
})

test('deleteUserData removes ROMs and saves of that user only', async () => {
  const mine = await addLive(300)
  const theirs = await addLive(301, {uploaderId: 't2_bob', uploaderName: 'bob'})
  await putSave(theirs.romId, 't2_alice', 'SS')
  const deleted = await deleteUserData('t2_alice')
  assert.deepEqual(
    deleted.map(r => r.romId),
    [mine.romId],
  )
  assert.equal(await getRom(mine.romId), undefined)
  assert.ok(await getRom(theirs.romId))
  assert.equal(fake.data.has(key.save(theirs.romId, 't2_alice')), false)
})
