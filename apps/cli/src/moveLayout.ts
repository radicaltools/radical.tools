// radical setup's move of a repository laid out the old way into .radical/
// (ADR Radical in one .radical folder): each part with git mv, so its
// history follows it, and what names the old places pointed at the new.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { OLD_STATE_DIR, STATE_DIR } from '@radical/common/formats/canvasSelection'
import {
  CRUCIBLE_FILE, CRUCIBLE_FINDINGS, CRUCIBLE_ROUNDS, MODEL_FOLDER, MODEL_STATE, OLD_CRUCIBLE_FILE, OLD_CRUCIBLE_FINDINGS,
  OLD_CRUCIBLE_ROUNDS, OLD_MODEL_FOLDER, OLD_MODEL_STATE, OLD_SENSORS_FILE, RADICAL_DIR, SENSORS_FILE,
} from '@radical/node-files/repositoryLayout'
import { HOOK_NAMES, quote, withoutLine } from './hooks'

const exec = promisify(execFile)

/** Where each part of the old layout goes. */
export const MOVES: Record<string, string> = {
  [OLD_MODEL_FOLDER]: MODEL_FOLDER,
  [OLD_SENSORS_FILE]: SENSORS_FILE,
  [OLD_CRUCIBLE_FILE]: CRUCIBLE_FILE,
  [OLD_CRUCIBLE_FINDINGS]: CRUCIBLE_FINDINGS,
  [OLD_CRUCIBLE_ROUNDS]: CRUCIBLE_ROUNDS,
  [OLD_MODEL_STATE]: MODEL_STATE,
}

/** What .radical/.gitignore keeps out of git: Crucible's rounds. */
const RADICAL_GITIGNORE = 'crucible/rounds/\n'

/** Moves `parts` (oldLayout's) of the repository at `root` into .radical/;
 *  returns a line for each change. */
export async function moveToRadical(root: string, parts: string[]): Promise<string[]> {
  const said: string[] = []
  const git = (...args: string[]) => exec('git', args, { cwd: root, windowsHide: true })
  await mkdir(join(root, RADICAL_DIR), { recursive: true })
  for (const part of parts) {
    const to = MOVES[part]
    await mkdir(dirname(join(root, to)), { recursive: true })
    // A part git does not know (never added) is renamed on disk.
    await git('mv', part, to).catch(() => rename(join(root, part), join(root, to)))
    said.push(`moved ${part} to ${to}`)
  }
  if (!existsSync(join(root, RADICAL_DIR, '.gitignore'))) {
    await writeFile(join(root, RADICAL_DIR, '.gitignore'), RADICAL_GITIGNORE)
    said.push(`wrote ${RADICAL_DIR}/.gitignore (Crucible's rounds stay out of git)`)
  }
  // The model's state, out of git, under its new name.
  const model = join(root, MODEL_FOLDER)
  if (parts.includes(OLD_MODEL_FOLDER) && existsSync(join(model, OLD_STATE_DIR)) && !existsSync(join(model, STATE_DIR))) {
    await rename(join(model, OLD_STATE_DIR), join(model, STATE_DIR))
    said.push(`renamed the model's ${OLD_STATE_DIR}/ to ${STATE_DIR}/`)
  }
  // Crucible's plan names the old places.
  const plan = join(root, CRUCIBLE_FILE)
  if (existsSync(plan)) {
    const text = await readFile(plan, 'utf8')
    const next = text
      .replace(new RegExp(`"${OLD_CRUCIBLE_FINDINGS}"`, 'g'), `"${CRUCIBLE_FINDINGS}"`)
      .replace(new RegExp(`"${OLD_CRUCIBLE_ROUNDS.replace('.', '\\.')}"`, 'g'), `"${CRUCIBLE_ROUNDS}"`)
      .replace(new RegExp(`"model": "${OLD_MODEL_FOLDER}"`, 'g'), `"model": "${MODEL_FOLDER}"`)
    if (next !== text) { await writeFile(plan, next); said.push(`pointed ${CRUCIBLE_FILE} at the new places`) }
  }
  if (parts.includes(OLD_MODEL_FOLDER)) said.push(...await pointAtModel(root, resolve(root, OLD_MODEL_FOLDER), model))
  return said
}

/** Points the project's agent configurations and git hooks that name the
 *  model folder `from` at `to`. */
async function pointAtModel(root: string, from: string, to: string): Promise<string[]> {
  const said: string[] = []
  for (const name of ['.mcp.json', '.vscode/mcp.json']) {
    const file = join(root, name)
    const text = await readFile(file, 'utf8').catch(() => null)
    if (text === null) continue
    let changed = false
    let data: { mcpServers?: Record<string, { args?: string[] }>; servers?: Record<string, { args?: string[] }> }
    try { data = JSON.parse(text) } catch { continue }
    for (const server of Object.values({ ...data.mcpServers, ...data.servers })) {
      const at = server.args?.indexOf('--folder') ?? -1
      if (at < 0 || resolve(root, server.args![at + 1] ?? '') !== from) continue
      server.args![at + 1] = relative(root, to)
      changed = true
    }
    if (changed) { await writeFile(file, `${JSON.stringify(data, null, 2)}\n`); said.push(`pointed ${name} at ${relative(root, to)}`) }
  }
  // The hooks' line for the old folder goes; radical hooks install adds one
  // for the new folder.
  const hooksDir = resolve(root, (await exec('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, windowsHide: true }).catch(() => ({ stdout: '' }))).stdout.trim() || '.git/hooks')
  let hooks = false
  for (const name of HOOK_NAMES) {
    const path = join(hooksDir, name)
    const text = await readFile(path, 'utf8').catch(() => null)
    if (text === null) continue
    const { lines, at } = withoutLine(text.split('\n'), quote(relative(root, from)))
    if (at >= 0) { await writeFile(path, lines.join('\n')); hooks = true }
  }
  if (hooks) said.push(`took ${relative(root, from)} out of the git hooks`)
  return said
}
