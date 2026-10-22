import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFindings, nextFindingId, readFindings, writeFinding, type Finding } from '../src/findingFiles'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('findings', () => {
  it('writes a finding as a Markdown file and reads it back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crucible-findings-'))
    dirs.push(dir)
    const finding: Finding = {
      id: 'F-0007',
      title: 'reloadKeeps broken after add (bookstore)',
      source: 'fuzz',
      status: 'open',
      rule: 'reloadKeeps',
      signature: 'reloadKeeps|add|defaultPositions.*',
      file: 'packages/ui/tests/invariants.test.ts',
      suite: 'invariants',
      world: 'bookstore',
      seed: 20261021,
      path: '12:3:4',
      length: 20,
      commit: 'abc1234',
      found: '2026-10-22',
      sequence: [{ a: 'add', parent: 3 }, { a: 'reload' }],
      steps: ['adds component x into API (api)', 'reload'],
      detail: 'the document read again saves differently:\n      defaultPositions.x.x: 1 → 2',
      notes: '## Notes\n\nSeen on the sample too.',
    }
    const file = writeFinding(dir, finding)
    expect(file).toBe(join(dir, 'F-0007.md'))
    const text = readFileSync(file, 'utf8')
    expect(text).toMatch(/^---\nid: "F-0007"\ntitle: "reloadKeeps broken after add \(bookstore\)"\n/)
    expect(text).toContain('## Steps\n\n1. adds component x into API (api)\n2. reload\n')
    expect(readFindings(dir)).toEqual([finding])
    expect(await loadFindings(dir)).toEqual([finding])
    expect(readFindings(join(dir, 'none'))).toEqual([])
  })

  it('numbers new findings after the highest id', () => {
    expect(nextFindingId([])).toBe('F-0001')
    expect(nextFindingId(['F-0002', 'F-0010', 'notes'])).toBe('F-0011')
  })
})
