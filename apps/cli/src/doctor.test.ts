import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { main } from './cli'
import type { Io } from './check'

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

/** Stands in for the MCP server: answers initialize and get_model_summary. */
const FAKE_SERVER = `#!/usr/bin/env node
let buffer = ''
const send = (message) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\\n')
process.stdin.on('data', (data) => {
  buffer += data
  let end
  while ((end = buffer.indexOf('\\n')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end))
    buffer = buffer.slice(end + 1)
    if (message.method === 'initialize') send({ id: message.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'radical-folder', version: '0.2.0' } } })
    if (message.method === 'tools/call') send({ id: message.id, result: { content: [{ type: 'text', text: JSON.stringify({ nodes: 3 }) }] } })
  }
})
`

async function run(cwd: string, home: string, args: string[]) {
  let out = ''
  let err = ''
  const io: Io = { cwd, home, env: { PATH: dirname(process.execPath) }, platform: 'linux', version: '0.2.0', out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } }
  const code = await main(args, io)
  return { code, out, err }
}

describe('radical doctor', () => {
  it('reports what works and what stops the agent, and starts the servers for the folder', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'radical-doctor-')))
    dirs.push(root)
    const repo = join(root, 'repo')
    const home = join(root, 'home')
    const folder = join(repo, 'architecture')
    await mkdir(home, { recursive: true })
    await mkdir(folder, { recursive: true })
    await exec('git', ['init', '-q'], { cwd: repo })
    for (const [path, content] of Object.entries(serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [], relations: [] }, 'Test'))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    // The server as an apps/mcp build, and as npx running the package.
    const server = join(root, 'apps', 'mcp', 'dist', 'index.js')
    const npx = join(root, 'bin', 'npx')
    for (const path of [server, npx]) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, FAKE_SERVER)
      await chmod(path, 0o755)
    }
    await writeFile(join(repo, '.mcp.json'), JSON.stringify({ mcpServers: {
      radical: { command: 'node', args: [server, '--folder', 'architecture'] },
      elsewhere: { command: 'node', args: [server, '--folder', 'other'] },
    } }))
    await mkdir(join(home, '.config', 'Claude'), { recursive: true })
    await writeFile(join(home, '.config', 'Claude', 'claude_desktop_config.json'), JSON.stringify({ mcpServers: {
      radical: { command: npx, args: ['-y', '@radicaltools/mcp@0.1.0', '--folder', folder], env: { PATH: dirname(process.execPath) } },
    } }))
    await mkdir(join(home, '.codex'))
    const codex = join(home, '.codex', 'config.toml')
    await writeFile(codex, `[mcp_servers.radical]\ncommand = "/nowhere/npx"\nargs = ["-y", "@radicaltools/mcp@0.2.0", "--folder", ${JSON.stringify(folder)}]\n`)

    const broken = await run(repo, home, ['doctor', 'architecture'])
    expect(broken.err).toBe('')
    expect(broken.code).toBe(1)
    expect(broken.out).toContain(`✓ Node.js ${process.versions.node}`)
    expect(broken.out).toContain('✓ reads as a model: 0 elements, 0 relations')
    expect(broken.out).toContain('! the git hooks do not save its base for Studio\'s Changes on branch: radical hooks install architecture')
    expect(broken.out).toContain('· Claude Code "elsewhere" (.mcp.json) serves other')
    expect(broken.out).toContain('✗ Codex "radical" (~/.codex/config.toml): its command /nowhere/npx is not there')
    expect(broken.out).toContain('! Claude Desktop "radical" (~/.config/Claude/claude_desktop_config.json) runs MCP server 0.1.0, this CLI is 0.2.0')
    expect(broken.out).toContain('✓ Claude Code "radical": MCP server 0.2.0 answers (3 elements)')
    expect(broken.out).toContain('✓ Claude Desktop "radical": MCP server 0.2.0 answers (3 elements)')
    expect(broken.out).not.toContain('Codex "radical": MCP server')
    expect(broken.out).toContain('1 problem found.')

    await writeFile(codex, `[mcp_servers.radical]\ncommand = ${JSON.stringify(npx)}\nargs = ["-y", "@radicaltools/mcp@0.2.0", "--folder", ${JSON.stringify(folder)}]\nenv = { PATH = ${JSON.stringify(dirname(process.execPath))} }\n`)
    const working = await run(repo, home, ['doctor', 'architecture'])
    expect(working.code).toBe(0)
    expect(working.out).toContain('✓ Codex "radical": MCP server 0.2.0 answers (3 elements)')
    expect(working.out).toContain('Nothing is broken.')

    const configured = await run(repo, home, ['doctor', 'architecture', '--no-start'])
    expect(configured.code).toBe(0)
    expect(configured.out).not.toContain('Servers')
    expect(configured.out).not.toContain('answers')

    await mkdir(join(repo, 'docs'))
    await writeFile(join(repo, 'docs', 'readme.txt'), 'notes')
    const notModel = await run(repo, home, ['doctor', 'docs', '--no-start'])
    expect(notModel.code).toBe(1)
    expect(notModel.out).toContain('✗ does not read as a model: it has no valid radical.md')
    expect(notModel.out).toContain('! no agent is set up for docs: radical setup docs')

    // Outside a git repository: a warning, not a crash.
    const outside = join(root, 'outside')
    for (const [path, content] of Object.entries(serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [], relations: [] }, 'Outside'))) {
      await mkdir(dirname(join(outside, path)), { recursive: true })
      await writeFile(join(outside, path), content)
    }
    const noGit = await run(root, home, ['doctor', 'outside', '--no-start'])
    expect(noGit.err).toBe('')
    expect(noGit.out).toContain('! is not in a git repository')

    expect((await run(repo, home, ['doctor', '--timeout', 'x'])).code).toBe(2)
  })
})
