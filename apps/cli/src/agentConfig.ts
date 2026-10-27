import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { buildInfo, releaseOf } from '@radical/common/version'
import type { Io } from './check'

// ─── Where each agent keeps its MCP servers ──────────────────────────────────
//
// radical setup writes one entry per agent and radical doctor reads them back
// (ADR "Guided setup in the CLI"). A project file (.mcp.json, .vscode/mcp.json)
// is shared through git, so it names npx from the PATH and the folder by its
// path from the top of the repository. A user file belongs to an app that may
// be started from the Dock, without the shell's PATH: it names npx by its
// absolute path, with node's directory on the server's PATH.

export type ClientId = 'claude-code' | 'claude-desktop' | 'codex' | 'cursor' | 'vscode'

/** How an agent starts a server: what radical setup writes, what doctor runs. */
export interface ServerEntry {
  command: string
  args: string[]
  env?: Record<string, string>
}

/** Where the configurations are found and how npx is named. */
export interface Place {
  cwd: string
  home: string
  env: Record<string, string | undefined>
  platform: NodeJS.Platform
  /** The top of the repository the model folder is in, else the working directory. */
  top: string
  /** The node running this command line. */
  execPath: string
}

export function placeOf(io: Io, top: string): Place {
  return {
    cwd: io.cwd,
    home: io.home ?? homedir(),
    env: io.env ?? process.env,
    platform: io.platform ?? process.platform,
    top,
    execPath: io.execPath ?? process.execPath,
  }
}

export interface Client {
  id: ClientId
  label: string
  /** project: in the repository, shared through git; user: the user's own. */
  scope: 'project' | 'user'
  file: (place: Place) => string
  /** The agent looks installed: its configuration directory or its command is there. */
  installed: (place: Place) => boolean
  /** The servers in the file's text by name; throws when it does not read. */
  read: (text: string) => Record<string, ServerEntry>
  /** The file's text (null: no file yet) with `entry` as server `name`. */
  write: (text: string | null, name: string, entry: ServerEntry) => string
  /** The directory a relative --folder is resolved against when the agent starts the server. */
  base: (place: Place) => string
}

/** The package an entry runs: pinned to this CLI's version, as one product
 *  version ships both (ADR "Product and format versioning"). */
export function mcpPackage(version: string = buildInfo().version): string {
  const release = releaseOf(version)
  return release.includes('-dev') ? '@radicaltools/mcp' : `@radicaltools/mcp@${release}`
}

const isWindows = (place: Place) => place.platform === 'win32'

/** A command found on the PATH (`path`, else the environment's). */
export function onPath(command: string, place: Place, path = place.env.PATH ?? place.env.Path ?? ''): string | null {
  const exts = isWindows(place) ? (place.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').concat('') : ['']
  for (const dir of path.split(isWindows(place) ? ';' : delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const candidate = join(dir, command + ext.toLowerCase())
      if (existsSync(candidate)) return candidate
      if (ext && existsSync(join(dir, command + ext))) return join(dir, command + ext)
    }
  }
  return null
}

const npxName = (place: Place) => isWindows(place) ? 'npx.cmd' : 'npx'

/** The directory of the node running now, by a name on the PATH that leads
 *  to it when there is one: /opt/homebrew/bin rather than
 *  /opt/homebrew/Cellar/node/22.1.0/bin, which the next upgrade removes. */
export function nodeDir(place: Place): string {
  const real = (path: string) => { try { return realpathSync(path) } catch { return null } }
  const running = real(place.execPath)
  const path = place.env.PATH ?? place.env.Path ?? ''
  for (const dir of path.split(isWindows(place) ? ';' : delimiter).filter(Boolean)) {
    const node = join(dir, isWindows(place) ? 'node.exe' : 'node')
    if (existsSync(node) && real(node) === running && existsSync(join(dir, npxName(place)))) return dir
  }
  return dirname(place.execPath)
}

/** The npx beside the node running now, which a user file names by its
 *  absolute path; null when there is none there. */
export function npxBesideNode(place: Place): string | null {
  const npx = join(nodeDir(place), npxName(place))
  return existsSync(npx) ? npx : null
}

/** The entry for `client` that serves `folder` (absolute). */
export function entryFor(client: Client, folder: string, place: Place, pkg = mcpPackage()): ServerEntry {
  const npx = npxName(place)
  if (client.scope === 'project') {
    const fromTop = relative(place.top, folder).replace(/\\/g, '/') || '.'
    const arg = client.id === 'vscode' ? (fromTop === '.' ? '${workspaceFolder}' : `\${workspaceFolder}/${fromTop}`) : fromTop
    return { command: npx, args: ['-y', pkg, '--folder', arg] }
  }
  const absolute = npxBesideNode(place)
  const entry: ServerEntry = { command: absolute ?? npx, args: ['-y', pkg, '--folder', folder] }
  if (absolute && !isWindows(place)) entry.env = { PATH: [dirname(absolute), '/usr/local/bin', '/usr/bin', '/bin'].join(':') }
  return entry
}

// ─── JSON files (mcpServers or servers) ──────────────────────────────────────

function jsonClient(key: 'mcpServers' | 'servers', withType: boolean): Pick<Client, 'read' | 'write'> {
  const parse = (text: string): Record<string, unknown> => {
    if (!text.trim()) return {}
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('is not a JSON object')
    return value as Record<string, unknown>
  }
  return {
    read: (text) => {
      const servers = parse(text)[key]
      const result: Record<string, ServerEntry> = {}
      if (!servers || typeof servers !== 'object') return result
      for (const [name, raw] of Object.entries(servers as Record<string, Record<string, unknown>>)) {
        if (!raw || typeof raw.command !== 'string') continue
        result[name] = {
          command: raw.command,
          args: Array.isArray(raw.args) ? raw.args.map(String) : [],
          ...(raw.env && typeof raw.env === 'object' ? { env: raw.env as Record<string, string> } : {}),
        }
      }
      return result
    },
    write: (text, name, entry) => {
      const config = parse(text ?? '')
      const servers = config[key] && typeof config[key] === 'object' ? config[key] as Record<string, unknown> : {}
      config[key] = { ...servers, [name]: withType ? { type: 'stdio', ...entry } : entry }
      return JSON.stringify(config, null, 2) + '\n'
    },
  }
}

// ─── Codex's config.toml ─────────────────────────────────────────────────────

const tomlKey = (name: string) => /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name)

