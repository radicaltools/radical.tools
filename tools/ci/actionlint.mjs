#!/usr/bin/env node
// Fitness function "Workflows pass actionlint" (CI/CD pipeline pack): runs
// actionlint, pinned, over the repository's .github/workflows. With Docker it
// runs actionlint's image, which bundles shellcheck (the CI job Workflows of
// ci.yml); without Docker it runs actionlint's release binary, downloaded
// once into node_modules/.cache and checked against its SHA-256, and
// shellcheck only when one is on the PATH. Arguments go to actionlint.
//
//   npm run lint:workflows                  every workflow of the repository
//   node tools/ci/actionlint.mjs <file>…    those files only

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

export const ACTIONLINT_VERSION = '1.7.12'
/** rhysd/actionlint:1.7.12, by the digest of its image index. */
export const ACTIONLINT_IMAGE = `rhysd/actionlint:${ACTIONLINT_VERSION}@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`
/** SHA-256 of the release archives (actionlint_1.7.12_checksums.txt). */
const ARCHIVES = {
  'darwin-arm64': ['darwin_arm64.tar.gz', 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'],
  'darwin-x64': ['darwin_amd64.tar.gz', '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644'],
  'linux-x64': ['linux_amd64.tar.gz', '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'],
  'linux-arm64': ['linux_arm64.tar.gz', '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6'],
  'win32-x64': ['windows_amd64.zip', '6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9'],
  'win32-arm64': ['windows_arm64.zip', 'cadcf7ea4efe3a68728893813643cebe1185e5b1d4be5b96245f65c9a4d5ea41'],
}

const hasDocker = () => spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'ignore' }).status === 0

/** The path of actionlint's release binary, downloaded when missing. */
async function binary() {
  const key = `${process.platform}-${process.arch}`
  const archive = ARCHIVES[key]
  if (!archive) throw new Error(`no actionlint ${ACTIONLINT_VERSION} binary for ${key}: install Docker`)
  const [suffix, sha256] = archive
  const dir = join(ROOT, 'node_modules/.cache/actionlint', ACTIONLINT_VERSION)
  const exe = join(dir, process.platform === 'win32' ? 'actionlint.exe' : 'actionlint')
  if (existsSync(exe)) return exe
  const name = `actionlint_${ACTIONLINT_VERSION}_${suffix}`
  const res = await fetch(`https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${name}`)
  if (!res.ok) throw new Error(`cannot download ${name}: HTTP ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  const got = createHash('sha256').update(bytes).digest('hex')
  if (got !== sha256) throw new Error(`${name} has SHA-256 ${got}, not ${sha256}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), bytes)
  const tar = spawnSync('tar', ['-xf', name, process.platform === 'win32' ? 'actionlint.exe' : 'actionlint'], { cwd: dir, encoding: 'utf8' })
  if (tar.status !== 0) throw new Error(`cannot unpack ${name}: ${tar.stderr}`)
  if (process.platform !== 'win32') chmodSync(exe, 0o755)
  return exe
}

/** Runs actionlint in `root` (a repository: its .github/workflows) with
 *  `args`; its exit code (0: no findings, 1: findings) and output. */
export async function runActionlint({ root = ROOT, args = [], docker = hasDocker() } = {}) {
  const run = docker
    ? spawnSync('docker', ['run', '--rm', '-v', `${resolve(root)}:/repo`, '--workdir', '/repo', ACTIONLINT_IMAGE, ...args], { encoding: 'utf8' })
    : spawnSync(await binary(), args, { cwd: root, encoding: 'utf8' })
  if (run.error) throw run.error
  return { code: run.status ?? 1, output: `${run.stdout ?? ''}${run.stderr ?? ''}`, docker }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  try {
    const { code, output } = await runActionlint({ args: process.stdout.isTTY || process.env.GITHUB_ACTIONS ? ['-color', ...args] : args })
    process.stdout.write(output)
    if (code === 0) console.log(`actionlint ${ACTIONLINT_VERSION}: no findings in the workflows.`)
    process.exit(code)
  } catch (error) {
    console.error(`actionlint: ${error.message}`)
    process.exit(2)
  }
}
