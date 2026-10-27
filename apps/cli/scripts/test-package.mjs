// Verify the published files and executable outside the monorepo.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'))
const npmCli = process.env.npm_execpath
assert(npmCli, 'Run this check with npm run test:package')
const args = process.argv.slice(2)
assert(args.length === 0 || (args.length === 2 && args[0] === '--out-dir'), 'Usage: npm run test:package -- [--out-dir <directory>]')
const output = args.length ? resolve(args[1]) : undefined
const temporary = await mkdtemp(join(tmpdir(), 'radical-cli-package-'))
const project = join(temporary, 'consumer')
const env = { ...process.env }
delete env.NODE_PATH

function npm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd, env, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
  })
}

function radical(...args) {
  return npm(['exec', '--offline', '--workspaces=false', '--', 'radical', ...args], project)
}

try {
  // A publish dry run still needs a real tarball and a real local install
  // for this check; both write only into our temporary directory.
  const [packed] = JSON.parse(npm(['pack', '--dry-run=false', '--json', '--foreground-scripts=false', '--pack-destination', temporary, '--workspaces=false'], workspace))
  const tarball = join(temporary, packed.filename)
  const paths = packed.files.map(f => f.path)
  for (const required of ['dist/index.js', 'package.json', 'README.md', 'LICENSE']) {
    assert(paths.includes(required), `Missing ${required} in npm package`)
  }
  assert(paths.every(p => p.startsWith('dist/') || ['package.json', 'README.md', 'LICENSE'].includes(p)), 'Unexpected file in npm package')

  await mkdir(project)
  await writeFile(join(project, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  npm(['install', tarball, '--dry-run=false', '--offline', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--workspaces=false'], project)
  const installed = join(project, 'node_modules', ...manifest.name.split('/'))
  const published = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'))
  assert(!published.private, 'The CLI must be publishable')
  assert.equal(published.publishConfig.access, 'public')
  assert.equal(Object.keys(published.dependencies ?? {}).length, 0, 'Runtime dependencies must be bundled')
  assert((await readFile(join(installed, 'dist/index.js'), 'utf8')).startsWith('#!/usr/bin/env node'))
  assert((await readFile(join(installed, 'LICENSE'), 'utf8')).includes('MIT License'))
  // The bare version when built from the commit tagged v<version>, with the commit otherwise.
  assert.match(radical('--version').trim(), new RegExp(`^${manifest.version.replace(/\./g, '\\.')}(\\+[0-9a-f]{7,})?$`))
  assert.match(radical('--help'), /Usage: radical/)
  assert.match(radical('export', 'confluence', '--help'), /--view/)
  assert.match(radical('setup', '--help'), /--client <id>/)
  assert.match(radical('setup', '--help'), /--no-start/)
  assert.match(radical('check', '--list-rules'), /folder-manifest/)

  const model = join(project, 'model')
  await mkdir(model)
  await writeFile(join(model, 'radical.md'), '---\nradicalFormat: "md-folder"\nversion: 1\nname: "Package test"\n---\n\n# Package test\n')
  const result = JSON.parse(radical('check', 'model', '--format', 'json'))
  assert.equal(result.ok, true)
  assert.equal(result.errors, 0)
  assert.equal(result.nodeCount, 0)
  await writeFile(join(model, 'views.json'), JSON.stringify([{ id: 'wiki', name: 'Package wiki', kind: 'wiki', nodeIds: [], positions: {} }]))
  const exported = radical('export', 'confluence', 'model', '--view', 'wiki', '--format', 'html')
  assert.match(exported, /<!doctype html>/)
  assert.match(exported, /Radical is the source of truth/)
  assert.match(exported, /No elements in this wiki view/)
  if (output) {
    await mkdir(output, { recursive: true })
    await copyFile(tarball, join(output, packed.filename))
  }
  console.log(`Package verified: ${manifest.name}@${manifest.version} (${packed.files.length} files, ${packed.size} bytes).`)
  console.log('Offline production install, executable, version, help and model check passed.')
} finally {
  // Delete only the directory this check created under the OS temp directory.
  assert(dirname(temporary) === resolve(tmpdir()) && temporary.startsWith(join(tmpdir(), 'radical-cli-package-')))
  await rm(temporary, { recursive: true, force: true })
}
