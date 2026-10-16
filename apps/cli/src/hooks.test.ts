import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { main } from './cli'
import { HOOK_MARKER, HOOK_NAMES } from './hooks'

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const git = (cwd: string, ...args: string[]) =>
  exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd })

async function run(cwd: string, command: string | undefined, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, command, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical hooks', () => {
  it('adds the line to the hooks once, keeps their own commands, and git runs it', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    await git(cwd, 'init', '-q', '-b', 'main')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [], relations: [] }, 'Test')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(cwd, 'my model', path)), { recursive: true })
      await writeFile(join(cwd, 'my model', path), content)
    }
    const hooks = join(cwd, '.git/hooks')
    await mkdir(hooks, { recursive: true })
    await writeFile(join(hooks, 'post-commit'), '#!/bin/sh\necho own >> own.txt')
    // Stands in for radical: records the arguments the hook passes.
    await writeFile(join(cwd, 'record.mjs'), "import { appendFileSync } from 'node:fs'\nappendFileSync('ran.txt', process.argv.slice(2).join(' ') + '\\n')\n")
    const command = `"${process.execPath}" "${join(cwd, 'record.mjs')}"`

    const first = await run(cwd, command, 'hooks', 'install', 'my model')
    expect(first.code).toBe(0)
    expect(first.out).toContain('Added to post-checkout, post-commit, post-merge')
    expect((await run(cwd, command, 'hooks', 'install', 'my model')).out).toContain('nothing changed')
    for (const name of HOOK_NAMES) {
      const text = await readFile(join(hooks, name), 'utf8')
      expect(text.split(HOOK_MARKER)).toHaveLength(2)
      expect(text).toContain(`${command} diff "my model" --save-base --quiet || true`)
      expect((await stat(join(hooks, name))).mode & 0o111).toBeTruthy()
    }
    expect(await readFile(join(hooks, 'post-commit'), 'utf8')).toMatch(/^#!\/bin\/sh\necho own >> own\.txt\n# radical/)
    // The CLI moved: installing again brings the line up to date, once.
    const moved = `"${process.execPath}" "${join(cwd, 'moved.mjs')}"`
    expect((await run(cwd, moved, 'hooks', 'install', 'my model')).out).toContain('Updated in post-checkout, post-commit, post-merge')
    expect(await readFile(join(hooks, 'post-merge'), 'utf8')).toContain(`${moved} diff "my model"`)
    expect((await readFile(join(hooks, 'post-merge'), 'utf8')).split(HOOK_MARKER)).toHaveLength(2)
    await run(cwd, command, 'hooks', 'install', 'my model')

    await git(cwd, 'add', 'my model')
    await git(cwd, 'commit', '-q', '-m', 'model')
    expect(await readFile(join(cwd, 'ran.txt'), 'utf8')).toBe('diff my model --save-base --quiet\n')
    expect(await readFile(join(cwd, 'own.txt'), 'utf8')).toBe('own\n')
  })

  it('exits 2 outside git and on a wrong action', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    const outside = await run(cwd, undefined, 'hooks', 'install')
    expect(outside.code).toBe(2)
    expect(outside.err).toContain('is not in a git repository')
    expect((await run(cwd, undefined, 'hooks', 'remove')).code).toBe(2)
    expect((await run(cwd, undefined, 'hooks', '--help')).out).toContain('Usage: radical hooks install')
  })
})
