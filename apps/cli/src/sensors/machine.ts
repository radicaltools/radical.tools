// The speed of the machine a value is measured on: a fixed piece of work,
// timed, against the same work on the reference machine, where the limits
// were set. A condition that ends in `scaled` has its limit stretched by
// this ratio (ADR Limits scaled to the machine). The reference is kept in
// the repository's .radical/radical.json ("machine"), in git.

import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { MACHINE_SPEED_METRIC, MACHINE_WORK_METRIC, commandWords } from '@radical/common/check'
import { REPOSITORY_FILE, parseRepositoryFile, serializeRepositoryFile, type RepositoryFile } from '@radical/common/repositoryMapping'
import { findRepositoryFile, repositoryRoot } from '@radical/node-files/repositoryLayout'
import type { SensorAdapter, SensorValue } from './types'

/** The reference a repository keeps in .radical/radical.json. */
export interface MachineReference {
  /** The work's median on the reference machine, in ms. */
  ms: number
  /** "builtin", or the command timed with --work. */
  work: string
  /** When it was measured (ISO time). */
  at: string
}

/** How long ago a measurement taken before the tests still counts for
 *  --again: one CI job, not yesterday's run. */
const AGAIN_WITHIN = 2 * 3600e3

/** The fixed work: arrays of samples built, averaged in windows, sorted and
 *  sent through JSON, much as a unit test of data code does. Its result is
 *  returned so that no engine can leave the work out. */
export function builtInWork(): number {
  const n = 20000
  const samples = Array.from({ length: n }, (_, i) => ({ t: i, v: 3 + Math.sin(i / 50), h: 120 + (i % 30) }))
  let sum = 0
  for (let k = 0; k < 40; k++) {
    const means: number[] = []
    for (let i = 0; i < n; i += 10) {
      let m = 0
      for (let j = i; j < i + 10 && j < n; j++) m += samples[j].v * (1 + k / 100)
      means.push(m / 10)
    }
    means.sort((a, b) => a - b)
    sum += means[means.length >> 1]
  }
  return sum + (JSON.parse(JSON.stringify(samples.slice(0, 5000))) as unknown[]).length
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const round1 = (n: number): number => Math.round(n * 10) / 10
const round2 = (n: number): number => Math.round(n * 100) / 100

/** The built-in work's median time: three runs to warm up, then `runs`. */
function timeBuiltIn(runs: number): number {
  for (let i = 0; i < 3; i++) builtInWork()
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    builtInWork()
    times.push(performance.now() - t0)
  }
  return median(times)
}

/** A command's median time: one run to warm up, then `runs`. */
async function timeCommand(command: string, runs: number, cwd: string): Promise<number> {
  const [cmd, ...args] = commandWords(command)
  if (!cmd) throw new Error('--work names no command')
  const once = () => new Promise<number>((done, fail) => {
    const t0 = performance.now()
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' })
    child.on('error', (error) => fail(new Error(`cannot run ${cmd}: ${error.message}`)))
    child.on('close', (status) => status === 0 ? done(performance.now() - t0) : fail(new Error(`${command} exited with ${status}`)))
  })
  await once()
  const times: number[] = []
  for (let i = 0; i < runs; i++) times.push(await once())
  return median(times)
}

/** The repository's .radical/radical.json from `cwd` up: where it is (or
 *  where a new one goes) and what it holds. */
async function repositoryFile(cwd: string): Promise<{ path: string; file: RepositoryFile | null }> {
  const found = await findRepositoryFile(cwd, REPOSITORY_FILE, REPOSITORY_FILE)
  if (found) return { path: found.path, file: parseRepositoryFile(await readFile(found.path, 'utf8'), found.path) }
  return { path: join(await repositoryRoot(cwd) ?? cwd, REPOSITORY_FILE), file: null }
}

