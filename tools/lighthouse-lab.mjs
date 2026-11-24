#!/usr/bin/env node
// Sensor lighthouse-lab (.radical/sensors/sensors.json), for the fitness
// functions No lab regression on phones and No lab regression on desktops
// (Mobile and perceived performance pack, LAB=baseline). radical sense run
// --trigger nightly runs it once for each front end their ADR constrains,
// with the device the measure line names:
//
//   lighthouse-lab mobile     Lighthouse's mobile default
//   lighthouse-lab desktop    --settings.preset=desktop
//
// It serves the front end's build (the element's workspace: Studio's web
// build, the Hub's build, the static site) with Lighthouse CI's own static
// server, runs `lhci collect` three times on each of its main pages into a
// temporary directory, and reads the reports with the built-in adapter,
// `radical sense lighthouse`, into the metricsOut file of its --context:
// web.lab.lcp.max{device=mobile} and the rest, which radical sense run labels
// with the element. It builds nothing: the night's job builds Studio and the
// Hub (npm run build:web, npm run build:hub) and the CLI before it.
//
// By hand, without --context, it measures every front end (or those named
// with --front) and prints the values:
//
//   node tools/lighthouse-lab.mjs mobile [--front apps/hub] [--runs 3] [--out <dir>]
//
// Chrome: CHROME_PATH when set, else Playwright's Chromium (the one the
// e2e suite and the night's container have), else what Lighthouse CI finds.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { measuredElement, workspacesOf } from '../.radical/sensors/context.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** The web front ends by workspace: the directory their build is served
 *  from, how it is built, and the main pages measured (paths on the served
 *  directory; the Hub's and Studio's routes are in the hash, so each has
 *  one page: what a visitor opens first). */
export const FRONT_ENDS = {
  'apps/web': { dir: 'apps/web', build: null, pages: ['/', '/manual.html'] },
  'apps/hub': { dir: 'apps/hub/out', build: 'npm run build:hub', pages: ['/'] },
  'apps/studio': { dir: 'apps/studio/out/renderer', build: 'npm run build:web', pages: ['/'] },
}

export const DEVICES = ['mobile', 'desktop']

/** Lighthouse runs a page: the median of three evens out one run's noise. */
export const RUNS = 3

/** The command line: the device, --context <json>, --front <workspace>…,
 *  --runs <n>, --out <dir>. Throws on what it cannot read. */
export function readArgs(argv) {
  const out = { device: null, context: null, fronts: [], runs: RUNS, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`)
      return argv[++i]
    }
    if (a === '--context') out.context = JSON.parse(value())
    else if (a === '--front') out.fronts.push(value())
    else if (a === '--runs') out.runs = Number(value())
    else if (a === '--out') out.out = value()
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
    else if (out.device) throw new Error(`one device, not ${out.device} and ${a}`)
    else out.device = a
  }
  if (!DEVICES.includes(out.device)) throw new Error(`name the device: ${DEVICES.join(' or ')} (got ${out.device ?? 'none'})`)
  if (!Number.isInteger(out.runs) || out.runs < 1) throw new Error('--runs takes a whole number above 0')
  return out
}

/** The front ends to measure: the element's (its paths' workspaces) when
 *  radical sense run gives one, else those named, else all. Throws for a
 *  workspace that is no web front end. */
export function frontEndsFor(workspaces) {
  const names = workspaces === '*' || !workspaces.length ? Object.keys(FRONT_ENDS) : workspaces
  const unknown = names.filter((w) => !FRONT_ENDS[w])
  if (unknown.length) throw new Error(`${unknown.join(', ')} is no web front end this sensor measures (${Object.keys(FRONT_ENDS).join(', ')})`)
  return names.map((workspace) => ({ workspace, ...FRONT_ENDS[workspace] }))
}

/** The arguments of `lhci collect` for one front end on one device: its
 *  build served by Lighthouse CI (a localhost URL gets the server's port),
 *  each page `runs` times. Chrome runs without its sandbox, which a
 *  container's root user cannot have. */
export function collectArgs(front, device, runs = RUNS) {
  return [
    'collect',
    `--staticDistDir=${join(ROOT, front.dir)}`,
    ...front.pages.map((page) => `--url=http://localhost${page}`),
    `--numberOfRuns=${runs}`,
    '--settings.chromeFlags=--no-sandbox --disable-dev-shm-usage',
    ...(device === 'desktop' ? ['--settings.preset=desktop'] : []),
  ]
}

