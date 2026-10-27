import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { buildInfo, releaseOf } from '@radical/common/version'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { CLIENTS, CLIENT_IDS, entryFor, mcpPackage, npxBesideNode, pinLauncher, placeOf, sameEntry, shown, type Client, type ClientId } from './agentConfig'
import { statusCommand } from './status'
import { hooksCommand } from './hooks'
import type { Io } from './check'

const exec = promisify(execFile)

/** Metamodels a new folder can start with, as the MCP server's --metamodel. */
const METAMODELS = { radical: builtInGovernanceMetamodel, c4: builtInC4Metamodel } as const

export const SETUP_USAGE = `Usage: radical setup [folder] [options]

Connects your coding agents to a Radical model folder, step by step:
  1. Node      checks the version
  2. Folder    a missing or empty folder becomes a new model
  3. Agents    adds the MCP server for the folder to each agent's
               configuration, pinned to this version (other entries stay)
  4. Hooks     the hooks that save the model's base for Studio's Changes on
               branch (radical hooks install); outside a git repository it
               asks, in a terminal, to start one in the working directory
  5. Check     radical status for the folder

In a terminal it asks each question with its default; press Enter to take
it. Otherwise (or with --yes) it asks nothing and takes the options and the
defaults: the folder architecture, the agents it finds installed.

  folder              the model folder (default: architecture)
  --client <id>       an agent to connect, more than once for several:
                      ${CLIENT_IDS.join(', ')}
                      (default: the ones found installed)
  --metamodel <name>  the metamodel of a new model: radical (C4 with domains
                      and governance, default) or c4
  --name <name>       the server's name in the configurations (default: radical)
  --no-hooks          leave the git hooks alone
  --no-check          end without the checks of radical status
  --dry-run           print what it would change and write nothing
  -y, --yes           ask nothing

Claude Code's .mcp.json and VS Code's .vscode/mcp.json go to the top of the
repository, to share through git; Claude Desktop's, Cursor's and Codex's
configurations are your own, backed up to <file>.bak before a change.

Run through the launcher (sh radical.sh setup, radical.cmd setup), it pins
the launcher to this version and every agent starts the server through it,
with the Node.js the launcher finds or downloaded.

Exit status: 0 set up and checked, 1 a step or a check failed, 2 it could
not run.`

