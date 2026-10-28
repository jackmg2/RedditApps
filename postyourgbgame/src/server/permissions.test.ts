import assert from 'node:assert/strict'
import {test} from 'node:test'
import {decideUpload, parseAllowedUsernames} from './permissions.ts'

test('parses allowed usernames (spec §8.1)', () => {
  assert.deepEqual(
    [...parseAllowedUsernames(' u/Alice, /u/BOB ,carol,, ')],
    ['alice', 'bob', 'carol'],
  )
  assert.equal(parseAllowedUsernames('').size, 0)
})

test('upload resolution order', () => {
  const base = {
    isMod: false,
    allowEveryone: false,
    allowedUsernames: '',
    username: 'Dave',
  }
  assert.equal(decideUpload(base).allowed, false, 'default is mods only')
  assert.ok(decideUpload(base).refusal?.includes('moderators'))
  assert.equal(decideUpload({...base, isMod: true}).allowed, true)
  assert.equal(decideUpload({...base, allowEveryone: true}).allowed, true)
  assert.equal(
    decideUpload({...base, allowedUsernames: 'u/dave'}).allowed,
    true,
  )
  assert.equal(decideUpload({...base, allowedUsernames: 'eve'}).allowed, false)
  assert.equal(
    decideUpload({...base, username: undefined, allowedUsernames: 'dave'})
      .allowed,
    false,
  )
})
