import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFindings, writeFinding, type Finding } from '@radical/crucible/findings'
import { main } from './cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

/** A fuzz file's stand-in: prints its FUZZ_* settings, appends the records of
 *  records.json to FUZZ_FINDINGS when a survey asks, and exits with its
 *  argument. */
const FAKE = `import { appendFileSync, existsSync, readFileSync } from 'node:fs'
const fuzz = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('FUZZ_')).sort())
console.log('env ' + JSON.stringify(fuzz))
if (process.env.FUZZ_FINDINGS && existsSync('records.json')) {
  for (const r of JSON.parse(readFileSync('records.json', 'utf8'))) appendFileSync(process.env.FUZZ_FINDINGS, JSON.stringify(r) + '\\n')
}
process.exit(Number(process.argv[2] ?? 0))
`

async function project(fuzz: object[] = [{ file: 'fake.mjs', command: ['node', 'fake.mjs'] }]): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-fuzz-'))
  dirs.push(cwd)
  await writeFile(join(cwd, 'fake.mjs'), FAKE)
  await writeFile(join(cwd, 'crucible.json'), JSON.stringify({ findings: 'crucible/findings', fuzz }))
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(['fuzz', ...args], { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

/** The FUZZ_* settings each run of the stand-in printed. */
const settingsOf = (out: string): Record<string, string>[] => [...out.matchAll(/^env (.*)$/gm)].map((m) => JSON.parse(m[1]))

const record = (signature: string, rule: string, world = 'bookstore') => ({
  suite: 'invariants', file: 'fake.mjs', world, rule, signature, seed: 7, path: '3:1', length: 20,
  actions: ["{ a: 'add', parent: 1 }", "{ a: 'reload' }"], steps: ['add component into root', 'reload (on All elements)'], detail: `${rule} broke:\n      a.x: 1 → 2`,
})

const finding = (id: string, signature: string, more: Partial<Finding> = {}): Finding => ({
  id, title: 'known', source: 'fuzz', status: 'open', rule: 'reloadKeeps', signature, file: 'fake.mjs', world: 'bookstore',
  seed: 42, path: '3:1', length: 9, found: '2026-10-22', steps: ['reload'], detail: 'it moved', ...more,
})

describe('radical fuzz', () => {
  it('runs each fuzz file in crucible.json with the plan\'s settings', async () => {
    const cwd = await project([{ file: 'fake.mjs', command: ['node', 'fake.mjs'] }, { file: 'other.mjs', command: ['node', '../fake.mjs'], cwd: 'sub' }])
    await mkdir(join(cwd, 'sub'))
    const inherited = process.env.FUZZ_SEED
    process.env.FUZZ_SEED = '9'
    try {
      const ci = await run(cwd)
      expect(ci.code).toBe(0)
      expect(settingsOf(ci.out)).toEqual([{ FUZZ_PLAN: 'ci' }, { FUZZ_PLAN: 'ci' }])
      expect(ci.out).toContain('▶ fake.mjs (plan ci)\n')
      expect(ci.out).toContain('▶ other.mjs (plan ci)\n')
      expect(ci.out).toContain('radical fuzz: 2 files, all passed')
      const night = await run(cwd, 'night', '--runs', '50', '--world', 'bookstore', '--seed', '3', '--length', '8', '--no-known', '--no-shrink')
      expect(night.code).toBe(0)
      expect(settingsOf(night.out)[0]).toEqual({ FUZZ_LENGTH: '8', FUZZ_NO_KNOWN: '1', FUZZ_NO_SHRINK: '1', FUZZ_PLAN: 'night', FUZZ_RUNS: '50', FUZZ_SEED: '3', FUZZ_WORLD: 'bookstore' })
    } finally {
      if (inherited === undefined) delete process.env.FUZZ_SEED
      else process.env.FUZZ_SEED = inherited
    }
  })

  it('exits 1 when a rule breaks outside the known failures', async () => {
    const cwd = await project([{ file: 'fake.mjs', command: ['node', 'fake.mjs'] }, { file: 'broken.mjs', command: ['node', 'fake.mjs', '1'] }])
    const { code, out } = await run(cwd)
    expect(code).toBe(1)
    expect(out).toContain('radical fuzz: 2 files, 1 failed')
  })

  it('exits 2 without a crucible.json or with an unknown plan', async () => {
    const cwd = await project()
    const none = await run(cwd, '--config', 'missing.json')
    expect(none.code).toBe(2)
    expect(none.err).toContain('missing.json: it lists the fuzz files')
    expect((await run(cwd, 'weekly')).err).toContain('Unknown plan weekly: ci or night.')
    expect((await run(cwd, 'weekly')).code).toBe(2)
    expect((await run(cwd, '--runs', 'many')).err).toContain('--runs takes a whole number.')
    await writeFile(join(cwd, 'crucible.json'), JSON.stringify({ fuzz: [] }))
    expect((await run(cwd)).err).toContain('lists no fuzz files')
    expect((await run(cwd)).code).toBe(2)
  })

  it('records each new signature of a survey as an open finding, once', async () => {
    const cwd = await project()
    const findings = join(cwd, 'crucible', 'findings')
    writeFinding(findings, finding('F-0001', 'reloadKeeps|add|views.*'))
    await writeFile(join(cwd, 'records.json'), JSON.stringify([
      record('reloadKeeps|add|defaultPositions.*', 'reloadKeeps'),
      record('geometry|drag|overlap', 'geometry', 'nested'),
      record('reloadKeeps|add|defaultPositions.*', 'reloadKeeps'),
      record('reloadKeeps|add|views.*', 'reloadKeeps'),
    ]))
    const first = await run(cwd, '--survey')
    expect(first.code).toBe(0)
    expect(settingsOf(first.out)[0].FUZZ_SURVEY).toMatch(/survey\.txt$/)
    expect(first.out).toContain('New findings (2):\n  F-0002  reloadKeeps broken after reload (bookstore)\n  F-0003  geometry broken after reload (nested)')
    const all = readFindings(findings)
    expect(all.map((f) => [f.id, f.status, f.signature])).toEqual([
      ['F-0001', 'open', 'reloadKeeps|add|views.*'],
      ['F-0002', 'open', 'reloadKeeps|add|defaultPositions.*'],
      ['F-0003', 'open', 'geometry|drag|overlap'],
    ])
    expect(all[1]).toMatchObject({ source: 'fuzz', rule: 'reloadKeeps', file: 'fake.mjs', suite: 'invariants', world: 'bookstore', seed: 7, path: '3:1', length: 20, steps: ['add component into root', 'reload (on All elements)'], detail: 'reloadKeeps broke:\n      a.x: 1 → 2' })
    expect(all[1].found).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const again = await run(cwd, '--survey')
    expect(again.out).toContain('No new findings')
    expect(readFindings(findings)).toHaveLength(3)
    expect(await readFile(join(findings, 'F-0002.md'), 'utf8')).toContain('## Steps\n\n1. add component into root\n2. reload (on All elements)\n')
  })

  it('replays a finding with its world, seed, path and length', async () => {
    const cwd = await project([{ file: 'other.mjs', command: ['node', 'fake.mjs', '1'] }, { file: 'fake.mjs', command: ['node', 'fake.mjs'] }])
    writeFinding(join(cwd, 'crucible', 'findings'), finding('F-0001', 'reloadKeeps|reload|defaultPositions.*', { title: 'A reload moves Customer' }))
    const { code, out } = await run(cwd, '--replay', 'F-0001')
    expect(code).toBe(0)
    expect(out).toContain('Replaying F-0001: A reload moves Customer')
    expect(out).toContain('▶ fake.mjs (replay F-0001)')
    expect(settingsOf(out)).toEqual([{ FUZZ_LENGTH: '9', FUZZ_NO_SHRINK: '1', FUZZ_PATH: '3:1', FUZZ_PLAN: 'ci', FUZZ_SEED: '42', FUZZ_WORLD: 'bookstore' }])
    const unknown = await run(cwd, '--replay', 'F-0099')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('No finding F-0099 in crucible/findings.')
    expect(existsSync(join(cwd, 'crucible', 'findings', 'F-0099.md'))).toBe(false)
  })
})
