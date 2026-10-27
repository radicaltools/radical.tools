import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { pinLauncher } from './agentConfig'

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const LAUNCHER = fileURLToPath(new URL('../launcher/radical.sh', import.meta.url))
const LAUNCHER_CMD = fileURLToPath(new URL('../launcher/radical.cmd', import.meta.url))

async function script(path: string, text: string) {
  await writeFile(path, `#!/bin/sh\n${text}\n`)
  await chmod(path, 0o755)
}

/** Runs `sh radical.sh <args>` in `cwd` with `env` and no terminal; never throws. */
async function launch(cwd: string, env: Record<string, string>, ...args: string[]) {
  try {
    const { stdout, stderr } = await exec('sh', [join(cwd, 'radical.sh'), ...args], { cwd, env })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string }
    return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr }
  }
}

describe.skipIf(process.platform === 'win32')('radical.sh', () => {
  it('finds Node.js or downloads it once, checked against its sum, and runs the CLI through npx', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'radical-launcher-')))
    dirs.push(root)
    const project = join(root, 'project')
    await mkdir(project)
    await copyFile(LAUNCHER, join(project, 'radical.sh'))

    // A node too old on the PATH, with npx beside it.
    const old = join(root, 'old')
    await mkdir(old)
    await script(join(old, 'node'), 'exit 1')
    await script(join(old, 'npx'), 'echo "the old npx ran"')

    // A Node.js mirror: one build for this platform, and the sums.
    const name = `node-v24.99.0-${process.platform === 'darwin' ? 'darwin' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`
    const build = join(root, 'build', name, 'bin')
    await mkdir(build, { recursive: true })
    await script(join(build, 'node'), 'exit 0')
    await script(join(build, 'npx'), 'echo "npx $*"; echo "PATH=$PATH"; echo "LAUNCHER=$RADICAL_LAUNCHER"')
    const dist = join(root, 'mirror', 'latest-v24.x')
    await mkdir(dist, { recursive: true })
    await exec('tar', ['-czf', join(dist, `${name}.tar.gz`), '-C', join(root, 'build'), name])
    const sum = createHash('sha256').update(await readFile(join(dist, `${name}.tar.gz`))).digest('hex')
    const sums = `${'0'.repeat(64)}  node-v24.99.0-aix-ppc64.tar.gz\n${sum}  ${name}.tar.gz\n`
    await writeFile(join(dist, 'SHASUMS256.txt'), sums)

    const home = join(root, 'home')
    const env = { PATH: `${old}:/usr/bin:/bin`, HOME: home, RADICAL_NODE_MIRROR: `file://${root}/mirror` }
    const installed = join(home, '.radical', 'node', name)

    const first = await launch(project, env, 'setup', '--yes')
    expect(first.stderr).toContain(`Downloading ${name}`)
    expect(first.code).toBe(0)
    expect(first.stdout).toContain('npx -y @radicaltools/cli@latest setup --yes')
    expect(first.stdout).toContain(`PATH=${installed}/bin:`)
    expect(first.stdout).toContain(`LAUNCHER=${join(project, 'radical.sh')}`)
    expect(first.stdout).not.toContain('the old npx ran')

    // Downloaded once: the mirror is not asked again.
    await rename(join(root, 'mirror'), join(root, 'gone'))
    const again = await launch(project, env, '--version')
    expect(again.code).toBe(0)
    expect(again.stderr).not.toContain('Downloading')
    expect(again.stdout).toContain('npx -y @radicaltools/cli@latest --version')

    // mcp runs the MCP server with the arguments after it.
    const mcp = await launch(project, env, 'mcp', '--folder', 'architecture')
    expect(mcp.stdout).toContain('npx -y @radicaltools/mcp@latest --folder architecture')

    // Pinned by radical setup; RADICAL_VERSION picks another for one run.
    await writeFile(join(project, 'radical.sh'), pinLauncher(await readFile(join(project, 'radical.sh'), 'utf8'), '0.2.0'))
    expect((await launch(project, env, 'check')).stdout).toContain('npx -y @radicaltools/cli@0.2.0 check')
    expect((await launch(project, { ...env, RADICAL_VERSION: 'latest' }, 'check')).stdout).toContain('npx -y @radicaltools/cli@latest check')
    const cmd = await readFile(LAUNCHER_CMD, 'utf8')
    expect(pinLauncher(cmd, '0.2.0')).toBe(cmd.replace('set "DEFAULT_VERSION=latest"', 'set "DEFAULT_VERSION=0.2.0"'))

    // No terminal and no --yes, or mcp: nothing is downloaded.
    await rename(join(root, 'gone'), join(root, 'mirror'))
    const elsewhere = { ...env, HOME: join(root, 'other') }
    const unasked = await launch(project, elsewhere, 'setup')
    expect(unasked.code).toBe(1)
    expect(unasked.stderr).toContain('run it in a terminal or with --yes')
    const agent = await launch(project, elsewhere, 'mcp', '--folder', 'architecture', '--yes')
    expect(agent.code).toBe(1)
    expect(agent.stderr).toContain('run sh radical.sh setup in a terminal first')
    expect(existsSync(join(root, 'other', '.radical'))).toBe(false)

    // A build that does not match its sum is not unpacked.
    await writeFile(join(dist, 'SHASUMS256.txt'), sums.replace(sum, 'f'.repeat(64)))
    const bad = await launch(project, elsewhere, 'setup', '--yes')
    expect(bad.code).toBe(1)
    expect(bad.stderr).toContain(`${name}.tar.gz does not match its SHA-256 sum`)
    expect(existsSync(join(root, 'other', '.radical', 'node', name))).toBe(false)
  })
})
