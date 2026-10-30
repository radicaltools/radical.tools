// A browser benchmark's measurements: runs Playwright on a spec, which
// writes what it measured as radical-metrics/1 files into the directory
// RADICAL_METRICS_DIR names, under the metric names its fitness function's
// conditions use (apps/e2e/tests/studio/scale.spec.ts). The spec knows what
// it measures; nothing maps its output.

import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { commandWords, parseMetricsFile } from '@radical/common/check'
import type { SensorAdapter, SensorValue } from './types'

const RUNNER = 'npx playwright test'

function envPairs(list: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of Array.isArray(list) ? list : []) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(String(item))
    if (!m) throw new Error(`--env ${String(item)} is not <NAME>=<value>`)
    out[m[1]] = m[2]
  }
  return out
}

export const playwrightAdapter: SensorAdapter = {
  name: 'playwright',
  description: 'runs Playwright on a spec and reads the radical-metrics/1 files it writes into RADICAL_METRICS_DIR',
  usage: `radical sense playwright <spec>… [--cwd <dir>] [--project <name>] [--env NAME=value]… [--runner <command>]

  --cwd <dir>        where Playwright runs (its config is found there), relative
                     to the working directory
  --project <name>   the Playwright project
  --env NAME=value   an environment variable for the spec; repeat for more
  --runner <cmd>     the command that runs Playwright (default: ${RUNNER})
  The spec writes its measurements as radical-metrics/1 files into the
  directory RADICAL_METRICS_DIR names; a run that wrote none measured nothing.`,
  options: {
    cwd: { type: 'string' },
    project: { type: 'string' },
    env: { type: 'string', multiple: true },
    runner: { type: 'string' },
  },
  async measure({ args, options, cwd }) {
    if (!args.length) throw new Error('no spec to run')
    const dir = resolve(cwd, typeof options.cwd === 'string' ? options.cwd : '.')
    const env = envPairs(options.env)
    const [command, ...runnerArgs] = commandWords(typeof options.runner === 'string' && options.runner ? options.runner : RUNNER)
    const out = await mkdtemp(join(tmpdir(), 'radical-playwright-'))
    try {
      const project = typeof options.project === 'string' && options.project ? [`--project=${options.project}`] : []
      const code = await new Promise<number>((done, fail) => {
        const child = spawn(command, [...runnerArgs, ...args, ...project], {
          cwd: dir,
          env: { ...process.env, ...env, RADICAL_METRICS_DIR: out },
          stdio: ['ignore', 'pipe', 'inherit'],
          shell: process.platform === 'win32',
        })
        // stdout belongs to radical sense.
        child.stdout?.pipe(process.stderr)
        child.on('error', (error) => fail(new Error(`cannot run ${command}: ${error.message}`)))
        child.on('close', (status, signal) => done(status ?? (signal ? 128 : 1)))
      })
      const files = (await readdir(out)).filter((f) => f.endsWith('.json')).sort()
      const values: SensorValue[] = []
      for (const file of files) {
        for (const m of parseMetricsFile(await readFile(join(out, file), 'utf8'), file)) {
          values.push({ metric: m.metric, value: m.value, ...(m.unit ? { unit: m.unit } : {}), ...(Object.keys(m.labels).length ? { labels: m.labels } : {}) })
        }
      }
      if (!values.length) throw new Error(`the run (exit code ${code}) wrote no radical-metrics/1 file into RADICAL_METRICS_DIR`)
      return values
    } finally {
      await rm(out, { recursive: true, force: true })
    }
  },
  fixture: {
    args: ['tests/fixture.spec.ts'],
    options: { runner: `"${process.execPath}" runner.mjs`, env: ['FIXTURE_MS=1234'] },
    files: {
      // Stands in for Playwright: writes what a spec would.
      'runner.mjs': `import { writeFileSync } from 'node:fs'
writeFileSync(process.env.RADICAL_METRICS_DIR + '/spec.json', JSON.stringify({
  format: 'radical-metrics', version: 1, source: 'fixture.spec.ts', at: new Date().toISOString(),
  measurements: [{ metric: 'fixture.open_ms', value: Number(process.env.FIXTURE_MS), unit: 'ms' }],
}))
`,
    },
  },
}
