import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import { deserializeFromMdFolder, isValidMdFolderManifest } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { compareVersions, displayVersion, releaseOf } from '@radical/common/version'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { CLIENTS, expanded, folderOf, isRadicalServer, launcherOf, launcherPath, onPath, pinnedVersion, placeOf, shown, type Client, type Place, type ServerEntry } from './agentConfig'
import { hooksSaveBase } from './hooks'
import type { Io } from './check'

const exec = promisify(execFile)

export const DOCTOR_USAGE = `Usage: radical doctor [folder] [options]

Checks what an agent needs to work on a model folder: Node, the folder (it
reads as a model, and the git hooks save its base for Studio), every agent
configuration that holds a Radical MCP server (Claude Code, Claude Desktop,
Codex, Cursor, VS Code), its command, the folder it serves and the version it
pins; then starts each server configured for the folder as its agent would
and asks it for the model's summary over stdio.

  folder              the model folder (default: the working directory when
                      it holds a model, else every server configured)
  --no-start          check the configurations without starting a server
  --timeout <s>       seconds a server has to answer (default 120: npx may
                      download the package first)

Exit status: 0 nothing is broken, 1 something is, 2 it could not run.`

/** The server's answer to initialize and get_model_summary over stdio. */
interface Answer { version?: string; nodes?: number; error?: string }

/** Starts `entry` in `cwd` and asks it for the model's summary. */
export function askServer(entry: ServerEntry, cwd: string, place: Place, timeoutMs: number): Promise<Answer> {
  return new Promise((done) => {
    const env = { ...place.env, ...entry.env } as NodeJS.ProcessEnv
    // A .cmd (npx.cmd on Windows) runs through the shell only.
    const child = spawn(entry.command, entry.args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: /\.(cmd|bat)$/i.test(entry.command) })
    let stdout = ''
    let stderr = ''
    let version: string | undefined
    let settled = false
    const finish = (answer: Answer) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdin.end()
      child.kill()
      done(answer)
    }
    const lastLines = () => stderr.trim().split('\n').slice(-3).join(' / ')
    const timer = setTimeout(() => finish({ error: `did not answer in ${Math.round(timeoutMs / 1000)} s${stderr.trim() ? `: ${lastLines()}` : ''}` }), timeoutMs)
    const send = (id: number | undefined, method: string, params: object) =>
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, params }) + '\n')
    child.on('error', (error) => finish({ error: error.message }))
    child.on('exit', (code) => finish({ error: `exited with ${code}${stderr.trim() ? `: ${lastLines()}` : ''}` }))
    child.stdin.on('error', () => { /* the exit says why */ })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
      let end
      while ((end = stdout.indexOf('\n')) >= 0) {
        const line = stdout.slice(0, end).trim()
        stdout = stdout.slice(end + 1)
        if (!line) continue
        let message: { id?: number; result?: Record<string, unknown>; error?: { message?: string } }
        try { message = JSON.parse(line) } catch { continue }
        if (message.error) { finish({ version, error: message.error.message ?? 'answered with an error' }); return }
        if (message.id === 1) {
          version = (message.result?.serverInfo as { version?: string } | undefined)?.version
          send(undefined, 'notifications/initialized', {})
          send(2, 'tools/call', { name: 'get_model_summary', arguments: {} })
        } else if (message.id === 2) {
          const result = message.result as { isError?: boolean; content?: { text?: string }[] } | undefined
          const text = result?.content?.map((c) => c.text ?? '').join('\n') ?? ''
          if (result?.isError) { finish({ version, error: text || 'get_model_summary failed' }); return }
          let nodes: number | undefined
          try { nodes = (JSON.parse(text.split('\n')[0]) as { nodes?: number }).nodes } catch { /* a summary without counts still answers */ }
          finish({ version, nodes })
        }
      }
    })
    send(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'radical-doctor', version: displayVersion() } })
  })
}

