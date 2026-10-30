// Values picked from a JSON file a tool wrote (a k6 summary, a bundle
// report, a coverage summary), each by its path.

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { SensorAdapter } from './types'

/** The value at `path` in `data`: a JSON pointer (`/metrics/http_req_duration/p(95)`)
 *  or dotted keys with [index] (`total.lines.pct`, `files[0].size`). */
export function valueAt(data: unknown, path: string): unknown {
  const keys = path.startsWith('/')
    ? path.slice(1).split('/').map((k) => k.replace(/~1/g, '/').replace(/~0/g, '~'))
    : path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let at: unknown = data
  for (const key of keys) {
    if (at === null || typeof at !== 'object') return undefined
    at = (at as Record<string, unknown>)[key]
  }
  return at
}

/** `<metric>=<path>[@<unit>]`. */
function parsePick(text: string): { metric: string; path: string; unit?: string } {
  const m = /^([A-Za-z_][\w.:/-]*)=(.+?)(?:@(\S+))?$/.exec(text)
  if (!m) throw new Error(`--metric ${text} is not <metric>=<path>[@<unit>]`)
  return { metric: m[1], path: m[2], ...(m[3] ? { unit: m[3] } : {}) }
}

export const jsonAdapter: SensorAdapter = {
  name: 'json',
  description: 'reads values from a JSON file by their paths',
  usage: `radical sense json <file> --metric <metric>=<path>[@<unit>] [--metric …]

  --metric   the metric's name, the value's path (dotted keys with [index],
             or a JSON pointer starting with /) and its unit, e.g.
             --metric api.latency.p95=/metrics/http_req_duration/p(95)@ms`,
  options: { metric: { type: 'string', multiple: true } },
  async measure({ args, options, cwd }) {
    if (args.length !== 1) throw new Error('name one JSON file')
    const picks = ((options.metric as string[] | undefined) ?? []).map(parsePick)
    if (!picks.length) throw new Error('no --metric to read')
    let data: unknown
    try { data = JSON.parse(await readFile(resolve(cwd, args[0]), 'utf8')) } catch (error) {
      throw new Error(`cannot read ${args[0]}: ${(error as NodeJS.ErrnoException).code === 'ENOENT' ? 'no such file' : (error as Error).message}`)
    }
    return picks.map((p) => {
      const value = valueAt(data, p.path)
      const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new Error(`${args[0]} has no number at ${p.path}`)
      return { metric: p.metric, value: number, ...(p.unit ? { unit: p.unit } : {}) }
    })
  },
  fixture: {
    // A k6 --summary-export, cut down.
    args: ['summary.json'],
    options: { metric: ['api.latency.p95=/metrics/http_req_duration/p(95)@ms', 'api.checks.passes=metrics.checks.passes'] },
    files: { 'summary.json': JSON.stringify({ metrics: { http_req_duration: { avg: 112.4, 'p(90)': 201.3, 'p(95)': 248.9 }, checks: { passes: 1200, fails: 0 } } }) },
  },
}
