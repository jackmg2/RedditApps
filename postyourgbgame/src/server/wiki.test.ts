import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {ListingRow} from './store/store.ts'
import {escapeCell, renderWikiPage, wikiRowLimit} from './wiki.ts'

function row(n: number, over: Partial<ListingRow> = {}): ListingRow {
  return {
    postId: `t3_p${n}`,
    title: `Game ${n}`,
    uploaderName: 'alice',
    sizeBytes: 65536,
    licence: 'MIT',
    cgbFlag: 0,
    createdAt: Date.UTC(2026, 9, 28),
    ...over,
  }
}

test('escapes Markdown that would break a table cell', () => {
  assert.equal(escapeCell('a|b [c] *d* _e_'), 'a\\|b \\[c\\] \\*d\\* \\_e\\_')
  assert.equal(escapeCell(' two\nlines\t '), 'two lines')
})

test('renders one linked row per ROM', () => {
  const page = renderWikiPage(
    [row(1, {title: 'Pipe | Dream', cgbFlag: 0xc0}), row(2, {cgbFlag: 0x80})],
    'homebrew',
  )
  assert.match(
    page,
    /^\| \[Pipe \\\| Dream\]\(https:\/\/www\.reddit\.com\/r\/homebrew\/comments\/p1\/\) \| u\/alice \| GBC \| 64 KB \| MIT \| 2026-10-28 \|$/m,
  )
  assert.match(page, /\| GB \/ GBC \|/)
  assert.match(page, /^2 ROMs\.$/m)
})

test('empty and oversized lists', () => {
  assert.match(renderWikiPage([], 'homebrew'), /No ROMs have been posted yet/)
  const many = Array.from({length: wikiRowLimit + 3}, (_, i) => row(i))
  const page = renderWikiPage(many, 'homebrew')
  assert.equal(
    page.split('\n').filter(l => l.startsWith('| [')).length,
    wikiRowLimit,
  )
  assert.match(page, /the 3 oldest are not listed/)
})
