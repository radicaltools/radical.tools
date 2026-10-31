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
/** What the line runs after saving the base, with the CLI `radical`. */
const FETCH = 'radical check "model" --from-ci --quiet --detach </dev/null >/dev/null 2>&1 || true'
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
    expect(first.out).toContain('Added to post-checkout, post-commit, post-merge, post-rewrite')
    expect((await run(cwd, command, 'hooks', 'install', 'my model')).out).toContain('nothing changed')
    for (const name of HOOK_NAMES) {
      const text = await readFile(join(hooks, name), 'utf8')
      expect(text.split(HOOK_MARKER)).toHaveLength(2)
      expect(text).toContain(`${command} diff "my model" --save-base --quiet </dev/null || true`)
      // Windows does not expose POSIX executable bits; the commit below
      // verifies that Git runs the installed hook on every platform.
      if (process.platform !== 'win32') expect((await stat(join(hooks, name))).mode & 0o111).toBeTruthy()
    }
    expect(await readFile(join(hooks, 'post-commit'), 'utf8')).toMatch(/^#!\/bin\/sh\n# radical.*\n.*\necho own >> own\.txt\n$/)
    // The CLI moved: installing again brings the line up to date, once.
    const moved = `"${process.execPath}" "${join(cwd, 'moved.mjs')}"`
    expect((await run(cwd, moved, 'hooks', 'install', 'my model')).out).toContain('Updated in post-checkout, post-commit, post-merge, post-rewrite')
    expect(await readFile(join(hooks, 'post-merge'), 'utf8')).toContain(`${moved} diff "my model"`)
    expect((await readFile(join(hooks, 'post-merge'), 'utf8')).split(HOOK_MARKER)).toHaveLength(2)
    await run(cwd, command, 'hooks', 'install', 'my model')

    await git(cwd, 'add', 'my model')
    await git(cwd, 'commit', '-q', '-m', 'model')
    expect(await readFile(join(cwd, 'ran.txt'), 'utf8')).toBe('diff my model --save-base --quiet\ncheck my model --from-ci --quiet --detach\n')
    expect(await readFile(join(cwd, 'own.txt'), 'utf8')).toBe('own\n')
  })

  it('keeps the line of every model folder it was installed for', async () => {
    // The marker was one for all folders: installing for a second folder
    // "updated" the first one's line, whose base was never saved again.
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    await git(cwd, 'init', '-q', '-b', 'main')
    for (const folder of ['one', 'two']) await mkdir(join(cwd, folder))
    expect((await run(cwd, 'radical', 'hooks', 'install', 'one')).out).toContain('Added to')
    expect((await run(cwd, 'radical', 'hooks', 'install', 'two')).out).toContain('Added to')
    expect((await run(cwd, 'radical', 'hooks', 'install', 'one')).out).toContain('nothing changed')
    for (const name of HOOK_NAMES) {
      const text = await readFile(join(cwd, '.git/hooks', name), 'utf8')
      expect(text).toContain('radical diff "one" --save-base')
      expect(text).toContain('radical diff "two" --save-base')
      expect(text.split(HOOK_MARKER)).toHaveLength(3)
    }
  })

  it('puts the line where it runs in a sh hook, and leaves a hook in another language to the user', async () => {
    // Appended at the end, the line never ran after an `exit` or an `exec`,
    // and a Python hook failed on it with a SyntaxError and stopped running.
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    await git(cwd, 'init', '-q', '-b', 'main')
    await mkdir(join(cwd, 'model'))
    const hooks = join(cwd, '.git/hooks')
    await mkdir(hooks, { recursive: true })
    const python = '#!/usr/bin/env python3\nopen("python-ran.txt", "w").write("yes")\n'
    await writeFile(join(hooks, 'post-commit'), python, { mode: 0o755 })
    await writeFile(join(hooks, 'post-checkout'), '#!/usr/bin/env bash\necho ran >> sh-ran.txt\nexit 0\n')
    // An install by an earlier version: the line appended to the Python hook.
    await writeFile(join(hooks, 'post-merge'), `#!/usr/bin/python3\nprint("merged")\n${HOOK_MARKER}\nradical diff "model" --save-base --quiet || true\n`)
    await writeFile(join(cwd, 'record.mjs'), "import { appendFileSync } from 'node:fs'\nappendFileSync('ran.txt', process.argv.slice(2).join(' ') + '\\n')\n")
    const command = `"${process.execPath}" "${join(cwd, 'record.mjs')}"`

    const result = await run(cwd, command, 'hooks', 'install', 'model')
    expect(result.code).toBe(2)
    expect(result.out).toContain('Added to post-checkout, post-rewrite')
    expect(result.err).toContain('post-commit, post-merge')
    expect(result.err).toContain(`${command} diff "model" --save-base --quiet`)
    expect(await readFile(join(hooks, 'post-commit'), 'utf8')).toBe(python)
    // The line an earlier version appended to a Python hook is taken out.
    expect(await readFile(join(hooks, 'post-merge'), 'utf8')).toBe('#!/usr/bin/python3\nprint("merged")\n')
    const checkout = await readFile(join(hooks, 'post-checkout'), 'utf8')
    expect(checkout).toMatch(/^#!\/usr\/bin\/env bash\n# radical/)
    expect(checkout).toMatch(/echo ran >> sh-ran\.txt\nexit 0\n$/)

    await git(cwd, 'commit', '-q', '--allow-empty', '-m', 'x')
    expect(await readFile(join(cwd, 'python-ran.txt'), 'utf8')).toBe('yes')
    await git(cwd, 'checkout', '-q', '-b', 'feature')
    expect(await readFile(join(cwd, 'ran.txt'), 'utf8')).toBe('diff model --save-base --quiet\ncheck model --from-ci --quiet --detach\n')
    expect(await readFile(join(cwd, 'sh-ran.txt'), 'utf8')).toBe('ran\n')
  })

  it('moves a line an earlier version put after the hook\'s exit to where it runs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    await git(cwd, 'init', '-q', '-b', 'main')
    await mkdir(join(cwd, 'model'))
    const hooks = join(cwd, '.git/hooks')
    await mkdir(hooks, { recursive: true })
    const line = 'radical diff "model" --save-base --quiet </dev/null || true'
    await writeFile(join(hooks, 'post-checkout'), `#!/bin/sh\nexit 0\n${HOOK_MARKER}\n${line}\n`)
    expect((await run(cwd, 'radical', 'hooks', 'install', 'model')).out).toContain('Updated in post-checkout')
    expect(await readFile(join(hooks, 'post-checkout'), 'utf8')).toBe(`#!/bin/sh\n${HOOK_MARKER}\n${line}; ${FETCH}\nexit 0\n`)
  })

  it('runs the CLI of the working tree the hook runs in, and says when it is not there', async () => {
    // Installed from a worktree, the hooks (one set for every worktree)
    // named that worktree's CLI, and failed without a word once it was gone.
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    const repo = join(cwd, 'repo')
    await mkdir(join(repo, 'model'), { recursive: true })
    await git(repo, 'init', '-q', '-b', 'main')
    await mkdir(join(repo, 'tools'))
    await writeFile(join(repo, 'tools/record.mjs'), "import { appendFileSync } from 'node:fs'\nappendFileSync('ran.txt', process.argv.slice(2).join(' ') + '\\n')\n")
    await writeFile(join(repo, '.gitignore'), 'ran.txt\n')
    await git(repo, 'add', '.')
    await git(repo, 'commit', '-q', '-m', 'cli')
    const tree = join(cwd, 'tree')
    await git(repo, 'worktree', 'add', '-q', tree, '-b', 'feature')
    await mkdir(join(tree, 'model'))
    const code = await main(['hooks', 'install', 'model'], { cwd: tree, cli: { node: `"${process.execPath}"`, script: join(tree, 'tools/record.mjs') }, out: () => {}, err: () => {} })
    expect(code).toBe(0)
    expect(await readFile(join(repo, '.git/hooks/post-commit'), 'utf8')).toContain('"tools/record.mjs" diff "model" --save-base')
    await git(repo, 'worktree', 'remove', tree)

    await git(repo, 'commit', '-q', '--allow-empty', '-m', 'x')
    expect(await readFile(join(repo, 'ran.txt'), 'utf8')).toBe('diff model --save-base --quiet\ncheck model --from-ci --quiet --detach\n')
    await git(repo, 'rm', '-q', 'tools/record.mjs')
    const { stderr } = await git(repo, 'commit', '-q', '-m', 'no cli')
    expect(stderr).toContain('tools/record.mjs is not in this working tree, so the base of model was not saved')
  })

  it('runs a CLI from npx\'s cache through npx, which npm may clear', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    await git(cwd, 'init', '-q', '-b', 'main')
    await mkdir(join(cwd, 'model'))
    const cache = await mkdtemp(join(tmpdir(), 'radical-npm-'))
    dirs.push(cache)
    const script = join(cache, '_npx', 'a1b2', 'node_modules', '@radicaltools', 'cli', 'dist', 'index.js')
    const code = await main(['hooks', 'install', 'model'], { cwd, cli: { node: `"${process.execPath}"`, script }, out: () => {}, err: () => {} })
    expect(code).toBe(0)
    const text = await readFile(join(cwd, '.git/hooks/post-commit'), 'utf8')
    expect(text).toMatch(/\nnpx -y @radicaltools\/cli(@\d\S*)? diff "model" --save-base --quiet <\/dev\/null \|\| true; npx -y @radicaltools\/cli(@\d\S*)? check "model" --from-ci --quiet --detach /)
    expect(text).not.toContain('_npx')
  })

  it('the line fetches the results of CI in the background', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'radical-hooks-'))
    dirs.push(cwd)
    await git(cwd, 'init', '-q', '-b', 'main')
    await mkdir(join(cwd, 'model'))
    expect((await run(cwd, 'radical', 'hooks', 'install', 'model')).code).toBe(0)
    // A command of its own after the base, its input and output closed: a
    // CLI built before --from-ci still saves the base, and says nothing.
    for (const name of HOOK_NAMES) {
      expect(await readFile(join(cwd, '.git/hooks', name), 'utf8')).toContain(`radical diff "model" --save-base --quiet </dev/null || true; ${FETCH}\n`)
    }
    // --detach starts the check on its own and returns: git waits for the hook.
    const started: string[][] = []
    const code = await main(['check', 'model', '--from-ci', '--quiet', '--detach'], { cwd, out: () => {}, err: () => {}, background: (args) => started.push(args) })
    expect(code).toBe(0)
    expect(started).toEqual([['check', 'model', '--from-ci', '--quiet']])
    let err = ''
    expect(await main(['check', 'model', '--detach'], { cwd, out: () => {}, err: (t) => { err += t } })).toBe(2)
    expect(err).toContain('nothing here can start a command in the background')
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
