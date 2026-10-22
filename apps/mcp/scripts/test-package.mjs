// Exercise the npm tarball from a temporary project outside the monorepo.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'))
const npmCli = process.env.npm_execpath
assert(npmCli, 'Run this check with npm run test:package')
const args = process.argv.slice(2)
assert(args.length === 0 || (args.length === 2 && args[0] === '--out-dir'), 'Usage: npm run test:package -- [--out-dir <directory>]')
const output = args.length ? resolve(args[1]) : undefined
const temporary = await mkdtemp(join(tmpdir(), 'radical-mcp-package-'))
const project = join(temporary, 'consumer')
const folder = join(temporary, 'model')
const env = { ...process.env }
delete env.NODE_PATH

function npm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd, env, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
  })
}

async function call(client, name, arguments_ = {}) {
  const result = await client.callTool({ name, arguments: arguments_ }, undefined, { timeout: 120_000 })
  const text = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
  assert(!result.isError, `${name}: ${text}`)
  return text
}

async function connect() {
  const client = new Client({ name: 'npm-package-test', version: '1.0.0' })
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [npmCli, 'exec', '--offline', '--workspaces=false', '--', 'radical-mcp', '--folder', folder],
      cwd: project, env,
    }))
    // The bare version when built from the commit tagged v<version>, with the commit otherwise.
    assert.match(client.getServerVersion()?.version ?? '', new RegExp(`^${manifest.version.replace(/\./g, '\\.')}(\\+[0-9a-f]{7,})?$`))
    return client
  } catch (error) {
    await client.close()
    throw error
  }
}

try {
  const [packed] = JSON.parse(npm(['pack', '--json', '--foreground-scripts=false', '--pack-destination', temporary, '--workspaces=false'], workspace))
  const tarball = join(temporary, packed.filename)
  const paths = packed.files.map(f => f.path)
  assert(paths.includes('dist/index.js'))
  assert(paths.includes('README.md'))
  assert(paths.includes('LICENSE'))
  assert(paths.includes('dist/hub-catalogue/concern/concern-authentication.radical'))
  assert(paths.every(p => p.startsWith('dist/') || ['package.json', 'README.md', 'LICENSE'].includes(p)), 'Unexpected file in npm package')
  assert(Object.keys(manifest.dependencies).every(name => !name.startsWith('@radical/')), 'Private workspaces must be bundled, not runtime dependencies')

  await mkdir(project)
  await writeFile(join(project, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  npm(['install', tarball, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--workspaces=false'], project)
  const installed = join(project, 'node_modules', ...manifest.name.split('/'))
  assert((await readFile(join(installed, 'dist/index.js'), 'utf8')).startsWith('#!/usr/bin/env node'))
  assert((await readFile(join(installed, 'LICENSE'), 'utf8')).includes('MIT License'))
  const bin = join(project, 'node_modules/.bin', process.platform === 'win32' ? 'radical-mcp.cmd' : 'radical-mcp')
  await readFile(bin)
  npm(['ls', '--omit=dev', '--workspaces=false'], project)

  let client = await connect()
  try {
    await call(client, 'get_model_summary')
    await call(client, 'add_node', { tempId: 'buyer', type: 'person', label: 'Package buyer' })
    await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Package shop' })
    await call(client, 'add_node', { tempId: 'bank', type: 'system', label: 'Package bank' })
    await call(client, 'add_relation', { sourceId: 'buyer', targetId: 'shop', relationType: 'interacts' })
    await call(client, 'add_relation', { sourceId: 'shop', targetId: 'bank', relationType: 'interacts' })
    await call(client, 'smart_layout')
    await call(client, 'forge_start', { description: 'Customers buy products online and pay once for each order.' })
    const catalogue = await call(client, 'forge_clarify', { stage: 'requirements' })
    assert(catalogue.includes('concern-authentication'), 'Installed server must read its bundled Hub catalogue')
    await call(client, 'get_issues')
  } finally { await client.close() }

  client = await connect()
  try {
    const saved = await call(client, 'search_model', { query: 'LIST NODES WHERE type = "system"' })
    assert(saved.includes('Package shop') && saved.includes('Package bank'), 'Model writes must survive a server restart')
    await readFile(join(folder, 'radical.md'))
  } finally { await client.close() }

  if (output) {
    await mkdir(output, { recursive: true })
    await copyFile(tarball, join(output, packed.filename))
  }
  console.log(`Package verified: ${manifest.name}@${manifest.version} (${packed.files.length} files, ${packed.size} bytes).`)
  console.log('Clean install, executable, MCP handshake, disk writes, restart, Smart Layout and Hub catalogue passed.')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
