import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { parseFederationFile } from '@radical/common/federation'
import type { C4Node } from '@radical/common/c4'
import { main } from './cli'
import { CLIENTS, CLIENT_IDS } from './agentConfig'
import { HOOK_MARKER } from './hooks'
import type { Io } from './check'

const exec = promisify(execFile)
const dirs: string[] = []
let cacheBefore: string | undefined
beforeEach(async () => {
  cacheBefore = process.env.RADICAL_CACHE
  const cache = await mkdtemp(join(tmpdir(), 'radical-cache-'))
  dirs.push(cache)
  process.env.RADICAL_CACHE = cache
})
afterEach(async () => {
  if (cacheBefore === undefined) delete process.env.RADICAL_CACHE
  else process.env.RADICAL_CACHE = cacheBefore
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

/** A repository, a home with a node and an npx of its own, and an Io over them. */
async function world() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'radical-setup-')))
  dirs.push(root)
  const repo = join(root, 'repo')
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  for (const dir of [repo, home, bin]) await mkdir(dir, { recursive: true })
  await exec('git', ['init', '-q'], { cwd: repo })
  for (const name of ['node', 'npx']) await writeFile(join(bin, name), '')
  const desktop = join(home, '.config', 'Claude', 'claude_desktop_config.json')
  const codex = join(home, '.codex', 'config.toml')
  const cursor = join(home, '.cursor', 'mcp.json')
  return { root, repo, home, bin, desktop, codex, cursor }
}

async function run(w: Awaited<ReturnType<typeof world>>, args: string[], extra: Partial<Io> = {}) {
  let out = ''
  let err = ''
  const code = await main(args, {
    cwd: w.repo, home: w.home, env: { PATH: '' }, platform: 'linux', execPath: join(w.bin, 'node'), version: '0.2.0',
    out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' }, ...extra,
  })
  return { code, out, err }
}

const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'))
const allClients = CLIENT_IDS.flatMap((id) => ['--client', id])

/** A git repository `name` beside the world's repository with a model in
 *  `folder`, committed once per tag given (a new element each time). */
async function modelRepo(w: Awaited<ReturnType<typeof world>>, name: string, tags: string[], folder = 'architecture'): Promise<string> {
  const dir = join(w.root, name)
  await mkdir(dir, { recursive: true })
  const git = (...args: string[]) => exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir })
  await git('init', '-q', '-b', 'main')
  const nodes: C4Node[] = []
  for (const tag of tags.length ? tags : ['']) {
    nodes.push({ id: `${name}-${nodes.length}`, type: 'system', label: `${name} ${nodes.length}`, x: 0, y: 0, width: 200, height: 100, collapsed: false } as C4Node)
    for (const [path, content] of Object.entries(serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes, relations: [] }, name))) {
      await mkdir(dirname(join(dir, folder, path)), { recursive: true })
      await writeFile(join(dir, folder, path), content)
    }
    await git('add', '-A')
    await git('commit', '-q', '-m', tag || 'model')
    if (tag) await git('tag', tag)
  }
  return dir
}

const fetchedFile = async (folder: string) => parseFederationFile(await readFile(join(folder, '.radical', 'federation.json'), 'utf8'))!

