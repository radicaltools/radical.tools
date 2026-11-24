#!/usr/bin/env node
// The launchers find or download Node.js (job Launcher of ci.yml, npm run
// test:launcher). They run the published CLI, so this checks that they work
// on this platform, not this commit's CLI:
//   - radical.sh with no Node.js on the PATH downloads it and prints the
//     version (macOS, Linux);
//   - radical.cmd with Node.js on the PATH, then with none on the PATH,
//     which downloads it into RADICAL_HOME (Windows).
// The downloads go under RUNNER_TEMP on a GitHub runner, else a new folder in
// the system's temporary folder.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')
const temp = process.env.RUNNER_TEMP || mkdtempSync(join(tmpdir(), 'radical-launcher-'))

function fail(message) {
  console.error(message)
  process.exit(1)
}

/** Runs a line in cmd.exe, as a `shell: cmd` step does. */
function cmd(line, env = process.env) {
  const comspec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'
  return spawnSync(comspec, ['/d', '/s', '/c', `"${line}"`], { cwd: ROOT, env, stdio: 'inherit', windowsVerbatimArguments: true }).status
}

if (process.platform === 'win32') {
  console.log('radical.cmd with Node.js on the PATH')
  if (cmd('call apps\\cli\\launcher\\radical.cmd --version') !== 0) fail('radical.cmd --version failed with Node.js on the PATH')

  console.log('radical.cmd with no Node.js on the PATH downloads it')
  const home = join(temp, 'radical')
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PATH'))
  Object.assign(env, { PATH: 'C:\\Windows\\System32;C:\\Windows', RADICAL_HOME: home, RADICAL_YES: '1' })
  if (cmd('call apps\\cli\\launcher\\radical.cmd --version', env) !== 0) fail('radical.cmd --version failed with no Node.js on the PATH')
  if (!existsSync(join(home, 'node'))) fail(`radical.cmd downloaded no Node.js into ${join(home, 'node')}`)
  console.log(readdirSync(join(home, 'node')).join('\n'))
} else {
  console.log('radical.sh with no Node.js on the PATH downloads it')
  const home = join(temp, 'home')
  const run = spawnSync('sh', ['apps/cli/launcher/radical.sh', '--version'], {
    cwd: ROOT,
    env: { HOME: home, PATH: '/usr/bin:/bin', RADICAL_YES: '1' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const out = run.stdout ?? ''
  console.log(out)
  if (run.status !== 0) fail(`radical.sh --version exited with ${run.status}`)
  if (!/^[0-9]+\.[0-9]+\.[0-9]+/m.test(out)) fail('radical.sh --version printed no version')
  if (!existsSync('/usr/bin/node') && !existsSync(join(home, '.radical/node'))) fail(`radical.sh downloaded no Node.js into ${join(home, '.radical/node')}`)
}
