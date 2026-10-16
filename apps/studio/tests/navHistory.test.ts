import { describe, expect, it } from 'vitest'
import { MAX_ENTRIES, moveTo, pushEntry, replaceEntry, restoreNav, saveNav, sinceText, type NavEntry, type NavState } from '../src/renderer/src/navHistory'

const entry = (hash: string, at = 0): NavEntry => ({ hash, where: hash, mode: 'Designer', at })
const hashes = (s: NavState) => s.entries.map((e) => e.hash)

describe('navigation history', () => {
  it('adds a place after the current one, dropping what was ahead of it', () => {
    let s: NavState = { entries: [entry('a')], index: 0 }
    s = pushEntry(s, entry('b'))
    s = pushEntry(s, entry('c'))
    expect(hashes(s)).toEqual(['a', 'b', 'c'])
    expect(s.index).toBe(2)
    // Back twice, then somewhere new: b and c are gone.
    s = moveTo(moveTo(s, 1), 0)
    expect(s.index).toBe(0)
    s = pushEntry(s, entry('d'))
    expect(hashes(s)).toEqual(['a', 'd'])
    expect(s.index).toBe(1)
  })

  it('writes the same place again in place, keeping when it was first shown', () => {
    const s = replaceEntry({ entries: [entry('a', 100), entry('b', 200)], index: 1 }, { ...entry('b2', 900), where: 'renamed' })
    expect(s.entries[1]).toEqual({ hash: 'b2', where: 'renamed', mode: 'Designer', at: 200 })
    expect(replaceEntry({ entries: [], index: 0 }, entry('x'))).toEqual({ entries: [entry('x')], index: 0 })
  })

  it('moves only within the list, and keeps at most a bounded number of places', () => {
    const s: NavState = { entries: [entry('a'), entry('b')], index: 1 }
    expect(moveTo(s, 5)).toBe(s)
    expect(moveTo(s, -1)).toBe(s)
    let long: NavState = { entries: [entry('0')], index: 0 }
    for (let i = 1; i <= MAX_ENTRIES + 5; i++) long = pushEntry(long, entry(String(i)))
    expect(long.entries).toHaveLength(MAX_ENTRIES)
    expect(long.index).toBe(MAX_ENTRIES - 1)
    expect(long.entries[0].hash).toBe('6')
  })

  it('says how long ago', () => {
    expect(sinceText(0, 5_000)).toBe('now')
    expect(sinceText(0, 30_000)).toBe('30 s ago')
    expect(sinceText(0, 120_000)).toBe('2 min ago')
    expect(sinceText(0, 2 * 3_600_000)).toBe('2 h ago')
  })
})

describe('navigation history kept for a reload', () => {
  const memory = (): Pick<Storage, 'getItem' | 'setItem'> => {
    const data = new Map<string, string>()
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } }
  }

  it('comes back at the entry the history is on, only while it is the address shown', () => {
    const storage = memory()
    const state: NavState = { entries: [entry('#/a', 1), entry('#/b', 2), entry('#/c', 3)], index: 2 }
    saveNav(state, storage)
    // Reloaded after going back once: the history is on b.
    expect(restoreNav('#/b', 1, storage)).toEqual({ entries: state.entries, index: 1 })
    // Another address, or no index of ours: start afresh.
    expect(restoreNav('#/x', 1, storage)).toBeNull()
    expect(restoreNav('#/b', undefined, storage)).toBeNull()
    expect(restoreNav('#/b', 7, storage)).toBeNull()
    expect(restoreNav('#/b', 1, memory())).toBeNull()
  })
})
