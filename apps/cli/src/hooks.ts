import { chmod, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { isAbsolute, relative, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import type { Io } from './check'

const exec = promisify(execFile)

export const HOOKS_USAGE = `Usage: radical hooks install [folder] [options]

Adds a line to the repository's post-checkout, post-commit, post-merge and
post-rewrite git hooks that saves the model folder's base (radical diff
--save-base) after a checkout, a commit, a pull or merge and a rebase, so
Studio shows the changes of the branch checked out without anyone running
it. The line goes right after the hook's first line, where an exit or an
exec further down cannot skip it, and what the hooks already do stays. Each
model folder has a line of its own; running it again adds nothing, but
brings the line up to date when the CLI or node has moved. A hook written
in another language than sh is left alone: the message says what to call
from it. A CLI inside the repository is named by its path from the top,
so each worktree runs its own, and the hook says when it is not built there.

  folder              the model folder (default: the working directory)

Exit status: 0 the hooks hold the line, 2 one or more could not be written.`

/** A checkout, a commit (amended too), a pull or merge, a rebase. */
export const HOOK_NAMES = ['post-checkout', 'post-commit', 'post-merge', 'post-rewrite'] as const

/** Marks the line, so a second install finds it. The line after it names
 *  the folder: a repository may hold more than one model. */
export const HOOK_MARKER = '# radical: save the model base for Studio'

/** True when the hook script `text` is run by a POSIX shell: no `#!` line
 *  (git runs it with sh), or one naming sh, bash, dash, zsh, ksh or ash,
 *  directly or through env. */
function isShHook(text: string): boolean {
  const shebang = /^#!\s*(\S+)(.*)/.exec(text.split('\n')[0])
  if (!shebang) return true
  const program = (path: string) => path.slice(path.lastIndexOf('/') + 1)
  let interpreter = program(shebang[1])
  if (interpreter === 'env') interpreter = program(shebang[2].trim().split(/\s+/).find((arg) => !arg.startsWith('-') && !arg.includes('=')) ?? '')
  return /^(sh|bash|dash|zsh|ksh|mksh|ash)$/.test(interpreter)
}

/** `lines` without the marked line that saves the base of `folder` (as
 *  quoted in the hook), and where it was (-1 when it was not there). */
function withoutLine(lines: string[], folder: string): { lines: string[]; at: number } {
  const at = lines.findIndex((text, i) => text === HOOK_MARKER && lines[i + 1]?.includes(` diff ${folder} --save-base`))
  return at < 0 ? { lines, at } : { lines: [...lines.slice(0, at), ...lines.slice(at + 2)], at }
}

const quote = (text: string) => `"${text.replace(/\\/g, '/').replace(/(["$`])/g, '\\$1')}"`

/** Runs `radical hooks` with `args` (after the command name); returns the exit status. */
export async function hooksCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { help: { type: 'boolean', short: 'h', default: false } } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${HOOKS_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(HOOKS_USAGE); return 0 }
  const [action, folder = '.', ...rest] = positionals
  if (action !== 'install' || rest.length) { io.err(HOOKS_USAGE); return 2 }
  try {
    const root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    const git = async (...gitArgs: string[]) => (await exec('git', gitArgs, { cwd: root, windowsHide: true })).stdout.trim()
    const top = await realpath(await git('rev-parse', '--show-toplevel').catch(() => {
      throw new Error('is not in a git repository')
    }))
    // core.hooksPath and worktrees included; relative to the folder.
    const hooksDir = resolve(root, await git('rev-parse', '--git-path', 'hooks'))
    await mkdir(hooksDir, { recursive: true })
    // Git runs hooks at the top of the working tree. The hook's stdin
    // (post-rewrite's list of commits) is for the hook's own commands.
    const folderArg = quote(relative(top, root) || '.')
    // A CLI inside the repository (npm run hooks) by its path from the top:
    // the hooks are one set for every worktree, and the worktree they were
    // installed from may be gone. Where it is not built, the hook says so.
    const script = io.cli ? await realpath(io.cli.script).catch(() => io.cli!.script) : null
    const fromTop = script ? relative(top, script) : null
    const inRepo = fromTop !== null && fromTop !== '' && !fromTop.startsWith('..') && !isAbsolute(fromTop)
    const command = io.cli ? `${io.cli.node} ${quote(inRepo ? fromTop : script!)}` : io.command ?? 'radical'
    const run = `${command} diff ${folderArg} --save-base --quiet </dev/null || true`
    const line = inRepo
      ? `if [ -f ${quote(fromTop)} ]; then ${run}; else echo ${quote(`radical hooks: ${fromTop} is not in this working tree, so the base of ${relative(top, root) || '.'} was not saved; build the CLI there, or install the hooks again.`)} >&2; fi`
      : run
    const written: string[] = []
    const updated: string[] = []
    const foreign: string[] = []
    for (const name of HOOK_NAMES) {
      const path = resolve(hooksDir, name)
      const old = await readFile(path, 'utf8').catch(() => null)
      if (old === null) {
        await writeFile(path, `#!/bin/sh\n${HOOK_MARKER}\n${line}\n`)
        await chmod(path, 0o755)
        written.push(name)
        continue
      }
      const { lines, at } = withoutLine(old.split('\n'), folderArg)
      if (!isShHook(old)) {
        // A sh line breaks a Python (or any other) hook: the user adds the
        // call in the hook's own language. A line an earlier version
        // appended to it is taken out.
        if (at >= 0) await writeFile(path, lines.join('\n'))
        foreign.push(name)
        continue
      }
      // Right after the #! line (and the other folders' lines): an exit or
      // exec further down would skip a line at the end.
      let after = lines[0].startsWith('#!') ? 1 : 0
      while (lines[after] === HOOK_MARKER && lines[after + 1] !== undefined) after += 2
      if (at >= 0 && at <= after) after = at
      const text = [...lines.slice(0, after), HOOK_MARKER, line, ...lines.slice(after)].join('\n')
      if (text === old) continue
      await writeFile(path, text.endsWith('\n') ? text : `${text}\n`)
      await chmod(path, 0o755)
      ;(at >= 0 ? updated : written).push(name)
    }
    const where = relative(io.cwd, hooksDir) || hooksDir
    if (written.length) io.out(`Added to ${written.join(', ')} in ${where}: ${line}`)
    if (updated.length) io.out(`Updated in ${updated.join(', ')} in ${where}: ${line}`)
    if (foreign.length) {
      io.err(`radical hooks: ${foreign.join(', ')} in ${where} ${foreign.length > 1 ? 'are' : 'is'} not a sh script, so no line was added. `
        + `Make ${foreign.length > 1 ? 'each' : 'it'} run this sh command from the top of the repository, ignoring its exit status: `
        + `${command} diff ${folderArg} --save-base --quiet`)
      return 2
    }
    if (!written.length && !updated.length) io.out('The hooks already save the base; nothing changed.')
    return 0
  } catch (error) {
    io.err(`radical hooks: ${folder}: ${(error as Error).message}`)
    return 2
  }
}
