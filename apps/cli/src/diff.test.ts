import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { main } from './cli'

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const nodes = (action = 'take the payment', x = 0): C4Node[] => [
  node('sys', 'system', 'Shop'),
  node('need', 'need', 'Brief'),
  node('req', 'requirement', 'Pay', { action, x }),
]
const relations: C4Relation[] = [
  { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
  { id: 'r2', relationType: 'satisfies', sourceId: 'sys', targetId: 'req' },
]

/** Writes the model into `dir`, replacing what was there. */
async function writeModel(dir: string, model: C4Node[]): Promise<void> {
  await rm(dir, { recursive: true, force: true })
  const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: model, relations }, 'Test')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), content)
  }
}

const git = (cwd: string, ...args: string[]) =>
  exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd })

/** A git repository on main whose first commit holds the model in model/. */
async function repo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-diff-'))
  dirs.push(cwd)
  await git(cwd, 'init', '-q', '-b', 'main')
  await writeModel(join(cwd, 'model'), nodes())
  await git(cwd, 'add', '.')
  await git(cwd, 'commit', '-q', '-m', 'model')
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical diff', () => {
  it('lists the model changes of the branch, committed or not, and leaves out the layout', async () => {
    const cwd = await repo()
    await git(cwd, 'checkout', '-q', '-b', 'feature')
    // The requirement changes, and every element moves.
    await writeModel(join(cwd, 'model'), nodes('take the payment within 2 seconds', 640).map((n) => ({ ...n, y: 300 })))

    const uncommitted = await run(cwd, 'diff', 'model')
    expect(uncommitted.code).toBe(0)
    expect(uncommitted.out).toMatch(/^Model changes since merge base with main \([0-9a-f]{7}\)/)
    expect(uncommitted.out).toContain('Elements: 0 added, 1 changed, 0 removed. Relations: 0 added, 0 changed, 0 removed.')
    expect(uncommitted.out).toContain('- requirement "Pay" (req)\n    action: take the payment → take the payment within 2 seconds')
    expect(uncommitted.out).toContain('      ← satisfies system "Shop" (sys)')
    expect(uncommitted.out).not.toMatch(/\b[xy]:/)

    await git(cwd, 'commit', '-q', '-am', 'faster payments')
    // Still the whole branch once committed; since HEAD, nothing.
    expect((await run(cwd, 'diff', 'model')).out).toContain('action: take the payment → take the payment within 2 seconds')
    expect((await run(cwd, 'diff', 'model', '--since', 'HEAD')).out).toMatch(/^No model changes since HEAD \([0-9a-f]{7}\)/)

    const json = JSON.parse((await run(cwd, 'diff', 'model', '--since', 'main', '--format', 'json')).out)
    expect(json.base).toMatchObject({ described: 'main' })
    expect(json.elements.changed).toMatchObject([{ id: 'req', changes: [{ field: 'action', before: 'take the payment', after: 'take the payment within 2 seconds' }] }])
  })

  it('reports a model the base did not have as all added', async () => {
    const cwd = await repo()
    await writeModel(join(cwd, 'other'), nodes())
    const { code, out } = await run(cwd, 'diff', 'other')
    expect(code).toBe(0)
    expect(out).toContain('Elements: 3 added, 0 changed, 0 removed. Relations: 2 added, 0 changed, 0 removed. The folder held no model then.')
  })

  it('exits 2 outside git, on an unknown ref, or with bad options', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'radical-diff-'))
    dirs.push(outside)
    await writeModel(join(outside, 'model'), nodes())
    const noGit = await run(outside, 'diff', 'model')
    expect(noGit.code).toBe(2)
    expect(noGit.err).toContain('is not in a git repository')

    const cwd = await repo()
    const unknown = await run(cwd, 'diff', 'model', '--since', 'nope')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('Unknown git ref "nope"')
    expect((await run(cwd, 'diff', 'model', '--since', '--output=x')).code).toBe(2)
    expect((await run(cwd, 'diff', 'model', '--format', 'xml')).code).toBe(2)
    expect((await run(cwd, 'diff', '--help')).out).toContain('Usage: radical diff')
  })
})