/** The reference kept in a repository file, when it is one. */
export function readReference(file: RepositoryFile | null): MachineReference | null {
  const m = file?.machine as Partial<MachineReference> | undefined
  return m && typeof m.ms === 'number' && m.ms > 0 && typeof m.work === 'string' ? { ms: m.ms, work: m.work, at: typeof m.at === 'string' ? m.at : '' } : null
}

export const machineAdapter: SensorAdapter = {
  name: 'machine',
  description: 'times a fixed piece of work against the reference machine, for limits scaled to the machine',
  usage: `radical sense machine [--reference] [--again] [--work <command>] [--runs <n>]

  Times a fixed piece of work and measures it as machine.work (ms) and as
  machine.speed, its ratio to the reference time the repository keeps in
  .radical/radical.json ("machine"). A condition that ends in scaled
  (\`test.duration.max{kind=unit} <= 100 ms scaled\`) has its limit multiplied
  by the machine.speed measured nearest in time to its value (a lower limit
  divided), never below ×1.

  --reference       measure on the machine the limits were set on and keep the
                    time as the reference in .radical/radical.json (commit it)
  --again           run after the tests: keep the slower of this run and the
                    one measured before them (a shared runner's speed changes
                    while it works)
  --work <command>  time this command instead of Radical's own work (when the
                    limits depend on disk or network); the reference must have
                    been taken with the same command
  --runs <n>        how many timed runs the median is taken over (default 9
                    for the built-in work, 5 for a command)`,
  options: {
    reference: { type: 'boolean', default: false },
    again: { type: 'boolean', default: false },
    work: { type: 'string' },
    runs: { type: 'string' },
  },
  async measure({ args, options, cwd, previous }) {
    if (args.length) throw new Error(`takes no arguments: ${args.join(' ')}`)
    const command = typeof options.work === 'string' && options.work.trim() ? options.work.trim() : undefined
    const work = command ?? 'builtin'
    const runs = options.runs === undefined ? (command ? 5 : 9) : Number(options.runs)
    if (!Number.isInteger(runs) || runs < 1) throw new Error(`--runs ${String(options.runs)} is no whole number of runs`)
    const { path, file } = await repositoryFile(cwd)
    const reference = readReference(file)
    if (!options.reference) {
      if (!reference) throw new Error(`no reference time in ${REPOSITORY_FILE}: run radical sense machine --reference on the machine the limits were set on, and commit ${REPOSITORY_FILE}`)
      if (reference.work !== work) throw new Error(`the reference in ${REPOSITORY_FILE} was taken with ${reference.work === 'builtin' ? 'the built-in work' : `--work "${reference.work}"`}, not ${command ? `--work "${command}"` : 'the built-in work'}: time the same work, or take the reference again`)
    }
    let ms = command ? await timeCommand(command, runs, cwd) : timeBuiltIn(runs)
    if (options.again) {
      // The slower of this run and the latest one before the tests.
      const before = (previous ?? [])
        .filter((m) => m.metric === MACHINE_WORK_METRIC && m.labels.work === work && Date.now() - Date.parse(m.at) <= AGAIN_WITHIN)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
      if (before) ms = Math.max(ms, before.value)
    }
    ms = round1(ms)
    if (options.reference) {
      const next: RepositoryFile = { ...(file ?? { implements: [], verifies: [] }), machine: { ms, work, at: new Date().toISOString() } satisfies MachineReference }
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, serializeRepositoryFile(next))
    }
    const base = options.reference ? ms : reference!.ms
    const values: SensorValue[] = [
      { metric: MACHINE_WORK_METRIC, value: ms, unit: 'ms', labels: { work } },
      { metric: MACHINE_SPEED_METRIC, value: round2(ms / base) },
    ]
    return values
  },
  fixture: {
    args: [],
    options: { runs: '1' },
    files: {
      // A reference no machine reaches, so the fixture measures a speed.
      [REPOSITORY_FILE]: JSON.stringify({ machine: { ms: 1e-3, work: 'builtin', at: '2026-11-24T00:00:00.000Z' }, implements: [], verifies: [] }),
    },
  },
}
