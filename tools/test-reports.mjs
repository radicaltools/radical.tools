#!/usr/bin/env node
// Runs every workspace's tests as `npm test` does and keeps a Vitest JSON
// report of each in reports/<workspace>.json, for `radical check --report
// reports`. Run with `npm run test:reports`. Unlike `npm test` it goes on
// after a failing workspace, so every report is there; it exits 1 when any
// workspace failed. The e2e suite writes reports/e2e.json itself.

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPORTS = join(ROOT, 'reports')
mkdirSync(REPORTS, { recursive: true })

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const workspaces = rootPkg.workspaces.flatMap((pattern) => {
  const base = join(ROOT, pattern.replace(/\/\*$/, ''))
  return readdirSync(base).map((dir) => join(base, dir)).filter((dir) => existsSync(join(dir, 'package.json')))
})

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const failed = []
for (const dir of workspaces) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  if (!pkg.scripts?.test) continue
  const report = join(REPORTS, `${pkg.name.replace(/^@/, '').replace(/\//g, '-')}.json`)
  console.log(`\n▶ ${pkg.name}`)
  // Arguments after -- go to the end of the test script, which ends in `vitest run`.
  const run = spawnSync(npm, ['run', 'test', '--', '--reporter=default', '--reporter=json', `--outputFile.json=${report}`], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (run.status !== 0) failed.push(pkg.name)
}

if (failed.length) {
  console.error(`\nTests failed in ${failed.join(', ')}; the reports are in reports/.`)
  process.exit(1)
}
console.log('\nAll tests passed; the reports are in reports/.')
