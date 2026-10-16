import { chmod, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { relative, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import type { Io } from './check'

const exec = promisify(execFile)

export const HOOKS_USAGE = `Usage: radical hooks install [folder] [options]

Adds a line to the repository's post-checkout, post-commit and post-merge git
hooks that saves the model folder's base (radical diff --save-base), so
Studio shows the changes of the branch checked out without anyone running
it. What the hooks already do stays; running it again adds nothing, but
brings the line up to date when the CLI or node has moved.

  folder              the model folder (default: the working directory)

Exit status: 0 the hooks hold the line, 2 they could not be written.`

export const HOOK_NAMES = ['post-checkout', 'post-commit', 'post-merge'] as const

/** Marks the line, so a second install finds it. */
export const HOOK_MARKER = '# radical: save the model base for Studio'

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
    // Git runs hooks at the top of the working tree.
    const line = `${io.command ?? 'radical'} diff ${quote(relative(top, root) || '.')} --save-base --quiet || true`
    const written: string[] = []
    const updated: string[] = []
    for (const name of HOOK_NAMES) {
      const path = resolve(hooksDir, name)
      const old = await readFile(path, 'utf8').catch(() => null)
      if (old?.includes(HOOK_MARKER)) {
        // Installed before: the line after the marker becomes today's (the CLI or node moved).
        const lines = old.split('\n')
        const at = lines.indexOf(HOOK_MARKER)
        if (lines[at + 1] === line) continue
        lines[at + 1] = line
        await writeFile(path, lines.join('\n'))
        updated.push(name)
        continue
      }
      const head = old === null ? '#!/bin/sh\n' : old.endsWith('\n') ? old : `${old}\n`
      await writeFile(path, `${head}${HOOK_MARKER}\n${line}\n`)
      await chmod(path, 0o755)
      written.push(name)
    }
    const where = relative(io.cwd, hooksDir) || hooksDir
    io.out(written.length ? `Added to ${written.join(', ')} in ${where}: ${line}`
      : updated.length ? `Updated in ${updated.join(', ')} in ${where}: ${line}`
        : 'The hooks already save the base; nothing changed.')
    return 0
  } catch (error) {
    io.err(`radical hooks: ${folder}: ${(error as Error).message}`)
    return 2
  }
}
