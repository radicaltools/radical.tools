import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { readFindings, writeFinding, type Finding } from '@radical/crucible/findings'
import { main } from './cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(['harden', ...args], { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

const finding = (id: string, more: Partial<Finding> = {}): Finding => ({
  id, title: 'Undo of a drag leaves the row off', source: 'fuzz', status: 'open', rule: 'undoRestores', signature: 'undoRestores|drag|views.*',
  file: 'packages/ui/tests/invariants.test.ts', suite: 'invariants', world: 'bookstore', seed: 7, path: '3:1', length: 20,
  sequence: [{ a: 'drag', el: 1, dx: 5, dy: 0 }, { a: 'undo' }], found: '2026-10-22', steps: ['drag API by (5, 0)', 'Undo'], detail: 'it moved', ...more,
})

describe('radical harden', () => {
  it('marks a fuzz finding hardened with its test and scenario', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-harden-'))
    dirs.push(cwd)
    const findings = join(cwd, 'crucible', 'findings')
    writeFinding(findings, finding('F-0001'))
    const { code, out } = await run(cwd, 'F-0001', '--scenario', 'Undo is exact')
    expect(code).toBe(0)
    expect(out).toContain('F-0001 is hardened: its fuzz file replays its steps as\n  packages/ui/tests/invariants.test.ts › F-0001 stays fixed: Undo of a drag leaves the row off\n')
    expect(out).toContain('Add that line to the Tests of scenario "Undo is exact"')
    expect(readFindings(findings)[0]).toMatchObject({
      status: 'hardened',
      scenario: 'Undo is exact',
      test: 'packages/ui/tests/invariants.test.ts › F-0001 stays fixed: Undo of a drag leaves the row off',
      sequence: [{ a: 'drag', el: 1, dx: 5, dy: 0 }, { a: 'undo' }],
    })
  })

  it('exits 2 for an unknown finding or one with no steps to replay', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-harden-'))
    dirs.push(cwd)
    writeFinding(join(cwd, 'crucible', 'findings'), finding('F-0002', { source: 'explore', sequence: undefined, world: undefined }))
    const explored = await run(cwd, 'F-0002')
    expect(explored.code).toBe(2)
    expect(explored.err).toContain('Finding F-0002 has no steps to replay')
    const unknown = await run(cwd, 'F-0099')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('No finding F-0099 in crucible/findings.')
    expect((await run(cwd)).code).toBe(2)
  })
})

/** A git repository whose base commit has a bug in src/calc.mjs that the
 *  working tree fixes, with tests run by `node <file>` (exit 0 passes). */
async function repository(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-gate-'))
  dirs.push(cwd)
  const files: Record<string, string> = {
    'src/calc.mjs': 'export const add = (a, b) => a - b\n',
    'src/old.mjs': 'export const gone = true\n',
    'tests/calc.test.mjs': "import { add } from '../src/calc.mjs'\nprocess.exit(add(2, 3) === 5 ? 0 : 1)\n",
    'tests/always.test.mjs': 'process.exit(0)\n',
    // Says it runs, with its pid, then takes its time: long enough to be interrupted.
    'tests/slow.test.mjs': "console.log('running ' + process.pid)\nawait new Promise((r) => setTimeout(r, 30000))\nprocess.exit(1)\n",
    // Fails when another run of it is going on: flaky under load.
    'tests/flaky.test.mjs': [
      "import { existsSync, rmSync, writeFileSync } from 'node:fs'",
      "import { add } from '../src/calc.mjs'",
      "if (existsSync('busy')) process.exit(1)",
      "writeFileSync('busy', '')",
      'await new Promise((r) => setTimeout(r, 1500))',
      "rmSync('busy', { force: true })",
      'process.exit(add(2, 3) === 5 ? 0 : 1)',
    ].join('\n') + '\n',
    'crucible.json': JSON.stringify({ runners: [{ files: 'tests/', command: ['node', '{file}'] }] }),
  }
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, path)), { recursive: true })
    await writeFile(join(cwd, path), text)
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' })
  git('init', '-q', '-b', 'main')
  git('-c', 'user.email=t@example.com', '-c', 'user.name=Test', 'add', '.')
  git('-c', 'user.email=t@example.com', '-c', 'user.name=Test', 'commit', '-q', '-m', 'base')
  // The fix, not committed: one file changed, one removed, one added.
  await writeFile(join(cwd, 'src/calc.mjs'), 'export const add = (a, b) => a + b\n')
  await rm(join(cwd, 'src/old.mjs'))
  await writeFile(join(cwd, 'src/new.mjs'), 'export const added = true\n')
  return cwd
}

