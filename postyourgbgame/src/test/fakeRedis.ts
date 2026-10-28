import {redis} from '@devvit/web/server'

type ZMember = {member: string; score: number}
type Value = string | Map<string, string> | Map<string, number>

/**
 * In-memory stand-in for the subset of the Devvit Redis client the app uses.
 * `install()` patches the shared `redis` object; `restore()` undoes it.
 */
export class FakeRedis {
  readonly data = new Map<string, Value>()
  readonly #originals = new Map<string, unknown>()

  #str(key: string): string | undefined {
    const v = this.data.get(key)
    return typeof v === 'string' ? v : undefined
  }

  #hash(key: string): Map<string, string> {
    let v = this.data.get(key)
    if (!(v instanceof Map)) {
      v = new Map<string, string>()
      this.data.set(key, v)
    }
    return v as Map<string, string>
  }

  #zset(key: string): Map<string, number> {
    let v = this.data.get(key)
    if (!(v instanceof Map)) {
      v = new Map<string, number>()
      this.data.set(key, v)
    }
    return v as Map<string, number>
  }

  #prune(key: string): void {
    const v = this.data.get(key)
    if (v instanceof Map && v.size === 0) this.data.delete(key)
  }

  readonly impl = {
    get: async (key: string) => this.#str(key),
    set: async (key: string, value: string, opts?: {nx?: boolean}) => {
      if (opts?.nx && this.data.has(key)) return ''
      this.data.set(key, value)
      return 'OK'
    },
    del: async (...keys: string[]) => {
      for (const k of keys) this.data.delete(k)
    },
    exists: async (...keys: string[]) =>
      keys.filter(k => this.data.has(k)).length,
    incrBy: async (key: string, n: number) => {
      const v = Number(this.#str(key) ?? 0) + n
      this.data.set(key, `${v}`)
      return v
    },
    expire: async () => {},
    hGet: async (key: string, field: string) => this.#hash(key).get(field),
    hGetAll: async (key: string) => {
      const out = Object.fromEntries(this.#hash(key))
      this.#prune(key)
      return out
    },
    hSet: async (key: string, values: {[field: string]: string}) => {
      const h = this.#hash(key)
      for (const [f, v] of Object.entries(values)) h.set(f, v)
      return Object.keys(values).length
    },
    hDel: async (key: string, fields: string[]) => {
      const h = this.#hash(key)
      let n = 0
      for (const f of fields) if (h.delete(f)) n++
      this.#prune(key)
      return n
    },
    hKeys: async (key: string) => {
      const out = [...this.#hash(key).keys()]
      this.#prune(key)
      return out
    },
    zAdd: async (key: string, ...members: ZMember[]) => {
      const z = this.#zset(key)
      for (const m of members) z.set(m.member, m.score)
      return members.length
    },
    zRem: async (key: string, members: string[]) => {
      const z = this.#zset(key)
      let n = 0
      for (const m of members) if (z.delete(m)) n++
      this.#prune(key)
      return n
    },
    zCard: async (key: string) => {
      const n = this.#zset(key).size
      this.#prune(key)
      return n
    },
    zRange: async (
      key: string,
      start: number,
      stop: number,
      opts: {by: 'rank' | 'score'; reverse?: boolean},
    ) => {
      const z = this.#zset(key)
      let rows: ZMember[] = [...z].map(([member, score]) => ({member, score}))
      this.#prune(key)
      rows.sort((a, b) => a.score - b.score || a.member.localeCompare(b.member))
      if (opts.by === 'score')
        return rows.filter(r => r.score >= start && r.score <= stop)
      if (opts.reverse) rows = rows.reverse()
      const end = stop < 0 ? rows.length + stop : stop
      return rows.slice(start, end + 1)
    },
  }

  install(): void {
    const target = redis as unknown as {[name: string]: unknown}
    for (const [name, fn] of Object.entries(this.impl)) {
      this.#originals.set(name, target[name])
      target[name] = fn
    }
  }

  restore(): void {
    const target = redis as unknown as {[name: string]: unknown}
    for (const [name, fn] of this.#originals) target[name] = fn
    this.#originals.clear()
  }

  clear(): void {
    this.data.clear()
  }
}