/** Runs `radical setup` with `args` (after the command name); returns the exit status. */
export async function setupCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        client: { type: 'string', multiple: true },
        metamodel: { type: 'string' },
        name: { type: 'string', default: 'radical' },
        'no-hooks': { type: 'boolean', default: false },
        'no-check': { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        yes: { type: 'boolean', short: 'y', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${SETUP_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(SETUP_USAGE); return 0 }
  const unknown = (values.client ?? []).filter((id) => !(CLIENT_IDS as string[]).includes(id))
  if (positionals.length > 1 || unknown.length || (values.metamodel && !(values.metamodel in METAMODELS)) || !values.name.trim()) {
    io.err(`${unknown.length ? `Unknown agent: ${unknown.join(', ')}\n\n` : ''}${SETUP_USAGE}`)
    return 2
  }
  const dry = values['dry-run']
  const ask = values.yes ? undefined : io.ask
  /** The answer to `question`, or `fallback` when nobody asks or Enter is pressed. */
  const answer = async (question: string, fallback: string) =>
    ask ? (await ask(`${question} [${fallback}]: `)).trim() || fallback : fallback
  const confirm = async (question: string) => /^y/i.test(await answer(question, 'yes'))
  let failed = false

  // ── 1. Node ──
  io.out('1/5 Node')
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 20 || (major === 20 && minor < 11)) {
    io.err(`radical setup: Node.js ${process.versions.node} is too old: the MCP server needs 20.11 or later (https://nodejs.org).`)
    return 2
  }
  io.out(`  ✓ Node.js ${process.versions.node}`)

  // ── 2. The model folder ──
  io.out('2/5 Model folder')
  const folderArg = positionals[0] ?? await answer('  Model folder', 'architecture')
  const folder = resolve(io.cwd, folderArg)
  let entries: string[] | null
  try { entries = await readdir(folder) } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') { io.err(`radical setup: ${folderArg}: ${code === 'ENOTDIR' ? 'is a file, not a folder' : (error as Error).message}`); return 2 }
    entries = null
  }
  const empty = entries === null || entries.every((name) => name.startsWith('.'))
  if (empty) {
    const metamodel = values.metamodel ?? await answer('  It holds no model yet. Metamodel of the new model, radical (C4 with domains and governance) or c4', 'radical')
    if (!(metamodel in METAMODELS)) { io.err(`radical setup: unknown metamodel ${metamodel}: radical or c4`); return 2 }
    if (dry) io.out(`  would start a new model (${metamodel} metamodel) in ${folderArg}`)
    else {
      await mkdir(folder, { recursive: true })
      const files = serializeToMdFolder({ nodes: [], relations: [], metamodel: METAMODELS[metamodel as keyof typeof METAMODELS]() }, basename(folder))
      const written = await new MdFolderSession(diskFolderStorage(folder)).write(files)
      if (!written.ok) { io.err(`radical setup: ${folderArg} changed while the model was written; run it again.`); return 2 }
      io.out(`  + started a new model (${metamodel} metamodel) in ${folderArg}`)
    }
  } else if (!existsSync(resolve(folder, 'radical.md'))) {
    io.err(`radical setup: ${folderArg} holds other files and no radical.md, so it is not a Radical model folder. Name an empty or new folder, or one with a model.`)
    return 2
  } else {
    io.out(`  ✓ ${folderArg} holds a model`)
  }
  const real = existsSync(folder) ? await realpath(folder) : folder
  const git = async (...gitArgs: string[]) => (await exec('git', gitArgs, { cwd: existsSync(real) ? real : io.cwd, windowsHide: true })).stdout.trim()
  let top = await git('rev-parse', '--show-toplevel').then((path) => realpath(path), () => null)
  const place = placeOf(io, top ?? await realpath(io.cwd))

  // ── 3. The agents ──
  io.out('3/5 Agents')
  if (place.launcher) {
    // The project keeps its launcher at this version, as the agents' servers.
    const release = releaseOf(io.version ?? buildInfo().version)
    const name = shown(place.launcher, place)
    const text = await readFile(place.launcher, 'utf8').catch(() => null)
    const pinned = text === null || release.includes('-dev') ? text : pinLauncher(text, release)
    if (pinned === null) io.out(`  ✗ ${name} does not read`)
    else if (pinned === text) io.out(`  ✓ ${name} runs ${release.includes('-dev') ? 'the latest version' : release}`)
    else if (dry) io.out(`  would pin ${name} to ${release}`)
    else {
      await writeFile(place.launcher, pinned)
      io.out(`  + pinned ${name} to ${release}`)
    }
    if (!dry && place.launcher.endsWith('.sh')) await chmod(place.launcher, 0o755).catch(() => undefined)
  }
  const found = CLIENTS.filter((client) => client.installed(place))
  let chosen: Client[]
  if (values.client?.length) chosen = CLIENTS.filter((client) => values.client!.includes(client.id))
  else if (ask) {
    CLIENTS.forEach((client, i) => io.out(`  ${i + 1}. ${client.label.padEnd(15)}${shown(client.file(place), place)}${found.includes(client) ? '  (found)' : ''}`))
    const picked = await answer('  Agents to connect, by number', found.map((client) => CLIENTS.indexOf(client) + 1).join(' ') || 'none')
    chosen = picked === 'none' ? [] : CLIENTS.filter((_, i) => picked.split(/[\s,]+/).includes(String(i + 1)))
  } else chosen = found
  if (!chosen.length) io.out('  - no agent chosen: radical setup --client <id> connects one later')
  if (chosen.some((client) => client.scope === 'user') && !npxBesideNode(place)) {
    io.out(`  ! no npx beside ${place.execPath}: the agents started from the Dock will look for npx on their own PATH`)
  }
  const pkg = mcpPackage(io.version)
  for (const client of chosen) {
    const file = client.file(place)
    const where = `${client.label}: ${shown(file, place)}`
    const entry = entryFor(client, real, place, pkg)
    const text = await readFile(file, 'utf8').catch(() => null)
    let servers
    try { servers = text === null ? {} : client.read(text) } catch (error) {
      io.out(`  ✗ ${where} does not read (${(error as Error).message}); add "${values.name}" by hand: ${JSON.stringify(entry)}`)
      failed = true
      continue
    }
    const old = servers[values.name]
    if (old && sameEntry(old, entry)) { io.out(`  ✓ ${where} already runs "${values.name}" for the folder`); continue }
    if (old && !(await confirm(`  ${where} has another "${values.name}" server (${[old.command, ...old.args].join(' ')}). Replace it?`))) {
      io.out(`  - ${where} keeps its "${values.name}"; --name <name> adds this one beside it`)
      continue
    }
    const verb = old ? 'replaced' : 'added'
    if (dry) { io.out(`  would ${old ? 'replace' : 'add'} "${values.name}" in ${where}: ${[entry.command, ...entry.args].join(' ')}`); continue }
    try {
      await mkdir(dirname(file), { recursive: true })
      if (text !== null && client.scope === 'user') await copyFile(file, `${file}.bak`)
      await writeFile(file, client.write(text, values.name, entry))
      io.out(`  + ${verb} "${values.name}" in ${where}${text !== null && client.scope === 'user' ? ` (backup: ${basename(file)}.bak)` : ''}`)
    } catch (error) {
      io.out(`  ✗ ${where} could not be written: ${(error as Error).message}`)
      failed = true
    }
  }

  // ── 4. The git hooks ──
  io.out('4/5 Git hooks')
  if (!top && !values['no-hooks'] && ask && await confirm('  Not in a git repository. Start one here (git init)?')) {
    if (dry) io.out('  would run: git init')
    else {
      await exec('git', ['init', '-q'], { cwd: io.cwd, windowsHide: true })
      top = await realpath(io.cwd)
      io.out('  + started a git repository')
    }
  }
  if (!top) io.out('  - not in a git repository: no hooks')
  else if (values['no-hooks']) io.out('  - left alone (--no-hooks)')
  else if (!(await confirm('  Add the git hooks that save the model\'s base for Studio\'s Changes on branch?'))) io.out('  - left alone')
  else if (dry) io.out(`  would run: radical hooks install ${folderArg}`)
  else {
    const hooksIo: Io = { ...io, out: (line) => io.out(`  ${line}`), err: (line) => io.out(`  ✗ ${line}`) }
    if ((await hooksCommand(['install', relative(io.cwd, real) || '.'], hooksIo)) !== 0) failed = true
  }

  // ── 5. Check ──
  io.out('5/5 Check')
  if (dry) { io.out('  - dry run: nothing was written'); return failed ? 1 : 0 }
  if (values['no-check']) io.out('  - skipped (--no-check); radical status checks it later')
  const code = values['no-check'] ? 0 : await statusCommand([relative(io.cwd, real) || '.'], io)
  if (chosen.length) {
    io.out('\nNext: restart the agents you connected (quit Claude Desktop and Cursor fully, run /mcp in Claude Code), '
      + `ask one to call get_model_summary, and open ${folderArg} in Studio (https://studio.radical.tools, Models → Open folder…) to watch it work.`)
  }
  return failed || code ? 1 : 0
}