/** Runs `radical doctor` with `args` (after the command name); returns the exit status. */
export async function doctorCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        'no-start': { type: 'boolean', default: false },
        timeout: { type: 'string', default: '120' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${DOCTOR_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(DOCTOR_USAGE); return 0 }
  const timeout = Number(values.timeout)
  if (positionals.length > 1 || !(timeout > 0)) { io.err(DOCTOR_USAGE); return 2 }

  let problems = 0
  const ok = (text: string) => io.out(`  ✓ ${text}`)
  const warn = (text: string) => io.out(`  ! ${text}`)
  const fail = (text: string) => { problems++; io.out(`  ✗ ${text}`) }

  // The folder: the one named, else the working directory when it is a model.
  const named = positionals[0]
  const candidate = resolve(io.cwd, named ?? '.')
  const folder = named !== undefined || existsSync(resolve(candidate, 'radical.md'))
    ? await realpath(candidate).catch(() => candidate)
    : null
  const git = async (cwd: string, ...gitArgs: string[]) => (await exec('git', gitArgs, { cwd, windowsHide: true })).stdout.trim()
  const topOf = async (dir: string) => {
    let at = dir
    while (!existsSync(at) && dirname(at) !== at) at = dirname(at)
    return git(at, 'rev-parse', '--show-toplevel').then((path) => realpath(path)).catch(() => null)
  }
  const top = await topOf(folder ?? io.cwd)
  const place = placeOf(io, top ?? io.cwd)
  const mine = io.version ?? displayVersion()

  io.out('Node')
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major > 20 || (major === 20 && minor >= 11)) ok(`Node.js ${process.versions.node} (${place.execPath})`)
  else fail(`Node.js ${process.versions.node}: the CLI and the MCP server need 20.11 or later`)
  ok(`radical ${mine}`)

  if (folder) {
    io.out(`Model folder ${shown(folder, place)}`)
    const isDir = await stat(folder).then((s) => s.isDirectory(), () => false)
    if (!isDir) fail(`${shown(folder, place)} is not there${named ? `: radical setup ${named} starts a model there` : ''}`)
    else {
      try {
        const files = await new MdFolderSession(diskFolderStorage(folder)).readAll()
        if (!isValidMdFolderManifest(files['radical.md'])) throw new Error('it has no valid radical.md, so it is not a Radical model folder')
        const data = deserializeFromMdFolder(files).data
        ok(`reads as a model: ${data.nodes.length} elements, ${data.relations.length} relations, ${data.views?.length ?? 0} views`)
      } catch (error) {
        fail(`does not read as a model: ${(error as Error).message}`)
      }
      if (!top) warn('is not in a git repository: Studio\'s Changes on branch and radical diff need one')
      else {
        const hooksDir = resolve(folder, await git(folder, 'rev-parse', '--git-path', 'hooks'))
        const fromTop = relative(top, folder).replace(/\\/g, '/')
        if (await hooksSaveBase(hooksDir, fromTop)) ok('the git hooks save its base for Studio\'s Changes on branch')
        else warn(`the git hooks do not save its base for Studio's Changes on branch: radical hooks install ${shown(folder, place)}`)
      }
    }
  }

  io.out('Agents')
  const toStart: { client: Client; name: string; entry: ServerEntry }[] = []
  let configured = 0
  for (const client of CLIENTS) {
    const file = client.file(place)
    const text = await readFile(file, 'utf8').catch(() => null)
    if (text === null) continue
    let servers: Record<string, ServerEntry>
    try { servers = client.read(text) } catch (error) {
      fail(`${client.label}: ${shown(file, place)} does not read: ${(error as Error).message}`)
      continue
    }
    for (const [name, entry] of Object.entries(servers)) {
      if (!isRadicalServer(entry)) continue
      const serves = folderOf(entry, client, place)
      const servesReal = serves ? await realpath(serves).catch(() => serves) : null
      const where = `${client.label} "${name}" (${shown(file, place)})`
      if (folder && servesReal !== folder) {
        io.out(`  · ${where} serves ${servesReal ? shown(servesReal, place) : 'no folder'}`)
        continue
      }
      configured++
      const before = problems
      const run = expanded(entry, place)
      const command = isAbsolute(run.command) ? (existsSync(run.command) ? run.command : null) : onPath(run.command, place, entry.env?.PATH)
      const launcher = launcherPath(entry, client, place)
      // On Windows the launcher itself is the command; its own check follows.
      if (!command && run.command !== launcherOf(run)) fail(`${where}: its command ${entry.command} is not there${entry.env?.PATH ? ` (PATH ${entry.env.PATH})` : ''}: radical setup writes it again`)
      if (launcher && !existsSync(launcher)) fail(`${where}: its launcher ${shown(launcher, place)} is not there: download it from https://radical.tools/${launcher.endsWith('.cmd') ? 'radical.cmd' : 'radical.sh'}`)
      if (!servesReal) fail(`${where}: names no --folder`)
      else if (!existsSync(resolve(servesReal, 'radical.md')) && !folder) fail(`${where}: serves ${shown(servesReal, place)}, which holds no model`)
      const pinned = pinnedVersion(entry, client, place)
      if (pinned && compareVersions(pinned, mine) !== 0 && !releaseOf(mine).includes('-dev')) {
        warn(`${where} runs MCP server ${pinned}, this CLI is ${releaseOf(mine)}: radical setup pins it to ${releaseOf(mine)}`)
      }
      if (problems === before) {
        const how = launcher ? ` through ${shown(launcher, place)}${pinned ? ` (${pinned})` : ''}` : pinned ? ` with @radicaltools/mcp@${pinned}` : ''
        ok(`${where} serves ${servesReal ? shown(servesReal, place) : '?'}${how}`)
        toStart.push({ client, name, entry })
      }
    }
  }
  if (!configured) {
    if (folder) warn(`no agent is set up for ${shown(folder, place)}: radical setup ${shown(folder, place)}`)
    else warn('no agent is set up for a Radical model: radical setup <folder>')
  }

  if (!values['no-start'] && toStart.length) {
    io.out('Servers')
    for (const { client, name, entry } of toStart) {
      const answer = await askServer(expanded(entry, place), client.base(place), place, timeout * 1000)
      const where = `${client.label} "${name}"`
      if (answer.error) { fail(`${where}: the server ${answer.error}`); continue }
      ok(`${where}: MCP server ${answer.version ?? '?'} answers${answer.nodes !== undefined ? ` (${answer.nodes} elements)` : ''}`)
      if (answer.version && !releaseOf(mine).includes('-dev') && compareVersions(answer.version, mine) !== 0) {
        warn(`${where}: the server is ${releaseOf(answer.version)}, this CLI ${releaseOf(mine)}; Studio warns when an agent writes with another version`)
      }
    }
  }

  io.out(problems ? `\n${problems} problem${problems > 1 ? 's' : ''} found.` : '\nNothing is broken.')
  return problems ? 1 : 0
}