const state = async (cwd: string) => ({
  calc: await readFile(join(cwd, 'src/calc.mjs'), 'utf8'),
  status: execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }),
})

describe('radical harden --gate', () => {
  it('passes a test that fails without the fix and passes with it every time', async () => {
    const cwd = await repository()
    const { code, out } = await run(cwd, '--gate', '--test', 'tests/calc.test.mjs › adds', '--base', 'main')
    expect(code).toBe(0)
    expect(out).toContain('base main, 3 source files changed since:\n  src/calc.mjs\n  src/new.mjs\n  src/old.mjs\n')
    expect(out).toContain('1. Without the fix: failed (exit 1), as it should.')
    expect(out).toContain('2. With the fix: passed.')
    expect(out).toContain('3. 5 runs at once: all passed.')
  })

  it('fails a test that passes without the fix', async () => {
    const cwd = await repository()
    const { code, out } = await run(cwd, '--gate', '--test', 'tests/always.test.mjs › passes', '--base', 'main')
    expect(code).toBe(1)
    expect(out).toContain('1. Without the fix: passed. ✖ The test does not fail without the fix')
  })

  it('fails a test that fails now and then', async () => {
    const cwd = await repository()
    const { code, out } = await run(cwd, '--gate', '--test', 'tests/flaky.test.mjs › adds', '--base', 'main', '--runs', '4')
    expect(code).toBe(1)
    expect(out).toContain('2. With the fix: passed.')
    expect(out).toMatch(/3\. 4 runs at once: [1-3] failed\. ✖ The test is flaky under load\./)
  })

  it('leaves the working tree as it found it', async () => {
    const cwd = await repository()
    const before = await state(cwd)
    await run(cwd, '--gate', '--test', 'tests/calc.test.mjs › adds', '--base', 'main')
    await run(cwd, '--gate', '--test', 'tests/always.test.mjs › passes', '--base', 'main')
    expect(await state(cwd)).toEqual(before)
    expect(before.calc).toContain('a + b')
    const broken = await run(cwd, '--gate', '--test', 'tests/missing.test.mjs › x', '--base', 'main')
    expect(broken.code).toBe(2)
    expect(await state(cwd)).toEqual(before)
  })

  // Ctrl+C sends SIGINT to the whole process group, the test with it; kill
  // sends SIGTERM to radical alone. Node ended on either without running
  // the finally that puts the fix back.
  for (const [signal, group] of [['SIGINT', true], ['SIGTERM', false]] as const) {
    it(`puts the fix back when it is interrupted (${signal}${group ? ' to the process group, as Ctrl+C does' : ''})`, async () => {
      const cwd = await repository()
      const before = await state(cwd)
      const temp = await mkdtemp(join(tmpdir(), 'radical-gate-tmp-'))
      dirs.push(temp)
      const child = spawn(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), join(import.meta.dirname, 'index.ts'), 'harden', '--gate', '--test', 'tests/slow.test.mjs › waits', '--base', 'main', '--runs', '1'],
        { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TMPDIR: temp } })
      let out = ''
      child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
      child.stderr.on('data', (chunk: Buffer) => { out += chunk.toString() })
      const closed = new Promise<number | string | null>((done) => child.on('close', (code, sig) => done(code ?? sig)))
      // The test runs without the fix.
      for (let i = 0; i < 300 && !/running \d+/.test(out); i++) await new Promise((r) => setTimeout(r, 50))
      expect(out).toMatch(/running \d+/)
      expect(await readFile(join(cwd, 'src/calc.mjs'), 'utf8')).toContain('a - b')
      process.kill(group ? -child.pid! : child.pid!, signal)
      const code = await closed
      expect(code).toBe(2)
      expect(out).toContain(`Interrupted (${signal}): the changed files are put back as they were.`)
      // The fix is back (the changed file, the new one, and the removed one removed),
      expect(await state(cwd)).toEqual(before)
      // and its copies are tidied away.
      expect((await readdir(temp)).filter((f) => f.startsWith('radical-harden-'))).toEqual([])
      // The test it ran is stopped too.
      const pid = Number(/running (\d+)/.exec(out)![1])
      await new Promise((r) => setTimeout(r, 300))
      expect(() => process.kill(pid, 0)).toThrow()
    }, 30_000)
  }
})