describe('radical setup', () => {
  it('writes each agent\'s configuration once, keeps their other entries, and starts the model', async () => {
    const w = await world()
    await writeFile(join(w.repo, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x', args: [] } } }))
    await mkdir(join(w.home, '.config', 'Claude'), { recursive: true })
    const desktopBefore = JSON.stringify({ mcpServers: { keep: { command: 'a' } }, theme: 'dark' })
    await writeFile(w.desktop, desktopBefore)
    await mkdir(join(w.home, '.codex'), { recursive: true })
    await writeFile(w.codex, '[model]\nname = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n\n[profiles.fast]\nmodel = "mini"\n')

    const first = await run(w, ['setup', 'architecture', '--yes', '--no-check', ...allClients])
    expect(first.err).toBe('')
    expect(first.code).toBe(0)
    expect(first.out).toContain('+ started a new model (radical metamodel) in architecture')
    expect(existsSync(join(w.repo, 'architecture', 'radical.md'))).toBe(true)

    const pkgArgs = ['-y', '@radicaltools/mcp@0.2.0', '--folder']
    expect((await json(join(w.repo, '.mcp.json'))).mcpServers).toEqual({
      other: { command: 'x', args: [] },
      radical: { type: 'stdio', command: 'npx', args: [...pkgArgs, 'architecture'] },
    })
    expect((await json(join(w.repo, '.vscode', 'mcp.json'))).servers.radical)
      .toEqual({ type: 'stdio', command: 'npx', args: [...pkgArgs, '${workspaceFolder}/architecture'] })
    const user = { command: join(w.bin, 'npx'), args: [...pkgArgs, join(w.repo, 'architecture')], env: { PATH: `${w.bin}:/usr/local/bin:/usr/bin:/bin` } }
    expect(await json(w.desktop)).toEqual({ mcpServers: { keep: { command: 'a' }, radical: user }, theme: 'dark' })
    expect(await readFile(`${w.desktop}.bak`, 'utf8')).toBe(desktopBefore)
    expect((await json(w.cursor)).mcpServers.radical).toEqual(user)
    const codexText = await readFile(w.codex, 'utf8')
    expect(codexText).toMatch(/^\[model\]\nname = "o3"\n\n\[mcp_servers\.other\]\ncommand = "x"\n\n\[profiles\.fast\]\nmodel = "mini"\n\n\[mcp_servers\.radical\]\n/)
    const codex = CLIENTS.find((client) => client.id === 'codex')!
    expect(codex.read(codexText)).toEqual({ other: { command: 'x', args: [] }, radical: user })
    expect(await readFile(join(w.repo, '.git', 'hooks', 'post-checkout'), 'utf8')).toContain(HOOK_MARKER)

    // Again: nothing changes.
    const files = [join(w.repo, '.mcp.json'), join(w.repo, '.vscode', 'mcp.json'), w.desktop, w.codex, w.cursor]
    const before = await Promise.all(files.map((file) => readFile(file, 'utf8')))
    const second = await run(w, ['setup', 'architecture', '--yes', '--no-check', ...allClients])
    expect(second.code).toBe(0)
    expect(second.out).toContain('✓ architecture holds a model')
    expect(second.out.match(/already runs "radical"/g)).toHaveLength(5)
    expect(await Promise.all(files.map((file) => readFile(file, 'utf8')))).toEqual(before)

    // An entry changed by hand is replaced; a Codex table keeps its place.
    await writeFile(w.codex, before[3].replace('"-y", ', '').replace('[profiles.fast]', '[mcp_servers.radical.env]\nHOME = "/x"\n\n[profiles.fast]'))
    const replaced = await run(w, ['setup', 'architecture', '--yes', '--no-check', '--client', 'codex'])
    expect(replaced.out).toContain('+ replaced "radical" in Codex')
    expect(codex.read(await readFile(w.codex, 'utf8')).radical).toEqual(user)
    expect((await readFile(w.codex, 'utf8')).match(/\[mcp_servers\.radical/g)).toHaveLength(1)

    // A dry run writes nothing.
    const dry = await run(w, ['setup', 'other', '--yes', '--dry-run', '--client', 'claude-code', '--client', 'cursor'])
    expect(dry.code).toBe(0)
    expect(dry.out).toContain('would start a new model (radical metamodel) in other')
    expect(dry.out).toContain('would replace "radical" in Claude Code: .mcp.json: npx -y @radicaltools/mcp@0.2.0 --folder other')
    expect(dry.out).toContain('would run: radical hooks install other')
    expect(existsSync(join(w.repo, 'other'))).toBe(false)
    expect(await readFile(join(w.repo, '.mcp.json'), 'utf8')).toBe(before[0])

    // A folder that holds something else is refused.
    await mkdir(join(w.repo, 'docs'))
    await writeFile(join(w.repo, 'docs', 'readme.txt'), 'notes')
    const refused = await run(w, ['setup', 'docs', '--yes', '--client', 'claude-code'])
    expect(refused.code).toBe(2)
    expect(refused.err).toContain('holds other files and no radical.md')
    expect(existsSync(join(w.repo, 'docs', 'radical.md'))).toBe(false)

    expect((await run(w, ['setup', '--client', 'emacs'])).code).toBe(2)
  })

  it('asks step by step in a terminal, and asks nothing without one', async () => {
    const w = await world()
    await mkdir(join(w.home, '.codex'))
    await mkdir(join(w.home, '.cursor'))
    const questions: string[] = []
    const answers = ['model', 'c4', '', '1 5', 'n']
    const asked = await run(w, ['setup', '--no-check'], { ask: async (q) => { questions.push(q); return answers.shift() ?? '' } })
    expect(asked.code).toBe(0)
    expect(questions).toEqual([
      '  Model folder [architecture]: ',
      expect.stringMatching(/^ {2}It holds no model yet\. Metamodel of the new model, .* \[radical\]: $/),
      '  A model this one depends on, by name (Enter: none): ',
      '  Agents to connect, by number [3 4]: ',
      expect.stringMatching(/git hooks .* \[yes\]: $/),
    ])
    expect(asked.out).toMatch(/3\. Codex +~\/\.codex\/config\.toml {2}\(found\)/)
    expect(JSON.parse(await readFile(join(w.repo, 'model', 'metamodel.json'), 'utf8')).id).toBe(builtInC4Metamodel().id)
    expect((await json(join(w.repo, '.mcp.json'))).mcpServers.radical.args.at(-1)).toBe('model')
    expect((await json(join(w.repo, '.vscode', 'mcp.json'))).servers.radical.args.at(-1)).toBe('${workspaceFolder}/model')
    expect(existsSync(w.codex) || existsSync(w.cursor)).toBe(false)
    expect(existsSync(join(w.repo, '.git', 'hooks', 'post-checkout'))).toBe(false)

    // No terminal: the agents found, the default folder, the hooks.
    const quiet = await run(w, ['setup', '--no-check'])
    expect(quiet.code).toBe(0)
    expect(quiet.out).toContain('+ started a new model (radical metamodel) in architecture')
    expect((await json(w.cursor)).mcpServers.radical.args.at(-1)).toBe(join(w.repo, 'architecture'))
    expect(await readFile(w.codex, 'utf8')).toContain('[mcp_servers.radical]')
    expect((await json(join(w.repo, '.mcp.json'))).mcpServers.radical.args.at(-1)).toBe('model')
    expect(await readFile(join(w.repo, '.git', 'hooks', 'post-checkout'), 'utf8')).toContain(HOOK_MARKER)
  })

  it('asks for the models this one depends on, offers the newest tag, and fetches them', async () => {
    const w = await world()
    await modelRepo(w, 'standards', ['v1.2.0', 'v1.10.0'])
    const questions: string[] = []
    const answers = ['', '', 'standards', '../../standards', '', '', '', 'none', 'n']
    const done = await run(w, ['setup', '--no-check'], { ask: async (q) => { questions.push(q); return answers.shift() ?? '' } })
    expect(done.err).toBe('')
    expect(done.code).toBe(0)
    expect(questions.slice(2, 7)).toEqual([
      '  A model this one depends on, by name (Enter: none): ',
      '    Its git repository, an address or a path from the model folder: ',
      '    The model folder in it [architecture]: ',
      // The newest version tag, by number: v1.10.0 after v1.2.0.
      '    Version [v1.10.0]: ',
      '  Another model this one depends on, by name (Enter: no more): ',
    ])
    const folder = join(w.repo, 'architecture')
    expect(await json(join(folder, 'deps.json'))).toEqual({ name: 'repo', dependencies: [{ name: 'standards', repo: '../../standards', path: 'architecture', ref: 'v1.10.0' }] })
    expect(done.out).toContain('+ standards (../../standards at v1.10.0) in deps.json')
    expect(done.out).toMatch(/\+ fetched standards@\w{7} \(v1\.10\.0\) into \.radical\/federation\.json: 2 elements/)
    expect((await fetchedFile(folder)).nodes.map((n) => n.label)).toEqual(['standards 0', 'standards 1'])
  })

  it('adds the dependencies --depends-on names without asking', async () => {
    const w = await world()
    await modelRepo(w, 'standards', ['v1.0.0', 'v2.0.0'])
    await modelRepo(w, 'billing', [], 'model')
    const first = await run(w, ['setup', '--yes', '--no-check', '--no-hooks', '--depends-on', 'standards=../../standards#v1.0.0'])
    expect(first.code).toBe(0)
    // A second model, its version its default branch (no tags), its model folder named; standards stays.
    const second = await run(w, ['setup', '--yes', '--no-check', '--no-hooks', '--depends-on', 'billing=../../billing#:model'])
    expect(second.code).toBe(0)
    expect(second.out).toContain('✓ depends on standards (../../standards at v1.0.0)')
    const folder = join(w.repo, 'architecture')
    expect((await json(join(folder, 'deps.json'))).dependencies).toEqual([
      { name: 'standards', repo: '../../standards', path: 'architecture', ref: 'v1.0.0' },
      { name: 'billing', repo: '../../billing', path: 'model', ref: 'main' },
    ])
    expect((await fetchedFile(folder)).dependencies.map((d) => [d.name, d.ref])).toEqual([['standards', 'v1.0.0'], ['billing', 'main']])
    expect((await run(w, ['setup', '--yes', '--depends-on', 'nameless'])).out).toContain('✗ --depends-on nameless: write <name>=<repository>[#<version>[:<model folder>]]')
  })

  it('through the launcher, pins it and starts each agent\'s server through it, in a git repository it starts', async () => {
    const w = await world()
    const fresh = join(w.root, 'fresh')
    await mkdir(fresh)
    const launcher = join(fresh, 'radical.sh')
    await copyFile(fileURLToPath(new URL('../launcher/radical.sh', import.meta.url)), launcher)
    await mkdir(join(w.home, '.config', 'Claude'), { recursive: true })
    const env = { PATH: '/usr/bin:/bin', RADICAL_LAUNCHER: launcher }
    const questions: string[] = []
    const answers = ['', '', '', 'yes', '']
    const first = await run(w, ['setup', '--no-check', '--client', 'claude-code', '--client', 'claude-desktop'],
      { cwd: fresh, env, ask: async (q) => { questions.push(q); return answers.shift() ?? '' } })
    expect(first.err).toBe('')
    expect(first.code).toBe(0)
    expect(questions[3]).toBe('  Not in a git repository. Start one here (git init)? [yes]: ')
    expect(first.out).toContain('+ pinned radical.sh to 0.2.0')
    expect(first.out).toContain('+ started a git repository')
    expect(await readFile(launcher, 'utf8')).toMatch(/^default_version=0\.2\.0$/m)
    expect(statSync(launcher).mode & 0o111).toBe(0o111)
    expect((await json(join(fresh, '.mcp.json'))).mcpServers.radical)
      .toEqual({ type: 'stdio', command: 'sh', args: ['radical.sh', 'mcp', '--folder', 'architecture'] })
    expect((await json(w.desktop)).mcpServers.radical).toEqual({
      command: 'sh', args: [launcher, 'mcp', '--folder', join(fresh, 'architecture')],
      env: { PATH: `${w.bin}:/usr/local/bin:/usr/bin:/bin` },
    })
    expect(await readFile(join(fresh, '.git', 'hooks', 'post-checkout'), 'utf8'))
      .toContain(`${HOOK_MARKER}\nsh "radical.sh" diff "architecture" --save-base --quiet </dev/null || true; sh "radical.sh" check "architecture" --from-ci --quiet --detach </dev/null >/dev/null 2>&1 || true; sh "radical.sh" federation fetch "architecture" --quiet --detach </dev/null >/dev/null 2>&1 || true\n`)

    const again = await run(w, ['setup', 'architecture', '--yes', '--no-check', '--client', 'claude-code'], { cwd: fresh, env })
    expect(again.out).toContain('✓ radical.sh runs 0.2.0')
    expect(again.out).toContain('✓ Claude Code: .mcp.json already runs "radical" for the folder')

    const status = await run(w, ['setup', '--status', 'architecture', '--no-start'], { cwd: fresh, env })
    expect(status.out).toContain('✓ Claude Code "radical" (.mcp.json) serves architecture through radical.sh (0.2.0)')
    expect(status.out).toContain('✓ Claude Desktop "radical" (~/.config/Claude/claude_desktop_config.json) serves architecture through radical.sh (0.2.0)')
    expect(status.code).toBe(0)
    await rm(launcher)
    const gone = await run(w, ['setup', '--status', 'architecture', '--no-start'], { cwd: fresh, env })
    expect(gone.code).toBe(1)
    expect(gone.out).toContain('✗ Claude Code "radical" (.mcp.json): its launcher radical.sh is not there: download it from https://radical.tools/radical.sh')
  })
})