/** A header's dotted key, split, quotes taken off: [mcp_servers."a b".env]. */
function headerKeys(line: string): string[] | null {
  const header = /^\s*\[([^[\]]+)\]\s*(#.*)?$/.exec(line)
  if (!header) return null
  return [...header[1].matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|([A-Za-z0-9_-]+)/g)]
    .map((m) => m[1] !== undefined ? JSON.parse(`"${m[1]}"`) as string : m[2] ?? m[3])
}

/** The strings in a TOML value: one basic or literal string, or an array of them. */
const tomlStrings = (value: string): string[] =>
  [...value.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map((m) => m[1] !== undefined ? JSON.parse(`"${m[1]}"`) as string : m[2])

/** `key = value` pairs of an inline table: { PATH = "…", HOME = "…" }. */
const tomlTable = (value: string): Record<string, string> =>
  Object.fromEntries([...value.matchAll(/([A-Za-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/g)].map((m) => [m[1], tomlStrings(m[2])[0]]))

const codexClient: Pick<Client, 'read' | 'write'> = {
  read: (text) => {
    const servers: Record<string, ServerEntry> = {}
    let current: { name: string; env: boolean } | null = null
    for (const line of text.split(/\r?\n/)) {
      const keys = headerKeys(line)
      if (keys) {
        current = keys[0] === 'mcp_servers' && keys.length >= 2 && keys.length <= 3 && (keys.length === 2 || keys[2] === 'env')
          ? { name: keys[1], env: keys.length === 3 }
          : null
        if (current) servers[current.name] ??= { command: '', args: [] }
        continue
      }
      const pair = current && /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line)
      if (!pair || !current) continue
      const server = servers[current.name]
      if (current.env) (server.env ??= {})[pair[1]] = tomlStrings(pair[2])[0] ?? ''
      else if (pair[1] === 'command') server.command = tomlStrings(pair[2])[0] ?? ''
      else if (pair[1] === 'args') server.args = tomlStrings(pair[2])
      else if (pair[1] === 'env') server.env = tomlTable(pair[2])
    }
    for (const [name, server] of Object.entries(servers)) if (!server.command) delete servers[name]
    return servers
  },
  write: (text, name, entry) => {
    const section = [
      `[mcp_servers.${tomlKey(name)}]`,
      `command = ${JSON.stringify(entry.command)}`,
      `args = [${entry.args.map((arg) => JSON.stringify(arg)).join(', ')}]`,
      ...(entry.env ? [`env = { ${Object.entries(entry.env).map(([k, v]) => `${tomlKey(k)} = ${JSON.stringify(v)}`).join(', ')} }`] : []),
    ]
    const lines = (text ?? '').split(/\r?\n/)
    // The server's table and its subtables ([mcp_servers.radical.env]) go;
    // the new table takes their place, or ends the file.
    const out: string[] = []
    let at = -1
    let inside = false
    for (const line of lines) {
      const keys = headerKeys(line)
      if (keys) inside = keys[0] === 'mcp_servers' && keys[1] === name
      if (inside) { if (at < 0) at = out.length; continue }
      out.push(line)
    }
    while (out.length && out[out.length - 1] === '') out.pop()
    if (at < 0 || at > out.length) {
      if (out.length) out.push('')
      out.push(...section)
    } else {
      out.splice(at, 0, ...section, ...(at < out.length && out[at] !== '' ? [''] : []))
    }
    return out.join('\n') + '\n'
  },
}

// ─── The agents ──────────────────────────────────────────────────────────────

const exists = (path: string) => existsSync(path)

const desktopFile = (p: Place) => p.platform === 'darwin'
  ? join(p.home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  : p.platform === 'win32'
    ? join(p.env.APPDATA ?? join(p.home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
    : join(p.env.XDG_CONFIG_HOME ?? join(p.home, '.config'), 'Claude', 'claude_desktop_config.json')

const codexFile = (p: Place) => join(p.env.CODEX_HOME ?? join(p.home, '.codex'), 'config.toml')

export const CLIENTS: readonly Client[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    scope: 'project',
    file: (p) => join(p.top, '.mcp.json'),
    installed: (p) => !!onPath('claude', p) || exists(join(p.home, '.claude')),
    base: (p) => p.top,
    ...jsonClient('mcpServers', true),
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    scope: 'user',
    file: desktopFile,
    installed: (p) => exists(dirname(desktopFile(p))),
    base: (p) => p.home,
    ...jsonClient('mcpServers', false),
  },
  {
    id: 'codex',
    label: 'Codex',
    scope: 'user',
    file: codexFile,
    installed: (p) => !!onPath('codex', p) || exists(dirname(codexFile(p))),
    base: (p) => p.home,
    ...codexClient,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    scope: 'user',
    file: (p) => join(p.home, '.cursor', 'mcp.json'),
    installed: (p) => exists(join(p.home, '.cursor')),
    base: (p) => p.home,
    ...jsonClient('mcpServers', false),
  },
  {
    id: 'vscode',
    label: 'VS Code',
    scope: 'project',
    file: (p) => join(p.top, '.vscode', 'mcp.json'),
    installed: (p) => !!onPath('code', p) || exists(join(p.top, '.vscode'))
      || (p.platform === 'darwin' && exists('/Applications/Visual Studio Code.app')),
    base: (p) => p.top,
    ...jsonClient('servers', true),
  },
]

export const CLIENT_IDS = CLIENTS.map((client) => client.id)

/** A server that runs the Radical MCP server: the package, its bin, or a
 *  build of apps/mcp. */
export function isRadicalServer(entry: ServerEntry): boolean {
  const words = [entry.command, ...entry.args]
  return words.some((word) => word.includes('@radicaltools/mcp') || /(^|[\\/])radical-mcp(\.cmd)?$/.test(word) || /mcp[\\/]dist[\\/]index\.js$/.test(word))
}

/** The folder an entry serves (absolute), and how it was written. */
export function folderOf(entry: ServerEntry, client: Client, place: Place): string | null {
  const at = entry.args.indexOf('--folder')
  const raw = at >= 0 ? entry.args[at + 1] : undefined
  if (!raw) return null
  const expanded = raw.replace(/\$\{workspaceFolder\}/g, place.top)
  return isAbsolute(expanded) ? expanded : resolve(client.base(place), expanded)
}

/** The version an entry pins (@radicaltools/mcp@0.2.0), if it pins one. */
export function pinnedVersion(entry: ServerEntry): string | null {
  for (const arg of entry.args) {
    const pinned = /@radicaltools\/mcp@(.+)$/.exec(arg)
    if (pinned) return pinned[1]
  }
  return null
}

/** `path` for a message: from the working directory when inside it, else with ~ for home. */
export function shown(path: string, place: Pick<Place, 'cwd' | 'home'>): string {
  const fromCwd = relative(place.cwd, path)
  if (fromCwd && !fromCwd.startsWith('..') && !isAbsolute(fromCwd)) return fromCwd
  if (!fromCwd) return '.'
  const fromHome = relative(place.home, path)
  return !fromHome.startsWith('..') && !isAbsolute(fromHome) ? join('~', fromHome) : path
}

export function sameEntry(a: ServerEntry, b: ServerEntry): boolean {
  const env = (e: ServerEntry) => JSON.stringify(Object.entries(e.env ?? {}).sort(([x], [y]) => x.localeCompare(y)))
  return a.command === b.command && JSON.stringify(a.args) === JSON.stringify(b.args) && env(a) === env(b)
}
