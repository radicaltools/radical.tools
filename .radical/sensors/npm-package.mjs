#!/usr/bin/env node
// Sensor npm-package (.radical/sensors/sensors.json), for the fitness function
// Installable npm packages: npm run test:package of each workspace the
// element is built in, which packs it, installs the archive outside the
// monorepo and runs it. Run by radical sense run, once per element.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fail, measuredElement, sensorContext, workspacesOf } from './context.mjs'

const ROOT = join(import.meta.dirname, '../..')
const element = measuredElement(sensorContext())
const workspaces = workspacesOf(element)
if (workspaces === '*') fail(`${element.label}: no one npm package; name the packages' elements in the ADR`)
for (const dir of workspaces) {
  const pkg = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'))
  if (pkg.private === true || !pkg.scripts?.['test:package']) fail(`${element.label}: ${dir} is no published npm package with a test:package script.`)
  const run = spawnSync('npm', ['run', 'test:package', '-w', `./${dir}`], { cwd: ROOT, stdio: ['ignore', 2, 2], shell: process.platform === 'win32' })
  if (run.status !== 0) fail(`${element.label}: npm run test:package -w ./${dir} failed.`, run.status ?? 1)
}
console.log(`${element.label}: ${workspaces.join(', ')} installs and runs from its archive.`)