/** Playwright's Chromium, when it is installed. */
function playwrightChromium() {
  try {
    const path = require('playwright-core').chromium.executablePath()
    return existsSync(path) ? path : undefined
  } catch {
    return undefined
  }
}

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

/** Measures one front end on one device into `metricsOut`. */
function measure(front, device, runs, metricsOut, labels) {
  if (!existsSync(join(ROOT, front.dir, 'index.html'))) fail(`${front.workspace}: no build in ${front.dir}${front.build ? ` (run ${front.build} first)` : ''}`)
  const cli = join(ROOT, 'apps/cli/dist/index.js')
  if (!existsSync(cli)) fail('no CLI build in apps/cli/dist (run npm run build -w @radicaltools/cli first)')
  const work = mkdtempSync(join(tmpdir(), 'lighthouse-lab-'))
  try {
    const chrome = process.env.CHROME_PATH || playwrightChromium()
    console.log(`${front.workspace}, ${device}: ${front.pages.join(', ')}, ${runs} runs each${chrome ? ` (${chrome})` : ''}`)
    // lhci collect writes to .lighthouseci in its working directory.
    const collect = spawnSync(process.execPath, [require.resolve('@lhci/cli/src/cli.js'), ...collectArgs(front, device, runs)], {
      cwd: work, stdio: 'inherit', env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) },
    })
    if (collect.status !== 0) fail(`${front.workspace}: lhci collect exited with ${collect.status ?? collect.signal}`)
    const read = spawnSync(process.execPath, [cli, 'sense', 'lighthouse', join(work, '.lighthouseci'), '--out', metricsOut, ...labels.flatMap((l) => ['--label', l])], { cwd: ROOT, stdio: 'inherit' })
    if (read.status !== 0) fail(`${front.workspace}: radical sense lighthouse exited with ${read.status ?? read.signal}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/** The worst page's values of a radical-metrics/1 file, one a line. */
export function summary(file) {
  const { measurements } = JSON.parse(readFileSync(file, 'utf8'))
  return measurements
    .filter((m) => /\.(max|min)$/.test(m.metric))
    .map((m) => `  ${m.metric}{${Object.entries(m.labels ?? {}).map(([k, v]) => `${k}=${v}`).join(',')}} = ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
    .join('\n')
}

function main(argv) {
  let args
  try {
    args = readArgs(argv)
  } catch (error) {
    fail(`lighthouse-lab: ${error.message}`)
  }
  const { device, context, runs } = args
  if (context) {
    // radical sense run: the element's front end, into its metricsOut.
    const element = measuredElement(context)
    let fronts
    try { fronts = frontEndsFor(workspacesOf(element)) } catch (error) { fail(`${element.label}: ${error.message}`) }
    if (fronts.length !== 1) fail(`${element.label}: its paths are in ${fronts.length} front ends; one element, one front end`)
    measure(fronts[0], device, runs, context.metricsOut, [])
    console.log(summary(context.metricsOut))
    return
  }
  let fronts
  try { fronts = frontEndsFor(args.fronts) } catch (error) { fail(error.message) }
  const outDir = args.out ? resolve(args.out) : mkdtempSync(join(tmpdir(), 'lighthouse-lab-out-'))
  mkdirSync(outDir, { recursive: true })
  for (const front of fronts) {
    const file = join(outDir, `${front.workspace.replace(/\//g, '-')}-${device}.json`)
    measure(front, device, runs, file, [`front=${front.workspace}`])
    console.log(`${front.workspace}, ${device} → ${file}\n${summary(file)}`)
  }
}

// Run as a script (also through a symbolic link), not when a test imports it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main(process.argv.slice(2))
